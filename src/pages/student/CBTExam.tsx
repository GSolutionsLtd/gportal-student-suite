import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Monitor, Clock, Play, CheckCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getLinkedStudentByUserId } from "@/lib/studentAccount";

export default function CBTExam() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<any[]>([]);
  const [myAttempts, setMyAttempts] = useState<any[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentLinked, setStudentLinked] = useState(true);

  // Exam taking state
  const [activeExam, setActiveExam] = useState<any>(null);
  const [examQuestions, setExamQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [resultDialog, setResultDialog] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  useEffect(() => { if (user) loadStudentData(); }, [user]);

  useEffect(() => {
    if (timeLeft <= 0 || !activeExam) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { handleSubmit(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, activeExam]);

  const loadStudentData = async () => {
    setLoading(true);
    const student = await getLinkedStudentByUserId(user!.id);
    if (!student) {
      setStudentLinked(false);
      setExams([]);
      setMyAttempts([]);
      setLoading(false);
      return;
    }

    setStudentLinked(true);
    setStudentId(student.id);

    const [examsRes, attemptsRes] = await Promise.all([
      supabase.from("cbt_exams").select("*").eq("status", "published").eq("class_arm_id", student.current_class_arm_id!),
      supabase.from("cbt_attempts").select("*").eq("student_id", student.id),
    ]);
    setExams(examsRes.data || []);
    setMyAttempts(attemptsRes.data || []);
    setLoading(false);
  };

  const getAttemptCount = (examId: string) => myAttempts.filter((a) => a.exam_id === examId).length;
  const getLastAttempt = (examId: string) => myAttempts.filter((a) => a.exam_id === examId && a.status === "completed").sort((a: any, b: any) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0];

  const startExam = async (exam: any) => {
    const count = getAttemptCount(exam.id);
    if (count >= exam.max_attempts) {
      toast({ title: "Max attempts reached", variant: "destructive" });
      return;
    }

    // Fetch questions WITHOUT answer keys (server-side filtered)
    const { data: eqs, error: qErr } = await supabase.rpc("get_cbt_exam_paper", { _exam_id: exam.id });

    if (qErr) { toast({ title: "Error", description: qErr.message, variant: "destructive" }); return; }
    if (!eqs || eqs.length === 0) {
      toast({ title: "No questions", description: "This exam has no questions yet.", variant: "destructive" });
      return;
    }

    let qs = [...eqs];
    if (exam.shuffle_questions) qs = qs.sort(() => Math.random() - 0.5);

    // Create attempt server-side (enforces attempt limits)
    const { data: newAttemptId, error } = await supabase.rpc("start_cbt_attempt", { _exam_id: exam.id });

    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }

    setActiveExam(exam);
    setExamQuestions(qs);
    setCurrentIndex(0);
    setAnswers({});
    setAttemptId(newAttemptId as unknown as string);
    setTimeLeft(exam.duration_minutes * 60);
  };

  const selectAnswer = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = useCallback(async () => {
    if (submitting || !attemptId) return;
    setSubmitting(true);

    try {
      const timeSpent = activeExam ? activeExam.duration_minutes * 60 - timeLeft : 0;

      // Grading happens entirely on the server
      const { data, error } = await supabase.rpc("submit_cbt_attempt", {
        _attempt_id: attemptId,
        _answers: answers,
        _time_spent_seconds: timeSpent,
      });

      if (error) throw error;

      const graded: any = Array.isArray(data) ? data[0] : data;

      setLastResult({
        score: graded?.score ?? 0,
        totalMarks: graded?.total_marks ?? 0,
        percentage: graded?.percentage ?? 0,
        passed: !!graded?.passed,
      });

      if (graded?.show_result) {
        setResultDialog(true);
      } else {
        toast({ title: "Submitted", description: "Your exam has been submitted. Results will be available later." });
      }

      setActiveExam(null);
      setExamQuestions([]);
      setAttemptId(null);
      loadStudentData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }, [attemptId, answers, activeExam, timeLeft, submitting]);


  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!studentLinked) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-medium">Student account not linked yet</h3>
          <p className="mt-2 text-muted-foreground">
            Ask an admin to link your signed-up account to your student record so your exams can load.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Active exam view
  if (activeExam && examQuestions.length > 0) {
    const currentQ = examQuestions[currentIndex] as any;
    const progress = ((currentIndex + 1) / examQuestions.length) * 100;
    const isUrgent = timeLeft < 60;

    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">{activeExam.title}</h2>
          <Badge variant={isUrgent ? "destructive" : "outline"} className="text-sm">
            <Clock className="h-4 w-4 mr-1" />{formatTime(timeLeft)}
          </Badge>
        </div>

        <Progress value={progress} className="h-2" />
        <p className="text-xs text-muted-foreground text-center">Question {currentIndex + 1} of {examQuestions.length}</p>

        <Card>
          <CardContent className="py-6">
            <p className="text-base font-medium mb-4">{currentQ.question_text}</p>
            <div className="space-y-2">
              {["A", "B", "C", "D"].map((opt) => {
                const val = currentQ[`option_${opt.toLowerCase()}`];
                if (!val) return null;
                const selected = answers[currentQ.id] === opt;
                return (
                  <button
                    key={opt}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selected ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                    }`}
                    onClick={() => selectAnswer(currentQ.id, opt)}
                  >
                    <span className="font-medium mr-2">{opt}.</span>{val}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button variant="outline" disabled={currentIndex === 0} onClick={() => setCurrentIndex((p) => p - 1)}>Previous</Button>
          <div className="flex gap-1 flex-wrap justify-center">
            {examQuestions.map((_: any, i: number) => (
              <button
                key={i}
                className={`w-7 h-7 rounded text-xs font-medium ${
                  i === currentIndex ? "bg-primary text-primary-foreground" :
                  answers[examQuestions[i].id] ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}
                onClick={() => setCurrentIndex(i)}
              >{i + 1}</button>
            ))}
          </div>
          {currentIndex < examQuestions.length - 1 ? (
            <Button onClick={() => setCurrentIndex((p) => p + 1)}>Next</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Submit
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Exam list
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">CBT Exams</h1>
        <p className="text-muted-foreground">Take your computer-based tests and exams</p>
      </div>

      {exams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Monitor className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No Available Exams</h3>
            <p className="text-muted-foreground mt-2">There are no published exams for your class at the moment.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {exams.map((exam) => {
            const attempts = getAttemptCount(exam.id);
            const lastAttempt = getLastAttempt(exam.id);
            const canTake = attempts < exam.max_attempts;

            return (
              <Card key={exam.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{exam.title}</CardTitle>
                  <CardDescription>{exam.duration_minutes} minutes • {exam.total_marks} marks • Pass: {exam.pass_mark}%</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Attempts: {attempts}/{exam.max_attempts}</span>
                      {lastAttempt && (
                        <Badge variant={lastAttempt.percentage >= exam.pass_mark ? "default" : "destructive"}>
                          {lastAttempt.percentage}%
                        </Badge>
                      )}
                    </div>
                    <Button className="w-full" disabled={!canTake} onClick={() => startExam(exam)}>
                      {canTake ? <><Play className="h-4 w-4 mr-2" />{attempts > 0 ? "Retake Exam" : "Start Exam"}</> : <><CheckCircle className="h-4 w-4 mr-2" />Completed</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={resultDialog} onOpenChange={setResultDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Exam Result</DialogTitle></DialogHeader>
          {lastResult && (
            <div className="text-center space-y-4 py-4">
              {lastResult.passed ? (
                <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
              ) : (
                <AlertTriangle className="h-16 w-16 mx-auto text-destructive" />
              )}
              <div>
                <p className="text-3xl font-bold">{lastResult.percentage}%</p>
                <p className="text-muted-foreground">{lastResult.score}/{lastResult.totalMarks} marks</p>
              </div>
              <Badge variant={lastResult.passed ? "default" : "destructive"} className="text-base px-4 py-1">
                {lastResult.passed ? "PASSED" : "FAILED"}
              </Badge>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setResultDialog(false)} className="w-full">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
