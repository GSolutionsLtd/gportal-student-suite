import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolFeatures } from "@/hooks/useSchoolFeatures";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Briefcase, GraduationCap } from "lucide-react";
import { format } from "date-fns";

interface Row {
  student_id: string; student_name: string; admission_number: string;
  class_arm: string | null;
  dominant_type: string | null; holland_code: string | null;
  recommendation_id: string | null; recommendation_at: string | null; top_career: string | null;
}

export default function TeacherCareerAid() {
  const { user } = useAuth();
  const { features, loading: featuresLoading } = useSchoolFeatures();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      // Find class arms taught by this teacher (form teacher OR teacher_subjects)
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

      const { data: students } = await supabase
        .from("students")
        .select("id, full_name, admission_number, current_class_arm_id, class_arms:current_class_arm_id(name)")
        .in("current_class_arm_id", armIds)
        .eq("is_active", true);

      const sids = (students || []).map((s: any) => s.id);
      const [{ data: assessments }, { data: recs }] = await Promise.all([
        supabase.from("career_assessments").select("student_id, dominant_type, holland_code, created_at")
          .in("student_id", sids).order("created_at", { ascending: false }),
        supabase.from("career_recommendations")
          .select("id, student_id, created_at, paths:career_recommendation_paths(career_title, rank)")
          .in("student_id", sids).order("created_at", { ascending: false }),
      ]);

      const latestAssess = new Map<string, any>();
      ((assessments as any[]) || []).forEach((a) => { if (!latestAssess.has(a.student_id)) latestAssess.set(a.student_id, a); });
      const latestRec = new Map<string, any>();
      ((recs as any[]) || []).forEach((r) => { if (!latestRec.has(r.student_id)) latestRec.set(r.student_id, r); });

      const built: Row[] = (students || []).map((s: any) => {
        const a = latestAssess.get(s.id);
        const r = latestRec.get(s.id);
        const top = r?.paths?.sort((x: any, y: any) => x.rank - y.rank)?.[0]?.career_title || null;
        return {
          student_id: s.id, student_name: s.full_name, admission_number: s.admission_number,
          class_arm: s.class_arms?.name || null,
          dominant_type: a?.dominant_type || null, holland_code: a?.holland_code || null,
          recommendation_id: r?.id || null, recommendation_at: r?.created_at || null, top_career: top,
        };
      });
      setRows(built);
      setLoading(false);
    })();
  }, [user]);

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
        <p className="text-muted-foreground">Monitor career profiles for students in your assigned classes.</p>
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
              <CardContent className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Top career:</span> {r.top_career || "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {r.recommendation_at ? `Last recommendation ${format(new Date(r.recommendation_at), "PP")}` : "No recommendations yet"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
