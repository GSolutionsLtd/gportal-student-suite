import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolFeatures } from "@/hooks/useSchoolFeatures";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, ExternalLink, Briefcase, Users, ClipboardList, Video, BarChart3, BookOpen, FileText, Sparkles } from "lucide-react";
import { format } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

interface Resource {
  id: string;
  title: string;
  description: string | null;
  category: string;
  url: string | null;
  is_published: boolean;
  created_at: string;
}

interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string | null;
  current_class_arm_id: string | null;
}

interface AssessmentRow {
  id: string;
  student_id: string;
  realistic: number; investigative: number; artistic: number;
  social: number; enterprising: number; conventional: number;
  dominant_type: string | null;
  holland_code: string | null;
  created_at: string;
}

interface SessionRow {
  id: string;
  student_id: string;
  notes: string | null;
  scheduled_at: string;
  status: string;
  meeting_url: string | null;
}

interface Path {
  rank: number;
  career_title: string;
  ss_subjects: string[];
  university_courses: string[];
  jamb_subjects: string[];
  jamb_cutoff: string | null;
  universities: string[];
  polytechnics: string[];
  colleges_of_education: string[];
  tech_skills: string[];
  soft_skills: string[];
  salary_insight: string | null;
  market_relevance: string | null;
}

export default function AdminCareerAid() {
  const { user } = useAuth();
  const { features, schoolId, loading: featuresLoading } = useSchoolFeatures();
  const { toast } = useToast();

  const [tab, setTab] = useState("resources");
  const [loading, setLoading] = useState(true);
  const [resources, setResources] = useState<Resource[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "general", url: "" });
  
  const [viewingRec, setViewingRec] = useState<{ name: string; summary: string | null; paths: Path[] } | null>(null);
  const [loadingRec, setLoadingRec] = useState(false);

  const load = async () => {
    if (!schoolId) return;
    setLoading(true);
    const [r, s, a, c] = await Promise.all([
      supabase.from("career_resources").select("id,title,description,category,url,is_published,created_at")
        .eq("school_id", schoolId).order("created_at", { ascending: false }),
      supabase.from("students").select("id,first_name,last_name,admission_number,current_class_arm_id")
        .eq("school_id", schoolId).eq("is_active", true).order("last_name"),
      supabase.from("career_assessments").select("id,student_id,realistic,investigative,artistic,social,enterprising,conventional,dominant_type,holland_code,created_at")
        .eq("school_id", schoolId).order("created_at", { ascending: false }),
      supabase.from("career_counseling_sessions").select("id,student_id,notes,scheduled_at,status,meeting_url")
        .eq("school_id", schoolId).order("scheduled_at", { ascending: false }),
    ]);
    if (r.error) toast({ title: "Resources error", description: r.error.message, variant: "destructive" });
    setResources((r.data as Resource[]) || []);
    setStudents((s.data as StudentRow[]) || []);
    setAssessments((a.data as AssessmentRow[]) || []);
    setSessions((c.data as SessionRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!schoolId) return;
    load();
    const channel = supabase
      .channel(`admin-careeraid-${schoolId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "career_counseling_sessions", filter: `school_id=eq.${schoolId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "career_assessments", filter: `school_id=eq.${schoolId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [schoolId]);

  const save = async () => {
    if (!form.title.trim() || !schoolId || !user) return;
    setSaving(true);
    const { error } = await supabase.from("career_resources").insert({
      school_id: schoolId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || "general",
      url: form.url.trim() || null,
      posted_by: user.id,
    });
    setSaving(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Resource posted" });
    setOpen(false);
    setForm({ title: "", description: "", category: "general", url: "" });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this resource?")) return;
    const { error } = await supabase.from("career_resources").delete().eq("id", id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setResources((rs) => rs.filter((x) => x.id !== id));
  };

  const studentName = (id: string) => {
    const s = students.find((x) => x.id === id);
    return s ? `${s.first_name} ${s.last_name}` : "Unknown student";
  };

  const viewRecommendation = async (studentId: string, name: string) => {
    setLoadingRec(true);
    const { data: rec } = await supabase.from("career_recommendations")
      .select("id, summary, paths:career_recommendation_paths(*)")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (!rec) {
      toast({ title: "No recommendation", description: "This student hasn't generated recommendations yet.", variant: "default" });
    } else {
      setViewingRec({ name, summary: rec.summary, paths: (rec.paths as Path[] || []).sort((a,b) => a.rank - b.rank) });
    }
    setLoadingRec(false);
  };

  const dominantDistribution = useMemo(() => {
    const counts: Record<string, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
    for (const a of assessments) {
      const code = (a.holland_code || "").charAt(0).toUpperCase();
      if (code in counts) counts[code]++;
    }
    return Object.entries(counts).map(([code, value]) => ({ code, value }));
  }, [assessments]);

  if (featuresLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!features.careeraid) {
    return (
      <div className="max-w-xl mx-auto mt-12 text-center space-y-3">
        <Briefcase className="h-12 w-12 mx-auto text-muted-foreground" />
        <h2 className="text-xl font-bold">CareerAid is not enabled</h2>
        <p className="text-muted-foreground">Ask your super admin to enable it.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-careeraid">
      <div>
        <h1 className="text-2xl font-bold">CareerAid Clinic</h1>
        <p className="text-muted-foreground">Oversee guidance resources, personality assessments, and career plans.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="resources"><BookOpen className="h-4 w-4 mr-2" />Resources</TabsTrigger>
          <TabsTrigger value="students"><Users className="h-4 w-4 mr-2" />Students</TabsTrigger>
          <TabsTrigger value="assessments"><ClipboardList className="h-4 w-4 mr-2" />Assessments</TabsTrigger>
          <TabsTrigger value="counseling"><Video className="h-4 w-4 mr-2" />Counseling</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="h-4 w-4 mr-2" />Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="resources" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />New resource</Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : resources.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">No resources yet.</CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {resources.map((r) => (
                <Card key={r.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <CardTitle className="text-base">{r.title}</CardTitle>
                        <CardDescription>{format(new Date(r.created_at), "PP")}</CardDescription>
                      </div>
                      <Badge variant="secondary">{r.category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {r.description && <p className="text-sm text-foreground/80">{r.description}</p>}
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <ExternalLink className="h-3 w-3" /> Open link
                      </a>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => remove(r.id)} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="students">
          <Card>
            <CardHeader><CardTitle>All students</CardTitle><CardDescription>School-wide roster for CareerAid oversight.</CardDescription></CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <p className="text-muted-foreground text-sm">No active students.</p>
              ) : (
                <div className="divide-y">
                  {students.map((s) => {
                    const hasAssessment = assessments.some((a) => a.student_id === s.id);
                    const name = `${s.first_name} ${s.last_name}`;
                    return (
                      <div key={s.id} className="flex items-center justify-between py-2">
                        <div>
                          <p className="font-medium">{name}</p>
                          <p className="text-xs text-muted-foreground">{s.admission_number || "—"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={hasAssessment ? "default" : "outline"}>
                            {hasAssessment ? "Assessed" : "Pending"}
                          </Badge>
                          {hasAssessment && (
                            <Button size="sm" variant="ghost" onClick={() => viewRecommendation(s.id, name)}>
                              <FileText className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assessments">
          <Card>
            <CardHeader><CardTitle>Personality Test assessments</CardTitle><CardDescription>Latest student submissions.</CardDescription></CardHeader>
            <CardContent>
              {assessments.length === 0 ? (
                <p className="text-muted-foreground text-sm">No assessments yet.</p>
              ) : (
                <div className="divide-y">
                  {assessments.map((a) => (
                    <div key={a.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{studentName(a.student_id)}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(a.created_at), "PP")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge>{a.dominant_type || "—"} ({a.holland_code || "—"})</Badge>
                        <Button size="sm" variant="outline" onClick={() => viewRecommendation(a.student_id, studentName(a.student_id))}>
                          View Plan
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="counseling">
          <Card>
            <CardHeader><CardTitle>Counseling sessions</CardTitle><CardDescription>Live monitoring of scheduled sessions.</CardDescription></CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-muted-foreground text-sm">No counseling sessions scheduled.</p>
              ) : (
                <div className="divide-y">
                  {sessions.map((s) => (
                    <div key={s.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium">{studentName(s.student_id)}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.notes || "General guidance"} • {format(new Date(s.scheduled_at), "PPp")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{s.status}</Badge>
                        {s.meeting_url && (
                          <a href={s.meeting_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" /> Join
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader><CardTitle>Personality Test distribution</CardTitle><CardDescription>Dominant interest types across {assessments.length} assessments.</CardDescription></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dominantDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="code" stroke="hsl(var(--foreground))" />
                  <YAxis allowDecimals={false} stroke="hsl(var(--foreground))" />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New career resource</DialogTitle>
            <DialogDescription>Share guidance with students in your school.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. scholarships, STEM" /></div>
            <div><Label>Description</Label><Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Link (optional)</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.title.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingRec} onOpenChange={(o) => !o && setViewingRec(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Career Plan: {viewingRec?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            {viewingRec?.summary && <p className="text-sm text-foreground/80 leading-relaxed">{viewingRec.summary}</p>}
            <div className="space-y-4">
              {viewingRec?.paths.map((p) => (
                <Card key={p.rank} className="border-primary/20">
                  <CardHeader className="py-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Badge>{p.rank}</Badge>{p.career_title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid md:grid-cols-2 gap-x-4 gap-y-3 text-xs pb-4">
                    <Info label="SS Subjects" value={p.ss_subjects.join(", ")} />
                    <Info label="University Courses" value={p.university_courses.join(", ")} />
                    <Info label="JAMB Subjects" value={p.jamb_subjects.join(", ")} />
                    <Info label="JAMB Cut-off" value={p.jamb_cutoff} />
                    <Info label="Universities" value={p.universities.join(", ")} />
                    <Info label="Polytechnics" value={p.polytechnics.join(", ")} />
                    <Info label="Colleges" value={p.colleges_of_education.join(", ")} />
                    <Info label="Tech Skills" value={p.tech_skills.join(", ")} />
                    <Info label="Soft Skills" value={p.soft_skills.join(", ")} />
                    <Info label="Salary" value={p.salary_insight} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-muted-foreground font-medium mb-0.5">{label}</p>
      <p className="text-foreground">{value || "-"}</p>
    </div>
  );
}
