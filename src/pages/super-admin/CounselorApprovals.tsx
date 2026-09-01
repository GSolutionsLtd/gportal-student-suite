import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";

type Status = "pending" | "approved" | "rejected";

export default function CounselorApprovals() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, { name: string; email: string }>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("counselor_profiles" as any).select("*").order("submitted_at", { ascending: false });
    const list = (data as any[]) ?? [];
    setRows(list);
    if (list.length) {
      const { data: profs } = await supabase
        .from("profiles").select("id, full_name, email").in("id", list.map((r) => r.user_id));
      const map: Record<string, { name: string; email: string }> = {};
      ((profs as any[]) ?? []).forEach((p) => { map[p.id] = { name: p.full_name, email: p.email }; });
      setNames(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const review = async (row: any, status: Status) => {
    setBusy(row.id);
    const { error } = await supabase.from("counselor_profiles" as any)
      .update({ status, review_note: notes[row.id]?.trim() || null } as any).eq("id", row.id);
    setBusy(null);
    if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
    toast({ title: status === "approved" ? "Counselor approved" : "Counselor rejected" });
    await load();
  };

  const byStatus = (s: Status) => rows.filter((r) => r.status === s);

  const Row = ({ r }: { r: any }) => (
    <Card key={r.id}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{names[r.user_id]?.name ?? "Counselor"}</CardTitle>
            <CardDescription>
              {names[r.user_id]?.email} · submitted {format(new Date(r.submitted_at), "PPp")}
            </CardDescription>
          </div>
          <Badge variant={r.status === "approved" ? "default" : "outline"}>{r.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="font-medium">{r.headline}</p>
        {r.bio && <p className="text-muted-foreground">{r.bio}</p>}
        <p><span className="font-medium">Qualifications: </span><span className="text-muted-foreground">{r.qualifications}</span></p>
        {r.certifications && <p><span className="font-medium">Certifications: </span><span className="text-muted-foreground">{r.certifications}</span></p>}
        <p><span className="font-medium">Experience: </span><span className="text-muted-foreground">{r.years_experience} year(s)</span></p>
        {r.specializations?.length > 0 && (
          <p><span className="font-medium">Specializations: </span><span className="text-muted-foreground">{r.specializations.join(", ")}</span></p>
        )}
        <p>
          <span className="font-medium">Availability: </span>
          <span className="text-muted-foreground">
            {(r.availability?.days ?? []).join(", ") || "—"}{r.availability?.hours ? ` · ${r.availability.hours}` : ""}
          </span>
        </p>
        {(r.phone || r.location) && (
          <p className="text-muted-foreground">{[r.phone, r.location].filter(Boolean).join(" · ")}</p>
        )}
        {r.review_note && <p className="text-xs text-muted-foreground">Review note: {r.review_note}</p>}

        <Textarea rows={2} placeholder="Optional note to the counselor"
          value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy === r.id || r.status === "approved"} onClick={() => review(r, "approved")}>
            {busy === r.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
            Approve
          </Button>
          <Button size="sm" variant="outline" disabled={busy === r.id || r.status === "rejected"} onClick={() => review(r, "rejected")}>
            <XCircle className="h-4 w-4 mr-1" />Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Career Counselors</h1>
        <p className="text-sm text-muted-foreground">
          Review counselor onboarding submissions. Only approved counselors appear in the CareerAid directory.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending">Pending ({byStatus("pending").length})</TabsTrigger>
            <TabsTrigger value="approved">Approved ({byStatus("approved").length})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({byStatus("rejected").length})</TabsTrigger>
          </TabsList>
          {(["pending", "approved", "rejected"] as Status[]).map((s) => (
            <TabsContent key={s} value={s} className="space-y-3">
              {byStatus(s).length === 0
                ? <Card><CardContent className="py-10 text-center text-muted-foreground">Nothing here.</CardContent></Card>
                : byStatus(s).map((r) => <Row key={r.id} r={r} />)}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
