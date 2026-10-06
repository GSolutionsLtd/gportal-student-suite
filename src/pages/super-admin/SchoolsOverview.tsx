import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Globe, Users, Wallet, UserCheck, ExternalLink, Search, GraduationCap } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string; code: string; name: string; logo_url: string | null;
  subscription_status: string | null; subscription_ends_at: string | null;
  website_published: boolean; website_sections: number;
  staff_total: number; teachers_approved: number; teachers_pending: number; students_total: number;
  fee_structures: number; fees_collected: number;
};

const naira = (n: number) => `₦${Number(n || 0).toLocaleString()}`;

export default function SchoolsOverview() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>("");
  const [q, setQ] = useState("");
  const [onlySubscribed, setOnlySubscribed] = useState("all");
  const [teachers, setTeachers] = useState<{ id: string; name: string; staff_id: string; approval_status: string }[]>([]);
  const [fees, setFees] = useState<{ id: string; name: string; amount: number }[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    (supabase as any).rpc("super_admin_schools_overview").then(({ data, error }: any) => {
      if (error) toast.error(error.message);
      const list = (data || []) as Row[];
      setRows(list);
      if (list[0]) setSelected(list[0].id);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setDetailLoading(true);
    (async () => {
      const [{ data: t }, { data: f }] = await Promise.all([
        (supabase as any).from("teachers").select("id, user_id, staff_id, approval_status").eq("school_id", selected),
        (supabase as any).from("fee_structures").select("*").eq("school_id", selected),
      ]);
      const ids = (t || []).map((x: any) => x.user_id);
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name").in("id", ids)
        : { data: [] as any[] };
      const pm = new Map((profs || []).map((p: any) => [p.id, p.full_name]));
      setTeachers((t || []).map((x: any) => ({ id: x.id, staff_id: x.staff_id, approval_status: x.approval_status, name: pm.get(x.user_id) || "Unnamed" })));
      setFees((f || []).map((x: any) => ({ id: x.id, name: x.name || x.fee_type || x.description || "Fee", amount: Number(x.amount || 0) })));
      setDetailLoading(false);
    })();
  }, [selected]);

  const filtered = useMemo(() => rows.filter((r) => {
    const matches = `${r.name} ${r.code}`.toLowerCase().includes(q.toLowerCase());
    const sub = onlySubscribed === "all" || (onlySubscribed === "active" ? r.subscription_status === "active" : r.subscription_status !== "active");
    return matches && sub;
  }), [rows, q, onlySubscribed]);

  const current = rows.find((r) => r.id === selected);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Schools Overview</h1>
        <p className="text-muted-foreground">Every school's website, staff, fees and approved teachers in one place. Pick a school to see its details.</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_200px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search school name or code" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={onlySubscribed} onValueChange={setOnlySubscribed}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All schools</SelectItem>
            <SelectItem value="active">Active subscription</SelectItem>
            <SelectItem value="inactive">Not active</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-2">
          {filtered.map((r) => (
            <button key={r.id} onClick={() => { setSelected(r.id); if (window.innerWidth < 1024) setTimeout(() => document.getElementById("school-detail")?.scrollIntoView({ behavior: "smooth" }), 50); }}
              className={`w-full rounded-lg border p-3 text-left transition-colors ${r.id === selected ? "border-primary bg-primary/5" : "hover:bg-accent"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.code}</p>
                </div>
                <Badge variant={r.subscription_status === "active" ? "default" : "outline"}>{r.subscription_status || "none"}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" />{r.website_published ? "Live" : "Not live"}</span>
                <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{r.staff_total} staff</span>
                <span className="inline-flex items-center gap-1"><UserCheck className="h-3 w-3" />{r.teachers_approved} approved</span>
                <span className="inline-flex items-center gap-1"><Wallet className="h-3 w-3" />{naira(r.fees_collected)}</span>
              </div>
            </button>
          ))}
          {filtered.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No schools match.</p>}
        </div>

        {current && (
          <Card id="school-detail" className="h-fit scroll-mt-20 lg:sticky lg:top-20">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                {current.logo_url && <img src={current.logo_url} alt="" className="h-8 w-8 rounded object-contain" />}
                {current.name}
              </CardTitle>
              <CardDescription>
                Code {current.code}
                {current.subscription_ends_at && ` · Subscription ends ${new Date(current.subscription_ends_at).toLocaleDateString()}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Staff", current.staff_total, Users],
                  ["Approved", current.teachers_approved, UserCheck],
                  ["Students", current.students_total, GraduationCap],
                  ["Fees paid", naira(current.fees_collected), Wallet],
                ].map(([label, val, Icon]: any) => (
                  <div key={label} className="rounded-lg border p-3">
                    <Icon className="h-4 w-4 text-primary" />
                    <p className="mt-1 text-lg font-semibold">{val}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2"><Globe className="h-4 w-4" />Website</h3>
                  <Button size="sm" variant="outline" asChild>
                    <a href={`/site/${current.code}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-4 w-4" />Open</a>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {current.website_published ? "Published" : "Not published"} · {current.website_sections} sections
                </p>
              </section>

              {detailLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : (
                <>
                  <section className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />Teachers
                      {current.teachers_pending > 0 && <Badge variant="secondary">{current.teachers_pending} pending</Badge>}
                    </h3>
                    {teachers.length === 0 ? <p className="text-sm text-muted-foreground">No teachers yet.</p> : (
                      <ul className="max-h-64 divide-y overflow-y-auto rounded-md border">
                        {teachers.map((t) => (
                          <li key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                            <span className="truncate">{t.name} <span className="text-xs text-muted-foreground">· {t.staff_id}</span></span>
                            <Badge variant={t.approval_status === "approved" ? "default" : t.approval_status === "rejected" ? "destructive" : "secondary"}>{t.approval_status}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                  <section className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2"><Wallet className="h-4 w-4" />Fee setup ({current.fee_structures})</h3>
                    {fees.length === 0 ? <p className="text-sm text-muted-foreground">No fees set up.</p> : (
                      <ul className="divide-y rounded-md border">
                        {fees.map((f) => (
                          <li key={f.id} className="flex justify-between px-3 py-2 text-sm"><span className="truncate">{f.name}</span><span>{naira(f.amount)}</span></li>
                        ))}
                      </ul>
                    )}
                  </section>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
