import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Star, CheckCircle2, XCircle, CalendarDays } from "lucide-react";
import { format } from "date-fns";

type Profile = {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  headline: string | null;
  bio: string | null;
  qualifications: string | null;
  certifications: string | null;
  specializations: string[] | null;
  years_experience: number | null;
  phone: string | null;
  location: string | null;
  availability: any;
  status: string;
  review_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  sessions_total: number;
  sessions_completed: number;
  average_rating: number | null;
};

type Session = {
  id: string;
  scheduled_at: string;
  status: string;
  topic: string | null;
  completed_at: string | null;
  learner: string;
  rating: number | null;
  review: string | null;
};

export default function AdminCounselorOnboarding() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Record<string, Session[]>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_counselor_profiles" as any);
    setLoading(false);
    if (error) {
      toast({ title: "Could not load counselors", description: error.message, variant: "destructive" });
      return;
    }
    setProfiles((data as Profile[]) ?? []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const loadSessions = async (userId: string) => {
    if (sessions[userId]) return;
    const { data, error } = await supabase.rpc("admin_counselor_sessions" as any, { _counselor_user_id: userId });
    if (error) {
      toast({ title: "Could not load session history", description: error.message, variant: "destructive" });
      return;
    }
    setSessions((prev) => ({ ...prev, [userId]: (data as Session[]) ?? [] }));
  };

  const review = async (p: Profile, status: "approved" | "rejected" | "pending") => {
    setBusy(p.id);
    const { error } = await supabase.rpc("admin_review_counselor" as any, {
      _profile_id: p.id, _status: status, _note: notes[p.id] || null,
    });
    setBusy(null);
    if (error) return toast({ title: "Review failed", description: error.message, variant: "destructive" });
    toast({
      title: status === "approved" ? "Counselor approved" : status === "rejected" ? "Counselor rejected" : "Returned to pending",
      description: status === "approved" ? "They now appear in the counselor directory." : undefined,
    });
    await load();
  };

  const byStatus = (s: string) => profiles.filter((p) => p.status === s);

  const Row = (p: Profile) => (
    <Card key={p.id}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{p.full_name}</CardTitle>
            <CardDescription>
              {p.headline || "Career counselor"}
              {p.email ? ` · ${p.email}` : ""}
              {p.location ? ` · ${p.location}` : ""}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {p.average_rating != null && (
              <Badge variant="secondary" className="gap-1"><Star className="h-3 w-3" />{p.average_rating}</Badge>
            )}
            <Badge variant={p.status === "approved" ? "default" : p.status === "rejected" ? "destructive" : "outline"}>
              {p.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-2 sm:grid-cols-3">
          <div><span className="text-muted-foreground">Experience:</span> {p.years_experience ?? 0} yrs</div>
          <div><span className="text-muted-foreground">Sessions:</span> {p.sessions_completed}/{p.sessions_total} completed</div>
          <div><span className="text-muted-foreground">Phone:</span> {p.phone || "—"}</div>
        </div>
        {p.bio && <p className="text-muted-foreground whitespace-pre-line">{p.bio}</p>}
        {p.qualifications && <p><span className="text-muted-foreground">Qualifications:</span> {p.qualifications}</p>}
        {p.certifications && <p><span className="text-muted-foreground">Certifications:</span> {p.certifications}</p>}
        {!!p.specializations?.length && (
          <div className="flex flex-wrap gap-1">
            {p.specializations.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
          </div>
        )}
        {p.availability && (
          <p className="text-muted-foreground flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {typeof p.availability === "string" ? p.availability : JSON.stringify(p.availability)}
          </p>
        )}

        <div className="space-y-2 rounded-md border p-3">
          <Button variant="outline" size="sm" onClick={() => loadSessions(p.user_id)}>View session history</Button>
          {sessions[p.user_id] && (
            sessions[p.user_id].length === 0
              ? <p className="text-muted-foreground">No sessions yet.</p>
              : (
                <div className="space-y-1">
                  {sessions[p.user_id].map((s) => (
                    <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-1 last:border-0">
                      <span>{format(new Date(s.scheduled_at), "PPp")} · {s.learner}</span>
                      <span className="flex items-center gap-2">
                        {s.rating != null && <Badge variant="secondary" className="gap-1"><Star className="h-3 w-3" />{s.rating}</Badge>}
                        <Badge variant="outline">{s.status}</Badge>
                      </span>
                    </div>
                  ))}
                </div>
              )
          )}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <Input
            className="flex-1 min-w-[220px]"
            placeholder="Review note (shown to the counselor)"
            value={notes[p.id] ?? p.review_note ?? ""}
            onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })}
          />
          <Button size="sm" disabled={busy === p.id || p.status === "approved"} onClick={() => review(p, "approved")}>
            <CheckCircle2 className="h-4 w-4 mr-1" />Approve & list
          </Button>
          <Button size="sm" variant="outline" disabled={busy === p.id || p.status === "rejected"} onClick={() => review(p, "rejected")}>
            <XCircle className="h-4 w-4 mr-1" />Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Counselor Onboarding</h1>
          <p className="text-muted-foreground text-sm">
            Review career counselor applications, inspect their session history and unlock their directory listing.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <Tabs defaultValue="pending" className="space-y-4">
            <TabsList className="flex flex-wrap">
              <TabsTrigger value="pending">Pending ({byStatus("pending").length})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({byStatus("approved").length})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({byStatus("rejected").length})</TabsTrigger>
            </TabsList>
            {["pending", "approved", "rejected"].map((s) => (
              <TabsContent key={s} value={s} className="space-y-4">
                {byStatus(s).length === 0
                  ? <Card><CardContent className="py-10 text-center text-muted-foreground">No {s} counselors.</CardContent></Card>
                  : byStatus(s).map(Row)}
              </TabsContent>
            ))}
          </Tabs>
        )}
    </div>
  );
}
