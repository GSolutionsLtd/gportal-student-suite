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
      .select("id, admission_number, first_name, last_name, middle_name, current_class_arm_id, guardian_email, guardian_name, guardian_phone")
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
          form_teacher_id,
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

    // 6) Components with class averages
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
          subject_id,
          subject:subjects(name, code)
        `,
      )
      .eq("result_id", resultRow.id)
      .order("id", { ascending: true });

    if (compError) throw compError;

    // 6b) Calculate class averages for each subject
    const componentsWithClassAvg = await Promise.all(
      (components || []).map(async (comp: any) => {
        // Get all scores for this subject in the same class/term
        const { data: allSubjectScores } = await supabase
          .from("result_components")
          .select("total_score, result:results!inner(class_arm_id, term_id, status)")
          .eq("subject_id", comp.subject_id)
          .eq("result.class_arm_id", resultRow.class_arm_id)
          .eq("result.term_id", resultRow.term_id)
          .eq("result.status", "published");

        let classAverage: number | null = null;
        if (allSubjectScores && allSubjectScores.length > 0) {
          const validScores = allSubjectScores.filter((s: any) => s.total_score !== null);
          if (validScores.length > 0) {
            const sum = validScores.reduce((acc: number, s: any) => acc + Number(s.total_score), 0);
            classAverage = Math.round((sum / validScores.length) * 100) / 100;
          }
        }

        return {
          ...comp,
          class_average: classAverage,
        };
      })
    );

    // 6c) Fetch all published results for this student (for cumulative view)
    const { data: allStudentResults } = await supabase
      .from("results")
      .select(`
        id,
        total_score,
        average_score,
        class_position,
        term_id,
        class_arm_id,
        term:terms(
          name,
          session:academic_sessions(name)
        ),
        class_arm:class_arms(
          name,
          class:classes(name)
        )
      `)
      .eq("student_id", student.id)
      .eq("status", "published")
      .order("created_at", { ascending: true });

    // Get class sizes for each term
    const cumulativeResults = await Promise.all(
      (allStudentResults || []).map(async (r: any) => {
        const { count } = await supabase
          .from("results")
          .select("id", { count: "exact", head: true })
          .eq("class_arm_id", r.class_arm_id)
          .eq("term_id", r.term_id)
          .eq("status", "published");

        // Get subject count for this result
        const { count: subjectCount } = await supabase
          .from("result_components")
          .select("id", { count: "exact", head: true })
          .eq("result_id", r.id);

        return {
          termId: r.term_id,
          termName: r.term?.name || "",
          sessionName: r.term?.session?.name || "",
          averageScore: r.average_score,
          classPosition: r.class_position,
          classSize: count || 0,
          totalSubjects: subjectCount || 0,
        };
      })
    );

    // 6d) Fetch class comparison data (top performer and bottom quartile)
    const { data: allClassResults } = await supabase
      .from("results")
      .select("id, average_score, student_id")
      .eq("class_arm_id", resultRow.class_arm_id)
      .eq("term_id", resultRow.term_id)
      .eq("status", "published")
      .order("average_score", { ascending: false });

    let classComparison = null;
    if (allClassResults && allClassResults.length > 0) {
      const validResults = allClassResults.filter((r: any) => r.average_score !== null);
      
      if (validResults.length > 0) {
        // Top performer
        const topResult = validResults[0];
        const { data: topStudent } = await supabase
          .from("students")
          .select("first_name, last_name")
          .eq("id", topResult.student_id)
          .single();

        // Get top performer's subject scores
        const { data: topComponents } = await supabase
          .from("result_components")
          .select("subject_id, total_score, subject:subjects(name)")
          .eq("result_id", topResult.id);

        // Bottom quartile average
        const quartileSize = Math.max(1, Math.floor(validResults.length / 4));
        const bottomQuartile = validResults.slice(-quartileSize);
        const bottomQuartileAvg = bottomQuartile.reduce((sum: number, r: any) => sum + Number(r.average_score), 0) / bottomQuartile.length;

        // Class average
        const classAvgScore = validResults.reduce((sum: number, r: any) => sum + Number(r.average_score), 0) / validResults.length;

        // Get bottom quartile subject averages
        const bottomQuartileSubjectAvgs: Record<string, number> = {};
        for (const bottomResult of bottomQuartile) {
          const { data: bottomComps } = await supabase
            .from("result_components")
            .select("subject_id, total_score")
            .eq("result_id", bottomResult.id);
          
          if (bottomComps) {
            bottomComps.forEach((comp: any) => {
              if (comp.total_score !== null) {
                if (!bottomQuartileSubjectAvgs[comp.subject_id]) {
                  bottomQuartileSubjectAvgs[comp.subject_id] = 0;
                }
                bottomQuartileSubjectAvgs[comp.subject_id] += Number(comp.total_score) / bottomQuartile.length;
              }
            });
          }
        }

        classComparison = {
          topPerformer: {
            name: topStudent ? `${topStudent.first_name} ${topStudent.last_name?.charAt(0)}.` : "Anonymous",
            averageScore: Number(topResult.average_score),
            subjectScores: (topComponents || []).map((c: any) => ({
              subjectId: c.subject_id,
              subjectName: c.subject?.name || "",
              score: c.total_score !== null ? Number(c.total_score) : null,
            })),
          },
          bottomQuartile: {
            averageScore: Math.round(bottomQuartileAvg * 100) / 100,
            subjectAverages: Object.entries(bottomQuartileSubjectAvgs).map(([subjectId, avg]) => ({
              subjectId,
              averageScore: Math.round(avg * 100) / 100,
            })),
          },
          classAverage: Math.round(classAvgScore * 100) / 100,
          totalStudents: validResults.length,
        };
      }
    }

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

    // 9) Teacher signatures (class teacher and form teacher)
    let classTeacherSignatureUrl: string | null = null;
    let formTeacherSignatureUrl: string | null = null;
    
    if (resultRow.class_teacher_id) {
      const { data: teacherRow } = await supabase
        .from("teachers")
        .select("signature_url")
        .eq("id", resultRow.class_teacher_id)
        .maybeSingle();
      classTeacherSignatureUrl = (teacherRow as any)?.signature_url ?? null;
    }
    
    // Check for form teacher - either from form_teacher_id on result or by finding form teacher assigned to class
    if ((resultRow as any).form_teacher_id) {
      const { data: formTeacherRow } = await supabase
        .from("teachers")
        .select("signature_url")
        .eq("id", (resultRow as any).form_teacher_id)
        .maybeSingle();
      formTeacherSignatureUrl = (formTeacherRow as any)?.signature_url ?? null;
    } else {
      // Try to find a form teacher assigned to this class arm via teacher_subjects
      const { data: formTeacherAssignment } = await supabase
        .from("teacher_subjects")
        .select("teacher:teachers!inner(id, signature_url, is_form_teacher)")
        .eq("class_arm_id", resultRow.class_arm_id)
        .eq("teacher.is_form_teacher", true)
        .limit(1)
        .maybeSingle();
      
      if (formTeacherAssignment?.teacher) {
        formTeacherSignatureUrl = (formTeacherAssignment.teacher as any)?.signature_url ?? null;
      }
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
      cumulativeResults,
      classComparison,
      guardianEmail: student.guardian_email || null,
      guardianName: student.guardian_name || null,
      guardianPhone: student.guardian_phone || null,
      result: {
        id: resultRow.id,
        total_score: resultRow.total_score,
        average_score: resultRow.average_score,
        class_position: resultRow.class_position,
        remarks: resultRow.remarks,
        class_teacher_remark: (resultRow as any).class_teacher_remark,
        principal_remark: (resultRow as any).principal_remark,
        class_teacher_signature_url: classTeacherSignatureUrl,
        form_teacher_signature_url: formTeacherSignatureUrl,
        term: (resultRow as any).term,
        student: {
          ...student,
          class_arm: classArm,
        },
        result_components: componentsWithClassAvg,
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
