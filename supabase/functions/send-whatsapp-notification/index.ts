import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authenticated admin/teacher
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: authErr } = await authClient.auth.getUser();
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const uid = userData.user.id;
    const roleChecks = await Promise.all([
      authClient.rpc("has_role", { _user_id: uid, _role: "teacher" }),
      authClient.rpc("has_role", { _user_id: uid, _role: "admin" }),
      authClient.rpc("has_role", { _user_id: uid, _role: "super_admin" }),
    ]);
    if (!roleChecks.some((r) => r.data === true)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const WHATSAPP_API_TOKEN = Deno.env.get("WHATSAPP_API_TOKEN");
    const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    if (!WHATSAPP_API_TOKEN) {
      throw new Error("WHATSAPP_API_TOKEN is not configured");
    }
    if (!WHATSAPP_PHONE_NUMBER_ID) {
      throw new Error("WHATSAPP_PHONE_NUMBER_ID is not configured");
    }

    const { phoneNumber, studentName, admissionNumber, termName, sessionName, averageScore, classPosition, classSize } = await req.json();

    if (!phoneNumber || !studentName) {
      throw new Error("phoneNumber and studentName are required");
    }

    // Format phone number for WhatsApp (ensure it starts with country code, no +)
    let formattedPhone = phoneNumber.replace(/[\s\-\(\)]/g, "");
    if (formattedPhone.startsWith("+")) {
      formattedPhone = formattedPhone.substring(1);
    }
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "234" + formattedPhone.substring(1); // Default to Nigeria
    }

    const message = `📋 *Result Notification*\n\n` +
      `Dear Parent/Guardian,\n\n` +
      `The academic result for *${studentName}* (${admissionNumber}) has been published.\n\n` +
      `📅 *Term:* ${termName}\n` +
      `📚 *Session:* ${sessionName}\n` +
      `📊 *Average Score:* ${averageScore ? Number(averageScore).toFixed(1) + "%" : "N/A"}\n` +
      `🏆 *Class Position:* ${classPosition || "N/A"}${classSize ? ` of ${classSize}` : ""}\n\n` +
      `Please log in to the portal to view the detailed result.\n\n` +
      `_This is an automated notification._`;

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: formattedPhone,
          type: "text",
          text: { body: message },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`WhatsApp API error [${response.status}]: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ success: true, messageId: data.messages?.[0]?.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("WhatsApp notification error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
