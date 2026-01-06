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

    // Fetch results with student info
    const { data: results, error: resultsError } = await supabase
      .from("results")
      .select(`
        id,
        student_id,
        term_id,
        average_score,
        class_position,
        student:students(
          first_name,
          last_name,
          guardian_email,
          guardian_name
        ),
        term:terms(
          name,
          session:academic_sessions(name)
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

      if (!student?.guardian_email) {
        errors.push(`No guardian email for student ${student?.first_name} ${student?.last_name}`);
        continue;
      }

      const studentName = `${student.first_name} ${student.last_name}`;
      const termName = term?.name || "Current Term";
      const sessionName = term?.session?.name || "Current Session";

      const subject = type === "published"
        ? `${studentName}'s Result is Now Available - ${termName}`
        : `${studentName}'s Result Has Been Approved - ${termName}`;

      const htmlContent = type === "published"
        ? `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a1a;">Result Published</h1>
            <p>Dear ${student.guardian_name || "Parent/Guardian"},</p>
            <p>We are pleased to inform you that <strong>${studentName}</strong>'s result for <strong>${termName}</strong> (${sessionName}) has been published and is now available for viewing.</p>
            ${result.average_score ? `<p><strong>Average Score:</strong> ${Number(result.average_score).toFixed(1)}%</p>` : ""}
            ${result.class_position ? `<p><strong>Class Position:</strong> ${result.class_position}</p>` : ""}
            <p>To view the complete result, please log into the student portal or use the result checking system with your PIN.</p>
            <p style="margin-top: 24px;">Best regards,<br>School Administration</p>
          </div>
        `
        : `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a1a;">Result Approved</h1>
            <p>Dear ${student.guardian_name || "Parent/Guardian"},</p>
            <p>This is to inform you that <strong>${studentName}</strong>'s result for <strong>${termName}</strong> (${sessionName}) has been reviewed and approved by the administration.</p>
            <p>The result will be published shortly and you will receive another notification when it becomes available for viewing.</p>
            <p style="margin-top: 24px;">Best regards,<br>School Administration</p>
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
