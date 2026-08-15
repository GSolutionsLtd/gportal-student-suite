import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, BookOpen, FileText, Sparkles } from "lucide-react";
import { format } from "date-fns";

interface LessonPlan {
  id: string;
  title: string;
  topic: string;
  grade_level: string | null;
  duration_minutes: number | null;
  objectives: string | null;
  materials: string | null;
  introduction: string | null;
  main_content: string | null;
  activities: string | null;
  evaluation: string | null;
  homework: string | null;
  references_notes: string | null;
  ai_generated: boolean;
  created_at: string;
  subject_id: string | null;
}

export default function StudentLessonNotes() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [subjectMap, setSubjectMap] = useState<Record<string, string>>({});
  const [viewing, setViewing] = useState<LessonPlan | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);

      const { data: student } = await supabase
        .from("students")
        .select("id, school_id, current_class_arm_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!student?.school_id) {
        setPlans([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from("lesson_plans")
        .select("*")
        .eq("status", "published")
        .eq("school_id", student.school_id)
        .order("created_at", { ascending: false });

      // Only notes for this student's class arm, or school-wide notes
      if (student.current_class_arm_id) {
        query = query.or(`class_arm_id.is.null,class_arm_id.eq.${student.current_class_arm_id}`);
      } else {
        query = query.is("class_arm_id", null);
      }

      const { data: plans } = await query;

      const subjectIds = Array.from(new Set((plans ?? []).map((p: any) => p.subject_id).filter(Boolean))) as string[];
      let subjMap: Record<string, string> = {};
      if (subjectIds.length) {
        const { data: subs } = await supabase.from("subjects").select("id, name").in("id", subjectIds);
        subjMap = Object.fromEntries((subs ?? []).map((s: any) => [s.id, s.name]));
      }
      setSubjectMap(subjMap);
      setPlans((plans as LessonPlan[]) ?? []);
      setLoading(false);
    })();
  }, [user]);


  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="h-6 w-6 text-primary" /> Lesson Notes</h1>
        <p className="text-muted-foreground">Notes and lesson plans your teachers have published.</p>
      </div>

      {plans.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          No lesson notes have been published yet. Check back soon.
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-base">{p.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {p.subject_id ? `${subjectMap[p.subject_id] ?? "—"} • ` : ""}{p.topic}
                    </CardDescription>
                    <p className="text-xs text-muted-foreground mt-1">
                      {p.grade_level || "—"} • {p.duration_minutes || 40} min • {format(new Date(p.created_at), "PP")}
                    </p>
                  </div>
                  {p.ai_generated && <Badge variant="secondary" className="text-xs"><Sparkles className="h-3 w-3 mr-1" />AI</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <Button size="sm" variant="outline" onClick={() => setViewing(p)}>
                  <FileText className="h-4 w-4 mr-1" />Read Note
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>{viewing.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <p className="text-muted-foreground">
                  <b>Topic:</b> {viewing.topic}
                  {viewing.subject_id && <> • <b>Subject:</b> {subjectMap[viewing.subject_id] ?? "—"}</>}
                  {" "}• <b>Class:</b> {viewing.grade_level || "—"} • <b>Duration:</b> {viewing.duration_minutes || 40} min
                </p>
                {(["objectives","materials","introduction","main_content","activities","evaluation","homework","references_notes"] as const).map((k) => {
                  const val = (viewing as any)[k];
                  if (!val) return null;
                  const label = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                  return (
                    <div key={k}>
                      <h3 className="font-semibold text-foreground mb-1">{label}</h3>
                      <p className="whitespace-pre-wrap text-muted-foreground">{val}</p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
