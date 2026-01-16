import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckResultRequest {
  admissionNumber: string;
  pin: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { admissionNumber, pin }: CheckResultRequest = await req.json();

    const admission = (admissionNumber || "").trim();
    const pinCode = (pin || "").trim().toUpperCase();

    if (!admission || !pinCode) {
      return json({ error: "Admission number and PIN are required." }, 400);
    }

    // 1) Verify PIN
    const { data: pinRow, error: pinError } = await supabase
      .from("pins")
      .select("id, status, usage_count, max_usage, expires_at, term_id, student_id")
      .eq("pin_code", pinCode)
      .maybeSingle();

    if (pinError) throw pinError;
    if (!pinRow) return json({ error: "Invalid PIN" }, 404);

    if (pinRow.status !== "active") {
      return json({ error: `PIN not active (${pinRow.status})` }, 400);
    }

    if (pinRow.expires_at && new Date(pinRow.expires_at) < new Date()) {
      return json({ error: "PIN expired" }, 400);
    }

    if (pinRow.usage_count >= pinRow.max_usage) {
      return json({ error: "PIN usage limit reached" }, 400);
    }

    // 2) Find student by admission number (case-insensitive)
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, admission_number, first_name, last_name, middle_name, current_class_arm_id")
      .ilike("admission_number", admission)
      .maybeSingle();

    if (studentError) throw studentError;
    if (!student) {
      return json({ error: "Student Not Found", code: "STUDENT_NOT_FOUND" }, 404);
    }

    // 3) If PIN is assigned, ensure it matches student
    if (pinRow.student_id && pinRow.student_id !== student.id) {
      return json({ error: "PIN mismatch for student", code: "PIN_MISMATCH" }, 400);
    }

    // 4) Fetch published result (optionally by term)
    let resultsQuery = supabase
      .from("results")
      .select(
        `
          id,
          total_score,
          average_score,
          class_position,
          remarks,
          class_teacher_remark,
          principal_remark,
          class_teacher_id,
          class_arm_id,
          term_id,
          term:terms(
            name,
            session:academic_sessions(name)
          )
        `,
      )
      .eq("student_id", student.id)
      .eq("status", "published");

    if (pinRow.term_id) resultsQuery = resultsQuery.eq("term_id", pinRow.term_id);

    const { data: resultRow, error: resultError } = await resultsQuery
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (resultError) throw resultError;
    if (!resultRow) return json({ error: "No published results found" }, 404);

    // Compute aggregates on-the-fly if missing
    if (resultRow.total_score === null || resultRow.average_score === null) {
      const { data: componentsForCalc } = await supabase
        .from("result_components")
        .select("total_score")
        .eq("result_id", resultRow.id);

      if (componentsForCalc && componentsForCalc.length > 0) {
        const validScores = componentsForCalc.filter((c: any) => c.total_score !== null);
        const total = validScores.reduce((sum: number, c: any) => sum + Number(c.total_score), 0);
        const avg = validScores.length > 0 ? total / validScores.length : 0;

        (resultRow as any).total_score = Math.round(total * 100) / 100;
        (resultRow as any).average_score = Math.round(avg * 100) / 100;
      }
    }

    // Compute position on-the-fly if missing
    if (resultRow.class_position === null && (resultRow as any).average_score !== null) {
      const { data: allResults } = await supabase
        .from("results")
        .select("id, average_score")
        .eq("class_arm_id", resultRow.class_arm_id)
        .eq("term_id", resultRow.term_id)
        .eq("status", "published");

      if (allResults && allResults.length > 0) {
        // Calculate averages for all results that don't have them
        const resultsWithAvg = await Promise.all(
          allResults.map(async (r: any) => {
            if (r.average_score !== null) return { id: r.id, average_score: r.average_score };
            const { data: comps } = await supabase
              .from("result_components")
              .select("total_score")
              .eq("result_id", r.id);
            if (!comps || comps.length === 0) return { id: r.id, average_score: 0 };
            const valid = comps.filter((c: any) => c.total_score !== null);
            const avg = valid.length > 0 ? valid.reduce((s: number, c: any) => s + Number(c.total_score), 0) / valid.length : 0;
            return { id: r.id, average_score: avg };
          })
        );

        resultsWithAvg.sort((a: any, b: any) => (b.average_score || 0) - (a.average_score || 0));
        const position = resultsWithAvg.findIndex((r: any) => r.id === resultRow.id) + 1;
        (resultRow as any).class_position = position > 0 ? position : null;
      }
    }

    // 5) Class size
    const { count: classSize } = await supabase
      .from("results")
      .select("id", { count: "exact", head: true })
      .eq("class_arm_id", resultRow.class_arm_id)
      .eq("status", "published");

    // 6) Components
    const { data: components, error: compError } = await supabase
      .from("result_components")
      .select(
        `
          id,
          test1_score,
          test2_score,
          other_assessment_score,
          exam_score,
          total_score,
          grade,
          remark,
          subject:subjects(name, code)
        `,
      )
      .eq("result_id", resultRow.id)
      .order("id", { ascending: true });

    if (compError) throw compError;

    // 7) Class arm info
    const { data: classArm, error: classArmError } = await supabase
      .from("class_arms")
      .select("name, class:classes(name)")
      .eq("id", student.current_class_arm_id)
      .maybeSingle();

    if (classArmError) throw classArmError;

    // 8) Grading scales + school settings
    const [{ data: scales, error: scalesError }, { data: schoolSettings, error: schoolError }] = await Promise.all([
      supabase.from("grading_scales").select("grade, min_score, max_score, remark").order("min_score", { ascending: false }),
      supabase
        .from("school_settings")
        .select("school_name, address, motto, logo_url, email, phone, principal_name, principal_signature_url")
        .limit(1)
        .maybeSingle(),
    ]);

    if (scalesError) throw scalesError;
    if (schoolError) throw schoolError;

    // 9) Teacher signature (optional)
    let classTeacherSignatureUrl: string | null = null;
    if (resultRow.class_teacher_id) {
      const { data: teacherRow } = await supabase
        .from("teachers")
        .select("signature_url")
        .eq("id", resultRow.class_teacher_id)
        .maybeSingle();
      classTeacherSignatureUrl = (teacherRow as any)?.signature_url ?? null;
    }

    // 10) Log usage + increment
    await supabase.from("pin_usage_logs").insert({
      pin_id: pinRow.id,
      student_id: student.id,
      ip_address: null,
      user_agent: req.headers.get("user-agent"),
    });

    const pinUpdate: Record<string, any> = {
      usage_count: (pinRow.usage_count || 0) + 1,
      used_at: new Date().toISOString(),
    };
    if (!pinRow.student_id) pinUpdate.student_id = student.id;

    await supabase.from("pins").update(pinUpdate).eq("id", pinRow.id);

    // Response shape used by the client
    const response = {
      schoolSettings,
      gradingScales: scales || [],
      classSize: classSize || 0,
      result: {
        id: resultRow.id,
        total_score: resultRow.total_score,
        average_score: resultRow.average_score,
        class_position: resultRow.class_position,
        remarks: resultRow.remarks,
        class_teacher_remark: (resultRow as any).class_teacher_remark,
        principal_remark: (resultRow as any).principal_remark,
        class_teacher_signature_url: classTeacherSignatureUrl,
        term: (resultRow as any).term,
        student: {
          ...student,
          class_arm: classArm,
        },
        result_components: components || [],
      },
    };

    return json(response, 200);
  } catch (e: any) {
    console.error("check-result error", e);
    return json({ error: e?.message || "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
