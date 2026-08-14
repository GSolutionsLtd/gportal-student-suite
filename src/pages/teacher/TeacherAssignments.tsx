import { useState, useEffect, useMemo, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolFeatures } from "@/hooks/useSchoolFeatures";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, FileText, Pencil, Send, Save, Trash2, Users, Bell, History } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { format } from "date-fns";

interface Assignment {
  id: string;
  title: string;
  instructions: string | null;
  attachment_url: string | null;
  max_score: number;
  due_at: string | null;
  status: "draft" | "published" | "closed";
  scores_approved: boolean;
  allow_resubmissions?: boolean;
  class_arm_id: string;
  subject_id: string;
  session_id: string | null;
  term_id: string | null;
  created_at: string;
}

interface ClassArmOption {
  class_arm_id: string;
  subject_id: string;
  session_id: string | null;
  class_arm_name: string;
  subject_name: string;
}

interface Submission {
  id: string;
  student_id: string;
  response_text: string | null;
  attachment_url: string | null;
  submitted_at: string | null;
  score: number | null;
  feedback: string | null;
  score_released: boolean;
  graded_at: string | null;
  revision_number?: number;
  resubmission_count?: number;
  student?: {
    first_name: string;
    last_name: string;
    admission_number: string;
  };
}

interface RubricCriterion {
  id?: string;
  title: string;
  description: string;
  weight: number;
  max_score: number;
  sort_order: number;
}

const blankForm = {
  title: "",
  instructions: "",
  attachment_url: "",
  max_score: 100,
  due_at: "",
  class_arm_id: "",
  subject_id: "",
  session_id: "" as string | null,
  term_id: "" as string | null,
  allow_resubmissions: true,
};

const blankCriterion = (sort_order = 0): RubricCriterion => ({
  title: "",
  description: "",
  weight: 0,
  max_score: 0,
  sort_order,
});

export default function TeacherAssignments() {
  const { user } = useAuth();
  const { features, schoolId, loading: featuresLoading } = useSchoolFeatures();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classOptions, setClassOptions] = useState<ClassArmOption[]>([]);
  const [currentTermId, setCurrentTermId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [rubricDraft, setRubricDraft] = useState<RubricCriterion[]>([]);

  const [gradingFor, setGradingFor] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [rubricCriteria, setRubricCriteria] = useState<RubricCriterion[]>([]);
  const [rubricScores, setRubricScores] = useState<Record<string, Record<string, { score: number; feedback: string }>>>({});
  const [revisionHistory, setRevisionHistory] = useState<Record<string, Array<{ revision_number: number; submitted_at: string | null; response_text: string | null; attachment_url: string | null }>>>({});

  useEffect(() => {
    if (!user || !schoolId) return;
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, schoolId]);

  const bootstrap = async () => {
    setLoading(true);
    try {
      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!teacher) {
        toast({ title: "Profile incomplete", description: "Complete your teacher profile first.", variant: "destructive" });
        setLoading(false);
        return;
      }
      setTeacherId(teacher.id);

      const [{ data: ts }, { data: term }] = await Promise.all([
        supabase
          .from("teacher_subjects")
          .select("class_arm_id, subject_id, session_id, class_arms(name), subjects(name)")
          .eq("teacher_id", teacher.id),
        supabase.from("terms").select("id").eq("is_current", true).maybeSingle(),
      ]);

      setCurrentTermId(term?.id ?? null);
      setClassOptions(
        (ts || []).map((row: any) => ({
          class_arm_id: row.class_arm_id,
          subject_id: row.subject_id,
          session_id: row.session_id,
          class_arm_name: row.class_arms?.name || "Class",
          subject_name: row.subjects?.name || "Subject",
        }))
      );

      const { data: list } = await supabase
        .from("assignments")
        .select("*")
        .eq("teacher_id", teacher.id)
        .order("created_at", { ascending: false });

      setAssignments((list as any) || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const refreshAssignments = async () => {
    if (!teacherId) return;
    const { data } = await supabase
      .from("assignments")
      .select("*")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });
    setAssignments((data as any) || []);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ ...blankForm });
    setRubricDraft([blankCriterion(0)]);
    setShowForm(true);
  };

  const openEdit = async (a: Assignment) => {
    setEditing(a);
    setForm({
      title: a.title,
      instructions: a.instructions || "",
      attachment_url: a.attachment_url || "",
      max_score: Number(a.max_score),
      due_at: a.due_at ? a.due_at.slice(0, 16) : "",
      class_arm_id: a.class_arm_id,
      subject_id: a.subject_id,
      session_id: a.session_id,
      term_id: a.term_id,
      allow_resubmissions: a.allow_resubmissions ?? true,
    });
    const { data } = await (supabase as any)
      .from("assignment_rubric_criteria")
      .select("id, title, description, weight, max_score, sort_order")
      .eq("assignment_id", a.id)
      .order("sort_order", { ascending: true });
    setRubricDraft((data && data.length ? data : [blankCriterion(0)]) as RubricCriterion[]);
    setShowForm(true);
  };

  const handleClassChoice = (value: string) => {
    const [class_arm_id, subject_id] = value.split("|");
    const opt = classOptions.find(
      (o) => o.class_arm_id === class_arm_id && o.subject_id === subject_id
    );
    setForm((f) => ({
      ...f,
      class_arm_id,
      subject_id,
      session_id: opt?.session_id ?? null,
    }));
  };

  const validate = () => {
    if (!form.title.trim()) return "Title is required";
    if (form.title.length > 200) return "Title must be 200 chars or less";
    if (!form.class_arm_id || !form.subject_id) return "Select a class and subject";
    if (form.max_score <= 0 || form.max_score > 1000) return "Max score must be between 1 and 1000";
    return null;
  };

  const saveAssignment = async (publish = false) => {
    const err = validate();
    if (err) {
      toast({ title: "Invalid", description: err, variant: "destructive" });
      return;
    }
    if (!teacherId || !schoolId) return;
    setSaving(true);
    try {
      const payload: any = {
        school_id: schoolId,
        teacher_id: teacherId,
        class_arm_id: form.class_arm_id,
        subject_id: form.subject_id,
        session_id: form.session_id || null,
        term_id: form.term_id || currentTermId,
        title: form.title.trim(),
        instructions: form.instructions.trim() || null,
        attachment_url: form.attachment_url.trim() || null,
        max_score: form.max_score,
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        allow_resubmissions: form.allow_resubmissions,
        status: publish ? "published" : editing?.status ?? "draft",
        created_by: user!.id,
      };

      let assignmentId = editing?.id;
      if (editing) {
        const { error } = await supabase.from("assignments").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("assignments").insert(payload).select("id").single();
        if (error) throw error;
        assignmentId = data?.id;
      }

      if (assignmentId) {
        await (supabase as any).from("assignment_rubric_criteria").delete().eq("assignment_id", assignmentId);
        const rows = rubricDraft
          .filter((r) => r.title.trim() && Number(r.max_score) > 0)
          .map((r, index) => ({
            assignment_id: assignmentId,
            school_id: schoolId,
            title: r.title.trim(),
            description: r.description.trim() || null,
            weight: Number(r.weight) || 0,
            max_score: Number(r.max_score) || 0,
            sort_order: index,
          }));
        if (rows.length) {
          const { error } = await (supabase as any).from("assignment_rubric_criteria").insert(rows);
          if (error) throw error;
        }
      }

      toast({ title: "Saved", description: `Assignment ${publish ? "published" : "saved"}.` });
      setShowForm(false);
      refreshAssignments();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (a: Assignment) => {
    const next = a.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("assignments").update({ status: next }).eq("id", a.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: next === "published" ? "Published" : "Unpublished" });
    refreshAssignments();
  };

  const deleteAssignment = async (a: Assignment) => {
    if (!confirm(`Delete "${a.title}"? This also removes submissions.`)) return;
    const { error } = await supabase.from("assignments").delete().eq("id", a.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted" });
    refreshAssignments();
  };

  const openGrading = async (a: Assignment) => {
    setGradingFor(a);
    setSubmissionsLoading(true);
    setSubmissions([]);
    setRubricCriteria([]);
    setRubricScores({});
    setRevisionHistory({});
    try {
      const { data: subs } = await supabase
        .from("assignment_submissions")
        .select("*")
        .eq("assignment_id", a.id)
        .order("submitted_at", { ascending: false, nullsFirst: false });

      const { data: students } = await supabase
        .from("students")
        .select("id, first_name, last_name, admission_number")
        .eq("current_class_arm_id", a.class_arm_id)
        .eq("is_active", true);

      const { data: criteria } = await (supabase as any)
        .from("assignment_rubric_criteria")
        .select("id, title, description, weight, max_score, sort_order")
        .eq("assignment_id", a.id)
        .order("sort_order", { ascending: true });
      setRubricCriteria((criteria as RubricCriterion[]) || []);

      const subMap = new Map((subs || []).map((s: any) => [s.student_id, s]));
      const merged: Submission[] = (students || []).map((s: any) => {
        const existing = subMap.get(s.id);
        if (existing) return { ...existing, student: s };
        return {
          id: "",
          student_id: s.id,
          response_text: null,
          attachment_url: null,
          submitted_at: null,
          score: null,
          feedback: null,
          score_released: false,
          graded_at: null,
          student: s,
        };
      });
      setSubmissions(merged);

      // Load existing rubric scores keyed by submission_id->criterion_id
      const submissionIds = (subs || []).map((s: any) => s.id).filter(Boolean);
      if (submissionIds.length && (criteria || []).length) {
        const { data: rs } = await (supabase as any)
          .from("assignment_rubric_scores")
          .select("submission_id, criterion_id, score, feedback")
          .in("submission_id", submissionIds);
        const map: Record<string, Record<string, { score: number; feedback: string }>> = {};
        (rs || []).forEach((row: any) => {
          map[row.submission_id] = map[row.submission_id] || {};
          map[row.submission_id][row.criterion_id] = {
            score: Number(row.score) || 0,
            feedback: row.feedback || "",
          };
        });
        setRubricScores(map);
      }

      // Load revision history
      if (submissionIds.length) {
        const { data: revs } = await (supabase as any)
          .from("assignment_submission_revisions")
          .select("submission_id, revision_number, submitted_at, response_text, attachment_url")
          .in("submission_id", submissionIds)
          .order("revision_number", { ascending: false });
        const rh: Record<string, any[]> = {};
        (revs || []).forEach((r: any) => {
          rh[r.submission_id] = rh[r.submission_id] || [];
          rh[r.submission_id].push(r);
        });
        setRevisionHistory(rh);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const setRubricCell = (
    submissionId: string,
    criterionId: string,
    patch: Partial<{ score: number; feedback: string }>
  ) => {
    setRubricScores((prev) => {
      const sub = { ...(prev[submissionId] || {}) };
      sub[criterionId] = {
        score: patch.score !== undefined ? patch.score : sub[criterionId]?.score ?? 0,
        feedback: patch.feedback !== undefined ? patch.feedback : sub[criterionId]?.feedback ?? "",
      };
      return { ...prev, [submissionId]: sub };
    });
  };

  const notifyDue = async () => {
    try {
      const { error } = await (supabase as any).rpc("notify_due_assignments");
      if (error) throw error;
      toast({ title: "Reminders sent", description: "Due reminders dispatched to enrolled students." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const updateSubmissionScore = (studentId: string, patch: Partial<Submission>) => {
    setSubmissions((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, ...patch } : s))
    );
  };

  const saveScores = async (release: boolean) => {
    if (!gradingFor || !user) return;
    setSaving(true);
    try {
      const toUpsert = submissions
        .filter((s) => s.score !== null && s.score !== undefined)
        .map((s) => ({
          ...(s.id ? { id: s.id } : {}),
          assignment_id: gradingFor.id,
          student_id: s.student_id,
          school_id: schoolId!,
          response_text: s.response_text,
          attachment_url: s.attachment_url,
          submitted_at: s.submitted_at ?? new Date().toISOString(),
          score: s.score,
          feedback: s.feedback,
          score_released: release ? true : s.score_released,
          graded_by: user.id,
          graded_at: new Date().toISOString(),
        }));

      if (toUpsert.length === 0) {
        toast({ title: "Nothing to save", description: "Enter at least one score." });
        setSaving(false);
        return;
      }

      const { data: saved, error } = await supabase
        .from("assignment_submissions")
        .upsert(toUpsert, { onConflict: "assignment_id,student_id" })
        .select("id, student_id");
      if (error) throw error;

      // Persist rubric scores (if any criteria + entries)
      if (rubricCriteria.length && Object.keys(rubricScores).length) {
        const idByStudent = new Map((saved || []).map((r: any) => [r.student_id, r.id]));
        const rubricRows: any[] = [];
        Object.entries(rubricScores).forEach(([submissionKey, perCriterion]) => {
          // submissionKey may already be a submission id, or a placeholder student_id for new submissions
          const sub = submissions.find(
            (s) => s.id === submissionKey || s.student_id === submissionKey
          );
          if (!sub) return;
          const submissionId = sub.id || idByStudent.get(sub.student_id);
          if (!submissionId) return;
          Object.entries(perCriterion).forEach(([criterionId, val]) => {
            rubricRows.push({
              submission_id: submissionId,
              criterion_id: criterionId,
              assignment_id: gradingFor.id,
              school_id: schoolId!,
              student_id: sub.student_id,
              score: Number(val.score) || 0,
              feedback: val.feedback || null,
              graded_by: user.id,
              graded_at: new Date().toISOString(),
            });
          });
        });
        if (rubricRows.length) {
          // Replace-on-conflict by (submission_id, criterion_id) — use delete+insert for safety
          const submissionIds = Array.from(new Set(rubricRows.map((r) => r.submission_id)));
          await (supabase as any)
            .from("assignment_rubric_scores")
            .delete()
            .in("submission_id", submissionIds);
          const { error: rsErr } = await (supabase as any)
            .from("assignment_rubric_scores")
            .insert(rubricRows);
          if (rsErr) throw rsErr;
        }
      }

      toast({
        title: release ? "Scores published" : "Draft scores saved",
        description: `${toUpsert.length} submission(s) updated.`,
      });
      openGrading(gradingFor);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const classChoiceValue = form.class_arm_id && form.subject_id ? `${form.class_arm_id}|${form.subject_id}` : "";

  const statusBadge = (s: string) => {
    if (s === "published") return <Badge>Published</Badge>;
    if (s === "closed") return <Badge variant="secondary">Closed</Badge>;
    return <Badge variant="outline">Draft</Badge>;
  };

  const submittedCount = useMemo(
    () => submissions.filter((s) => !!s.submitted_at).length,
    [submissions]
  );

  if (featuresLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!features.assignments) {
    return (
      <div className="max-w-xl mx-auto mt-12 text-center space-y-3">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
        <h2 className="text-xl font-bold">Assignments module is not enabled</h2>
        <p className="text-muted-foreground">
          Ask your school administrator to request this module from the system administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assignment Management</h1>
          <p className="text-muted-foreground">Create assignments, monitor submissions and publish scores.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={notifyDue}>
            <Bell className="h-4 w-4 mr-2" /> Send Due Reminders
          </Button>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" /> New Assignment
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Assignments</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Max Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No assignments yet. Click "New Assignment" to create one.
                  </TableCell>
                </TableRow>
              )}
              {assignments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.title}</TableCell>
                  <TableCell>{a.due_at ? format(new Date(a.due_at), "PP p") : "—"}</TableCell>
                  <TableCell>{a.max_score}</TableCell>
                  <TableCell>{statusBadge(a.status)}</TableCell>
                  <TableCell>
                    {a.scores_approved ? (
                      <Badge>Approved</Badge>
                    ) : (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="outline" onClick={() => openGrading(a)}>
                      <Users className="h-4 w-4 mr-1" /> Grade
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => togglePublish(a)}>
                      {a.status === "published" ? "Unpublish" : "Publish"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteAssignment(a)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Assignment" : "New Assignment"}</DialogTitle>
            <DialogDescription>
              Choose a class/subject you teach. Students see the assignment only after you publish it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={form.title}
                maxLength={200}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Class & Subject *</Label>
              <Select value={classChoiceValue} onValueChange={handleClassChoice}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a class arm + subject you teach" />
                </SelectTrigger>
                <SelectContent>
                  {classOptions.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No teaching assignments yet — ask your admin to assign you.
                    </div>
                  )}
                  {classOptions.map((o) => (
                    <SelectItem
                      key={`${o.class_arm_id}|${o.subject_id}`}
                      value={`${o.class_arm_id}|${o.subject_id}`}
                    >
                      {o.class_arm_name} — {o.subject_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Max Score</Label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={form.max_score}
                  onChange={(e) => setForm((f) => ({ ...f, max_score: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date / Time</Label>
                <Input
                  type="datetime-local"
                  value={form.due_at}
                  onChange={(e) => setForm((f) => ({ ...f, due_at: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Instructions</Label>
              <Textarea
                rows={5}
                value={form.instructions}
                maxLength={5000}
                onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
              />
            </div>

            {schoolId && (
              <AssignmentFileField
                label="Assignment resource (optional)"
                folder={`${schoolId}/assignments/${editing?.id || `drafts-${user?.id}`}`}
                value={form.attachment_url}
                onChange={(v) => setForm((f) => ({ ...f, attachment_url: v }))}
              />
            )}

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Allow resubmissions before due date</div>
                <div className="text-xs text-muted-foreground">
                  Students can replace their answer until the deadline.
                </div>
              </div>
              <Switch
                checked={form.allow_resubmissions}
                onCheckedChange={(v) => setForm((f) => ({ ...f, allow_resubmissions: v }))}
              />
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Rubric Criteria (optional)</Label>
                  <p className="text-xs text-muted-foreground">
                    Break down scoring into weighted criteria. Leave empty to use a single total score.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setRubricDraft((r) => [...r, blankCriterion(r.length)])
                  }
                >
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>

              {rubricDraft.map((c, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                  <Input
                    className="col-span-4"
                    placeholder="Criterion title"
                    value={c.title}
                    onChange={(e) =>
                      setRubricDraft((r) =>
                        r.map((row, i) => (i === idx ? { ...row, title: e.target.value } : row))
                      )
                    }
                  />
                  <Input
                    className="col-span-4"
                    placeholder="Description"
                    value={c.description}
                    onChange={(e) =>
                      setRubricDraft((r) =>
                        r.map((row, i) => (i === idx ? { ...row, description: e.target.value } : row))
                      )
                    }
                  />
                  <Input
                    className="col-span-2"
                    type="number"
                    min={0}
                    placeholder="Weight %"
                    value={c.weight || ""}
                    onChange={(e) =>
                      setRubricDraft((r) =>
                        r.map((row, i) =>
                          i === idx ? { ...row, weight: Number(e.target.value) || 0 } : row
                        )
                      )
                    }
                  />
                  <Input
                    className="col-span-1"
                    type="number"
                    min={0}
                    placeholder="Max"
                    value={c.max_score || ""}
                    onChange={(e) =>
                      setRubricDraft((r) =>
                        r.map((row, i) =>
                          i === idx ? { ...row, max_score: Number(e.target.value) || 0 } : row
                        )
                      )
                    }
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="col-span-1"
                    onClick={() =>
                      setRubricDraft((r) => r.filter((_, i) => i !== idx))
                    }
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button variant="secondary" onClick={() => saveAssignment(false)} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save as Draft
            </Button>
            <Button onClick={() => saveAssignment(true)} disabled={saving}>
              <Send className="h-4 w-4 mr-2" /> Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grading dialog */}
      <Dialog open={!!gradingFor} onOpenChange={(v) => !v && setGradingFor(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{gradingFor?.title}</DialogTitle>
            <DialogDescription>
              {submittedCount} of {submissions.length} students submitted. Enter scores then save draft or publish to students.
            </DialogDescription>
          </DialogHeader>

          {submissionsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="w-32">Score / {gradingFor?.max_score}</TableHead>
                  <TableHead>Feedback</TableHead>
                  <TableHead>Released</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((s) => {
                  const subKey = s.id || s.student_id;
                  const revs = s.id ? revisionHistory[s.id] || [] : [];
                  return (
                    <Fragment key={s.student_id}>
                      <TableRow>
                        <TableCell>
                          <div className="font-medium">
                            {s.student?.last_name} {s.student?.first_name}
                          </div>
                          <div className="text-xs text-muted-foreground">{s.student?.admission_number}</div>
                          {(s.resubmission_count ?? 0) > 0 && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {s.resubmission_count} resubmission{(s.resubmission_count ?? 0) > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {s.submitted_at ? (
                            <div className="space-y-1">
                              <span className="text-xs">{format(new Date(s.submitted_at), "PP p")}</span>
                              {s.attachment_url && (
                                <div><AttachmentLink value={s.attachment_url} /></div>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-xs">No submission</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={Number(gradingFor?.max_score) || 100}
                            value={s.score ?? ""}
                            onChange={(e) =>
                              updateSubmissionScore(s.student_id, {
                                score: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={s.feedback ?? ""}
                            maxLength={500}
                            onChange={(e) =>
                              updateSubmissionScore(s.student_id, { feedback: e.target.value })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {s.score_released ? <Badge>Yes</Badge> : <Badge variant="outline">No</Badge>}
                        </TableCell>
                      </TableRow>
                      {(rubricCriteria.length > 0 || revs.length > 0) && (
                        <TableRow key={`${s.student_id}-extras`}>
                          <TableCell colSpan={5} className="bg-muted/30">
                            <Accordion type="multiple" className="w-full">
                              {rubricCriteria.length > 0 && (
                                <AccordionItem value="rubric">
                                  <AccordionTrigger className="text-xs">
                                    Rubric breakdown
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <div className="grid gap-2">
                                      {rubricCriteria.map((c) => {
                                        const val = rubricScores[subKey]?.[c.id!] || { score: 0, feedback: "" };
                                        return (
                                          <div
                                            key={c.id}
                                            className="grid grid-cols-12 gap-2 items-center"
                                          >
                                            <div className="col-span-4 text-xs">
                                              <div className="font-medium">{c.title}</div>
                                              {c.description && (
                                                <div className="text-muted-foreground">{c.description}</div>
                                              )}
                                            </div>
                                            <Input
                                              className="col-span-2"
                                              type="number"
                                              min={0}
                                              max={Number(c.max_score) || undefined}
                                              placeholder={`/ ${c.max_score}`}
                                              value={val.score || ""}
                                              onChange={(e) =>
                                                setRubricCell(subKey, c.id!, {
                                                  score: Number(e.target.value) || 0,
                                                })
                                              }
                                            />
                                            <Input
                                              className="col-span-6"
                                              placeholder="Criterion feedback (optional)"
                                              value={val.feedback}
                                              onChange={(e) =>
                                                setRubricCell(subKey, c.id!, { feedback: e.target.value })
                                              }
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              )}
                              {revs.length > 0 && (
                                <AccordionItem value="history">
                                  <AccordionTrigger className="text-xs">
                                    <span className="inline-flex items-center gap-2">
                                      <History className="h-3 w-3" />
                                      Revision history ({revs.length})
                                    </span>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <ol className="space-y-2 text-xs">
                                      {revs.map((r) => (
                                        <li
                                          key={r.revision_number}
                                          className="rounded border border-border/60 p-2"
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="font-medium">
                                              Revision #{r.revision_number}
                                            </span>
                                            <span className="text-muted-foreground">
                                              {r.submitted_at
                                                ? format(new Date(r.submitted_at), "PP p")
                                                : "—"}
                                            </span>
                                          </div>
                                          {r.response_text && (
                                            <p className="mt-1 whitespace-pre-wrap">{r.response_text}</p>
                                          )}
                                          {r.attachment_url && (
                                            <AttachmentLink value={r.attachment_url} />
                                          )}
                                        </li>
                                      ))}
                                    </ol>
                                  </AccordionContent>
                                </AccordionItem>
                              )}
                            </Accordion>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setGradingFor(null)}>Close</Button>
            <Button variant="secondary" onClick={() => saveScores(false)} disabled={saving}>
              <Save className="h-4 w-4 mr-2" /> Save Draft Scores
            </Button>
            <Button onClick={() => saveScores(true)} disabled={saving}>
              <Send className="h-4 w-4 mr-2" /> Publish Scores
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
