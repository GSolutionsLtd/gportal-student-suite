import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";
import { Loader2, Video, Wallet, CheckCircle2, Users, LogOut } from "lucide-react";
import { format } from "date-fns";

const RATE = 2000;

export default function CounselorDashboard() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [linkDraft, setLinkDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [cProfile, setCProfile] = useState<any>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: s }, { data: w }, { data: p }] = await Promise.all([
      supabase.from("career_counseling_sessions").select("*").order("scheduled_at", { ascending: false }).limit(200),
      supabase.from("counselor_wallet_entries").select("*").eq("counselor_user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("counselor_payouts").select("*").eq("counselor_user_id", user.id).order("requested_at", { ascending: false }),
    ]);
    const rows = (s as any[]) ?? [];
    setSessions(rows);
    setEntries((w as any[]) ?? []);
    setPayouts((p as any[]) ?? []);

    const studentIds = rows.map((r) => r.student_id).filter(Boolean);
    const userIds = rows.map((r) => r.subscriber_user_id).filter(Boolean);
    const map: Record<string, string> = {};
    if (studentIds.length) {
      const { data } = await supabase.from("students").select("id, first_name, last_name").in("id", studentIds);
      ((data as any[]) ?? []).forEach((x) => { map[x.id] = `${x.first_name} ${x.last_name}`; });
    }
    if (userIds.length) {
      const { data } = await supabase.from("careeraid_subscriptions").select("user_id, full_name").in("user_id", userIds);
      ((data as any[]) ?? []).forEach((x) => { map[x.user_id] = `${x.full_name} (independent)`; });
    }
    setNames(map);
    const { data: cp } = await supabase
      .from("counselor_profiles" as any).select("*").eq("user_id", user.id).maybeSingle();
    setCProfile(cp);

    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const subjectName = (s: any) => names[s.student_id] || names[s.subscriber_user_id] || "Student";

  const MIN_STUDENTS = 5;

  const unpaid = useMemo(() => entries.filter((e) => !e.payout_id), [entries]);

  // Only months with at least 5 distinct students counseled can be withdrawn.
  const qualifyingMonths = useMemo(() => {
    const byMonth: Record<string, Set<string>> = {};
    unpaid.forEach((e) => {
      const m = String(e.period_month);
      (byMonth[m] ??= new Set()).add(String(e.subject_key));
    });
    return new Set(Object.entries(byMonth).filter(([, s]) => s.size >= MIN_STUDENTS).map(([m]) => m));
  }, [unpaid]);

  const balance = useMemo(
    () => unpaid.reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [unpaid],
  );
  const withdrawable = useMemo(
    () => unpaid.filter((e) => qualifyingMonths.has(String(e.period_month)))
      .reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [unpaid, qualifyingMonths],
  );
  const thisMonthCount = useMemo(() => {
    const m = format(new Date(), "yyyy-MM");
    return new Set(entries.filter((e) => String(e.period_month).startsWith(m)).map((e) => String(e.subject_key))).size;
  }, [entries]);

  const withdrawalDay = new Date().getDate() === 28;
  const meetsQuota = withdrawable > 0;


  const update = async (id: string, patch: Record<string, unknown>) => {
    setBusy(id);
    const { error } = await supabase.from("career_counseling_sessions").update(patch as any).eq("id", id);
    setBusy(null);
    if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
    await load();
  };

  const accept = (s: any) => {
    const url = (linkDraft[s.id] || s.meeting_url || "").trim();
    if (!/^https?:\/\//.test(url)) {
      return toast({ title: "Add a meeting link", description: "Paste a valid video link before accepting.", variant: "destructive" });
    }
    update(s.id, { status: "accepted", counselor_user_id: user!.id, meeting_url: url });
  };

  const loadBanks = async () => {
    if (banks.length) return;
    const { data, error } = await supabase.functions.invoke("counselor-payout", { body: { action: "banks" } });
    if (error) return toast({ title: "Could not load banks", description: error.message, variant: "destructive" });
    setBanks((data as any)?.banks ?? []);
  };

  const saveBank = async () => {
    setBusy("bank");
    const bank = banks.find((b) => b.code === bankCode);
    const { data, error } = await supabase.functions.invoke("counselor-payout", {
      body: { action: "save_bank", bank_code: bankCode, bank_name: bank?.name, account_number: accountNumber },
    });
    setBusy(null);
    const err = (data as any)?.error;
    if (error || err) {
      return toast({ title: "Could not save payout account", description: err || error?.message, variant: "destructive" });
    }
    toast({ title: "Payout account saved", description: `Verified as ${(data as any).account_name}` });
    await load();
  };

  const requestPayout = async () => {
    setBusy("payout");
    const { data, error } = await supabase.functions.invoke("counselor-payout", { body: { action: "withdraw" } });
    setBusy(null);
    const err = (data as any)?.error;
    if (error || err) return toast({ title: "Withdrawal not allowed", description: err || error?.message, variant: "destructive" });
    toast({
      title: (data as any).status === "paid" ? "Payout sent" : "Payout processing",
      description: `₦${Number((data as any).amount).toLocaleString()} to your bank account.`,
    });

    await load();
  };

  const pending = sessions.filter((s) => s.status === "requested");
  const upcoming = sessions.filter((s) => s.status === "accepted");
  const done = sessions.filter((s) => s.status === "completed");

  const SessionCard = ({ s, mode }: { s: any; mode: "pending" | "upcoming" | "done" }) => (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-sm">{subjectName(s)}</p>
          <p className="text-xs text-muted-foreground">{format(new Date(s.scheduled_at), "PPp")} · {s.duration_minutes} mins</p>
        </div>
        <Badge variant="outline">{s.status}</Badge>
      </div>
      {s.topic && <p className="text-xs text-muted-foreground">{s.topic}</p>}
      {mode === "pending" && (
        <div className="flex flex-wrap gap-2 items-end">
          <div className="space-y-1 flex-1 min-w-[200px]">
            <Label className="text-xs" htmlFor={`link-${s.id}`}>Video meeting link</Label>
            <Input id={`link-${s.id}`} placeholder="https://meet.google.com/…"
              value={linkDraft[s.id] ?? s.meeting_url ?? ""}
              onChange={(e) => setLinkDraft({ ...linkDraft, [s.id]: e.target.value })} />
          </div>
          <Button size="sm" disabled={busy === s.id} onClick={() => accept(s)}>Accept</Button>
          <Button size="sm" variant="outline" disabled={busy === s.id} onClick={() => update(s.id, { status: "declined" })}>Decline</Button>
        </div>
      )}
      {mode === "upcoming" && (
        <div className="flex flex-wrap gap-2">
          {s.meeting_url && (
            <a href={s.meeting_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm"><Video className="h-4 w-4 mr-1" />Join room</Button>
            </a>
          )}
          <Button size="sm" variant="outline" disabled={busy === s.id}
            onClick={() => update(s.id, { status: "completed", completed_at: new Date().toISOString() })}>
            <CheckCircle2 className="h-4 w-4 mr-1" />Mark completed
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2"><Logo /></Link>
          <Button variant="ghost" size="sm" onClick={() => signOut()}><LogOut className="h-4 w-4 mr-2" />Sign out</Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Career Counselor Dashboard</h1>
            <p className="text-muted-foreground text-sm">Guide students from subscribed schools and independent CareerAid subscribers.</p>
          </div>
          <Link to="/counselor/onboarding">
            <Button variant="outline" size="sm">{cProfile ? "Edit onboarding profile" : "Complete onboarding"}</Button>
          </Link>
        </div>

        {cProfile?.status !== "approved" && (
          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle className="text-base">
                {!cProfile ? "Complete your onboarding" : cProfile.status === "rejected" ? "Profile not approved" : "Profile awaiting approval"}
              </CardTitle>
              <CardDescription>
                {!cProfile
                  ? "Submit your profile, qualifications and availability. An administrator must approve it before students can see or book you."
                  : cProfile.status === "rejected"
                    ? cProfile.review_note || "Update your profile and resubmit it for review."
                    : "An administrator is reviewing your submission. You will appear in the counselor directory once approved."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/counselor/onboarding">
                <Button size="sm">{cProfile ? "Review my submission" : "Start onboarding"}</Button>
              </Link>
            </CardContent>
          </Card>
        )}


        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardHeader className="pb-2"><CardDescription>Students counseled this month (min {MIN_STUDENTS})</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2"><Users className="h-5 w-5 text-primary" />{thisMonthCount}/{MIN_STUDENTS}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Wallet balance</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" />₦{balance.toLocaleString()}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Rate per student / month</CardDescription>
            <CardTitle className="text-2xl">₦{RATE.toLocaleString()}</CardTitle></CardHeader></Card>
        </div>


        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <Tabs defaultValue="requests" className="space-y-4">
            <TabsList className="flex flex-wrap">
              <TabsTrigger value="requests">Requests ({pending.length})</TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({done.length})</TabsTrigger>
              <TabsTrigger value="wallet"><Wallet className="h-4 w-4 mr-2" />Wallet</TabsTrigger>
            </TabsList>

            <TabsContent value="requests" className="space-y-3">
              {pending.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">No pending requests.</CardContent></Card>
                : pending.map((s) => <SessionCard key={s.id} s={s} mode="pending" />)}
            </TabsContent>
            <TabsContent value="upcoming" className="space-y-3">
              {upcoming.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">No confirmed sessions.</CardContent></Card>
                : upcoming.map((s) => <SessionCard key={s.id} s={s} mode="upcoming" />)}
            </TabsContent>
            <TabsContent value="completed" className="space-y-3">
              {done.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">Nothing completed yet.</CardContent></Card>
                : done.map((s) => <SessionCard key={s.id} s={s} mode="done" />)}
            </TabsContent>

            <TabsContent value="wallet" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Withdraw earnings</CardTitle>
                  <CardDescription>
                    You earn ₦{RATE.toLocaleString()} for each distinct student you counsel in a month.
                    A month only qualifies once you have counseled at least {MIN_STUDENTS} different students,
                    and withdrawals are only available on the 28th of every month.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button onClick={requestPayout} disabled={!withdrawalDay || !meetsQuota || busy === "payout"}>
                    {busy === "payout" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Withdraw ₦{withdrawable.toLocaleString()}
                  </Button>
                  {!meetsQuota && (
                    <p className="text-xs text-muted-foreground">
                      No month has reached {MIN_STUDENTS} counseled students yet — {thisMonthCount}/{MIN_STUDENTS} this month.
                    </p>
                  )}
                  {!withdrawalDay && (
                    <p className="text-xs text-muted-foreground">Withdrawal opens on the 28th of this month.</p>
                  )}
                </CardContent>
              </Card>


              <Card>
                <CardHeader><CardTitle className="text-base">Earning history</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {entries.length === 0 ? <p className="text-sm text-muted-foreground">No earnings recorded yet.</p>
                    : entries.map((e) => (
                      <div key={e.id} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                        <span>{names[e.subject_key] || e.subject_label || "Student"} · {format(new Date(e.period_month), "MMM yyyy")}</span>
                        <span className="flex items-center gap-2">
                          ₦{Number(e.amount).toLocaleString()}
                          <Badge variant={e.payout_id ? "secondary" : "outline"}>{e.payout_id ? "Paid out" : "Available"}</Badge>
                        </span>
                      </div>
                    ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Withdrawal requests</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {payouts.length === 0 ? <p className="text-sm text-muted-foreground">No withdrawals yet.</p>
                    : payouts.map((p) => (
                      <div key={p.id} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                        <span>{format(new Date(p.requested_at), "PP")} · {p.students_counseled} student(s)</span>
                        <span className="flex items-center gap-2">₦{Number(p.amount).toLocaleString()}<Badge variant="outline">{p.status}</Badge></span>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
