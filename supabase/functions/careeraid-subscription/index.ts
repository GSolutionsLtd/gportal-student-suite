// CareerAid Clinic subscription: initialise a Paystack payment for an independent
// (school-free) learner and verify it afterwards, activating a 12-month plan.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");

const PRICE_NAIRA = 5000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    if (action === "initialize") {
      const fullName = String(body.full_name ?? "").trim();
      const phone = body.phone ? String(body.phone).trim() : null;
      const classLevel = body.class_level ? String(body.class_level).trim() : null;
      const state = body.state_of_residence ? String(body.state_of_residence).trim() : null;
      const callbackUrl = String(body.callback_url ?? "");
      if (fullName.length < 2 || fullName.length > 120) return json({ error: "Enter your full name" }, 400);
      if (!/^https?:\/\//.test(callbackUrl)) return json({ error: "Invalid callback URL" }, 400);
      if (!PAYSTACK_SECRET_KEY) return json({ error: "Payments are not configured yet" }, 503);

      const reference = `CAID-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;

      const { error: insErr } = await admin.from("careeraid_subscriptions").insert({
        user_id: user.id,
        full_name: fullName,
        email: user.email,
        phone,
        class_level: classLevel,
        state_of_residence: state,
        amount: PRICE_NAIRA,
        status: "pending",
        paystack_reference: reference,
      });
      if (insErr) return json({ error: insErr.message }, 500);

      const psResp = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          amount: PRICE_NAIRA * 100,
          reference,
          callback_url: callbackUrl,
          metadata: { purpose: "careeraid_subscription", user_id: user.id },
        }),
      });
      const ps = await psResp.json();
      if (!psResp.ok || !ps?.status) return json({ error: ps?.message || "Could not start payment" }, 502);

      return json({ authorization_url: ps.data.authorization_url, reference });
    }

    if (action === "verify") {
      const reference = String(body.reference ?? "").trim();
      if (!/^[A-Za-z0-9-]{6,64}$/.test(reference)) return json({ error: "Invalid reference" }, 400);
      if (!PAYSTACK_SECRET_KEY) return json({ error: "Payments are not configured yet" }, 503);

      const { data: sub } = await admin
        .from("careeraid_subscriptions")
        .select("id, user_id, status")
        .eq("paystack_reference", reference)
        .maybeSingle();
      if (!sub || sub.user_id !== user.id) return json({ error: "Subscription not found" }, 404);
      if (sub.status === "active") return json({ status: "active" });

      const vr = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      });
      const v = await vr.json();
      if (!vr.ok || v?.data?.status !== "success") return json({ status: "pending", error: "Payment not successful yet" }, 402);

      const now = new Date();
      const expires = new Date(now);
      expires.setFullYear(expires.getFullYear() + 1);

      const { error: upErr } = await admin.from("careeraid_subscriptions").update({
        status: "active", starts_at: now.toISOString(), expires_at: expires.toISOString(),
      }).eq("id", sub.id);
      if (upErr) return json({ error: upErr.message }, 500);

      return json({ status: "active", expires_at: expires.toISOString() });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
