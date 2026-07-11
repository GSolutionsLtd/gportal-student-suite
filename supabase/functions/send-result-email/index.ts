import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendResultEmailRequest {
  recipientEmail: string;
  recipientName: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  termName: string;
  sessionName: string;
  averageScore: number | null;
  classPosition: number | null;
  classSize: number;
  pdfBase64?: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Require authenticated admin/teacher
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: authErr } = await authClient.auth.getUser();
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    const uid = userData.user.id;
    const roleChecks = await Promise.all([
      authClient.rpc("has_role", { _user_id: uid, _role: "teacher" }),
      authClient.rpc("has_role", { _user_id: uid, _role: "admin" }),
      authClient.rpc("has_role", { _user_id: uid, _role: "super_admin" }),
    ]);
    if (!roleChecks.some((r) => r.data === true)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured. Please contact the administrator." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const resend = new Resend(resendApiKey);

    const {
      recipientEmail,
      recipientName,
      studentName,
      admissionNumber,
      className,
      termName,
      sessionName,
      averageScore,
      classPosition,
      classSize,
      pdfBase64,
    }: SendResultEmailRequest = await req.json();

    // Validate required fields
    if (!recipientEmail || !studentName) {
      return new Response(
        JSON.stringify({ error: "Recipient email and student name are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Cap attachment size (~8MB base64)
    if (pdfBase64 && pdfBase64.length > 8_000_000) {
      return new Response(
        JSON.stringify({ error: "Attachment too large" }),
        { status: 413, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get school settings for branding
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: schoolSettings } = await supabase
      .from("school_settings")
      .select("school_name, email, phone, address, motto")
      .limit(1)
      .maybeSingle();

    const schoolName = schoolSettings?.school_name || "School";
    const schoolEmail = schoolSettings?.email || "noreply@school.com";

    // Format position with ordinal suffix
    const getOrdinalSuffix = (n: number): string => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    const positionText = classPosition !== null 
      ? `${getOrdinalSuffix(classPosition)} out of ${classSize} students`
      : "Not available";

    const averageText = averageScore !== null 
      ? `${averageScore.toFixed(1)}%`
      : "Not available";

    // Prepare email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Student Result Notification</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">${schoolName}</h1>
          ${schoolSettings?.motto ? `<p style="margin: 5px 0 0 0; font-style: italic; opacity: 0.9;">"${schoolSettings.motto}"</p>` : ''}
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <p style="font-size: 16px; margin-bottom: 20px;">Dear <strong>${recipientName || 'Parent/Guardian'}</strong>,</p>
          
          <p>We are pleased to share the academic result for <strong>${studentName}</strong>.</p>
          
          <div style="background: #f8fafc; border-left: 4px solid #1e3a8a; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <h2 style="color: #1e3a8a; margin: 0 0 15px 0; font-size: 18px;">Result Summary</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Student Name:</td>
                <td style="padding: 8px 0; font-weight: bold;">${studentName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Admission Number:</td>
                <td style="padding: 8px 0; font-weight: bold;">${admissionNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Class:</td>
                <td style="padding: 8px 0; font-weight: bold;">${className}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Term:</td>
                <td style="padding: 8px 0; font-weight: bold;">${termName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Session:</td>
                <td style="padding: 8px 0; font-weight: bold;">${sessionName}</td>
              </tr>
            </table>
          </div>
          
          <div style="display: flex; gap: 15px; margin: 25px 0;">
            <div style="flex: 1; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 20px; border-radius: 10px; text-align: center;">
              <p style="margin: 0 0 5px 0; font-size: 12px; opacity: 0.9;">Average Score</p>
              <p style="margin: 0; font-size: 24px; font-weight: bold;">${averageText}</p>
            </div>
            <div style="flex: 1; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 20px; border-radius: 10px; text-align: center;">
              <p style="margin: 0 0 5px 0; font-size: 12px; opacity: 0.9;">Class Position</p>
              <p style="margin: 0; font-size: 24px; font-weight: bold;">${classPosition !== null ? getOrdinalSuffix(classPosition) : 'N/A'}</p>
            </div>
          </div>
          
          ${pdfBase64 ? `
          <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;">📎 The detailed result report is attached as a PDF file.</p>
          </div>
          ` : `
          <p style="text-align: center; margin: 25px 0;">
            <a href="#" style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">View Full Result Online</a>
          </p>
          `}
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
          
          <p style="color: #666; font-size: 14px;">
            If you have any questions about this result, please contact the school administration.
          </p>
          
          <p style="margin-top: 20px;">
            Best regards,<br>
            <strong>The ${schoolName} Team</strong>
          </p>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
          <p style="margin: 0;">${schoolSettings?.address || ''}</p>
          ${schoolSettings?.phone ? `<p style="margin: 5px 0;">Tel: ${schoolSettings.phone}</p>` : ''}
          ${schoolSettings?.email ? `<p style="margin: 5px 0;">Email: ${schoolSettings.email}</p>` : ''}
          <p style="margin: 15px 0 0 0; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
        </div>
      </body>
      </html>
    `;

    // Prepare email options
    const emailOptions: any = {
      from: `${schoolName} <onboarding@resend.dev>`,
      to: [recipientEmail],
      subject: `${studentName}'s Academic Result - ${termName} ${sessionName}`,
      html: emailHtml,
    };

    // Add PDF attachment if provided
    if (pdfBase64) {
      emailOptions.attachments = [
        {
          filename: `${studentName.replace(/\s+/g, '_')}_${termName.replace(/\s+/g, '_')}_Result.pdf`,
          content: pdfBase64,
        },
      ];
    }

    console.log("Sending result email to:", recipientEmail);

    const emailResponse = await resend.emails.send(emailOptions);

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Result email sent successfully",
        data: emailResponse
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-result-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send email" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
