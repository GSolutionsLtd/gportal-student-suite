import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { reference } = await req.json();

    if (!reference) {
      return new Response(
        JSON.stringify({ error: "Missing reference" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // School fee references (FEE-<payment_id>) are verified with the school's own key
    let verifySecret = paystackSecret;
    const feeMatch = /^FEE-([0-9a-f-]{36})$/i.exec(String(reference));
    if (feeMatch) {
      const { data: pay } = await supabase.from("fee_payments")
        .select("fee_structures(school_id)").eq("id", feeMatch[1]).maybeSingle();
      const sid = (pay as any)?.fee_structures?.school_id;
      const { data: k } = sid ? await supabase.from("school_payment_secrets")
        .select("paystack_secret_key").eq("school_id", sid).maybeSingle() : { data: null };
      if (!k?.paystack_secret_key) {
        return new Response(JSON.stringify({ error: "School payment account not configured" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      verifySecret = k.paystack_secret_key;
    }

    // Verify transaction with Paystack
    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${verifySecret}`,
        "Content-Type": "application/json",
      },
    });

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      return new Response(
        JSON.stringify({ error: paystackData.message || "Verification failed" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const transaction = paystackData.data;
    const paymentType = transaction.metadata?.type || (transaction.metadata?.school_id ? "school_subscription" : "unknown");

    if (transaction.status !== "success") {
      return new Response(
        JSON.stringify({
          success: false,
          status: transaction.status,
          paymentType,
          message: "Payment not successful",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extract metadata
    const schoolId = transaction.metadata?.school_id;
    const durationMonths = transaction.metadata?.duration_months || 1;

    if (paymentType === "school_fee") {
      const paymentId = transaction.metadata?.payment_id;
      const feeName = transaction.metadata?.fee_name || "School Fee";

      if (paymentId) {
        const { data: receiptData } = await supabase.rpc("generate_receipt_number");

        const { error } = await supabase
          .from("fee_payments")
          .update({
            status: "paid",
            paid_at: transaction.paid_at,
            verified_at: new Date().toISOString(),
            payment_reference: transaction.reference,
            paystack_reference: transaction.reference,
            receipt_number: receiptData || null,
          })
          .eq("id", paymentId);

        if (error) {
          console.error("Error updating fee payment:", error);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          paymentType: "school_fee",
          status: transaction.status,
          amount: transaction.amount / 100,
          currency: transaction.currency,
          paid_at: transaction.paid_at,
          feeName,
          message: "Payment verified successfully",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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
        console.log(`Verified and updated subscription for school ${schoolId}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        paymentType: "school_subscription",
        status: transaction.status,
        amount: transaction.amount / 100,
        currency: transaction.currency,
        paid_at: transaction.paid_at,
        school_id: schoolId,
        message: "Payment verified successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Verification error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
