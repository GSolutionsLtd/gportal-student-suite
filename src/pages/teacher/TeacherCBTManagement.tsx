import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Loader2, Monitor, Plus } from "lucide-react";
import { format } from "date-fns";

interface AssignmentOption {
  classArmId: string;
  classArmName: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  sessionId: string;
}

interface TermOption {
  id: string;
  name: string;
  session_id: string;
}

export default function TeacherCBTManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("exams");
  const [assignments, setAssignments] = useState<AssignmentOption[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [examForm, setExamForm] = useState({
    title: "",
    term_id: "",
    class_arm_id: "",
    subject_id: "",
    question_bank_id: "",
    duration_minutes: 60,
    total_marks: 100,
    pass_mark: 40,
    max_attempts: 1,
    shuffle_questions: true,
    shuffle_options: false,
    show_result_immediately: true,
    exam_type: "exam",
  });

  useEffect(() => {
    if (user) {
      void loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: teacher, error: teacherError } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (teacherError) throw teacherError;
      if (!teacher) {
        setTeacherId(null);
        setAssignments([]);
        return;
      }

      setTeacherId(teacher.id);

      const { data: teacherSubjects, error: assignmentError } = await supabase
        .from("teacher_subjects")
        .select("class_arm_id, subject_id, session_id")
        .eq("teacher_id", teacher.id);

      if (assignmentError) throw assignmentError;

      const assignmentRows = teacherSubjects || [];
      if (assignmentRows.length === 0) {
        setAssignments([]);
        setTerms([]);
        setBanks([]);
        setExams([]);
        return;
      }

      const classArmIds = [...new Set(assignmentRows.map((row) => row.class_arm_id))];
      const subjectIds = [...new Set(assignmentRows.map((row) => row.subject_id))];
      const sessionIds = [...new Set(assignmentRows.map((row) => row.session_id))];

      const [{ data: classArms }, { data: subjects }, { data: termsData }] = await Promise.all([
        supabase.from("class_arms").select("id, name, class_id, class:classes(name)").in("id", classArmIds),
        supabase.from("subjects").select("id, name").in("id", subjectIds),
        supabase.from("terms").select("id, name, session_id").in("session_id", sessionIds).order("start_date", { ascending: false }),
      ]);

      const classArmMap = new Map((classArms || []).map((classArm) => [classArm.id, classArm]));
      const subjectMap = new Map((subjects || []).map((subject) => [subject.id, subject]));

      const mappedAssignments = assignmentRows
        .map((row) => {
          const classArm = classArmMap.get(row.class_arm_id);
          const subject = subjectMap.get(row.subject_id);
          if (!classArm || !subject) return null;

          return {
            classArmId: row.class_arm_id,
            classArmName: classArm.name,
            classId: classArm.class_id,
            className: classArm.class?.name || "Unknown Class",
            subjectId: row.subject_id,
            subjectName: subject.name,
            sessionId: row.session_id,
          } satisfies AssignmentOption;
        })
        .filter(Boolean) as AssignmentOption[];

      setAssignments(mappedAssignments);
      setTerms(termsData || []);

      const classIds = [...new Set(mappedAssignments.map((assignment) => assignment.classId))];

      const [{ data: questionBanks }, { data: examsData }] = await Promise.all([
        supabase
          .from("question_banks")
          .select("*")
          .in("class_id", classIds)
          .in("subject_id", subjectIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("cbt_exams")
          .select("*")
          .in("class_arm_id", classArmIds)
          .in("subject_id", subjectIds)
          .order("created_at", { ascending: false }),
      ]);

      setBanks(questionBanks || []);
      setExams(examsData || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const allowedAssignmentsForTerm = useMemo(() => {
    const selectedTerm = terms.find((term) => term.id === examForm.term_id);
    if (!selectedTerm) return [];
    return assignments.filter((assignment) => assignment.sessionId === selectedTerm.session_id);
  }, [assignments, examForm.term_id, terms]);

  const availableSubjects = useMemo(() => {
    const subjectMap = new Map<string, string>();
    allowedAssignmentsForTerm.forEach((assignment) => {
      subjectMap.set(assignment.subjectId, assignment.subjectName);
    });
    return [...subjectMap.entries()].map(([id, name]) => ({ id, name }));
  }, [allowedAssignmentsForTerm]);

  const availableClassArms = useMemo(() => {
    return allowedAssignmentsForTerm.filter((assignment) => assignment.subjectId === examForm.subject_id);
  }, [allowedAssignmentsForTerm, examForm.subject_id]);

  const availableBanks = useMemo(() => {
    const selectedAssignment = allowedAssignmentsForTerm.find(
      (assignment) => assignment.classArmId === examForm.class_arm_id && assignment.subjectId === examForm.subject_id,
    );

    if (!selectedAssignment) return [];

    return banks.filter(
      (bank) => bank.class_id === selectedAssignment.classId && bank.subject_id === selectedAssignment.subjectId,
    );
  }, [allowedAssignmentsForTerm, banks, examForm.class_arm_id, examForm.subject_id]);

  const loadAttempts = async (examId: string) => {
    setSelectedExamId(examId);

    const { data, error } = await supabase
      .from("cbt_attempts")
      .select("*")
      .eq("exam_id", examId)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    if (!data || data.length === 0) {
      setAttempts([]);
      return;
    }

    const studentIds = [...new Set(data.map((attempt) => attempt.student_id))];
    const { data: students } = await supabase
      .from("students")
      .select("id, first_name, last_name, admission_number")
      .in("id", studentIds);

    const studentMap = new Map((students || []).map((student) => [student.id, student]));
    setAttempts(data.map((attempt) => ({ ...attempt, student: studentMap.get(attempt.student_id) })));
  };

  const saveExam = async () => {
    if (!teacherId || !user) return;
    if (!examForm.title || !examForm.term_id || !examForm.class_arm_id || !examForm.subject_id) {
      toast({ title: "Missing fields", description: "Fill all required exam fields.", variant: "destructive" });
      return;
    }

    const allowed = allowedAssignmentsForTerm.some(
      (assignment) => assignment.classArmId === examForm.class_arm_id && assignment.subjectId === examForm.subject_id,
    );

    if (!allowed) {
      toast({
        title: "Assignment required",
        description: "You can only create exams for classes and subjects assigned to you.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("cbt_exams").insert({
        ...examForm,
        question_bank_id: examForm.question_bank_id || null,
        created_by: user.id,
        status: "draft",
      });

      if (error) throw error;

      toast({ title: "Exam created", description: "The exam has been saved as draft." });
      setDialogOpen(false);
      setExamForm({
        title: "",
        term_id: "",
        class_arm_id: "",
        subject_id: "",
        question_bank_id: "",
        duration_minutes: 60,
        total_marks: 100,
        pass_mark: 40,
        max_attempts: 1,
        shuffle_questions: true,
        shuffle_options: false,
        show_result_immediately: true,
      });
      await loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const publishExam = async (exam: any) => {
    try {
      if (exam.question_bank_id) {
        const { data: bankQuestions } = await supabase
          .from("questions")
          .select("id")
          .eq("question_bank_id", exam.question_bank_id);

        const { data: existingExamQuestions } = await supabase
          .from("cbt_exam_questions")
          .select("question_id")
          .eq("exam_id", exam.id);

        const existingIds = new Set((existingExamQuestions || []).map((row) => row.question_id));
        const newExamQuestions = (bankQuestions || [])
          .filter((question) => !existingIds.has(question.id))
          .map((question, index) => ({ exam_id: exam.id, question_id: question.id, sort_order: index }));

        if (newExamQuestions.length > 0) {
          const { error: examQuestionsError } = await supabase.from("cbt_exam_questions").insert(newExamQuestions);
          if (examQuestionsError) throw examQuestionsError;
        }
      }

      const { error } = await supabase.from("cbt_exams").update({ status: "published" }).eq("id", exam.id);
      if (error) throw error;

      toast({ title: "Exam published", description: "Students in the assigned class arm can now take this exam." });
      await loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Teacher CBT Management</h1>
        <p className="text-muted-foreground">Create and publish exams only for your assigned classes and class arms.</p>
      </div>

      {assignments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            You do not have any class-subject assignments for CBT setup yet.
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="exams">
              <Monitor className="mr-2 h-4 w-4" /> Exams
            </TabsTrigger>
            <TabsTrigger value="results">
              <BarChart3 className="mr-2 h-4 w-4" /> Results
            </TabsTrigger>
          </TabsList>

          <TabsContent value="exams">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>My CBT Exams</CardTitle>
                  <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> New Exam
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Class Arm</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exams.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                          No exams created yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      exams.map((exam) => {
                        const assignment = assignments.find(
                          (item) => item.classArmId === exam.class_arm_id && item.subjectId === exam.subject_id,
                        );

                        return (
                          <TableRow key={exam.id}>
                            <TableCell className="font-medium">{exam.title}</TableCell>
                            <TableCell>{assignment?.subjectName || "Unknown Subject"}</TableCell>
                            <TableCell>
                              {assignment ? `${assignment.className} - ${assignment.classArmName}` : "Unknown Class Arm"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={exam.status === "published" ? "default" : "secondary"}>{exam.status}</Badge>
                            </TableCell>
                            <TableCell>{exam.duration_minutes} min</TableCell>
                            <TableCell className="text-right">
                              {exam.status === "draft" ? (
                                <Button size="sm" variant="outline" onClick={() => publishExam(exam)}>
                                  Publish
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" onClick={() => loadAttempts(exam.id)}>
                                  View Results
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <CardTitle>Exam Attempts</CardTitle>
                  <Select value={selectedExamId} onValueChange={loadAttempts}>
                    <SelectTrigger className="w-full max-w-sm">
                      <SelectValue placeholder="Select an exam" />
                    </SelectTrigger>
                    <SelectContent>
                      {exams.map((exam) => (
                        <SelectItem key={exam.id} value={exam.id}>
                          {exam.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Admission No.</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Percentage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attempts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                          {selectedExamId ? "No attempts yet." : "Select an exam to view attempts."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      attempts.map((attempt) => (
                        <TableRow key={attempt.id}>
                          <TableCell>
                            {attempt.student
                              ? `${attempt.student.first_name} ${attempt.student.last_name}`
                              : "Unknown Student"}
                          </TableCell>
                          <TableCell>{attempt.student?.admission_number || "—"}</TableCell>
                          <TableCell>
                            {attempt.score ?? "—"}/{attempt.total_marks ?? "—"}
                          </TableCell>
                          <TableCell>{attempt.percentage != null ? `${attempt.percentage}%` : "—"}</TableCell>
                          <TableCell>
                            <Badge variant={attempt.status === "completed" ? "default" : "secondary"}>{attempt.status}</Badge>
                          </TableCell>
                          <TableCell>
                            {attempt.submitted_at ? format(new Date(attempt.submitted_at), "dd MMM yyyy HH:mm") : "In progress"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create CBT Exam</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={examForm.title} onChange={(event) => setExamForm((prev) => ({ ...prev, title: event.target.value }))} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Term</Label>
                <Select
                  value={examForm.term_id}
                  onValueChange={(value) =>
                    setExamForm((prev) => ({
                      ...prev,
                      term_id: value,
                      subject_id: "",
                      class_arm_id: "",
                      question_bank_id: "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent>
                    {terms.map((term) => (
                      <SelectItem key={term.id} value={term.id}>
                        {term.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Subject</Label>
                <Select
                  value={examForm.subject_id}
                  onValueChange={(value) =>
                    setExamForm((prev) => ({ ...prev, subject_id: value, class_arm_id: "", question_bank_id: "" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Class Arm</Label>
                <Select
                  value={examForm.class_arm_id}
                  onValueChange={(value) => setExamForm((prev) => ({ ...prev, class_arm_id: value, question_bank_id: "" }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class arm" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClassArms.map((assignment) => (
                      <SelectItem key={`${assignment.classArmId}-${assignment.subjectId}`} value={assignment.classArmId}>
                        {assignment.className} - {assignment.classArmName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Question Bank</Label>
                <Select value={examForm.question_bank_id} onValueChange={(value) => setExamForm((prev) => ({ ...prev, question_bank_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBanks.map((bank) => (
                      <SelectItem key={bank.id} value={bank.id}>
                        {bank.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Duration</Label>
                <Input
                  type="number"
                  value={examForm.duration_minutes}
                  onChange={(event) => setExamForm((prev) => ({ ...prev, duration_minutes: Number(event.target.value) || 60 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Total Marks</Label>
                <Input
                  type="number"
                  value={examForm.total_marks}
                  onChange={(event) => setExamForm((prev) => ({ ...prev, total_marks: Number(event.target.value) || 100 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Pass Mark</Label>
                <Input
                  type="number"
                  value={examForm.pass_mark}
                  onChange={(event) => setExamForm((prev) => ({ ...prev, pass_mark: Number(event.target.value) || 40 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Attempts</Label>
                <Input
                  type="number"
                  value={examForm.max_attempts}
                  onChange={(event) => setExamForm((prev) => ({ ...prev, max_attempts: Number(event.target.value) || 1 }))}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Shuffle Questions</Label>
                <Switch checked={examForm.shuffle_questions} onCheckedChange={(checked) => setExamForm((prev) => ({ ...prev, shuffle_questions: checked }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Shuffle Options</Label>
                <Switch checked={examForm.shuffle_options} onCheckedChange={(checked) => setExamForm((prev) => ({ ...prev, shuffle_options: checked }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Show Result Immediately</Label>
                <Switch
                  checked={examForm.show_result_immediately}
                  onCheckedChange={(checked) => setExamForm((prev) => ({ ...prev, show_result_immediately: checked }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveExam} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}