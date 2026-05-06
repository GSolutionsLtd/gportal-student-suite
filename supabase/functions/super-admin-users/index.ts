import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suspend"), userId: z.string().uuid() }),
  z.object({ action: z.literal("activate"), userId: z.string().uuid() }),
  z.object({ action: z.literal("delete"), userId: z.string().uuid() }),
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const firstError = Object.values(flat.fieldErrors).flat()[0] || flat.formErrors[0] || "Invalid user action.";
      return json({ error: firstError }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerData, error: callerError } = await authClient.auth.getUser();
    if (callerError || !callerData.user) return json({ error: "Unauthorized" }, 401);

    const { data: callerRole, error: callerRoleError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerData.user.id)
      .maybeSingle();
    if (callerRoleError) throw callerRoleError;
    if (callerRole?.role !== "super_admin") {
      return json({ error: "Only Super Admins can manage suspect users." }, 403);
    }

    const { action, userId } = parsed.data;
    if (userId === callerData.user.id) {
      return json({ error: "You cannot manage your own Super Admin account here." }, 400);
    }

    const { data: targetRole, error: targetRoleError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    if (targetRoleError) throw targetRoleError;
    if (targetRole?.role === "super_admin") {
      return json({ error: "Super Admin accounts cannot be suspended or deleted here." }, 400);
    }

    if (action === "suspend" || action === "activate") {
      const { error } = await admin
        .from("profiles")
        .update({ is_active: action === "activate" })
        .eq("id", userId);
      if (error) throw error;
      return json({ ok: true, status: action === "activate" ? "active" : "suspended" });
    }

    await admin.from("school_admins").delete().eq("user_id", userId);
    await admin.from("parent_school_memberships").delete().eq("parent_user_id", userId);
    await admin.from("parent_students").delete().eq("parent_user_id", userId);
    await admin.from("teachers").delete().eq("user_id", userId);
    await admin.from("students").update({ user_id: null }).eq("user_id", userId);
    await admin.from("notifications").delete().eq("user_id", userId);
    await admin.from("notification_preferences").delete().eq("user_id", userId);
    await admin.from("user_roles").delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("id", userId);

    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);
    if (deleteAuthError) throw deleteAuthError;

    return json({ ok: true, status: "deleted" });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "User management action failed" }, 400);
  }
});
