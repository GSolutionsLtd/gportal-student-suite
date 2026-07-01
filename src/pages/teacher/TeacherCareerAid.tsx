import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolFeatures } from "@/hooks/useSchoolFeatures";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Briefcase, GraduationCap, FileText, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

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

interface Row {
  student_id: string; student_name: string; admission_number: string;
  class_arm: string | null;
  dominant_type: string | null; holland_code: string | null;
  recommendation_id: string | null; recommendation_at: string | null; top_career: string | null;
  summary: string | null;
  paths: Path[];
}

export default function TeacherCareerAid() {
  const { user } = useAuth();
  const { features, loading: featuresLoading } = useSchoolFeatures();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const { data: teacher } = await supabase.from("teachers").select("id, school_id").eq("user_id", user.id).maybeSingle();
        if (!teacher) { setLoading(false); return; }

        const { data: assignedArms } = await supabase
          .from("teacher_subjects" as any).select("class_arm_id").eq("teacher_id", (teacher as any).id);
        const { data: formArms } = await supabase
          .from("class_arms").select("id").eq("form_teacher_id", (teacher as any).id);
        const armIds = Array.from(new Set([
          ...((assignedArms as any[]) || []).map((a) => a.class_arm_id),
          ...((formArms as any[]) || []).map((a) => a.id),
        ])).filter(Boolean);

        if (armIds.length === 0) { setRows([]); setLoading(false); return; }

        const { data: students, error: sErr } = await supabase
          .from("students")
          .select("id, first_name, last_name, admission_number, current_class_arm_id, class_arms:current_class_arm_id(name)")
          .in("current_class_arm_id", armIds)
          .eq("is_active", true);
        
        if (sErr) throw sErr;

        const sids = (students || []).map((s: any) => s.id);
        const [{ data: assessments, error: aErr }, { data: recs, error: rErr }] = await Promise.all([
          supabase.from("career_assessments").select("student_id, dominant_type, holland_code, created_at")
            .in("student_id", sids).order("created_at", { ascending: false }),
          supabase.from("career_recommendations")
            .select("id, student_id, summary, created_at, paths:career_recommendation_paths(*)")
            .in("student_id", sids).order("created_at", { ascending: false }),
        ]);

        if (aErr) throw aErr;
        if (rErr) throw rErr;

        const latestAssess = new Map<string, any>();
        ((assessments as any[]) || []).forEach((a) => { if (!latestAssess.has(a.student_id)) latestAssess.set(a.student_id, a); });
        const latestRec = new Map<string, any>();
        ((recs as any[]) || []).forEach((r) => { if (!latestRec.has(r.student_id)) latestRec.set(r.student_id, r); });

        const built: Row[] = (students || []).map((s: any) => {
          const a = latestAssess.get(s.id);
          const r = latestRec.get(s.id);
          const paths = (r?.paths as Path[]) || [];
          const sortedPaths = [...paths].sort((x, y) => x.rank - y.rank);
          const top = sortedPaths[0]?.career_title || null;
          return {
            student_id: s.id,
            student_name: `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim(),
            admission_number: s.admission_number,
            class_arm: s.class_arms?.name || null,
            dominant_type: a?.dominant_type || null, holland_code: a?.holland_code || null,
            recommendation_id: r?.id || null, recommendation_at: r?.created_at || null, top_career: top,
            summary: r?.summary || null,
            paths: sortedPaths,
          };
        });
        setRows(built);
      } catch (err: any) {
        toast({ title: "Error loading data", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [user, toast]);

  if (featuresLoading || loading) return <div className="flex justify-center h-64 items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!features.careeraid) return (
    <div className="max-w-xl mx-auto mt-12 text-center space-y-3">
      <Briefcase className="h-12 w-12 mx-auto text-muted-foreground" />
      <h2 className="text-xl font-bold">CareerAid is not enabled</h2>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">CareerAid — My Students</h1>
        <p className="text-muted-foreground">Monitor personality profiles and career plans for your students.</p>
      </div>
      {rows.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No assigned students yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <Card key={r.student_id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2"><GraduationCap className="h-4 w-4" />{r.student_name}</CardTitle>
                    <CardDescription>{r.admission_number} · {r.class_arm}</CardDescription>
                  </div>
                  {r.dominant_type && <Badge variant="secondary">{r.dominant_type} ({r.holland_code})</Badge>}
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-3">
                <div className="space-y-1">
                  <p><span className="text-muted-foreground">Top career:</span> {r.top_career || "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.recommendation_at ? `Last recommendation ${format(new Date(r.recommendation_at), "PP")}` : "No recommendations yet"}
                  </p>
                </div>
                {r.recommendation_id && (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => setSelectedRow(r)}>
                    <FileText className="h-4 w-4 mr-2" /> View Career Plan
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedRow} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Career Plan: {selectedRow?.student_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            {selectedRow?.summary && <p className="text-sm text-foreground/80 leading-relaxed">{selectedRow.summary}</p>}
            <div className="space-y-4">
              {selectedRow?.paths.map((p) => (
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
