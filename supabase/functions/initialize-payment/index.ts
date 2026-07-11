import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentRequest {
  type?: "school_subscription" | "school_fee";
  school_id: string;
  email: string;
  amount: number; // Amount in kobo (NGN) or smallest currency unit
  plan_type: string; // 'monthly' | 'quarterly' | 'yearly'
  callback_url?: string;
  student_id?: string;
  fee_structure_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY")!;

    // Require authenticated caller
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = authData.user.id;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json() as PaymentRequest;
    const paymentType = payload.type || (payload.school_id ? "school_subscription" : "school_fee");
    const { school_id, email, amount, plan_type, callback_url, student_id, fee_structure_id } = payload;

    if (paymentType === "school_fee") {
      if (!student_id || !fee_structure_id || !email || !amount) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: student_id, fee_structure_id, email, amount" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: feeStructure, error: feeStructureError } = await supabase
        .from("fee_structures")
        .select("id, name, amount")
        .eq("id", fee_structure_id)
        .single();

      if (feeStructureError || !feeStructure) {
        return new Response(
          JSON.stringify({ error: "Fee structure not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: payment, error: paymentError } = await supabase
        .from("fee_payments")
        .insert({
          student_id,
          fee_structure_id,
          amount_paid: Number(amount),
          payment_method: "online",
          status: "pending",
        })
        .select("id")
        .single();

      if (paymentError || !payment) {
        return new Response(
          JSON.stringify({ error: paymentError?.message || "Could not create payment record" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const reference = `FEE-${payment.id}`;

      const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: Math.round(Number(amount) * 100),
          reference,
          callback_url: callback_url || `${req.headers.get("origin")}/payment/callback`,
          metadata: {
            type: "school_fee",
            payment_id: payment.id,
            student_id,
            fee_structure_id,
            fee_name: feeStructure.name,
          },
        }),
      });

      const paystackData = await paystackResponse.json();

      if (!paystackData.status) {
        return new Response(
          JSON.stringify({ error: paystackData.message || "Payment initialization failed" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          authorization_url: paystackData.data.authorization_url,
          access_code: paystackData.data.access_code,
          reference: paystackData.data.reference,
          paymentType: "school_fee",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!school_id || !email || !amount) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: school_id, email, amount" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify school exists
    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .select("id, name, code")
      .eq("id", school_id)
      .single();

    if (schoolError || !school) {
      return new Response(
        JSON.stringify({ error: "School not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Calculate duration based on plan type
    let durationMonths = 1;
    switch (plan_type) {
      case "quarterly":
        durationMonths = 3;
        break;
      case "yearly":
        durationMonths = 12;
        break;
      default:
        durationMonths = 1;
    }

    // Generate unique reference
    const reference = `SCH-${school.code}-${Date.now()}`;

    // Initialize Paystack transaction
    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amount * 100, // Convert to kobo
        reference,
        callback_url: callback_url || `${req.headers.get("origin")}/payment/callback`,
        metadata: {
          type: "school_subscription",
          school_id,
          school_name: school.name,
          plan_type,
          duration_months: durationMonths,
          custom_fields: [
            {
              display_name: "School Name",
              variable_name: "school_name",
              value: school.name,
            },
            {
              display_name: "Plan",
              variable_name: "plan_type",
              value: plan_type.charAt(0).toUpperCase() + plan_type.slice(1),
            },
          ],
        },
      }),
    });

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      console.error("Paystack error:", paystackData);
      return new Response(
        JSON.stringify({ error: paystackData.message || "Payment initialization failed" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Payment initialized for school:", school.name, "Reference:", reference);

    return new Response(
      JSON.stringify({
        success: true,
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference: paystackData.data.reference,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Payment initialization error:", error);
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
