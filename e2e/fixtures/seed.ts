/**
 * Seed helpers for Playwright runs.
 *
 * Designed to be invoked from a globalSetup script or directly from CI.
 * It does NOT create auth users (those are provisioned via the dashboard);
 * it only ensures a known assignment with rubric, revisions, a near-future
 * due date, and a published state exists for the configured school + teacher.
 *
 * Required env vars:
 *   E2E_SUPABASE_URL
 *   E2E_SUPABASE_SERVICE_ROLE_KEY
 *   E2E_SCHOOL_ID
 *   E2E_TEACHER_USER_ID
 *   E2E_STUDENT_ID
 *   E2E_CLASS_ARM_ID
 *   E2E_SUBJECT_ID
 */
import { createClient } from "@supabase/supabase-js";

export interface SeedResult {
  assignmentId: string;
  submissionId: string;
}

export async function seedRubricAndRevisions(): Promise<SeedResult> {
  const url = process.env.E2E_SUPABASE_URL!;
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
  const schoolId = process.env.E2E_SCHOOL_ID!;
  const teacherId = process.env.E2E_TEACHER_USER_ID!;
  const studentId = process.env.E2E_STUDENT_ID!;
  const classArmId = process.env.E2E_CLASS_ARM_ID!;
  const subjectId = process.env.E2E_SUBJECT_ID!;

  if (!url || !key) throw new Error("E2E_SUPABASE_URL/E2E_SUPABASE_SERVICE_ROLE_KEY required");

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const dueAt = new Date(Date.now() + 6 * 3600 * 1000).toISOString(); // due in 6h (reminder window)

  const { data: assignment, error: aErr } = await sb
    .from("assignments")
    .insert({
      school_id: schoolId,
      created_by: teacherId,
      class_arm_id: classArmId,
      subject_id: subjectId,
      title: "E2E Rubric Assignment",
      description: "Seeded for Playwright",
      due_at: dueAt,
      status: "published",
      max_score: 100,
    })
    .select("id")
    .single();
  if (aErr) throw aErr;

  // Rubric: 3 weighted criteria summing to 100.
  const criteria = [
    { label: "Clarity", weight: 40, max_score: 10 },
    { label: "Depth", weight: 35, max_score: 10 },
    { label: "Originality", weight: 25, max_score: 10 },
  ];
  const { data: critRows, error: cErr } = await sb
    .from("assignment_rubric_criteria")
    .insert(criteria.map((c) => ({ assignment_id: assignment!.id, school_id: schoolId, ...c })))
    .select("id, label, weight");
  if (cErr) throw cErr;

  // Submission + two revisions (one resubmit cycle handled by trigger).
  const { data: sub, error: sErr } = await sb
    .from("assignment_submissions")
    .insert({
      assignment_id: assignment!.id,
      student_id: studentId,
      school_id: schoolId,
      response_text: "Initial draft seeded by e2e",
    })
    .select("id")
    .single();
  if (sErr) throw sErr;

  await sb.from("assignment_submissions").update({ response_text: "Revision 1 — improved clarity." }).eq("id", sub!.id);
  await sb.from("assignment_submissions").update({ response_text: "Revision 2 — added depth and originality." }).eq("id", sub!.id);

  // Score each criterion.
  for (const c of critRows!) {
    await sb.from("assignment_rubric_scores").insert({
      submission_id: sub!.id,
      criterion_id: c.id,
      school_id: schoolId,
      score: 8,
      feedback: `Good ${c.label.toLowerCase()}.`,
    });
  }

  return { assignmentId: assignment!.id, submissionId: sub!.id };
}

// CLI: bun e2e/fixtures/seed.ts
if (import.meta.main) {
  seedRubricAndRevisions()
    .then((r) => { console.log("Seeded:", r); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
