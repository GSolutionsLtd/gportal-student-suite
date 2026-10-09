import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
};

interface PaystackEvent {
  event: string;
  data: {
    id: number;
    reference: string;
    amount: number;
    currency: string;
    status: string;
    customer: {
      email: string;
      customer_code: string;
    };
    metadata?: {
      school_id?: string;
      plan_type?: string;
      duration_months?: number;
    };
    paid_at?: string;
    subscription_code?: string;
    plan?: {
      plan_code: string;
      name: string;
      amount: number;
      interval: string;
    };
  };
}

const verifyPaystackSignature = async (body: string, signature: string, secret: string): Promise<boolean> => {
  if (!signature || !secret) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Constant-time compare
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const signature = req.headers.get("x-paystack-signature") || "";
    const body = await req.text();
    
    // Company key signs subscriptions/CareerAid/payouts. School fee events are signed by the
    // school's own Paystack key, so fall back to that school's key when the company key doesn't match.
    let viaSchoolKey = false;
    let validSig = await verifyPaystackSignature(body, signature, paystackSecret);
    if (!validSig) {
      try {
        const peek = JSON.parse(body);
        const md = peek?.data?.metadata || {};
        let sid: string | undefined = md.school_id_fee;
        if (!sid && md.application_id) {
          const { data: a } = await supabase.from("admission_applications").select("school_id").eq("id", md.application_id).maybeSingle();
          sid = a?.school_id;
        }
        if (sid && (md.type === "school_fee" || md.type === "admission_fee")) {
          const { data: k } = await supabase.from("school_payment_secrets").select("paystack_secret_key").eq("school_id", sid).maybeSingle();
          if (k?.paystack_secret_key) {
            validSig = await verifyPaystackSignature(body, signature, k.paystack_secret_key);
            viaSchoolKey = validSig;
          }
        }
      } catch (_) { /* ignore */ }
    }
    if (!validSig) {
      console.error("Invalid Paystack signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event: PaystackEvent = JSON.parse(body);
    console.log("Received Paystack event:", event.event);

    switch (event.event) {
      case "charge.success": {
        // Handle successful payment
        const { data: paymentData } = event;
        const md: any = paymentData.metadata || {};
        if (viaSchoolKey) {
          if (md.type === "school_fee" && md.payment_id) {
            const { data: receipt } = await supabase.rpc("generate_receipt_number");
            await supabase.from("fee_payments").update({
              status: "paid", paid_at: paymentData.paid_at || new Date().toISOString(),
              verified_at: new Date().toISOString(), payment_reference: paymentData.reference,
              paystack_reference: paymentData.reference, receipt_number: receipt || null,
            }).eq("id", md.payment_id).neq("status", "paid");
          } else if (md.type === "admission_fee" && md.application_id) {
            await supabase.from("admission_applications").update({
              payment_status: "paid", amount_paid: paymentData.amount / 100, paid_at: new Date().toISOString(),
            }).eq("id", md.application_id).eq("payment_reference", paymentData.reference);
          }
          break;
        }
        // Only company-signed events below may touch subscriptions
        const schoolId = paymentData.metadata?.school_id;
        const durationMonths = paymentData.metadata?.duration_months || 1;

        // Independent CareerAid Clinic subscription (₦5,000 / month)
        if ((paymentData.metadata as any)?.purpose === "careeraid_subscription") {
          const startsAt = new Date();
          const expiresAt = new Date(startsAt);
          expiresAt.setMonth(expiresAt.getMonth() + 1);
          const { error } = await supabase
            .from("careeraid_subscriptions")
            .update({
              status: "active",
              starts_at: startsAt.toISOString(),
              expires_at: expiresAt.toISOString(),
            })
            .eq("paystack_reference", paymentData.reference)
            .neq("status", "active");
          if (error) console.error("Error activating CareerAid subscription:", error);
          break;
        }

        if (schoolId) {

          // Calculate new subscription end date
          const now = new Date();
          const subscriptionEndsAt = new Date(now);
          subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + durationMonths);

          // Update school subscription
          const { error } = await supabase
            .from("schools")
            .update({
              subscription_status: "active",
              subscription_ends_at: subscriptionEndsAt.toISOString(),
            })
            .eq("id", schoolId);

          if (error) {
            console.error("Error updating school subscription:", error);
          } else {
            console.log(`Updated subscription for school ${schoolId} until ${subscriptionEndsAt.toISOString()}`);
          }
        }
        break;
      }

      case "subscription.create": {
        // Handle new subscription created
        const { data: subData } = event;
        const schoolId = subData.metadata?.school_id;

        if (schoolId) {
          const { error } = await supabase
            .from("schools")
            .update({
              subscription_status: "active",
            })
            .eq("id", schoolId);

          if (error) {
            console.error("Error updating school subscription:", error);
          }
        }
        break;
      }

      case "subscription.disable":
      case "subscription.not_renew": {
        // Handle subscription cancellation
        const { data: subData } = event;
        const schoolId = subData.metadata?.school_id;

        if (schoolId) {
          const { error } = await supabase
            .from("schools")
            .update({
              subscription_status: "expired",
            })
            .eq("id", schoolId);

          if (error) {
            console.error("Error updating school subscription:", error);
          }
        }
        break;
      }

      case "transfer.success":
      case "transfer.failed":
      case "transfer.reversed": {
        const transferCode = (event.data as any)?.transfer_code;
        const transferRef = (event.data as any)?.reference;
        if (transferCode || transferRef) {
          const succeeded = event.event === "transfer.success";
          let q = supabase
            .from("counselor_payouts")
            .update({
              status: succeeded ? "paid" : "failed",
              paid_at: succeeded ? new Date().toISOString() : null,
              failure_reason: succeeded ? null : ((event.data as any)?.reason || event.event),
            });
          q = transferCode ? q.eq("paystack_transfer_code", transferCode) : q.eq("transfer_reference", transferRef);
          const { data: payouts, error } = await q.select("id");
          if (error) console.error("Error updating counselor payout:", error);

          // Failed / reversed transfers: release the reserved earnings back to the wallet
          if (!succeeded && payouts && payouts.length > 0) {
            const { error: relErr } = await supabase
              .from("counselor_wallet_entries")
              .update({ payout_id: null })
              .in("payout_id", payouts.map((p: any) => p.id));
            if (relErr) console.error("Error releasing wallet entries:", relErr);
          }
        }
        break;
      }

      default:
        console.log("Unhandled event type:", event.event);

    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
