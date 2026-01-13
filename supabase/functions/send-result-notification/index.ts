import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

async function sendEmail(to: string, subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "School Results <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });
  return response.json();
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: "approved" | "published";
  resultIds: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { type, resultIds }: NotificationRequest = await req.json();

    if (!resultIds || resultIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "No result IDs provided" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch school settings for branding
    const { data: schoolSettings } = await supabase
      .from("school_settings")
      .select("school_name, logo_url, address, phone, email, motto")
      .maybeSingle();

    const schoolName = schoolSettings?.school_name || "School";
    const schoolAddress = schoolSettings?.address || "";
    const schoolPhone = schoolSettings?.phone || "";
    const schoolEmail = schoolSettings?.email || "";
    const schoolMotto = schoolSettings?.motto || "";
    const logoUrl = schoolSettings?.logo_url || "";

    // Fetch results with student info and result components for summary
    const { data: results, error: resultsError } = await supabase
      .from("results")
      .select(`
        id,
        student_id,
        term_id,
        average_score,
        class_position,
        total_score,
        student:students(
          first_name,
          last_name,
          guardian_email,
          guardian_name,
          admission_number
        ),
        term:terms(
          name,
          session:academic_sessions(name)
        ),
        class_arm:class_arms(
          name,
          class:classes(name)
        )
      `)
      .in("id", resultIds);

    if (resultsError) {
      console.error("Error fetching results:", resultsError);
      throw resultsError;
    }

    const emailsSent: string[] = [];
    const errors: string[] = [];

    for (const result of results || []) {
      const student = result.student as any;
      const term = result.term as any;
      const classArm = result.class_arm as any;

      if (!student?.guardian_email) {
        errors.push(`No guardian email for student ${student?.first_name} ${student?.last_name}`);
        continue;
      }

      const studentName = `${student.first_name} ${student.last_name}`;
      const termName = term?.name || "Current Term";
      const sessionName = term?.session?.name || "Current Session";
      const className = classArm ? `${classArm.class?.name || ""} ${classArm.name}` : "";

      // Fetch result components for subject summary (only for published)
      let subjectSummaryHtml = "";
      if (type === "published") {
        const { data: components } = await supabase
          .from("result_components")
          .select(`
            total_score,
            grade,
            subject:subjects(name, code)
          `)
          .eq("result_id", result.id)
          .order("total_score", { ascending: false });

        if (components && components.length > 0) {
          const subjectRows = components.map((comp: any) => `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${comp.subject?.name || "N/A"}</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${comp.total_score !== null ? comp.total_score : "-"}</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${comp.grade || "-"}</td>
            </tr>
          `).join("");

          subjectSummaryHtml = `
            <div style="margin: 20px 0;">
              <h3 style="color: #333; margin-bottom: 10px;">Subject Summary</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                  <tr style="background: #f5f5f5;">
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Subject</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Score</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  ${subjectRows}
                </tbody>
              </table>
            </div>
          `;
        }
      }

      const subject = type === "published"
        ? `${studentName}'s Result is Now Available - ${termName}`
        : `${studentName}'s Result Has Been Approved - ${termName}`;

      const htmlContent = type === "published"
        ? `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
            <!-- Header with School Info -->
            <div style="background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%); padding: 30px; text-align: center; color: white;">
              ${logoUrl ? `<img src="${logoUrl}" alt="${schoolName}" style="max-height: 80px; margin-bottom: 15px;" />` : ""}
              <h1 style="margin: 0; font-size: 24px;">${schoolName}</h1>
              ${schoolMotto ? `<p style="margin: 5px 0 0; opacity: 0.9; font-style: italic;">${schoolMotto}</p>` : ""}
            </div>

            <!-- Main Content -->
            <div style="padding: 30px;">
              <h2 style="color: #1a365d; margin-top: 0;">Result Published</h2>
              <p style="color: #555;">Dear ${student.guardian_name || "Parent/Guardian"},</p>
              <p style="color: #555;">We are pleased to inform you that <strong>${studentName}</strong>'s academic result for <strong>${termName}</strong> (${sessionName}) has been published and is now available for viewing.</p>
              
              <!-- Student Info Card -->
              <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #333; margin-top: 0; margin-bottom: 15px;">Student Information</h3>
                <table style="width: 100%; font-size: 14px;">
                  <tr>
                    <td style="padding: 5px 0; color: #666;">Name:</td>
                    <td style="padding: 5px 0; font-weight: bold;">${studentName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 0; color: #666;">Admission No:</td>
                    <td style="padding: 5px 0; font-weight: bold;">${student.admission_number}</td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 0; color: #666;">Class:</td>
                    <td style="padding: 5px 0; font-weight: bold;">${className}</td>
                  </tr>
                  ${result.average_score ? `
                  <tr>
                    <td style="padding: 5px 0; color: #666;">Average Score:</td>
                    <td style="padding: 5px 0; font-weight: bold; color: #2c5282;">${Number(result.average_score).toFixed(1)}%</td>
                  </tr>` : ""}
                  ${result.class_position ? `
                  <tr>
                    <td style="padding: 5px 0; color: #666;">Class Position:</td>
                    <td style="padding: 5px 0; font-weight: bold; color: #2c5282;">${result.class_position}</td>
                  </tr>` : ""}
                </table>
              </div>

              ${subjectSummaryHtml}

              <p style="color: #555;">To view the complete result with detailed breakdown, please log into the student portal or use the result checking system with your PIN.</p>
              
              <p style="margin-top: 30px; color: #555;">Best regards,<br><strong>${schoolName} Administration</strong></p>
            </div>

            <!-- Footer -->
            <div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
              ${schoolAddress ? `<p style="margin: 5px 0;">${schoolAddress}</p>` : ""}
              ${schoolPhone ? `<p style="margin: 5px 0;">Phone: ${schoolPhone}</p>` : ""}
              ${schoolEmail ? `<p style="margin: 5px 0;">Email: ${schoolEmail}</p>` : ""}
            </div>
          </div>
        `
        : `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
            <!-- Header with School Info -->
            <div style="background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%); padding: 30px; text-align: center; color: white;">
              ${logoUrl ? `<img src="${logoUrl}" alt="${schoolName}" style="max-height: 80px; margin-bottom: 15px;" />` : ""}
              <h1 style="margin: 0; font-size: 24px;">${schoolName}</h1>
              ${schoolMotto ? `<p style="margin: 5px 0 0; opacity: 0.9; font-style: italic;">${schoolMotto}</p>` : ""}
            </div>

            <!-- Main Content -->
            <div style="padding: 30px;">
              <h2 style="color: #1a365d; margin-top: 0;">Result Approved</h2>
              <p style="color: #555;">Dear ${student.guardian_name || "Parent/Guardian"},</p>
              <p style="color: #555;">This is to inform you that <strong>${studentName}</strong>'s academic result for <strong>${termName}</strong> (${sessionName}) has been reviewed and approved by the administration.</p>
              <p style="color: #555;">The result will be published shortly and you will receive another notification when it becomes available for viewing.</p>
              
              <p style="margin-top: 30px; color: #555;">Best regards,<br><strong>${schoolName} Administration</strong></p>
            </div>

            <!-- Footer -->
            <div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
              ${schoolAddress ? `<p style="margin: 5px 0;">${schoolAddress}</p>` : ""}
              ${schoolPhone ? `<p style="margin: 5px 0;">Phone: ${schoolPhone}</p>` : ""}
              ${schoolEmail ? `<p style="margin: 5px 0;">Email: ${schoolEmail}</p>` : ""}
            </div>
          </div>
        `;

      try {
        const emailResponse = await sendEmail(student.guardian_email, subject, htmlContent);

        console.log(`Email sent to ${student.guardian_email}:`, emailResponse);
        emailsSent.push(student.guardian_email);
      } catch (emailError: any) {
        console.error(`Failed to send email to ${student.guardian_email}:`, emailError);
        errors.push(`Failed to send to ${student.guardian_email}: ${emailError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent: emailsSent.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-result-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
