import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolContext } from "@/hooks/useSchoolContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Plus, Trash2, Edit, Download, BookOpen, FileText } from "lucide-react";
import jsPDF from "jspdf";
import { format } from "date-fns";

interface LessonPlan {
  id: string;
  school_id: string;
  teacher_user_id: string;
  subject_id: string | null;
  class_arm_id: string | null;
  title: string;
  topic: string;
  grade_level: string | null;
  duration_minutes: number | null;
  objectives: string | null;
  materials: string | null;
  introduction: string | null;
  main_content: string | null;
  activities: string | null;
  evaluation: string | null;
  homework: string | null;
  references_notes: string | null;
  ai_generated: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

const emptyPlan = {
  title: "", topic: "", grade_level: "", duration_minutes: 40,
  objectives: "", materials: "", introduction: "", main_content: "",
  activities: "", evaluation: "", homework: "", references_notes: "",
  subject_id: null as string | null, class_arm_id: null as string | null,
  ai_generated: false, status: "draft",
};

export default function LessonPlannerPage() {
  const { user, userRole } = useAuth();
  const { schoolId } = useSchoolContext();
  const { toast } = useToast();
  const isAdmin = userRole === "admin" || userRole === "super_admin";
  const isTeacher = userRole === "teacher";

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [classArms, setClassArms] = useState<{ id: string; name: string }[]>([]);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiForm, setAiForm] = useState({ topic: "", subject: "", grade_level: "", duration_minutes: 40, extra_notes: "" });
  const [aiLoading, setAiLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<LessonPlan> & typeof emptyPlan>(emptyPlan);
  const [saving, setSaving] = useState(false);

  const [viewing, setViewing] = useState<LessonPlan | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    load();
  }, [schoolId, user]);

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: s }, { data: c }] = await Promise.all([
      supabase.from("lesson_plans").select("*")
        .eq("school_id", schoolId!).order("created_at", { ascending: false }),
      supabase.from("subjects").select("id, name").eq("school_id", schoolId!),
      supabase.from("class_arms").select("id, name").eq("school_id", schoolId!),
    ]);
    setPlans((p as LessonPlan[]) ?? []);
    setSubjects((s as any[]) ?? []);
    setClassArms((c as any[]) ?? []);
    setLoading(false);
  };

  const generateAi = async () => {
    if (!aiForm.topic.trim()) return toast({ title: "Topic required", variant: "destructive" });
    setAiLoading(true);
    const { data, error } = await supabase.functions.invoke("generate-lesson-plan", { body: aiForm });
    setAiLoading(false);
    if (error || (data as any)?.error) {
      return toast({ title: "AI generation failed", description: (data as any)?.error || error?.message, variant: "destructive" });
    }
    const plan = (data as any).plan ?? {};
    setEditing({
      ...emptyPlan,
      title: plan.title || aiForm.topic,
      topic: aiForm.topic,
      grade_level: aiForm.grade_level,
      duration_minutes: aiForm.duration_minutes,
      objectives: plan.objectives || "",
      materials: plan.materials || "",
      introduction: plan.introduction || "",
      main_content: plan.main_content || "",
      activities: plan.activities || "",
      evaluation: plan.evaluation || "",
      homework: plan.homework || "",
      references_notes: plan.references_notes || "",
      ai_generated: true,
    });
    setAiOpen(false);
    setEditOpen(true);
    toast({ title: "Lesson plan drafted", description: "Review and save." });
  };

  const savePlan = async () => {
    if (!schoolId || !user) return;
    if (!editing.title.trim() || !editing.topic.trim()) {
      return toast({ title: "Title and topic are required", variant: "destructive" });
    }
    setSaving(true);
    const payload = {
      school_id: schoolId,
      teacher_user_id: user.id,
      title: editing.title,
      topic: editing.topic,
      grade_level: editing.grade_level || null,
      duration_minutes: Number(editing.duration_minutes) || 40,
      objectives: editing.objectives || null,
      materials: editing.materials || null,
      introduction: editing.introduction || null,
      main_content: editing.main_content || null,
      activities: editing.activities || null,
      evaluation: editing.evaluation || null,
      homework: editing.homework || null,
      references_notes: editing.references_notes || null,
      subject_id: editing.subject_id || null,
      class_arm_id: editing.class_arm_id || null,
      ai_generated: !!editing.ai_generated,
      status: editing.status || "draft",
    };
    let error;
    if ((editing as any).id) {
      ({ error } = await supabase.from("lesson_plans").update(payload).eq("id", (editing as any).id));
    } else {
      ({ error } = await supabase.from("lesson_plans").insert(payload));
    }
    setSaving(false);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: "Saved" });
    setEditOpen(false);
    setEditing(emptyPlan);
    load();
  };

  const deletePlan = async (id: string) => {
    if (!confirm("Delete this lesson plan?")) return;
    const { error } = await supabase.from("lesson_plans").delete().eq("id", id);
    if (error) return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    toast({ title: "Deleted" });
    load();
  };

  const openEdit = (p: LessonPlan) => {
    setEditing({ ...emptyPlan, ...p } as any);
    setEditOpen(true);
  };

  const downloadPdf = (p: LessonPlan) => {
    const doc = new jsPDF();
    let y = 15;
    doc.setFontSize(16); doc.setFont(undefined, "bold");
    doc.text(p.title, 14, y); y += 8;
    doc.setFontSize(10); doc.setFont(undefined, "normal");
    doc.text(`Topic: ${p.topic}`, 14, y); y += 5;
    doc.text(`Class: ${p.grade_level || "-"}  |  Duration: ${p.duration_minutes || 40} min`, 14, y); y += 5;
    doc.text(`Generated: ${format(new Date(p.created_at), "PPp")}`, 14, y); y += 7;
    const sections: [string, string | null][] = [
      ["Objectives", p.objectives], ["Materials", p.materials],
      ["Introduction", p.introduction], ["Main Content", p.main_content],
      ["Activities", p.activities], ["Evaluation", p.evaluation],
      ["Homework", p.homework], ["References", p.references_notes],
    ];
    sections.forEach(([label, val]) => {
      if (!val) return;
      if (y > 260) { doc.addPage(); y = 15; }
      doc.setFont(undefined, "bold"); doc.setFontSize(11);
      doc.text(label, 14, y); y += 5;
      doc.setFont(undefined, "normal"); doc.setFontSize(9);
      const split = doc.splitTextToSize(val, 180);
      split.forEach((line: string) => {
        if (y > 285) { doc.addPage(); y = 15; }
        doc.text(line, 14, y); y += 4;
      });
      y += 3;
    });
    doc.save(`lesson-plan-${p.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
  };

  const downloadDocx = (p: LessonPlan) => {
    // Simple .doc HTML-based export (Word opens .doc HTML fine)
    const html = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset="utf-8"><title>${p.title}</title></head>
<body style="font-family: Calibri, sans-serif;">
<h1>${p.title}</h1>
<p><b>Topic:</b> ${p.topic}<br><b>Class:</b> ${p.grade_level || "-"}<br><b>Duration:</b> ${p.duration_minutes || 40} min</p>
${(["objectives","materials","introduction","main_content","activities","evaluation","homework","references_notes"] as const).map((k) => {
  const label = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const val = (p as any)[k];
  return val ? `<h2>${label}</h2><p style="white-space:pre-wrap">${String(val).replace(/</g,"&lt;")}</p>` : "";
}).join("")}
</body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${p.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.doc`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="h-6 w-6 text-primary" /> AI Lesson Planner</h1>
          <p className="text-muted-foreground">Generate, edit and export curriculum-aligned lesson plans.</p>
        </div>
        {isTeacher && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setEditing(emptyPlan); setEditOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> New Blank
            </Button>
            <Button onClick={() => setAiOpen(true)}>
              <Sparkles className="h-4 w-4 mr-2" /> Generate with AI
            </Button>
          </div>
        )}
      </div>

      {plans.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          {isTeacher ? "No lesson plans yet. Click 'Generate with AI' to draft your first one." : "No lesson plans in this school yet."}
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-base">{p.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {p.topic} • {p.grade_level || "—"} • {p.duration_minutes || 40} min
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    {p.ai_generated && <Badge variant="secondary" className="text-xs"><Sparkles className="h-3 w-3 mr-1" />AI</Badge>}
                    <Badge variant="outline" className="text-xs">{p.status}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setViewing(p)}><FileText className="h-4 w-4 mr-1" />View</Button>
                {isTeacher && p.teacher_user_id === user?.id && (
                  <Button size="sm" variant="outline" onClick={() => openEdit(p)}><Edit className="h-4 w-4 mr-1" />Edit</Button>
                )}
                <Button size="sm" variant="outline" onClick={() => downloadPdf(p)}><Download className="h-4 w-4 mr-1" />PDF</Button>
                <Button size="sm" variant="outline" onClick={() => downloadDocx(p)}><Download className="h-4 w-4 mr-1" />DOCX</Button>
                {(isTeacher && p.teacher_user_id === user?.id) || isAdmin ? (
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => deletePlan(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* AI generation dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Generate lesson plan with AI</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Topic *</Label><Input value={aiForm.topic} onChange={(e) => setAiForm({ ...aiForm, topic: e.target.value })} placeholder="e.g. Photosynthesis" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Subject</Label><Input value={aiForm.subject} onChange={(e) => setAiForm({ ...aiForm, subject: e.target.value })} placeholder="Biology" /></div>
              <div><Label>Class / Grade</Label><Input value={aiForm.grade_level} onChange={(e) => setAiForm({ ...aiForm, grade_level: e.target.value })} placeholder="SS 1" /></div>
            </div>
            <div><Label>Duration (minutes)</Label><Input type="number" value={aiForm.duration_minutes} onChange={(e) => setAiForm({ ...aiForm, duration_minutes: Number(e.target.value) })} /></div>
            <div><Label>Extra notes (optional)</Label><Textarea value={aiForm.extra_notes} onChange={(e) => setAiForm({ ...aiForm, extra_notes: e.target.value })} placeholder="Focus on group activities, include a diagram..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiOpen(false)}>Cancel</Button>
            <Button onClick={generateAi} disabled={aiLoading}>
              {aiLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}<Sparkles className="h-4 w-4 mr-2" />Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{(editing as any).id ? "Edit" : "New"} lesson plan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Title *</Label><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
              <div><Label>Topic *</Label><Input value={editing.topic} onChange={(e) => setEditing({ ...editing, topic: e.target.value })} /></div>
              <div><Label>Grade / Class</Label><Input value={editing.grade_level || ""} onChange={(e) => setEditing({ ...editing, grade_level: e.target.value })} /></div>
              <div><Label>Duration (min)</Label><Input type="number" value={editing.duration_minutes || 40} onChange={(e) => setEditing({ ...editing, duration_minutes: Number(e.target.value) })} /></div>
              <div>
                <Label>Subject</Label>
                <Select value={editing.subject_id || "_none"} onValueChange={(v) => setEditing({ ...editing, subject_id: v === "_none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— None —</SelectItem>
                    {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Class arm</Label>
                <Select value={editing.class_arm_id || "_none"} onValueChange={(v) => setEditing({ ...editing, class_arm_id: v === "_none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— None —</SelectItem>
                    {classArms.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(["objectives","materials","introduction","main_content","activities","evaluation","homework","references_notes"] as const).map((k) => (
              <div key={k}>
                <Label className="capitalize">{k.replace(/_/g, " ")}</Label>
                <Textarea rows={3} value={(editing as any)[k] || ""} onChange={(e) => setEditing({ ...editing, [k]: e.target.value } as any)} />
              </div>
            ))}
            <div>
              <Label>Status</Label>
              <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft (private)</SelectItem>
                  <SelectItem value="ready">Ready for review</SelectItem>
                  <SelectItem value="published">Published (visible to students)</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Set to <b>Published</b> so students in the selected class arm (or the whole school if none is chosen) can read this lesson note on their dashboard.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={savePlan} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>{viewing.title}</DialogTitle>
                <CardDescription>{viewing.topic} • {viewing.grade_level || "—"} • {viewing.duration_minutes || 40} min</CardDescription>
              </DialogHeader>
              <div className="space-y-4">
                {(["objectives","materials","introduction","main_content","activities","evaluation","homework","references_notes"] as const).map((k) => {
                  const v = (viewing as any)[k];
                  if (!v) return null;
                  return (
                    <div key={k}>
                      <h3 className="font-semibold capitalize mb-1">{k.replace(/_/g, " ")}</h3>
                      <p className="text-sm whitespace-pre-wrap text-muted-foreground">{v}</p>
                    </div>
                  );
                })}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => downloadDocx(viewing)}><Download className="h-4 w-4 mr-2" />DOCX</Button>
                <Button onClick={() => downloadPdf(viewing)}><Download className="h-4 w-4 mr-2" />PDF</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
