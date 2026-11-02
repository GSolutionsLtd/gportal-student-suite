import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchClassArmOptions, buildArmLabel } from "@/lib/classArms";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolFeatures } from "@/hooks/useSchoolFeatures";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileText, Download, CheckCircle2, X, Search, Plus, Pencil, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import AssignmentFileField from "@/components/assignments/AssignmentFileField";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface AssignmentRow {
  id: string;
  title: string;
  max_score: number;
  due_at: string | null;
  status: string;
  scores_approved: boolean;
  teacher_id: string;
  class_arm_id: string;
  subject_id: string;
  session_id: string | null;
  term_id: string | null;
  created_at: string;
  teachers?: { id: string; profiles?: { full_name: string } | null };
  class_arms?: { name: string; classes?: { name: string } | null };
  subjects?: { name: string };
  submission_count?: number;
}

export default function AdminAssignments() {
  const { user } = useAuth();
  const { features, schoolId, loading: featuresLoading } = useSchoolFeatures();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [search, setSearch] = useState("");
  const [teacherFilter, setTeacherFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const blankForm = {
    id: "",
    title: "",
    instructions: "",
    teacher_id: "",
    class_arm_id: "",
    subject_id: "",
    max_score: 100,
    due_at: "",
    status: "draft",
    allow_resubmissions: true,
    attachment_url: "",
  };
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [classArms, setClassArms] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!schoolId) return;
    refresh();
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const loadOptions = async () => {
    const [{ data: tRows }, armOptions, { data: sRows }] = await Promise.all([
      supabase.from("teachers").select("id, user_id, staff_id").eq("school_id", schoolId!).eq("is_active", true),
      fetchClassArmOptions(schoolId!),

      supabase.from("subjects").select("id, name").eq("school_id", schoolId!).eq("is_active", true).order("name"),
    ]);
    const userIds = (tRows || []).map((t: any) => t.user_id).filter(Boolean);
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    setTeachers(
      (tRows || []).map((t: any) => ({
        id: t.id,
        name: (profs || []).find((p: any) => p.id === t.user_id)?.full_name || t.staff_id || "Teacher",
      }))
    );
    setClassArms(armOptions.map((c) => ({ id: c.id, name: c.label })));
    setSubjects((sRows as any) || []);
  };

  const openCreate = () => {
    setForm(blankForm);
    setFormOpen(true);
  };

  const openEdit = async (a: AssignmentRow) => {
    const { data } = await supabase
      .from("assignments")
      .select("id, title, instructions, attachment_url, allow_resubmissions")
      .eq("id", a.id)
      .maybeSingle();
    setForm({
      id: a.id,
      title: a.title,
      instructions: (data as any)?.instructions || "",
      teacher_id: a.teacher_id,
      class_arm_id: a.class_arm_id,
      subject_id: a.subject_id,
      max_score: Number(a.max_score) || 100,
      due_at: a.due_at ? new Date(a.due_at).toISOString().slice(0, 16) : "",
      status: a.status,
      allow_resubmissions: (data as any)?.allow_resubmissions ?? true,
      attachment_url: (data as any)?.attachment_url || "",
    });
    setFormOpen(true);
  };

  const saveAssignment = async () => {
    if (!form.title.trim() || !form.teacher_id || !form.class_arm_id || !form.subject_id) {
      toast({ title: "Missing fields", description: "Title, teacher, class arm and subject are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        school_id: schoolId,
        title: form.title.trim(),
        instructions: form.instructions.trim() || null,
        teacher_id: form.teacher_id,
        class_arm_id: form.class_arm_id,
        subject_id: form.subject_id,
        max_score: form.max_score,
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        status: form.status,
        allow_resubmissions: form.allow_resubmissions,
        attachment_url: form.attachment_url.trim() || null,
      };
      if (form.id) {
        const { error } = await supabase.from("assignments").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("assignments")
          .insert({ ...payload, created_by: user!.id });
        if (error) throw error;
      }
      toast({ title: form.id ? "Assignment updated" : "Assignment created" });
      setFormOpen(false);
      refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const removeAssignment = async (a: AssignmentRow) => {
    if (!window.confirm(`Delete "${a.title}"? This also removes its submissions.`)) return;
    const { error } = await supabase.from("assignments").delete().eq("id", a.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Assignment deleted" });
    refresh();
  };


  const refresh = async () => {
    setLoading(true);
    try {
      // teachers.user_id links to auth users, not profiles, so names are resolved separately below.
      const error = true;
      const data = null;

      if (error) {
        const { data: simple } = await supabase
          .from("assignments")
          .select(
            "id, title, max_score, due_at, status, scores_approved, teacher_id, class_arm_id, subject_id, session_id, term_id, created_at, class_arms(name, classes(name)), subjects(name)"
          )
          .eq("school_id", schoolId!)
          .order("created_at", { ascending: false });

        // Resolve teacher names manually
        const ids = Array.from(new Set((simple || []).map((r: any) => r.teacher_id)));
        const { data: teachers } = await supabase
          .from("teachers")
          .select("id, user_id")
          .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
        const userIds = (teachers || []).map((t: any) => t.user_id);
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
        const teacherToName = new Map(
          (teachers || []).map((t: any) => [
            t.id,
            (profs || []).find((p: any) => p.id === t.user_id)?.full_name || "Teacher",
          ])
        );
        const merged = (simple || []).map((r: any) => ({
          ...r,
          teachers: { id: r.teacher_id, profiles: { full_name: teacherToName.get(r.teacher_id) || "Teacher" } },
        }));
        await attachSubmissionCounts(merged);
        return;
      }

      await attachSubmissionCounts((data as any) || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const attachSubmissionCounts = async (list: AssignmentRow[]) => {
    if (list.length === 0) {
      setRows([]);
      return;
    }
    const ids = list.map((r) => r.id);
    const { data: subs } = await supabase
      .from("assignment_submissions")
      .select("assignment_id, submitted_at")
      .in("assignment_id", ids);
    const counts = new Map<string, number>();
    (subs || []).forEach((s: any) => {
      if (s.submitted_at) counts.set(s.assignment_id, (counts.get(s.assignment_id) || 0) + 1);
    });
    setRows(list.map((r) => ({ ...r, submission_count: counts.get(r.id) || 0 })));
  };

  const toggleApproval = async (a: AssignmentRow) => {
    const next = !a.scores_approved;
    const { error } = await supabase
      .from("assignments")
      .update({
        scores_approved: next,
        approved_by: next ? user!.id : null,
        approved_at: next ? new Date().toISOString() : null,
      })
      .eq("id", a.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: next ? "Approved" : "Approval revoked" });
    refresh();
  };

  const teacherOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      map.set(r.teacher_id, r.teachers?.profiles?.full_name || "Teacher");
    });
    return Array.from(map.entries());
  }, [rows]);

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => map.set(r.class_arm_id, buildArmLabel(r.class_arms)));
    return Array.from(map.entries());
  }, [rows]);

  const filtered = rows.filter((r) => {
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (teacherFilter !== "all" && r.teacher_id !== teacherFilter) return false;
    if (classFilter !== "all" && r.class_arm_id !== classFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  });

  const exportPDF = async () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Assignment Report", 14, 16);
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), "PPP p")}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [["Title", "Teacher", "Class", "Subject", "Due", "Status", "Approval", "Submissions", "Max"]],
      body: filtered.map((r) => [
        r.title,
        r.teachers?.profiles?.full_name || "—",
        buildArmLabel(r.class_arms) || "—",
        r.subjects?.name || "—",
        r.due_at ? format(new Date(r.due_at), "PP") : "—",
        r.status,
        r.scores_approved ? "Approved" : "Pending",
        String(r.submission_count ?? 0),
        String(r.max_score),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [55, 65, 200] },
    });

    // Append rubric breakdown per assignment (only when criteria exist)
    const assignmentIds = filtered.map((r) => r.id);
    if (assignmentIds.length) {
      const { data: criteria } = await (supabase as any)
        .from("assignment_rubric_criteria")
        .select("id, assignment_id, title, weight, max_score, sort_order")
        .in("assignment_id", assignmentIds)
        .order("sort_order", { ascending: true });
      const byAssignment = new Map<string, any[]>();
      (criteria || []).forEach((c: any) => {
        const arr = byAssignment.get(c.assignment_id) || [];
        arr.push(c);
        byAssignment.set(c.assignment_id, arr);
      });

      for (const r of filtered) {
        const cs = byAssignment.get(r.id);
        if (!cs || cs.length === 0) continue;
        doc.addPage();
        doc.setFontSize(12);
        doc.text(`Rubric — ${r.title}`, 14, 16);
        doc.setFontSize(9);
        doc.text(
          `${buildArmLabel(r.class_arms)} • ${r.subjects?.name || ""} • Teacher: ${r.teachers?.profiles?.full_name || "—"}`,
          14,
          22
        );
        autoTable(doc, {
          startY: 28,
          head: [["#", "Criterion", "Weight %", "Max Score"]],
          body: cs.map((c: any, i: number) => [
            String(i + 1),
            c.title,
            String(c.weight ?? 0),
            String(c.max_score ?? 0),
          ]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [55, 65, 200] },
        });
      }
    }

    doc.save(`assignments-report-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`);
  };

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
        <h2 className="text-xl font-bold">Assignments module is disabled</h2>
        <p className="text-muted-foreground">
          Enable it in Lovable Cloud → School Features to allow teachers and students to use this module.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Assignment Monitoring</h1>
          <p className="text-muted-foreground">
            Oversee all assignments created by teachers. Approve scores and export reports.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> New Assignment
          </Button>
          <Button onClick={exportPDF} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search title..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={teacherFilter} onValueChange={setTeacherFilter}>
              <SelectTrigger><SelectValue placeholder="Teacher" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teachers</SelectItem>
                {teacherOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submissions</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No assignments match the current filters.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell>{r.teachers?.profiles?.full_name || "—"}</TableCell>
                  <TableCell>{buildArmLabel(r.class_arms) || "—"}</TableCell>
                  <TableCell>{r.subjects?.name || "—"}</TableCell>
                  <TableCell>{r.due_at ? format(new Date(r.due_at), "PP") : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "published" ? "default" : "outline"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.submission_count ?? 0}</TableCell>
                  <TableCell>
                    {r.scores_approved ? (
                      <Badge>Approved</Badge>
                    ) : (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={() => removeAssignment(r)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={r.scores_approved ? "outline" : "default"}
                        onClick={() => toggleApproval(r)}
                      >
                        {r.scores_approved ? (
                          <><X className="h-4 w-4 mr-1" /> Revoke</>
                        ) : (
                          <><CheckCircle2 className="h-4 w-4 mr-1" /> Approve</>
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit assignment" : "New assignment"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Instructions</Label>
              <Textarea
                rows={4}
                maxLength={5000}
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>Teacher *</Label>
                <Select value={form.teacher_id} onValueChange={(v) => setForm({ ...form, teacher_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>
                    {teachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Class arm *</Label>
                <Select value={form.class_arm_id} onValueChange={(v) => setForm({ ...form, class_arm_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select class arm" /></SelectTrigger>
                  <SelectContent>
                    {classArms.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subject *</Label>
                <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Max score</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.max_score}
                  onChange={(e) => setForm({ ...form, max_score: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Due date & time</Label>
                <Input
                  type="datetime-local"
                  value={form.due_at}
                  onChange={(e) => setForm({ ...form, due_at: e.target.value })}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="text-sm font-medium">Allow resubmissions before due date</div>
              <Switch
                checked={form.allow_resubmissions}
                onCheckedChange={(v) => setForm({ ...form, allow_resubmissions: v })}
              />
            </div>
            {schoolId && (
              <AssignmentFileField
                label="Assignment resource (optional)"
                folder={`${schoolId}/assignments/${form.id || "admin-drafts"}`}
                value={form.attachment_url}
                onChange={(v) => setForm({ ...form, attachment_url: v })}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={saveAssignment} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
