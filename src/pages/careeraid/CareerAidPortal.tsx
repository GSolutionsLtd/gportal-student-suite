import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Logo } from "@/components/Logo";
import { HOLLAND_QUESTIONS, HOLLAND_LABELS, HollandType } from "@/data/hollandQuestions";
import {
  Loader2, Compass, Sparkles, GraduationCap, Video, Target, CheckCircle2, ArrowRight, ShieldCheck,
  Lock, Star, LogOut,
} from "lucide-react";

import { format } from "date-fns";

interface Path {
  id?: string;
  rank: number;
  career_title: string;
  ss_subjects: string[] | null;
  university_courses: string[] | null;
  jamb_subjects: string[] | null;
  jamb_cutoff: string | null;
  universities: string[] | null;
  polytechnics: string[] | null;
  tech_skills: string[] | null;
  soft_skills: string[] | null;
  salary_insight: string | null;
  market_relevance: string | null;
}

interface Recommendation {
  id: string;
  summary: string | null;
  created_at: string;
  paths: Path[];
}

const SCALE = [
  { v: 1, label: "Not me" },
  { v: 2, label: "Rarely" },
  { v: 3, label: "Sometimes" },
  { v: 4, label: "Often" },
  { v: 5, label: "Very me" },
];

export default function CareerAidPortal() {
  const { user, isLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [schoolStudent, setSchoolStudent] = useState<{ schoolCode: string } | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [tab, setTab] = useState("assessment");

  // subscribe form
  const [form, setForm] = useState({ full_name: "", phone: "", class_level: "", state_of_residence: "" });
  const [paying, setPaying] = useState(false);

  // assessment
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [recs, setRecs] = useState<Recommendation[]>([]);

  // goals
  const [goals, setGoals] = useState<any[]>([]);
  const [goalTitle, setGoalTitle] = useState("");

  // counseling
  const [sessions, setSessions] = useState<any[]>([]);
  const [booking, setBooking] = useState({ scheduled_at: "", topic: "" });
  const [bookingBusy, setBookingBusy] = useState(false);
  const [counselors, setCounselors] = useState<{ user_id: string; full_name: string; headline?: string | null; specializations?: string[] | null; years_experience?: number | null; availability?: any; sessions_completed: number; average_rating: number | null }[]>([]);
  const [ratings, setRatings] = useState<Record<string, { rating: number; comment: string | null }>>({});
  const [ratingDraft, setRatingDraft] = useState<Record<string, { rating: number; comment: string }>>({});
  const [ratingBusy, setRatingBusy] = useState<string | null>(null);

  const active = subscription?.status === "active"
    && (!subscription?.expires_at || new Date(subscription.expires_at) > new Date());

  const unratedSessions = useMemo(
    () => sessions.filter((s) => s.status === "completed" && !ratings[s.id]),
    [sessions, ratings],
  );

  const loadAll = async (uid: string) => {
    const [{ data: recRows }, { data: goalRows }, { data: sessionRows }] = await Promise.all([
      supabase.from("career_recommendations")
        .select("id, summary, created_at, paths:career_recommendation_paths(*)")
        .eq("subscriber_user_id", uid).order("created_at", { ascending: false }),
      supabase.from("career_plan_goals").select("*").eq("subscriber_user_id", uid).order("created_at", { ascending: false }),
      supabase.from("career_counseling_sessions").select("*").eq("subscriber_user_id", uid).order("scheduled_at", { ascending: false }),
    ]);
    setRecs(((recRows as any[]) ?? []).map((r) => ({ ...r, paths: (r.paths ?? []).sort((a: Path, b: Path) => a.rank - b.rank) })));
    setGoals((goalRows as any[]) ?? []);
    setSessions((sessionRows as any[]) ?? []);

    const { data: ratingRows } = await supabase
      .from("counselor_session_ratings").select("session_id, rating, comment").eq("rater_user_id", uid);
    const map: Record<string, { rating: number; comment: string | null }> = {};
    ((ratingRows as any[]) ?? []).forEach((r) => { map[r.session_id] = { rating: r.rating, comment: r.comment }; });
    setRatings(map);
  };

  const loadCounselors = async () => {
    const { data } = await supabase.rpc("list_career_counselors" as any);
    setCounselors((data as any[]) ?? []);
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
    if (user) { await loadAll(user.id); await loadCounselors().catch(() => {}); }
  };

  useEffect(() => {
    if (isLoading) return;
    if (!user) { setLoading(false); return; }

    (async () => {
      setLoading(true);
      const { data: student } = await supabase
        .from("students").select("id, schools(code)").eq("user_id", user.id).maybeSingle();
      if (student && (student as any).schools?.code) {
        setSchoolStudent({ schoolCode: (student as any).schools.code });
        setLoading(false);
        return;
      }

      const { data: sub } = await supabase
        .from("careeraid_subscriptions").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      setSubscription(sub);
      setForm((f) => ({ ...f, full_name: f.full_name || (sub as any)?.full_name || "" }));
      await loadAll(user.id);
      if ((sub as any)?.status === "active") await loadCounselors().catch(() => {});
      setLoading(false);
    })();
  }, [user, isLoading]);



  // Paystack callback
  useEffect(() => {
    const reference = params.get("reference") || params.get("trxref");
    if (!reference || !user) return;
    (async () => {
      const { data, error } = await supabase.functions.invoke("careeraid-subscription", {
        body: { action: "verify", reference },
      });
      if (error || (data as any)?.error) {
        toast({ title: "Payment not confirmed", description: (data as any)?.error || error?.message, variant: "destructive" });
      } else {
        toast({ title: "Subscription active", description: "Welcome to CareerAid Clinic." });
        const { data: sub } = await supabase.from("careeraid_subscriptions").select("*")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
        setSubscription(sub);
        await loadAll(user.id);
        await loadCounselors().catch(() => {});

      }
      params.delete("reference"); params.delete("trxref");
      setParams(params, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const startPayment = async () => {
    if (!form.full_name.trim()) return toast({ title: "Enter your full name", variant: "destructive" });
    setPaying(true);
    const { data, error } = await supabase.functions.invoke("careeraid-subscription", {
      body: { action: "initialize", ...form, callback_url: `${window.location.origin}/careeraid` },
    });
    setPaying(false);
    const url = (data as any)?.authorization_url;
    if (error || !url) {
      return toast({ title: "Could not start payment", description: (data as any)?.error || error?.message, variant: "destructive" });
    }
    window.location.href = url;
  };

  const progress = useMemo(
    () => Math.round((Object.keys(answers).length / HOLLAND_QUESTIONS.length) * 100),
    [answers],
  );

  const submitAssessment = async () => {
    if (!user) return;
    if (Object.keys(answers).length < HOLLAND_QUESTIONS.length) {
      return toast({ title: "Please answer all questions", variant: "destructive" });
    }
    setSubmitting(true);
    const totals: Record<HollandType, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
    for (const q of HOLLAND_QUESTIONS) totals[q.type] += answers[q.id] || 0;
    const sorted = (Object.keys(totals) as HollandType[]).sort((a, b) => totals[b] - totals[a]);
    const code = sorted.slice(0, 3).join("");

    const { data: assess, error } = await supabase.from("career_assessments").insert({
      subscriber_user_id: user.id,
      realistic: totals.R, investigative: totals.I, artistic: totals.A,
      social: totals.S, enterprising: totals.E, conventional: totals.C,
      dominant_type: HOLLAND_LABELS[sorted[0]], holland_code: code, raw_answers: answers,
    }).select("id").single();
    setSubmitting(false);
    if (error || !assess) return toast({ title: "Error", description: error?.message, variant: "destructive" });

    setGenerating(true);
    const { data, error: fnErr } = await supabase.functions.invoke("careeraid-recommend", {
      body: { assessment_id: assess.id },
    });
    setGenerating(false);
    if (fnErr || (data as any)?.error) {
      return toast({ title: "Recommendation failed", description: (data as any)?.error || fnErr?.message, variant: "destructive" });
    }
    await loadAll(user.id);
    setTab("plan");
    toast({ title: "Your career plan is ready" });
  };

  const addGoal = async () => {
    if (!user || !goalTitle.trim()) return;
    const { error } = await supabase.from("career_plan_goals").insert({
      subscriber_user_id: user.id, title: goalTitle.trim(), status: "in_progress", progress: 0,
    } as any);
    if (error) return toast({ title: "Could not add goal", description: error.message, variant: "destructive" });
    setGoalTitle("");
    await loadAll(user.id);
  };

  const bookSession = async () => {
    if (!user || !booking.scheduled_at) return toast({ title: "Pick a date and time", variant: "destructive" });
    setBookingBusy(true);
    const { error } = await supabase.from("career_counseling_sessions").insert({
      subscriber_user_id: user.id, requested_by: user.id,
      scheduled_at: new Date(booking.scheduled_at).toISOString(),
      topic: booking.topic || null, duration_minutes: 30, status: "requested",
    } as any);
    setBookingBusy(false);
    if (error) return toast({ title: "Booking failed", description: error.message, variant: "destructive" });
    setBooking({ scheduled_at: "", topic: "" });
    toast({ title: "Session requested", description: "A career counselor will confirm shortly." });
    await loadAll(user.id);
  };

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2"><Logo /></Link>
          <div className="flex items-center gap-2">
            <Link to="/check-result"><Button variant="ghost" size="sm">Check Result</Button></Link>
            {!user
              ? <Link to="/careeraid/auth"><Button size="sm">Sign in</Button></Link>
              : <Button variant="outline" size="sm" onClick={() => signOut()}>
                  <LogOut className="h-4 w-4 mr-2" />Sign out
                </Button>}
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-10">{children}</main>
    </div>
  );

  if (isLoading || loading) {
    return <Shell><div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></Shell>;
  }

  // ---------- Public landing (signed out) ----------
  if (!user) {
    return (
      <Shell>
        <section className="max-w-3xl mx-auto text-center space-y-6">
          <Badge variant="secondary" className="mx-auto"><Compass className="h-3 w-3 mr-1" /> CareerAid Clinic</Badge>
          <h1 className="text-4xl font-bold tracking-tight">Find the right career path — with or without a school</h1>
          <p className="text-lg text-muted-foreground">
            Take the Personality Assessment, get AI-generated Nigerian career pathways with SS subject
            combinations, JAMB subjects, universities and skills, then book a live session with a career counselor.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/careeraid/auth"><Button size="lg">Get started <ArrowRight className="h-4 w-4 ml-2" /></Button></Link>
            <Link to="/counselor/auth"><Button size="lg" variant="outline">Sign up as a Career Counselor</Button></Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3 mt-14 max-w-5xl mx-auto">
          {[
            { icon: Sparkles, title: "Personality Assessment", text: "30 questions that map your strongest interest profile." },
            { icon: GraduationCap, title: "Nigerian pathways", text: "Courses, JAMB combinations, universities, polytechnics and colleges." },
            { icon: Video, title: "Live counseling", text: "Book a video guidance session with a certified career counselor." },
          ].map((f) => (
            <Card key={f.title}>
              <CardHeader>
                <f.icon className="h-6 w-6 text-primary" />
                <CardTitle className="text-base">{f.title}</CardTitle>
                <CardDescription>{f.text}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>
      </Shell>
    );
  }

  // ---------- School-affiliated student ----------
  if (schoolStudent) {
    return (
      <Shell>
        <Card className="max-w-lg mx-auto text-center">
          <CardHeader>
            <ShieldCheck className="h-8 w-8 mx-auto text-primary" />
            <CardTitle>CareerAid is included with your school</CardTitle>
            <CardDescription>Open CareerAid inside your student dashboard — no extra payment needed.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to={`/${schoolStudent.schoolCode}/student/careeraid`}>
              <Button>Open CareerAid <ArrowRight className="h-4 w-4 ml-2" /></Button>
            </Link>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  // ---------- Subscribe card (shown as a tab for free users) ----------
  const subscribeCard = (
    <Card className="max-w-xl mx-auto">
      <CardHeader>
        <Badge variant="secondary" className="w-fit">₦5,000 / month</Badge>
        <CardTitle>Subscribe to CareerAid Clinic</CardTitle>
        <CardDescription>
          Independent access — you do not need to belong to a school. Unlimited assessments and career plans,
          plus access to the counselor directory and live video counseling bookings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="ca-name">Full name</Label>
            <Input id="ca-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ca-phone">Phone</Label>
            <Input id="ca-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ca-class">Class / level</Label>
            <Input id="ca-class" placeholder="e.g. SS2" value={form.class_level} onChange={(e) => setForm({ ...form, class_level: e.target.value })} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="ca-state">State of residence</Label>
            <Input id="ca-state" value={form.state_of_residence} onChange={(e) => setForm({ ...form, state_of_residence: e.target.value })} />
          </div>
        </div>
        <Button className="w-full" onClick={startPayment} disabled={paying}>
          {paying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Pay ₦5,000 / month and unlock everything
        </Button>
        {subscription?.status === "pending" && (
          <p className="text-xs text-muted-foreground text-center">
            A previous payment attempt is still pending. Completing payment activates your plan instantly.
          </p>
        )}
      </CardContent>
    </Card>
  );

  // ---------- Learner portal ----------
  return (
    <Shell>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold">CareerAid Clinic</h1>
          <p className="text-muted-foreground text-sm">
            {active
              ? `Active until ${subscription?.expires_at ? format(new Date(subscription.expires_at), "PP") : "—"}`
              : "Free access: one assessment and career plan per month. Counseling requires a subscription."}
          </p>
        </div>
        {active
          ? <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Subscribed</Badge>
          : <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" /> Free access</Badge>}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="assessment"><Sparkles className="h-4 w-4 mr-2" />Personality Assessment</TabsTrigger>
          <TabsTrigger value="plan"><Target className="h-4 w-4 mr-2" />My Plan</TabsTrigger>
          <TabsTrigger value="counseling"><Video className="h-4 w-4 mr-2" />Counseling</TabsTrigger>
          {!active && <TabsTrigger value="subscribe"><Sparkles className="h-4 w-4 mr-2" />Subscribe</TabsTrigger>}
        </TabsList>



        <TabsContent value="assessment">
          <Card>
            <CardHeader>
              <CardTitle>Personality Assessment</CardTitle>
              <CardDescription>Answer all {HOLLAND_QUESTIONS.length} statements honestly. Progress: {progress}%</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {HOLLAND_QUESTIONS.map((q) => (
                <div key={q.id} className="space-y-2 border-b pb-4 last:border-0">
                  <p className="text-sm font-medium">{q.id}. {q.text}</p>
                  <RadioGroup
                    className="flex flex-wrap gap-4"
                    value={String(answers[q.id] ?? "")}
                    onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id]: Number(v) }))}
                  >
                    {SCALE.map((s) => (
                      <div key={s.v} className="flex items-center gap-2">
                        <RadioGroupItem value={String(s.v)} id={`q${q.id}-${s.v}`} />
                        <Label htmlFor={`q${q.id}-${s.v}`} className="text-xs font-normal">{s.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              ))}
              <Button onClick={submitAssessment} disabled={submitting || generating}>
                {(submitting || generating) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {generating ? "Generating your career plan…" : "Submit and generate career plan"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plan" className="space-y-4">
          {recs.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              Take the Personality Assessment to generate your career pathways.
            </CardContent></Card>
          ) : (
            recs.map((rec) => (
              <Card key={rec.id}>
                <CardHeader>
                  <CardTitle className="text-base">Career plan · {format(new Date(rec.created_at), "PP")}</CardTitle>
                  {rec.summary && <CardDescription>{rec.summary}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-4">
                  {rec.paths.map((p) => (
                    <div key={p.id ?? p.rank} className="border rounded-lg p-4 space-y-2">
                      <p className="font-semibold">#{p.rank} · {p.career_title}</p>
                      <FieldList label="SS subjects" items={p.ss_subjects} />
                      <FieldList label="University courses" items={p.university_courses} />
                      <FieldList label="JAMB subjects" items={p.jamb_subjects} />
                      <FieldList label="Universities" items={p.universities} />
                      <FieldList label="Polytechnics" items={p.polytechnics} />
                      <FieldList label="Skills to build" items={[...(p.tech_skills ?? []), ...(p.soft_skills ?? [])]} />
                      {p.jamb_cutoff && <p className="text-xs text-muted-foreground">JAMB guide: {p.jamb_cutoff}</p>}
                      {p.salary_insight && <p className="text-xs text-muted-foreground">{p.salary_insight}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Goals & milestones</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="e.g. Score 280 in JAMB" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} />
                <Button onClick={addGoal}>Add</Button>
              </div>
              {goals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No goals yet.</p>
              ) : goals.map((g) => (
                <div key={g.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                  <span className="text-sm">{g.title}</span>
                  <Badge variant="outline">{g.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="counseling" className="space-y-4">
          {!active ? (
            <Card>
              <CardHeader>
                <Lock className="h-6 w-6 text-primary" />
                <CardTitle className="text-base">Counseling is for subscribers</CardTitle>
                <CardDescription>
                  Subscribe for ₦5,000 / month to see the list of available career counselors and book
                  live video guidance sessions. Free access only covers one assessment and career plan per month.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setTab("subscribe")}>Subscribe now <ArrowRight className="h-4 w-4 ml-2" /></Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Available career counselors</CardTitle>
                  <CardDescription>Certified counselors you can book a live video session with.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {counselors.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No counselors available right now.</p>
                  ) : counselors.map((c) => (
                    <div key={c.user_id} className="flex items-center justify-between border rounded-md px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{c.full_name}</p>
                        <p className="text-xs text-muted-foreground">{c.sessions_completed} session(s) completed</p>
                      </div>
                      <Badge variant="outline" className="gap-1">
                        <Star className="h-3 w-3" />{c.average_rating ? Number(c.average_rating).toFixed(1) : "New"}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Book a live guidance session</CardTitle>
                  <CardDescription>A career counselor confirms your slot and shares the meeting link.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="ca-when">Preferred date & time</Label>
                      <Input id="ca-when" type="datetime-local" value={booking.scheduled_at}
                        onChange={(e) => setBooking({ ...booking, scheduled_at: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ca-topic">What do you need help with?</Label>
                      <Textarea id="ca-topic" rows={2} value={booking.topic}
                        onChange={(e) => setBooking({ ...booking, topic: e.target.value })} />
                    </div>
                  </div>
                  {unratedSessions.length > 0 && (
                    <p className="text-xs text-destructive">
                      Please review and rate your last completed session before booking a new one.
                    </p>
                  )}
                  <Button onClick={bookSession} disabled={bookingBusy || unratedSessions.length > 0}>
                    {bookingBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Request session
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Your sessions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sessions booked yet.</p>
              ) : sessions.map((s) => (
                <div key={s.id} className="border rounded-md px-3 py-2 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{format(new Date(s.scheduled_at), "PPp")}</p>
                      {s.topic && <p className="text-xs text-muted-foreground">{s.topic}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{s.status}</Badge>
                      {s.meeting_url && s.status === "accepted" && (
                        <a href={s.meeting_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm"><Video className="h-4 w-4 mr-1" />Join</Button>
                        </a>
                      )}
                    </div>
                  </div>

                  {s.status === "completed" && (
                    ratings[s.id] ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Star className="h-3 w-3" /> You rated this session {ratings[s.id].rating}/5
                        {ratings[s.id].comment ? ` — “${ratings[s.id].comment}”` : ""}
                      </p>
                    ) : (
                      <div className="space-y-2 border-t pt-2">
                        <p className="text-xs font-medium">Review required — rate your counselor</p>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button key={n} type="button" aria-label={`${n} star`}
                              onClick={() => setRatingDraft({ ...ratingDraft, [s.id]: { ...(ratingDraft[s.id] ?? { comment: "" }), rating: n } })}>
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
            </CardContent>
          </Card>
        </TabsContent>

        {!active && (
          <TabsContent value="subscribe">
            {subscribeCard}
          </TabsContent>
        )}

      </Tabs>
    </Shell>
  );
}

function FieldList({ label, items }: { label: string; items: string[] | null | undefined }) {
  if (!items || items.length === 0) return null;
  return (
    <p className="text-xs">
      <span className="font-medium">{label}: </span>
      <span className="text-muted-foreground">{items.join(", ")}</span>
    </p>
  );
}
