import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list-schools") }),
  z.object({ action: z.literal("list-invites"), schoolId: z.string().uuid() }),
  z.object({ action: z.literal("validate"), inviteCode: z.string().trim().min(6).max(32) }),
  z.object({
    action: z.literal("create"),
    schoolId: z.string().uuid(),
    email: z.string().trim().email().max(255).optional().or(z.literal("")),
  }),
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 12; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const firstError = Object.values(flat.fieldErrors).flat()[0] || flat.formErrors[0] || "Invalid request.";
      return json({ error: firstError }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    if (parsed.data.action === "list-schools") {
      const [{ data: schools, error: schoolsError }, { data: primaryAdmins, error: adminsError }] = await Promise.all([
        admin
          .from("schools")
          .select("id, code, name, subscription_status")
          .in("subscription_status", ["trial", "active"])
          .order("name", { ascending: true }),
        admin.from("school_admins").select("school_id").eq("is_primary", true),
      ]);
      if (schoolsError) throw schoolsError;
      if (adminsError) throw adminsError;

      const assigned = new Set((primaryAdmins || []).map((row) => row.school_id));
      return json({
        schools: (schools || []).map((school) => ({
          ...school,
          admin_available: !assigned.has(school.id),
        })),
      });
    }

    if (parsed.data.action === "validate") {
      const { data, error } = await admin.rpc("validate_admin_invite", {
        _code: parsed.data.inviteCode.trim().toUpperCase(),
      });
      if (error) throw error;
      return json({ invite: Array.isArray(data) && data.length > 0 ? data[0] : null });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

    const { data: roleRow, error: roleError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (roleError) throw roleError;
    if (roleRow?.role !== "super_admin") return json({ error: "Only Super Admins can create school Admin invites." }, 403);

    if (parsed.data.action === "list-invites") {
      const { data, error } = await admin
        .from("admin_invites")
        .select("id, code, email, expires_at, used_at, created_at")
        .eq("school_id", parsed.data.schoolId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ invites: data || [] });
    }

    const { data: school, error: schoolError } = await admin
      .from("schools")
      .select("id, name, code, subscription_status")
      .eq("id", parsed.data.schoolId)
      .maybeSingle();
    if (schoolError) throw schoolError;
    if (!school) return json({ error: "Selected school was not found." }, 404);
    if (!["trial", "active"].includes(school.subscription_status)) {
      return json({ error: "Only active or trial schools can receive an Admin invite." }, 400);
    }

    const { data: primaryAdmin, error: primaryError } = await admin
      .from("school_admins")
      .select("id")
      .eq("school_id", parsed.data.schoolId)
      .eq("is_primary", true)
      .maybeSingle();
    if (primaryError) throw primaryError;
    if (primaryAdmin) return json({ error: "This school already has a primary Admin." }, 400);

    let inserted: { code: string; expires_at: string } | null = null;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      const { data, error } = await admin
        .from("admin_invites")
        .insert({
          code: generateCode(),
          school_id: parsed.data.schoolId,
          email: parsed.data.email ? parsed.data.email.toLowerCase() : null,
          created_by: userData.user.id,
        })
        .select("code, expires_at")
        .single();
      if (error) {
        if (String(error.message).toLowerCase().includes("duplicate")) continue;
        throw error;
      }
      inserted = data;
    }

    if (!inserted) return json({ error: "Could not generate a unique invite code. Try again." }, 500);
    return json({ invite: { ...inserted, school_name: school.name, school_code: school.code } });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invite request failed" }, 400);
  }
});
