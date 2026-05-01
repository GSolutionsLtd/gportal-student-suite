import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SignupRole = "admin" | "teacher" | "student" | "parent";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, email, fullName, role, schoolId, teacher } = await req.json();

    if (!userId || !email || !fullName || !role || !schoolId) {
      throw new Error("Missing required signup details.");
    }

    const allowedRoles: SignupRole[] = ["admin", "teacher", "student", "parent"];
    if (!allowedRoles.includes(role)) {
      throw new Error("This role cannot be created from public signup.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
    if (userError || !userData.user) throw new Error("Unable to verify the new account.");
    if (userData.user.email?.toLowerCase() !== String(email).toLowerCase()) {
      throw new Error("Signup verification failed.");
    }

    const { data: school, error: schoolError } = await admin
      .from("schools")
      .select("id, subscription_status")
      .eq("id", schoolId)
      .maybeSingle();

    if (schoolError || !school) throw new Error("Selected school was not found.");
    if (!["trial", "active"].includes(school.subscription_status)) {
      throw new Error("Selected school is not available for signup.");
    }

    const { data: existingRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingRole && existingRole.role !== role) {
      throw new Error("This account already has a different role.");
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      email,
      full_name: fullName,
    });
    if (profileError) throw profileError;

    if (!existingRole) {
      const { error } = await admin.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    }

    if (role === "admin") {
      const { data: existingAdmin } = await admin
        .from("school_admins")
        .select("id, user_id")
        .eq("school_id", schoolId)
        .eq("is_primary", true)
        .maybeSingle();

      if (existingAdmin && existingAdmin.user_id !== userId) {
        throw new Error("This school already has a primary Admin. Ask the Super Admin to reassign it.");
      }

      if (!existingAdmin) {
        const { error } = await admin.from("school_admins").insert({
          user_id: userId,
          school_id: schoolId,
          is_primary: true,
        });
        if (error) throw error;
      }
    }

    if (role === "parent") {
      const { data: existingMembership } = await admin
        .from("parent_school_memberships")
        .select("id")
        .eq("parent_user_id", userId)
        .eq("school_id", schoolId)
        .maybeSingle();

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
      const { data: existingStudent } = await admin
        .from("students")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

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

      const { data: existingTeacher } = await admin
        .from("teachers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

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

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Signup completion failed" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
