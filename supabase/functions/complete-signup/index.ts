import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SignupRole = "admin" | "teacher" | "student" | "parent";

const BodySchema = z
  .object({
    userId: z.string().uuid(),
    email: z.string().email().max(255),
    fullName: z.string().trim().min(2).max(150),
    role: z.enum(["admin", "teacher", "student", "parent"]),
    schoolId: z.string().uuid().optional(),
    inviteCode: z.string().trim().min(6).max(32).optional(),
    teacher: z
      .object({
        staff_id: z.string().trim().min(1).max(50),
        is_class_teacher: z.boolean().optional(),
        is_form_teacher: z.boolean().optional(),
        signature_url: z.string().url().nullable().optional(),
      })
      .optional(),
  })
  .refine(
    (d) =>
      (d.role === "admin" && (!!d.inviteCode || !!d.schoolId)) ||
      (d.role !== "admin" && !!d.schoolId),
    {
      message:
        "Admins must provide an invite code or select an eligible school; other roles must select a school.",
    }
  );

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let admin: ReturnType<typeof createClient> | null = null;
  let cleanupUserId: string | null = null;

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const firstError =
        Object.values(flat.fieldErrors).flat()[0] ||
        flat.formErrors[0] ||
        "Invalid signup details.";
      return json({ error: firstError }, 400);
    }

    const { userId, email, fullName, role, teacher } = parsed.data;
    let { schoolId } = parsed.data;
    const inviteCode = parsed.data.inviteCode?.trim().toUpperCase();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
    if (userError || !userData.user) throw new Error("Unable to verify the new account.");
    if (userData.user.email?.toLowerCase() !== String(email).toLowerCase()) {
      throw new Error("Signup verification failed.");
    }

    const createdAt = userData.user.created_at ? new Date(userData.user.created_at).getTime() : 0;
    const isRecentSignup = Date.now() - createdAt < 30 * 60 * 1000;
    cleanupUserId = isRecentSignup ? userId : null;

    // When email confirmation is required, signUp returns no session, so the
    // client invocation sends only the anon key. We still verified the new user
    // via admin.getUserById above. Only enforce session-bearer match for
    // non-recent signups (e.g. retry flows on an existing user).
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const hasUserBearer = bearer && bearer !== anonKey;

    if (hasUserBearer) {
      const authClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      });
      const { data: sessionUser, error: sessionError } = await authClient.auth.getUser();
      if (sessionError || !sessionUser.user || sessionUser.user.id !== userId) {
        if (!isRecentSignup) {
          throw new Error("Signup session could not be verified. Please sign up again.");
        }
      }
    } else if (!isRecentSignup) {
      throw new Error("Signup session is missing. Please sign up again.");
    }

    const { data: existingRole, error: existingRoleError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    if (existingRoleError) throw existingRoleError;

    if (existingRole && existingRole.role !== role) {
      throw new Error("This account already has a different role.");
    }
    if (existingRole) cleanupUserId = null;

    let inviteRow: { id: string; school_id: string; email: string | null } | null = null;
    if (role === "admin") {
      if (inviteCode) {
        const { data: inv, error: invErr } = await admin
          .from("admin_invites")
          .select("id, school_id, email, used_at, expires_at")
          .eq("code", inviteCode)
          .maybeSingle();
        if (invErr) throw invErr;
        if (!inv) throw new Error("Invite code is invalid.");
        if (inv.used_at) throw new Error("This invite has already been used.");
        if (new Date(inv.expires_at).getTime() < Date.now()) throw new Error("This invite has expired.");
        if (inv.email && inv.email.toLowerCase() !== email.toLowerCase()) {
          throw new Error("This invite was issued for a different email address.");
        }
        schoolId = inv.school_id;
        inviteRow = { id: inv.id, school_id: inv.school_id, email: inv.email };
      } else if (!schoolId) {
        throw new Error("Select an eligible school or enter a valid Admin invite code.");
      }
    }

    if (!schoolId) throw new Error("A school must be selected.");

    const { data: school, error: schoolError } = await admin
      .from("schools")
      .select("id, subscription_status")
      .eq("id", schoolId)
      .maybeSingle();
    if (schoolError || !school) throw new Error("Selected school was not found.");
    if (!["trial", "active"].includes(school.subscription_status)) {
      throw new Error("Selected school is not available for signup.");
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      email,
      full_name: fullName,
      is_active: true,
    });
    if (profileError) throw profileError;

    if (role === "admin") {
      const { data: primaryAdmin, error: primaryError } = await admin
        .from("school_admins")
        .select("id, user_id")
        .eq("school_id", schoolId)
        .eq("is_primary", true)
        .maybeSingle();
      if (primaryError) throw primaryError;

      if (primaryAdmin && primaryAdmin.user_id !== userId) {
        throw new Error("This school already has a primary Admin. Ask the Super Admin to reassign it.");
      }

      const { data: existingForUser, error: existingAdminError } = await admin
        .from("school_admins")
        .select("id, school_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (existingAdminError) throw existingAdminError;

      if (existingForUser && existingForUser.school_id !== schoolId) {
        throw new Error("This account is already linked to a different school as Admin.");
      }

      if (!primaryAdmin && !existingForUser) {
        const { error } = await admin.from("school_admins").insert({
          user_id: userId,
          school_id: schoolId,
          is_primary: true,
        });
        if (error) throw new Error(`Failed to link Admin to school: ${error.message}`);
      } else if (existingForUser && existingForUser.school_id === schoolId) {
        const { error } = await admin
          .from("school_admins")
          .update({ is_primary: true })
          .eq("id", existingForUser.id);
        if (error) throw new Error(`Failed to update Admin school link: ${error.message}`);
      }
    }

    if (role === "parent") {
      const { data: existingMembership, error: membershipLookupError } = await admin
        .from("parent_school_memberships")
        .select("id")
        .eq("parent_user_id", userId)
        .eq("school_id", schoolId)
        .maybeSingle();
      if (membershipLookupError) throw membershipLookupError;

      if (!existingMembership) {
        const { error } = await admin.from("parent_school_memberships").insert({
          parent_user_id: userId,
          school_id: schoolId,
          is_primary: true,
        });
        if (error) throw error;
      }
    }

    if (role === "student") {
      const [firstName, ...rest] = String(fullName).trim().split(/\s+/);
      const { data: existingStudent, error: studentLookupError } = await admin
        .from("students")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (studentLookupError) throw studentLookupError;

      const payload = {
        user_id: userId,
        first_name: firstName || fullName,
        last_name: rest.join(" ") || firstName || fullName,
        school_id: schoolId,
        admission_number: `PENDING-${userId.slice(0, 8).toUpperCase()}`,
      };

      const { error } = existingStudent
        ? await admin.from("students").update(payload).eq("id", existingStudent.id)
        : await admin.from("students").insert(payload);
      if (error) throw error;
    }

    if (role === "teacher") {
      if (!teacher?.staff_id) throw new Error("Staff ID is required for teacher signup.");

      const { data: existingTeacher, error: teacherLookupError } = await admin
        .from("teachers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (teacherLookupError) throw teacherLookupError;

      const payload = {
        user_id: userId,
        staff_id: String(teacher.staff_id).trim().toUpperCase(),
        date_joined: new Date().toISOString().slice(0, 10),
        is_active: true,
        is_class_teacher: !!teacher.is_class_teacher,
        is_form_teacher: !!teacher.is_form_teacher,
        signature_url: teacher.signature_url ?? null,
        school_id: schoolId,
      };

      const { error } = existingTeacher
        ? await admin.from("teachers").update(payload).eq("id", existingTeacher.id)
        : await admin.from("teachers").insert(payload);
      if (error) throw error;
    }

    if (!existingRole) {
      const { error } = await admin.from("user_roles").insert({ user_id: userId, role });
      if (error) throw new Error(`Failed to assign role: ${error.message}`);
    }

    if (role === "admin" && inviteRow) {
      const { error } = await admin
        .from("admin_invites")
        .update({ used_at: new Date().toISOString(), used_by: userId })
        .eq("id", inviteRow.id)
        .is("used_at", null);
      if (error) throw new Error(`Failed to mark invite as used: ${error.message}`);
    }

    cleanupUserId = null;
    return json({ ok: true });
  } catch (error) {
    if (admin && cleanupUserId) {
      try {
        await admin.from("user_roles").delete().eq("user_id", cleanupUserId);
        await admin.from("school_admins").delete().eq("user_id", cleanupUserId);
        await admin.from("parent_school_memberships").delete().eq("parent_user_id", cleanupUserId);
        await admin.from("teachers").delete().eq("user_id", cleanupUserId);
        await admin.from("students").update({ user_id: null }).eq("user_id", cleanupUserId);
        await admin.from("profiles").delete().eq("id", cleanupUserId);
        await admin.auth.admin.deleteUser(cleanupUserId);
      } catch (cleanupError) {
        console.error("Signup cleanup failed", cleanupError);
      }
    }

    return json(
      { error: error instanceof Error ? error.message : "Signup completion failed" },
      400
    );
  }
});
