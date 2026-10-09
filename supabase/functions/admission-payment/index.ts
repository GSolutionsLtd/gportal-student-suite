import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    // Admission fees go to the school's own Paystack account
    const schoolSecret = async (schoolId: string) => {
      const { data } = await db.from("school_payment_secrets").select("paystack_secret_key").eq("school_id", schoolId).maybeSingle();
      return data?.paystack_secret_key as string | undefined;
    };

    if (action === "init") {
      const num = String(body.application_number || "").trim().toUpperCase();
      const email = String(body.email || "").trim().toLowerCase();
      const callback = String(body.callback_url || "");
      if (!/^ADM-\d{4}-[A-Z0-9]{6}$/.test(num) || !email || !/^https?:\/\//.test(callback)) {
        return json({ error: "Invalid request" }, 400);
      }
      const { data: app } = await db.from("admission_applications")
        .select("id, school_id, guardian_email, payment_status").eq("application_number", num).maybeSingle();
      if (!app || app.guardian_email !== email) return json({ error: "Application not found" }, 404);
      if (app.payment_status === "paid") return json({ error: "Already paid" }, 400);
      const { data: settings } = await db.from("admission_settings").select("application_fee").eq("school_id", app.school_id).maybeSingle();
      const fee = Number(settings?.application_fee || 0);
      if (fee <= 0) return json({ error: "No application fee required" }, 400);
      const secret = await schoolSecret(app.school_id);
      if (!secret) return json({ error: "This school has not set up online payment yet" }, 503);
      const reference = `ADMFEE-${num}-${Date.now()}`;
      const r = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email, amount: Math.round(fee * 100), reference, callback_url: callback,
          metadata: { type: "admission_fee", application_id: app.id } }),
      });
      const p = await r.json();
      if (!p.status) return json({ error: p.message || "Payment init failed" }, 502);
      await db.from("admission_applications").update({ payment_reference: reference }).eq("id", app.id);
      return json({ authorization_url: p.data.authorization_url, reference });
    }

    if (action === "verify") {
      const reference = String(body.reference || "");
      if (!/^ADMFEE-[A-Z0-9-]+$/.test(reference)) return json({ error: "Invalid reference" }, 400);
      const { data: refApp } = await db.from("admission_applications").select("school_id").eq("payment_reference", reference).maybeSingle();
      if (!refApp) return json({ error: "Application not found" }, 404);
      const secret = await schoolSecret(refApp.school_id);
      if (!secret) return json({ paid: false });
      const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const p = await r.json();
      if (!p.status || p.data?.status !== "success") return json({ paid: false });
      const { data: app } = await db.from("admission_applications").select("id, school_id")
        .eq("payment_reference", reference).maybeSingle();
      if (!app) return json({ error: "Application not found" }, 404);
      const { data: settings } = await db.from("admission_settings").select("application_fee").eq("school_id", app.school_id).maybeSingle();
      if (p.data.amount < Math.round(Number(settings?.application_fee || 0) * 100)) return json({ paid: false });
      await db.from("admission_applications").update({
        payment_status: "paid", amount_paid: p.data.amount / 100, paid_at: new Date().toISOString(),
      }).eq("id", app.id);
      return json({ paid: true });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
