import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, BookOpen, FileText, Shield } from "lucide-react";
import { format } from "date-fns";

type Plan = { id: string; title: string; topic: string | null; grade_level: string | null; status: string; created_at: string; subject_id: string | null };
type Assignment = { id: string; title: string; status: string; due_at: string | null; created_at: string; subject_id: string | null; scores_approved: boolean | null };
type AuditRow = { id: string; action: string; table_name: string; created_at: string; new_data: any };

const MODULE_LABELS: Record<string, string> = {
  assignments: "Assignments",
  assignment_submissions: "Submissions",
  assignment_rubric_scores: "Rubric scoring",
  lesson_plans: "Curriculum notes",
  lesson_plan_versions: "Curriculum notes",
  results: "Results",
  result_components: "Results",
};

export function TeacherWorkHistory({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subjects, setSubjects] = useState<Record<string, string>>({});
  const [audit, setAudit] = useState<AuditRow[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: teacher } = await supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle();

      const [{ data: lp }, { data: asg }, { data: subs }, { data: logs }] = await Promise.all([
        supabase.from("lesson_plans").select("id, title, topic, grade_level, status, created_at, subject_id")
          .eq("teacher_user_id", user.id).order("created_at", { ascending: false }).limit(compact ? 5 : 100),
        teacher
          ? supabase.from("assignments").select("id, title, status, due_at, created_at, subject_id, scores_approved")
              .eq("teacher_id", (teacher as any).id).order("created_at", { ascending: false }).limit(compact ? 5 : 100)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("subjects").select("id, name"),
        supabase.from("audit_logs").select("id, action, table_name, created_at, new_data")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(compact ? 5 : 100),
      ]);
      setAudit(((logs as any[]) ?? []) as AuditRow[]);

      setPlans(((lp as any[]) ?? []) as Plan[]);
      setAssignments(((asg as any[]) ?? []) as Assignment[]);
      const map: Record<string, string> = {};
      ((subs as any[]) ?? []).forEach((s) => { map[s.id] = s.name; });
      setSubjects(map);
      setLoading(false);
    })();
  }, [user, compact]);

  const published = plans.filter((p) => p.status === "published");

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">My teaching activity</CardTitle>
        <CardDescription>
          {plans.length} curriculum note(s) · {published.length} published · {assignments.length} assignment(s)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="notes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="notes"><BookOpen className="h-4 w-4 mr-2" />Curriculum notes</TabsTrigger>
            <TabsTrigger value="published">Published plans ({published.length})</TabsTrigger>
            <TabsTrigger value="assignments"><FileText className="h-4 w-4 mr-2" />Assignments</TabsTrigger>
            <TabsTrigger value="audit"><Shield className="h-4 w-4 mr-2" />Audit trail</TabsTrigger>
          </TabsList>

          {[
            { key: "notes", rows: plans },
            { key: "published", rows: published },
          ].map(({ key, rows }) => (
            <TabsContent key={key} value={key} className="space-y-2">
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing here yet.</p>
              ) : rows.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{p.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {[subjects[p.subject_id ?? ""], p.grade_level, p.topic].filter(Boolean).join(" · ") || "—"}
                      {" · "}{format(new Date(p.created_at), "PP")}
                    </p>
                  </div>
                  <Badge variant={p.status === "published" ? "default" : "outline"}>{p.status}</Badge>
                </div>
              ))}
            </TabsContent>
          ))}

          <TabsContent value="assignments" className="space-y-2">
            {assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">You have not created any assignments yet.</p>
            ) : assignments.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {subjects[a.subject_id ?? ""] || "—"}
                    {a.due_at ? ` · due ${format(new Date(a.due_at), "PP")}` : ""}
                  </p>
                </div>
                <span className="flex items-center gap-2">
                  {a.scores_approved && <Badge variant="secondary">scores approved</Badge>}
                  <Badge variant={a.status === "published" ? "default" : "outline"}>{a.status}</Badge>
                </span>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="audit" className="space-y-2">
            {audit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity has been recorded for your account yet.</p>
            ) : audit.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">
                    {(l.new_data?.event as string | undefined)?.replace(/_/g, " ") || l.action}
                    {l.new_data?.title ? ` — ${l.new_data.title}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{MODULE_LABELS[l.table_name] || l.table_name}</p>
                </div>
                <span className="flex items-center gap-2">
                  <Badge variant="outline">{l.action}</Badge>
                  <span className="text-xs text-muted-foreground">{format(new Date(l.created_at), "PP p")}</span>
                </span>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
