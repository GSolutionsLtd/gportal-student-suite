import { useEffect, useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Briefcase, Sparkles, Download, Video, Mic, History, ExternalLink, Bookmark, BookmarkCheck, Target, Plus, Trash2, CheckCircle2, Calendar } from "lucide-react";
import { HOLLAND_QUESTIONS, HOLLAND_LABELS, HollandType } from "@/data/hollandQuestions";
import jsPDF from "jspdf";
import { format } from "date-fns";

interface Resource { id: string; title: string; description: string | null; category: string; url: string | null; }
interface Path {
  id: string; rank: number; career_title: string;
  ss_subjects: string[]; university_courses: string[]; jamb_subjects: string[]; jamb_cutoff: string | null;
  universities: string[]; polytechnics: string[]; colleges_of_education: string[];
  tech_skills: string[]; soft_skills: string[]; salary_insight: string | null; market_relevance: string | null;
}
interface Recommendation { id: string; summary: string | null; created_at: string; paths: Path[]; }

export default function StudentCareerAid() {
  const { user } = useAuth();
  const { features, loading: featuresLoading } = useSchoolFeatures();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string>("");
  const [schoolId, setSchoolId] = useState<string | null>(null);

  // Library
  const [resources, setResources] = useState<Resource[]>([]);
  const [saves, setSaves] = useState<Set<string>>(new Set());

  // Assessment
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submittingQuiz, setSubmittingQuiz] = useState(false);

  // Recommendations
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [genLoading, setGenLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("assessment");

  // Counseling
  const [sessions, setSessions] = useState<any[]>([]);
  const [bookDate, setBookDate] = useState("");
  const [ratings, setRatings] = useState<Record<string, { rating: number; comment: string | null }>>({});
  const [ratingDraft, setRatingDraft] = useState<Record<string, { rating: number; comment: string }>>({});
  const [ratingBusy, setRatingBusy] = useState<string | null>(null);


  // Mock interview
  const [interviewCareer, setInterviewCareer] = useState("");
  const [activeInterview, setActiveInterview] = useState<{ id: string; questions: { q: string }[] } | null>(null);
  const [interviewAnswers, setInterviewAnswers] = useState<string[]>([]);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewResult, setInterviewResult] = useState<{ score: number; feedback: string } | null>(null);

  // My Plan — goals
  interface Goal { id: string; title: string; description: string | null; target_date: string | null; status: "not_started" | "in_progress" | "completed"; progress: number; }
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoal, setNewGoal] = useState({ title: "", description: "", target_date: "", status: "not_started" as Goal["status"], progress: 0 });
  const [goalSaving, setGoalSaving] = useState(false);


  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: s } = await supabase.from("students").select("id, school_id, first_name, last_name").eq("user_id", user.id).maybeSingle();
      if (!s || !(s as any).school_id) { setLoading(false); return; }
      const sid = (s as any).id as string;
      const schId = (s as any).school_id as string;
      setStudentId(sid); setSchoolId(schId);
      setStudentName(`${(s as any).first_name ?? ""} ${(s as any).last_name ?? ""}`.trim());
      await Promise.all([loadLibrary(sid, schId), loadRecommendations(sid), loadSessions(sid), loadGoals(sid)]);
      setLoading(false);
    })();
    // eslint-disable-next-line
  }, [user]);

  const loadLibrary = async (sid: string, schId: string) => {
    const [{ data: res }, { data: sv }] = await Promise.all([
      supabase.from("career_resources").select("id, title, description, category, url")
        .eq("school_id", schId).eq("is_published", true).order("created_at", { ascending: false }),
      supabase.from("student_career_saves").select("resource_id").eq("student_id", sid),
    ]);
    setResources((res as Resource[]) || []);
    setSaves(new Set(((sv as any[]) || []).map((x) => x.resource_id)));
  };

  const loadRecommendations = async (sid: string) => {
    const { data: rs, error: recError } = await supabase.from("career_recommendations")
      .select("id, summary, created_at").eq("student_id", sid).order("created_at", { ascending: false });
    if (recError) {
      toast({ title: "Could not load recommendations", description: recError.message, variant: "destructive" });
      setRecs([]);
      return;
    }
    if (!rs || rs.length === 0) { setRecs([]); return; }
    const ids = rs.map((r) => r.id);
    const { data: pths, error: pathError } = await supabase.from("career_recommendation_paths")
      .select("*").in("recommendation_id", ids).order("rank");
    if (pathError) {
      toast({ title: "Could not load career paths", description: pathError.message, variant: "destructive" });
    }
    const grouped: Recommendation[] = (rs as any[]).map((r) => ({
      ...r, paths: ((pths as any[]) || []).filter((p) => p.recommendation_id === r.id),
    }));
    setRecs(grouped);
  };

  const loadSessions = async (sid: string) => {
    const { data } = await supabase.from("career_counseling_sessions")
      .select("*").eq("student_id", sid).order("scheduled_at", { ascending: false });
    setSessions((data as any[]) || []);
    if (user) {
      const { data: rt } = await supabase.from("counselor_session_ratings")
        .select("session_id, rating, comment").eq("rater_user_id", user.id);
      const map: Record<string, { rating: number; comment: string | null }> = {};
      ((rt as any[]) || []).forEach((r) => { map[r.session_id] = { rating: r.rating, comment: r.comment }; });
      setRatings(map);
    }
  };

  const submitRating = async (sessionId: string) => {
    const draft = ratingDraft[sessionId];
    if (!draft?.rating) return toast({ title: "Pick a star rating", variant: "destructive" });
    setRatingBusy(sessionId);
    const { error } = await supabase.from("counselor_session_ratings").insert({
      session_id: sessionId, rating: draft.rating, comment: draft.comment?.trim() || null,
    } as any);
    setRatingBusy(null);
    if (error) return toast({ title: "Could not save review", description: error.message, variant: "destructive" });
    toast({ title: "Thanks for your review" });
    if (studentId) await loadSessions(studentId);
  };


  const loadGoals = async (sid: string) => {
    const { data } = await supabase.from("career_plan_goals")
      .select("id, title, description, target_date, status, progress")
      .eq("student_id", sid).order("created_at", { ascending: false });
    setGoals((data as Goal[]) || []);
  };

  const addGoal = async () => {
    if (!studentId || !schoolId || !newGoal.title.trim()) return;
    setGoalSaving(true);
    const { error } = await supabase.from("career_plan_goals").insert({
      student_id: studentId, school_id: schoolId,
      title: newGoal.title.trim(),
      description: newGoal.description.trim() || null,
      target_date: newGoal.target_date || null,
      status: newGoal.status,
      progress: newGoal.progress,
    });
    setGoalSaving(false);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setNewGoal({ title: "", description: "", target_date: "", status: "not_started", progress: 0 });
    await loadGoals(studentId);
    toast({ title: "Goal added" });
  };

  const updateGoal = async (id: string, patch: Partial<Goal>) => {
    const { error } = await supabase.from("career_plan_goals").update(patch).eq("id", id);
    if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
    if (studentId) loadGoals(studentId);
  };

  const deleteGoal = async (id: string) => {
    if (!confirm("Delete this goal?")) return;
    const { error } = await supabase.from("career_plan_goals").delete().eq("id", id);
    if (error) return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    if (studentId) loadGoals(studentId);
  };


  const toggleSave = async (rid: string) => {
    if (!studentId) return;
    if (saves.has(rid)) {
      await supabase.from("student_career_saves").delete().eq("student_id", studentId).eq("resource_id", rid);
      const n = new Set(saves); n.delete(rid); setSaves(n);
    } else {
      await supabase.from("student_career_saves").insert({ student_id: studentId, resource_id: rid });
      setSaves(new Set(saves).add(rid));
    }
  };

  const submitAssessment = async () => {
    if (!studentId || !schoolId) return;
    if (Object.keys(answers).length < HOLLAND_QUESTIONS.length) {
      return toast({ title: "Please answer all questions", variant: "destructive" });
    }
    setSubmittingQuiz(true);
    const totals: Record<HollandType, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
    for (const q of HOLLAND_QUESTIONS) totals[q.type] += answers[q.id] || 0;
    const sorted = (Object.keys(totals) as HollandType[]).sort((a, b) => totals[b] - totals[a]);
    const dominant = sorted[0];
    const code = sorted.slice(0, 3).join("");

    const { data: assess, error } = await supabase.from("career_assessments").insert({
      student_id: studentId, school_id: schoolId,
      realistic: totals.R, investigative: totals.I, artistic: totals.A,
      social: totals.S, enterprising: totals.E, conventional: totals.C,
      dominant_type: HOLLAND_LABELS[dominant], holland_code: code, raw_answers: answers,
    }).select("id").single();
    setSubmittingQuiz(false);
    if (error || !assess) return toast({ title: "Error", description: error?.message, variant: "destructive" });

    toast({ title: "Assessment saved", description: `Dominant: ${HOLLAND_LABELS[dominant]} (${code})` });
    await generateRecommendations(assess.id);
  };

  const generateRecommendations = async (assessmentId: string) => {
    setGenLoading(true);
    const { data, error } = await supabase.functions.invoke("careeraid-recommend", { body: { assessment_id: assessmentId } });
    setGenLoading(false);
    if (error || (data as any)?.error) {
      return toast({ title: "Recommendation failed", description: (data as any)?.error || error?.message, variant: "destructive" });
    }
    const response = data as { recommendation_id?: string; summary?: string; paths?: Path[]; source?: string } | null;
    if (response?.recommendation_id && Array.isArray(response.paths)) {
      setRecs((current) => [{
        id: response.recommendation_id,
        summary: response.summary || null,
        created_at: new Date().toISOString(),
        paths: response.paths.map((p) => ({ ...p, id: p.id || `${response.recommendation_id}-${p.rank}` })),
      }, ...current.filter((r) => r.id !== response.recommendation_id)]);
    }
    setActiveTab("plan");
    toast({
      title: "Recommendations ready",
      description: response?.source === "fallback" ? "Generated from the built-in CareerAid guide." : "Your career plan is ready.",
    });
    if (studentId) await loadRecommendations(studentId);
  };

  const downloadPdf = (rec: Recommendation) => {
    const doc = new jsPDF();
    let y = 15;
    doc.setFontSize(18); doc.text("CareerAid — Career Plan", 14, y); y += 8;
    doc.setFontSize(10); doc.text(`Student: ${studentName}`, 14, y); y += 5;
    doc.text(`Generated: ${format(new Date(rec.created_at), "PPp")}`, 14, y); y += 8;
    if (rec.summary) { doc.setFontSize(11); doc.text(doc.splitTextToSize(rec.summary, 180), 14, y); y += doc.splitTextToSize(rec.summary, 180).length * 5 + 4; }
    rec.paths.forEach((p) => {
      if (y > 260) { doc.addPage(); y = 15; }
      doc.setFontSize(13); doc.setFont(undefined, "bold");
      doc.text(`${p.rank}. ${p.career_title}`, 14, y); y += 6;
      doc.setFontSize(9); doc.setFont(undefined, "normal");
      const lines = [
        `SS Subjects: ${p.ss_subjects.join(", ")}`,
        `University courses: ${p.university_courses.join(", ")}`,
        `JAMB subjects: ${p.jamb_subjects.join(", ")}  |  Cut-off: ${p.jamb_cutoff || "-"}`,
        `Universities: ${p.universities.join(", ")}`,
        `Polytechnics: ${p.polytechnics.join(", ")}`,
        `Colleges of Education: ${p.colleges_of_education.join(", ")}`,
        `Tech skills: ${p.tech_skills.join(", ")}`,
        `Soft skills: ${p.soft_skills.join(", ")}`,
        `Salary: ${p.salary_insight || "-"}`,
        `Market relevance: ${p.market_relevance || "-"}`,
      ];
      lines.forEach((l) => {
        const split = doc.splitTextToSize(l, 180);
        if (y + split.length * 4 > 285) { doc.addPage(); y = 15; }
        doc.text(split, 14, y); y += split.length * 4 + 1;
      });
      y += 3;
    });
    doc.save(`careeraid-${format(new Date(rec.created_at), "yyyyMMdd-HHmm")}.pdf`);
  };

  const bookSession = async () => {
    if (!studentId || !schoolId || !bookDate) return;
    const room = `careeraid-${studentId.slice(0, 8)}-${Date.now()}`;
    const { error } = await supabase.from("career_counseling_sessions").insert({
      school_id: schoolId, student_id: studentId,
      scheduled_at: new Date(bookDate).toISOString(),
      meeting_url: `https://meet.jit.si/${room}`,
    });
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Session booked" });
    setBookDate("");
    await loadSessions(studentId);
  };

  const startInterview = async () => {
    if (!interviewCareer.trim()) return;
    setInterviewLoading(true); setInterviewResult(null);
    const { data, error } = await supabase.functions.invoke("careeraid-mock-interview",
      { body: { action: "start", career_path: interviewCareer.trim() } });
    setInterviewLoading(false);
    if (error || (data as any)?.error) return toast({ title: "Error", description: (data as any)?.error || error?.message, variant: "destructive" });
    setActiveInterview(data as any);
    setInterviewAnswers(new Array((data as any).questions.length).fill(""));
  };

  const submitInterview = async () => {
    if (!activeInterview) return;
    setInterviewLoading(true);
    const { data, error } = await supabase.functions.invoke("careeraid-mock-interview",
      { body: { action: "submit", interview_id: activeInterview.id, answers: interviewAnswers } });
    setInterviewLoading(false);
    if (error || (data as any)?.error) return toast({ title: "Error", description: (data as any)?.error || error?.message, variant: "destructive" });
    setInterviewResult(data as any);
    setActiveInterview(null);
  };

  if (featuresLoading || loading) return <div className="flex justify-center h-64 items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!features.careeraid) return (
    <div className="max-w-xl mx-auto mt-12 text-center space-y-3">
      <Briefcase className="h-12 w-12 mx-auto text-muted-foreground" />
      <h2 className="text-xl font-bold">CareerAid is not enabled</h2>
      <p className="text-muted-foreground">Ask your school admin to enable it.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">CareerAid Clinic</h1>
        <p className="text-muted-foreground">AI-powered career guidance for Nigerian students.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="assessment">Assessment</TabsTrigger>
          <TabsTrigger value="plan">My Plan</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="counseling">Counseling</TabsTrigger>
          <TabsTrigger value="interview">Mock Interview</TabsTrigger>
          <TabsTrigger value="explore">Explore</TabsTrigger>
        </TabsList>

        <TabsContent value="assessment">
          <Card>
            <CardHeader>
              <CardTitle>Personality Assessment</CardTitle>
              <CardDescription>Rate how much each statement describes you (1 = not at all, 5 = strongly).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {HOLLAND_QUESTIONS.map((q) => (
                <div key={q.id} className="border-b pb-3">
                  <p className="text-sm font-medium mb-2">{q.id}. {q.text}</p>
                  <RadioGroup
                    value={String(answers[q.id] ?? "")}
                    onValueChange={(v) => setAnswers({ ...answers, [q.id]: Number(v) })}
                    className="flex gap-3"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div key={n} className="flex items-center gap-1">
                        <RadioGroupItem value={String(n)} id={`q${q.id}-${n}`} />
                        <Label htmlFor={`q${q.id}-${n}`} className="text-xs">{n}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              ))}
              <Button onClick={submitAssessment} disabled={submittingQuiz || genLoading} className="w-full">
                {(submittingQuiz || genLoading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Sparkles className="h-4 w-4 mr-2" />{genLoading ? "Generating AI recommendations..." : "Submit & Generate Recommendations"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plan" className="space-y-6">
          {/* Latest recommendation */}
          {recs.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">Take the assessment to generate your career plan.</CardContent></Card>
          ) : (
            <RecommendationView rec={recs[0]} onDownload={() => downloadPdf(recs[0])} />
          )}

          {/* Goals & Milestones */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" />Goals & Milestones</CardTitle>
              <CardDescription>Set personal career goals and track your progress.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-2 p-3 border rounded-lg">
                <Input placeholder="Goal title (e.g. Pass JAMB with 280+)" value={newGoal.title} onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })} />
                <Input type="date" value={newGoal.target_date} onChange={(e) => setNewGoal({ ...newGoal, target_date: e.target.value })} />
                <Textarea className="md:col-span-2" placeholder="Description / milestones (optional)" value={newGoal.description} onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })} rows={2} />
                <Button className="md:col-span-2" onClick={addGoal} disabled={goalSaving || !newGoal.title.trim()}>
                  {goalSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}<Plus className="h-4 w-4 mr-1" />Add goal
                </Button>
              </div>
              {goals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No goals yet. Add your first career goal above.</p>
              ) : (
                <div className="space-y-3">
                  {goals.map((g) => (
                    <div key={g.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium flex items-center gap-2">
                            {g.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Target className="h-4 w-4 text-primary" />}
                            {g.title}
                          </p>
                          {g.description && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{g.description}</p>}
                          {g.target_date && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Calendar className="h-3 w-3" />Target: {format(new Date(g.target_date), "PP")}</p>}
                        </div>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteGoal(g.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select value={g.status} onValueChange={(v) => updateGoal(g.id, { status: v as Goal["status"], progress: v === "completed" ? 100 : g.progress })}>
                          <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="not_started">Not started</SelectItem>
                            <SelectItem value="in_progress">In progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input type="number" min={0} max={100} className="w-20 h-8" value={g.progress}
                          onChange={(e) => updateGoal(g.id, { progress: Math.max(0, Math.min(100, Number(e.target.value))) })} />
                        <span className="text-xs text-muted-foreground">%</span>
                        <Progress value={g.progress} className="flex-1 h-2" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Saved resources */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BookmarkCheck className="h-5 w-5 text-primary" />Saved Resources</CardTitle>
              <CardDescription>Career resources you've pinned from the Explore tab.</CardDescription>
            </CardHeader>
            <CardContent>
              {resources.filter((r) => saves.has(r.id)).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No saved resources. Visit Explore to pin items.</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {resources.filter((r) => saves.has(r.id)).map((r) => (
                    <div key={r.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start gap-2">
                        <p className="font-medium text-sm">{r.title}</p>
                        <Badge variant="secondary" className="text-xs">{r.category}</Badge>
                      </div>
                      {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                      {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"><ExternalLink className="h-3 w-3" />Open</a>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming counseling sessions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Video className="h-5 w-5 text-primary" />Counseling Sessions</CardTitle>
              <CardDescription>Your booked and past counseling sessions.</CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No sessions yet. Book one from the Counseling tab.</p>
              ) : (
                <div className="space-y-2">
                  {sessions.slice(0, 5).map((s) => (
                    <div key={s.id} className="flex justify-between items-center border rounded p-3">
                      <div>
                        <p className="text-sm font-medium">{format(new Date(s.scheduled_at), "PPp")}</p>
                        <Badge variant="secondary" className="mt-1 text-xs">{s.status}</Badge>
                      </div>
                      {s.meeting_url && (
                        <a href={s.meeting_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline"><Video className="h-4 w-4 mr-1" />Join</Button>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="history">
          {recs.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">No history yet.</CardContent></Card>
          ) : (
            <div className="space-y-4">{recs.map((r) => <RecommendationView key={r.id} rec={r} onDownload={() => downloadPdf(r)} />)}</div>
          )}
        </TabsContent>

        <TabsContent value="counseling">
          <Card>
            <CardHeader><CardTitle>Book a counseling session</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 items-end">
                <div className="flex-1"><Label>Date & time</Label>
                  <Input type="datetime-local" value={bookDate} onChange={(e) => setBookDate(e.target.value)} /></div>
                <Button
                  onClick={bookSession}
                  disabled={!bookDate || sessions.some((s) => s.status === "completed" && !ratings[s.id])}
                >
                  <Video className="h-4 w-4 mr-2" />Book
                </Button>
              </div>
              {sessions.some((s) => s.status === "completed" && !ratings[s.id]) && (
                <p className="text-xs text-destructive">
                  Please review and rate your last completed session before booking a new one.
                </p>
              )}
              <div className="space-y-2 mt-4">
                {sessions.length === 0 ? <p className="text-sm text-muted-foreground">No sessions booked.</p> :
                  sessions.map((s) => (
                    <div key={s.id} className="border rounded p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium">{format(new Date(s.scheduled_at), "PPp")}</p>
                          <Badge variant="secondary" className="mt-1">{s.status}</Badge>
                        </div>
                        {s.meeting_url && (
                          <a href={s.meeting_url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline"><Video className="h-4 w-4 mr-1" />Join</Button>
                          </a>
                        )}
                      </div>
                      {s.status === "completed" && (
                        ratings[s.id] ? (
                          <p className="text-xs text-muted-foreground">You rated this session {ratings[s.id].rating}/5</p>
                        ) : (
                          <div className="space-y-2 border-t pt-2">
                            <p className="text-xs font-medium">Review required — rate your counselor</p>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <button key={n} type="button" aria-label={`${n} star`}
                                  onClick={() => setRatingDraft({ ...ratingDraft, [s.id]: { rating: n, comment: ratingDraft[s.id]?.comment ?? "" } })}>
                                  <Star className={`h-5 w-5 ${(ratingDraft[s.id]?.rating ?? 0) >= n ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                                </button>
                              ))}
                            </div>
                            <Textarea rows={2} placeholder="How helpful was the session?"
                              value={ratingDraft[s.id]?.comment ?? ""}
                              onChange={(e) => setRatingDraft({ ...ratingDraft, [s.id]: { rating: ratingDraft[s.id]?.rating ?? 0, comment: e.target.value } })} />
                            <Button size="sm" disabled={ratingBusy === s.id} onClick={() => submitRating(s.id)}>
                              {ratingBusy === s.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Submit review
                            </Button>
                          </div>
                        )
                      )}
                    </div>
                  ))}
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interview">
          <Card>
            <CardHeader><CardTitle>Mock Interview</CardTitle><CardDescription>Practice career-specific questions with AI scoring.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {!activeInterview && !interviewResult && (
                <div className="flex gap-2">
                  <Input placeholder="e.g. Medical Doctor, Software Engineer" value={interviewCareer} onChange={(e) => setInterviewCareer(e.target.value)} />
                  <Button onClick={startInterview} disabled={interviewLoading || !interviewCareer.trim()}>
                    {interviewLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}<Mic className="h-4 w-4 mr-1" />Start
                  </Button>
                </div>
              )}
              {activeInterview && (
                <div className="space-y-3">
                  {activeInterview.questions.map((q, i) => (
                    <div key={i}>
                      <Label className="text-sm font-medium">Q{i + 1}. {q.q}</Label>
                      <Textarea rows={3} value={interviewAnswers[i] || ""}
                        onChange={(e) => { const a = [...interviewAnswers]; a[i] = e.target.value; setInterviewAnswers(a); }} />
                    </div>
                  ))}
                  <Button onClick={submitInterview} disabled={interviewLoading} className="w-full">
                    {interviewLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit for scoring
                  </Button>
                </div>
              )}
              {interviewResult && (
                <Card>
                  <CardHeader><CardTitle>Score: {interviewResult.score}/100</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{interviewResult.feedback}</p>
                    <Button variant="outline" className="mt-3" onClick={() => { setInterviewResult(null); setInterviewCareer(""); }}>New interview</Button>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="explore">
          {resources.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">No resources shared yet.</CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {resources.map((r) => (
                <Card key={r.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-base">{r.title}</CardTitle>
                      <Badge variant="secondary">{r.category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {r.description && <p className="text-sm text-foreground/80">{r.description}</p>}
                    <div className="flex items-center justify-between">
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <ExternalLink className="h-3 w-3" /> Open
                        </a>
                      ) : <span />}
                      <Button size="sm" variant={saves.has(r.id) ? "default" : "outline"} onClick={() => toggleSave(r.id)}>
                        {saves.has(r.id) ? <BookmarkCheck className="h-4 w-4 mr-1" /> : <Bookmark className="h-4 w-4 mr-1" />}
                        {saves.has(r.id) ? "Saved" : "Save"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RecommendationView({ rec, onDownload }: { rec: Recommendation; onDownload: () => void }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start gap-2">
          <div>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Career Plan</CardTitle>
            <CardDescription>{format(new Date(rec.created_at), "PPp")}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onDownload}><Download className="h-4 w-4 mr-2" />PDF</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {rec.summary && <p className="text-sm text-foreground/80">{rec.summary}</p>}
        {rec.paths.map((p) => (
          <Card key={p.id} className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Badge>{p.rank}</Badge>{p.career_title}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-2 text-xs">
              <Info label="SS Subjects" value={p.ss_subjects.join(", ")} />
              <Info label="University Courses" value={p.university_courses.join(", ")} />
              <Info label="JAMB Subjects" value={p.jamb_subjects.join(", ")} />
              <Info label="JAMB Cut-off" value={p.jamb_cutoff} />
              <Info label="Universities" value={p.universities.join(", ")} />
              <Info label="Polytechnics" value={p.polytechnics.join(", ")} />
              <Info label="Colleges of Education" value={p.colleges_of_education.join(", ")} />
              <Info label="Tech Skills" value={p.tech_skills.join(", ")} />
              <Info label="Soft Skills" value={p.soft_skills.join(", ")} />
              <Info label="Salary" value={p.salary_insight} />
              <Info label="Market Relevance" value={p.market_relevance} className="md:col-span-2" />
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}

function Info({ label, value, className }: { label: string; value: string | null; className?: string }) {
  return (
    <div className={className}>
      <p className="text-muted-foreground font-medium">{label}</p>
      <p>{value || "-"}</p>
    </div>
  );
}
