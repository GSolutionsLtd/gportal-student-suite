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
    
    // Verify signature
    if (!(await verifyPaystackSignature(body, signature, paystackSecret))) {
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
        const schoolId = paymentData.metadata?.school_id;
        const durationMonths = paymentData.metadata?.duration_months || 1;

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
