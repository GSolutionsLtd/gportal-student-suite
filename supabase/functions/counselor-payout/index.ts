// Real Paystack payouts for career counselors.
// Actions: banks | resolve_account | save_bank | withdraw
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

const ps = async (path: string, init?: RequestInit) => {
  const resp = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await resp.json().catch(() => ({}));
  return { ok: resp.ok && body?.status !== false, body };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!PAYSTACK_SECRET_KEY) return json({ error: "Payments are not configured yet" }, 503);

    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isCounselor } = await admin.rpc("has_role", { _user_id: user.id, _role: "counselor" });
    if (!isCounselor) return json({ error: "Only career counselors can use payouts" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    if (action === "banks") {
      const { ok, body: b } = await ps("/bank?currency=NGN&perPage=100");
      if (!ok) return json({ error: b?.message || "Could not load banks" }, 502);
      const banks = (b.data as any[]).map((x) => ({ name: x.name, code: x.code }))
        .sort((a, b2) => a.name.localeCompare(b2.name));
      return json({ banks });
    }

    if (action === "save_bank") {
      const bankCode = String(body.bank_code ?? "").trim();
      const bankName = String(body.bank_name ?? "").trim();
      const accountNumber = String(body.account_number ?? "").trim();
      if (!/^\d{3}$/.test(bankCode)) return json({ error: "Select a valid bank" }, 400);
      if (!/^\d{10}$/.test(accountNumber)) return json({ error: "Account number must be 10 digits" }, 400);

      const resolved = await ps(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);
      if (!resolved.ok) return json({ error: resolved.body?.message || "Could not verify this account" }, 400);
      const accountName = resolved.body.data.account_name as string;

      const recipient = await ps("/transferrecipient", {
        method: "POST",
        body: JSON.stringify({
          type: "nuban",
          name: accountName,
          account_number: accountNumber,
          bank_code: bankCode,
          currency: "NGN",
        }),
      });
      if (!recipient.ok) return json({ error: recipient.body?.message || "Could not save payout account" }, 502);

      const { error } = await admin.from("counselor_profiles").update({
        bank_code: bankCode,
        bank_name: bankName || resolved.body.data.bank_name || null,
        account_number: accountNumber,
        account_name: accountName,
        paystack_recipient_code: recipient.body.data.recipient_code,
      }).eq("user_id", user.id);
      if (error) return json({ error: error.message }, 500);

      return json({ account_name: accountName });
    }

    if (action === "withdraw") {
      const { data: profile } = await admin
        .from("counselor_profiles")
        .select("status, account_name, paystack_recipient_code")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile?.paystack_recipient_code) {
        return json({ error: "Add your bank payout account before withdrawing" }, 400);
      }
      if (profile.status !== "approved") {
        return json({ error: "Your counselor profile must be approved before withdrawals" }, 403);
      }

      // Enforces 28th-of-month + 5-student quota, and reserves the wallet entries.
      const { data: payout, error: rpcErr } = await userClient.rpc("request_counselor_payout");
      if (rpcErr) return json({ error: rpcErr.message }, 400);

      const reference = `CPAY-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
      const transfer = await ps("/transfer", {
        method: "POST",
        body: JSON.stringify({
          source: "balance",
          amount: Math.round(Number((payout as any).amount) * 100),
          recipient: profile.paystack_recipient_code,
          reason: `CareerAid counselor payout ${(payout as any).period_month}`,
          reference,
        }),
      });

      if (!transfer.ok) {
        await admin.from("counselor_payouts").update({
          status: "failed",
          failure_reason: transfer.body?.message || "Transfer could not be started",
          transfer_reference: reference,
        }).eq("id", (payout as any).id);
        return json({ error: transfer.body?.message || "Transfer could not be started" }, 502);
      }

      const status = transfer.body.data.status === "success" ? "paid" : "processing";
      await admin.from("counselor_payouts").update({
        status,
        transfer_reference: reference,
        paystack_transfer_code: transfer.body.data.transfer_code,
        paid_at: status === "paid" ? new Date().toISOString() : null,
      }).eq("id", (payout as any).id);

      return json({ status, amount: (payout as any).amount, reference });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
