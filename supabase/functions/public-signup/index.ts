// School-independent public signup: CareerAid learners and Career Counselors.
// Verifies the freshly created auth user server-side, then provisions the role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body.userId ?? "");
    const email = String(body.email ?? "").toLowerCase();
    const fullName = String(body.fullName ?? "").trim();
    const kind = String(body.kind ?? ""); // "careeraid" | "counselor"
    const phone = body.phone ? String(body.phone).trim().slice(0, 30) : null;

    if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: "Invalid account reference." }, 400);
    if (!email.includes("@")) return json({ error: "Invalid email." }, 400);
    if (fullName.length < 2 || fullName.length > 150) return json({ error: "Enter your full name." }, 400);
    if (kind !== "careeraid" && kind !== "counselor") return json({ error: "Unknown signup type." }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId);
    if (userErr || !userData.user) return json({ error: "Unable to verify the new account." }, 400);
    if (userData.user.email?.toLowerCase() !== email) return json({ error: "Signup verification failed." }, 400);

    const createdAt = userData.user.created_at ? new Date(userData.user.created_at).getTime() : 0;
    if (Date.now() - createdAt > 30 * 60 * 1000) return json({ error: "This account already exists. Please sign in." }, 400);

    // Never take over an account that already belongs to a school role.
    const { data: existingRole } = await admin
      .from("user_roles").select("role").eq("user_id", userId).maybeSingle();
    if (existingRole && existingRole.role !== "counselor") {
      return json({ error: "This account already has a different role." }, 400);
    }

    await admin.from("profiles").upsert(
      { id: userId, email, full_name: fullName },
      { onConflict: "id" },
    );

    if (kind === "counselor" && !existingRole) {
      const { error: roleErr } = await admin.from("user_roles").insert({ user_id: userId, role: "counselor" });
      if (roleErr) return json({ error: roleErr.message }, 500);
    }

    if (kind === "careeraid") {
      // Placeholder subscription record so the portal can show the payment gate.
      const { data: sub } = await admin
        .from("careeraid_subscriptions").select("id").eq("user_id", userId).maybeSingle();
      if (!sub) {
        await admin.from("careeraid_subscriptions").insert({
          user_id: userId, full_name: fullName, email, phone, amount: 5000, status: "pending",
        });
      }
    }

    return json({ ok: true, kind });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
