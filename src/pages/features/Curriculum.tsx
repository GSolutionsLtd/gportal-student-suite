import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolContext } from "@/hooks/useSchoolContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Upload, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Opt = { id: string; name: string };
const db = supabase as any;

export default function Curriculum() {
  const { user, userRole } = useAuth();
  const { schoolId } = useSchoolContext();
  const isAdmin = userRole === "admin";
  const [classes, setClasses] = useState<Opt[]>([]);
  const [subjects, setSubjects] = useState<Opt[]>([]);
  const [terms, setTerms] = useState<Opt[]>([]);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [termId, setTermId] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [allRows, setAllRows] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ week_number: 1, topic: "", objectives: "" });
  const [docOpen, setDocOpen] = useState(false);
  const [docDraft, setDocDraft] = useState<{ title: string; description: string; file: File | null }>({ title: "", description: "", file: null });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    Promise.all([
      db.from("classes").select("id,name").eq("school_id", schoolId).order("level"),
      db.from("subjects").select("id,name").eq("school_id", schoolId).order("name"),
      db.from("terms").select("id,name,is_current").eq("school_id", schoolId).order("start_date", { ascending: false }),
    ]).then(([c, s, t]: any[]) => {
      setClasses(c.data || []); setSubjects(s.data || []); setTerms(t.data || []);
      const cur = (t.data || []).find((x: any) => x.is_current);
      if (cur) setTermId(cur.id);
    });
  }, [schoolId]);

  const load = async () => {
    if (!schoolId) return;
    let q = db.from("curriculum_schemes").select("*").eq("school_id", schoolId);
    if (termId) q = q.eq("term_id", termId);
    const { data } = await q.order("week_number");
    setAllRows(data || []);
    setRows((data || []).filter((r: any) => r.class_id === classId && r.subject_id === subjectId));
    const { data: d } = await db.from("curriculum_documents").select("*").eq("school_id", schoolId).order("created_at", { ascending: false });
    setDocs(d || []);
  };
  useEffect(() => { load(); }, [schoolId, classId, subjectId, termId]);

  const coverage = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>();
    allRows.forEach((r) => {
      const k = `${r.class_id}|${r.subject_id}`;
      const v = map.get(k) || { total: 0, done: 0 };
      v.total++; if (r.is_covered) v.done++; map.set(k, v);
    });
    const name = (list: Opt[], id: string) => list.find((x) => x.id === id)?.name || "—";
    return [...map.entries()].map(([k, v]) => {
      const [c, s] = k.split("|");
      return { label: `${name(classes, c)} • ${name(subjects, s)}`, ...v, pct: Math.round((v.done / v.total) * 100) };
    }).sort((a, b) => a.pct - b.pct);
  }, [allRows, classes, subjects]);

  const addTopic = async () => {
    if (!draft.topic.trim()) return toast.error("Topic is required");
    const { error } = await db.from("curriculum_schemes").insert({
      school_id: schoolId, class_id: classId, subject_id: subjectId, term_id: termId || null,
      week_number: Number(draft.week_number) || 1, topic: draft.topic.trim().slice(0, 300),
      objectives: draft.objectives.trim().slice(0, 2000) || null, created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    setOpen(false); setDraft({ week_number: (Number(draft.week_number) || 1) + 1, topic: "", objectives: "" }); load();
  };

  const toggle = async (r: any, v: boolean) => {
    const { error } = await db.from("curriculum_schemes").update({
      is_covered: v, covered_at: v ? new Date().toISOString() : null, covered_by: v ? user?.id : null,
    }).eq("id", r.id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await db.from("curriculum_schemes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const uploadDoc = async () => {
    const f = docDraft.file;
    if (!f || !docDraft.title.trim()) return toast.error("Title and file are required");
    if (f.size > 20 * 1024 * 1024) return toast.error("File must be under 20MB");
    setBusy(true);
    const path = `${schoolId}/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]/g, "_")}`;
    const up = await supabase.storage.from("curriculum-files").upload(path, f);
    if (up.error) { setBusy(false); return toast.error(up.error.message); }
    const { error } = await db.from("curriculum_documents").insert({
      school_id: schoolId, title: docDraft.title.trim().slice(0, 200), description: docDraft.description.trim() || null,
      file_path: path, uploaded_by: user?.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setDocOpen(false); setDocDraft({ title: "", description: "", file: null }); load();
  };

  const download = async (d: any) => {
    const { data, error } = await supabase.storage.from("curriculum-files").createSignedUrl(d.file_path, 600);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  const deleteDoc = async (d: any) => {
    await supabase.storage.from("curriculum-files").remove([d.file_path]);
    await db.from("curriculum_documents").delete().eq("id", d.id);
    load();
  };

  const pick = (val: string, set: (v: string) => void, list: Opt[], ph: string) => (
    <Select value={val} onValueChange={set}>
      <SelectTrigger><SelectValue placeholder={ph} /></SelectTrigger>
      <SelectContent>{list.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
    </Select>
  );

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Curriculum</h1><p className="text-muted-foreground">Scheme of work, topic coverage and curriculum library.</p></div>
      <Tabs defaultValue="scheme">
        <TabsList className="w-full sm:w-auto overflow-x-auto"><TabsTrigger value="scheme">Scheme of work</TabsTrigger><TabsTrigger value="coverage">Coverage</TabsTrigger><TabsTrigger value="library">Library</TabsTrigger></TabsList>

        <TabsContent value="scheme" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {pick(termId, setTermId, terms, "Term")}{pick(classId, setClassId, classes, "Class")}{pick(subjectId, setSubjectId, subjects, "Subject")}
          </div>
          {classId && subjectId ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div><CardTitle>Weekly topics</CardTitle><CardDescription>{rows.filter((r) => r.is_covered).length} of {rows.length} covered</CardDescription></div>
                <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Add topic</Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {rows.length === 0 && <p className="text-sm text-muted-foreground">No topics yet.</p>}
                {rows.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 rounded-lg border p-3">
                    <Checkbox checked={r.is_covered} onCheckedChange={(v) => toggle(r, !!v)} className="mt-1" aria-label="Mark as taught" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">Week {r.week_number}: {r.topic}</p>
                      {r.objectives && <p className="text-sm text-muted-foreground whitespace-pre-line">{r.objectives}</p>}
                      {r.is_covered && r.covered_at && <p className="text-xs text-primary mt-1">Taught {new Date(r.covered_at).toLocaleDateString()}</p>}
                    </div>
                    {(isAdmin || r.created_by === user?.id) && <Button variant="ghost" size="icon" onClick={() => remove(r.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : <p className="text-sm text-muted-foreground">Choose a class and subject to view its scheme of work.</p>}
        </TabsContent>

        <TabsContent value="coverage">
          <Card><CardHeader><CardTitle>Coverage this term</CardTitle><CardDescription>Share of planned topics marked as taught.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {coverage.length === 0 && <p className="text-sm text-muted-foreground">No schemes of work for this term yet.</p>}
              {coverage.map((c) => (
                <div key={c.label} className="space-y-1">
                  <div className="flex justify-between text-sm"><span>{c.label}</span><span>{c.done}/{c.total} • {c.pct}%</span></div>
                  <Progress value={c.pct} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="library">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div><CardTitle>Curriculum library</CardTitle><CardDescription>National and school curriculum documents.</CardDescription></div>
              {isAdmin && <Button size="sm" onClick={() => setDocOpen(true)}><Upload className="h-4 w-4 mr-1" />Upload</Button>}
            </CardHeader>
            <CardContent className="space-y-2">
              {docs.length === 0 && <p className="text-sm text-muted-foreground">No documents uploaded.</p>}
              {docs.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex-1 min-w-0"><p className="font-medium truncate">{d.title}</p>{d.description && <p className="text-sm text-muted-foreground">{d.description}</p>}</div>
                  <Button variant="outline" size="sm" onClick={() => download(d)}><Download className="h-4 w-4" /></Button>
                  {isAdmin && <Button variant="ghost" size="icon" onClick={() => deleteDoc(d)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>Add topic</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Week</Label><Input type="number" min={1} max={20} value={draft.week_number} onChange={(e) => setDraft({ ...draft, week_number: Number(e.target.value) })} /></div>
            <div><Label>Topic</Label><Input value={draft.topic} onChange={(e) => setDraft({ ...draft, topic: e.target.value })} /></div>
            <div><Label>Objectives</Label><Textarea value={draft.objectives} onChange={(e) => setDraft({ ...draft, objectives: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={addTopic}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={docOpen} onOpenChange={setDocOpen}>
        <DialogContent><DialogHeader><DialogTitle>Upload curriculum document</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={docDraft.title} onChange={(e) => setDocDraft({ ...docDraft, title: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={docDraft.description} onChange={(e) => setDocDraft({ ...docDraft, description: e.target.value })} /></div>
            <div><Label>File (PDF, Word, max 20MB)</Label><Input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={(e) => setDocDraft({ ...docDraft, file: e.target.files?.[0] || null })} /></div>
          </div>
          <DialogFooter><Button onClick={uploadDoc} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Upload</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
