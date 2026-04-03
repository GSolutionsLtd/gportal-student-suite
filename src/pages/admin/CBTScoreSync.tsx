import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, CheckCircle, AlertTriangle, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface SyncPreview {
  student_id: string;
  student_name: string;
  admission_number: string;
  class_arm_name: string;
  subject_name: string;
  exam_title: string;
  score: number;
  total_marks: number;
  percentage: number;
  score_type: string;
}

export default function CBTScoreSync() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);

  const [sessions, setSessions] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [scoreType, setScoreType] = useState("exam");
  const [preview, setPreview] = useState<SyncPreview[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; errors: number } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [sessRes, termRes] = await Promise.all([
      supabase.from("academic_sessions").select("id, name").order("start_date", { ascending: false }),
      supabase.from("terms").select("id, name, session_id").order("created_at", { ascending: false }),
    ]);
    setSessions(sessRes.data || []);
    setTerms(termRes.data || []);
    setLoading(false);
  };

  const filteredTerms = terms.filter((t) => t.session_id === selectedSession);

  const loadPreview = async () => {
    if (!selectedTerm) {
      toast({ title: "Select a term", variant: "destructive" });
      return;
    }

    setPreviewLoading(true);
    setPreview([]);
    setSyncResult(null);

    try {
      // Get all completed CBT attempts for this term
      const { data: exams } = await supabase
        .from("cbt_exams")
        .select("id, title, subject_id, class_arm_id, total_marks")
        .eq("term_id", selectedTerm)
        .eq("status", "published");

      if (!exams || exams.length === 0) {
        toast({ title: "No exams found", description: "No published CBT exams for this term" });
        setPreviewLoading(false);
        return;
      }

      const examIds = exams.map((e) => e.id);
      const { data: attempts } = await supabase
        .from("cbt_attempts")
        .select("*")
        .in("exam_id", examIds)
        .eq("status", "completed");

      if (!attempts || attempts.length === 0) {
        toast({ title: "No completed attempts", description: "No students have completed exams yet" });
        setPreviewLoading(false);
        return;
      }

      // Get student details
      const studentIds = [...new Set(attempts.map((a) => a.student_id))];
      const classArmIds = [...new Set(exams.map((e) => e.class_arm_id))];
      const subjectIds = [...new Set(exams.map((e) => e.subject_id))];

      const [{ data: students }, { data: classArms }, { data: subjects }] = await Promise.all([
        supabase.from("students").select("id, first_name, last_name, admission_number").in("id", studentIds),
        supabase.from("class_arms").select("id, name").in("id", classArmIds),
        supabase.from("subjects").select("id, name").in("id", subjectIds),
      ]);

      const studentMap = new Map((students || []).map((s) => [s.id, s]));
      const armMap = new Map((classArms || []).map((a) => [a.id, a.name]));
      const subjectMap = new Map((subjects || []).map((s) => [s.id, s.name]));
      const examMap = new Map(exams.map((e) => [e.id, e]));

      // For each student, pick their best attempt per exam
      const bestAttempts = new Map<string, typeof attempts[0]>();
      attempts.forEach((a) => {
        const key = `${a.student_id}_${a.exam_id}`;
        const existing = bestAttempts.get(key);
        if (!existing || (a.score || 0) > (existing.score || 0)) {
          bestAttempts.set(key, a);
        }
      });

      const previewData: SyncPreview[] = Array.from(bestAttempts.values()).map((a) => {
        const exam = examMap.get(a.exam_id)!;
        const student = studentMap.get(a.student_id);
        return {
          student_id: a.student_id,
          student_name: student ? `${student.first_name} ${student.last_name}` : "Unknown",
          admission_number: student?.admission_number || "—",
          class_arm_name: armMap.get(exam.class_arm_id) || "—",
          subject_name: subjectMap.get(exam.subject_id) || "—",
          exam_title: exam.title,
          score: a.score || 0,
          total_marks: exam.total_marks,
          percentage: a.percentage || 0,
          score_type: scoreType,
        };
      });

      setPreview(previewData.sort((a, b) => a.class_arm_name.localeCompare(b.class_arm_name) || a.student_name.localeCompare(b.student_name)));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSync = async () => {
    if (preview.length === 0) return;

    setSyncing(true);
    setProgress(0);
    setSyncResult(null);

    let synced = 0;
    let errors = 0;

    try {
      // Get all exams for this term to map subject_id + class_arm_id
      const { data: exams } = await supabase
        .from("cbt_exams")
        .select("id, subject_id, class_arm_id")
        .eq("term_id", selectedTerm);

      const examMap = new Map((exams || []).map((e) => [e.id, e]));

      // Get best attempts
      const examIds = (exams || []).map((e) => e.id);
      const { data: attempts } = await supabase
        .from("cbt_attempts")
        .select("*")
        .in("exam_id", examIds)
        .eq("status", "completed");

      const bestAttempts = new Map<string, any>();
      (attempts || []).forEach((a) => {
        const key = `${a.student_id}_${a.exam_id}`;
        const existing = bestAttempts.get(key);
        if (!existing || (a.score || 0) > (existing.score || 0)) {
          bestAttempts.set(key, a);
        }
      });

      const total = bestAttempts.size;
      let processed = 0;

      for (const [, attempt] of bestAttempts) {
        try {
          const exam = examMap.get(attempt.exam_id);
          if (!exam) continue;

          // Find or create the result record
          let { data: result } = await supabase
            .from("results")
            .select("id")
            .eq("student_id", attempt.student_id)
            .eq("term_id", selectedTerm)
            .eq("class_arm_id", exam.class_arm_id)
            .maybeSingle();

          if (!result) {
            const { data: newResult, error: createErr } = await supabase
              .from("results")
              .insert({
                student_id: attempt.student_id,
                term_id: selectedTerm,
                class_arm_id: exam.class_arm_id,
                status: "draft",
              })
              .select("id")
              .single();

            if (createErr) { errors++; continue; }
            result = newResult;
          }

          // Find or create result_component for this subject
          let { data: component } = await supabase
            .from("result_components")
            .select("id")
            .eq("result_id", result.id)
            .eq("subject_id", exam.subject_id)
            .maybeSingle();

          const scoreField = scoreType === "test1" ? "test1_score"
            : scoreType === "test2" ? "test2_score"
            : scoreType === "other" ? "other_assessment_score"
            : "exam_score";

          const scoreValue = attempt.percentage != null ? Math.round(attempt.percentage) : attempt.score;

          if (component) {
            await supabase
              .from("result_components")
              .update({ [scoreField]: scoreValue, entered_by: user?.id, entered_at: new Date().toISOString() })
              .eq("id", component.id);
          } else {
            await supabase
              .from("result_components")
              .insert({
                result_id: result.id,
                subject_id: exam.subject_id,
                [scoreField]: scoreValue,
                entered_by: user?.id,
              });
          }

          synced++;
        } catch {
          errors++;
        }

        processed++;
        setProgress(Math.round((processed / total) * 100));
      }

      setSyncResult({ synced, errors });
      toast({
        title: "Sync Complete",
        description: `${synced} scores synced, ${errors} errors`,
      });
    } catch (err: any) {
      toast({ title: "Sync Error", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">CBT Score Sync</h1>
        <p className="text-muted-foreground">
          Automatically populate student results from CBT exam scores
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Configure Sync
          </CardTitle>
          <CardDescription>Select session, term, and score type to pull CBT scores into the result system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Session</label>
              <Select value={selectedSession} onValueChange={(v) => { setSelectedSession(v); setSelectedTerm(""); setPreview([]); }}>
                <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Term</label>
              <Select value={selectedTerm} onValueChange={(v) => { setSelectedTerm(v); setPreview([]); }}>
                <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
                <SelectContent>
                  {filteredTerms.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Score Type</label>
              <Select value={scoreType} onValueChange={setScoreType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="test1">Test 1</SelectItem>
                  <SelectItem value="test2">Test 2</SelectItem>
                  <SelectItem value="other">Other Assessment</SelectItem>
                  <SelectItem value="exam">Exam</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={loadPreview} disabled={previewLoading || !selectedTerm} className="w-full">
                {previewLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Preview Scores
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Score Preview ({preview.length} records)</CardTitle>
                <CardDescription>Review the scores before syncing to the result system</CardDescription>
              </div>
              <Button onClick={handleSync} disabled={syncing}>
                {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                Sync All Scores
              </Button>
            </div>
            {syncing && (
              <div className="space-y-1">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground">{progress}% complete</p>
              </div>
            )}
            {syncResult && (
              <div className="flex items-center gap-4 mt-2">
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="h-3 w-3" />{syncResult.synced} synced
                </Badge>
                {syncResult.errors > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />{syncResult.errors} errors
                  </Badge>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Adm. No.</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{p.student_name}</TableCell>
                      <TableCell>{p.admission_number}</TableCell>
                      <TableCell>{p.class_arm_name}</TableCell>
                      <TableCell>{p.subject_name}</TableCell>
                      <TableCell>{p.exam_title}</TableCell>
                      <TableCell>{p.score}/{p.total_marks}</TableCell>
                      <TableCell>
                        <Badge variant={p.percentage >= 50 ? "default" : "destructive"}>
                          {p.percentage.toFixed(0)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
