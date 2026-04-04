import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Edit, Trash2, BookOpen, FileQuestion, Monitor, BarChart3, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function CBTManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("banks");
  const [loading, setLoading] = useState(true);

  // Reference data
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [classArms, setClassArms] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);

  // Question Banks
  const [banks, setBanks] = useState<any[]>([]);
  const [bankDialog, setBankDialog] = useState(false);
  const [editingBank, setEditingBank] = useState<any>(null);
  const [bankForm, setBankForm] = useState({ title: "", subject_id: "", class_id: "" });

  // Questions
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedBankId, setSelectedBankId] = useState("");
  const [questionDialog, setQuestionDialog] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [qForm, setQForm] = useState({
    question_text: "", option_a: "", option_b: "", option_c: "", option_d: "",
    correct_answer: "A", marks: 1, explanation: "",
  });

  // Exams
  const [exams, setExams] = useState<any[]>([]);
  const [examDialog, setExamDialog] = useState(false);
  const [editingExam, setEditingExam] = useState<any>(null);
  const [examForm, setExamForm] = useState({
    title: "", subject_id: "", class_arm_id: "", term_id: "", question_bank_id: "",
    duration_minutes: 60, total_marks: 100, pass_mark: 40,
    shuffle_questions: true, shuffle_options: false, show_result_immediately: true,
    max_attempts: 1, status: "draft", exam_type: "exam",
  });

  // Results
  const [attempts, setAttempts] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");

  useEffect(() => { loadRefData(); }, []);

  const loadRefData = async () => {
    setLoading(true);
    const [subRes, clsRes, armRes, termRes] = await Promise.all([
      supabase.from("subjects").select("id, name").eq("is_active", true).order("name"),
      supabase.from("classes").select("id, name").eq("is_active", true).order("level"),
      supabase.from("class_arms").select("id, name, class_id").eq("is_active", true),
      supabase.from("terms").select("id, name, session_id").order("created_at", { ascending: false }),
    ]);
    setSubjects(subRes.data || []);
    setClasses(clsRes.data || []);
    setClassArms(armRes.data || []);
    setTerms(termRes.data || []);
    await Promise.all([loadBanks(), loadExams()]);
    setLoading(false);
  };

  const loadBanks = async () => {
    const { data } = await supabase.from("question_banks").select("*").order("created_at", { ascending: false });
    setBanks(data || []);
  };

  const loadExams = async () => {
    const { data } = await supabase.from("cbt_exams").select("*").order("created_at", { ascending: false });
    setExams(data || []);
  };

  const loadQuestions = async (bankId: string) => {
    setSelectedBankId(bankId);
    const { data } = await supabase.from("questions").select("*").eq("question_bank_id", bankId).order("created_at");
    setQuestions(data || []);
  };

  const loadAttempts = async (examId: string) => {
    setSelectedExamId(examId);
    const { data } = await supabase.from("cbt_attempts").select("*").eq("exam_id", examId).order("created_at", { ascending: false });
    if (data && data.length > 0) {
      const studentIds = [...new Set(data.map((a) => a.student_id))];
      const { data: students } = await supabase.from("students").select("id, first_name, last_name, admission_number").in("id", studentIds);
      const studentMap = new Map((students || []).map((s) => [s.id, s]));
      setAttempts(data.map((a) => ({ ...a, student: studentMap.get(a.student_id) })));
    } else {
      setAttempts([]);
    }
  };

  // -- Bank CRUD --
  const saveBank = async () => {
    if (!bankForm.title || !bankForm.subject_id || !bankForm.class_id) {
      toast({ title: "Fill all fields", variant: "destructive" }); return;
    }
    const payload = { ...bankForm, created_by: user!.id };
    const { error } = editingBank
      ? await supabase.from("question_banks").update(payload).eq("id", editingBank.id)
      : await supabase.from("question_banks").insert(payload);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: editingBank ? "Updated" : "Created" });
    setBankDialog(false);
    setEditingBank(null);
    setBankForm({ title: "", subject_id: "", class_id: "" });
    loadBanks();
  };

  const deleteBank = async (id: string) => {
    await supabase.from("question_banks").delete().eq("id", id);
    loadBanks();
    toast({ title: "Deleted" });
  };

  // -- Question CRUD --
  const saveQuestion = async () => {
    if (!qForm.question_text || !qForm.option_a || !qForm.option_b) {
      toast({ title: "Fill required fields", variant: "destructive" }); return;
    }
    const payload = { ...qForm, question_bank_id: selectedBankId };
    const { error } = editingQuestion
      ? await supabase.from("questions").update(payload).eq("id", editingQuestion.id)
      : await supabase.from("questions").insert(payload);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: editingQuestion ? "Updated" : "Added" });
    setQuestionDialog(false);
    setEditingQuestion(null);
    setQForm({ question_text: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "A", marks: 1, explanation: "" });
    loadQuestions(selectedBankId);
  };

  const deleteQuestion = async (id: string) => {
    await supabase.from("questions").delete().eq("id", id);
    loadQuestions(selectedBankId);
  };

  // -- Exam CRUD --
  const saveExam = async () => {
    if (!examForm.title || !examForm.subject_id || !examForm.class_arm_id || !examForm.term_id) {
      toast({ title: "Fill required fields", variant: "destructive" }); return;
    }
    const payload = { ...examForm, created_by: user!.id };
    const { error } = editingExam
      ? await supabase.from("cbt_exams").update(payload).eq("id", editingExam.id)
      : await supabase.from("cbt_exams").insert(payload);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: editingExam ? "Updated" : "Created" });
    setExamDialog(false);
    setEditingExam(null);
    setExamForm({ title: "", subject_id: "", class_arm_id: "", term_id: "", question_bank_id: "", duration_minutes: 60, total_marks: 100, pass_mark: 40, shuffle_questions: true, shuffle_options: false, show_result_immediately: true, max_attempts: 1, status: "draft", exam_type: "exam" });
    loadExams();
  };

  const publishExam = async (exam: any) => {
    // Auto-add all questions from the linked question bank
    if (exam.question_bank_id) {
      const { data: bankQuestions } = await supabase.from("questions").select("id").eq("question_bank_id", exam.question_bank_id);
      if (bankQuestions && bankQuestions.length > 0) {
        const existing = await supabase.from("cbt_exam_questions").select("question_id").eq("exam_id", exam.id);
        const existingIds = new Set((existing.data || []).map((e) => e.question_id));
        const newQs = bankQuestions.filter((q) => !existingIds.has(q.id)).map((q, i) => ({
          exam_id: exam.id, question_id: q.id, sort_order: i,
        }));
        if (newQs.length > 0) await supabase.from("cbt_exam_questions").insert(newQs);
      }
    }
    await supabase.from("cbt_exams").update({ status: "published" }).eq("id", exam.id);
    toast({ title: "Exam published" });
    loadExams();
  };

  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name || "—";
  const className = (id: string) => classes.find((c) => c.id === id)?.name || "—";
  const armName = (id: string) => classArms.find((a) => a.id === id)?.name || "—";

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Computer-Based Testing</h1>
        <p className="text-muted-foreground">Manage question banks, create exams, and view results</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="banks"><BookOpen className="h-4 w-4 mr-1" />Question Banks</TabsTrigger>
          <TabsTrigger value="questions"><FileQuestion className="h-4 w-4 mr-1" />Questions</TabsTrigger>
          <TabsTrigger value="exams"><Monitor className="h-4 w-4 mr-1" />Exams</TabsTrigger>
          <TabsTrigger value="results"><BarChart3 className="h-4 w-4 mr-1" />Results</TabsTrigger>
        </TabsList>

        {/* Question Banks Tab */}
        <TabsContent value="banks">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Question Banks</CardTitle>
                <Button onClick={() => { setEditingBank(null); setBankForm({ title: "", subject_id: "", class_id: "" }); setBankDialog(true); }}>
                  <Plus className="h-4 w-4 mr-2" />New Bank
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {banks.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.title}</TableCell>
                      <TableCell>{subjectName(b.subject_id)}</TableCell>
                      <TableCell>{className(b.class_id)}</TableCell>
                      <TableCell><Badge variant={b.is_active ? "default" : "secondary"}>{b.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                      <TableCell className="space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => { loadQuestions(b.id); setActiveTab("questions"); }}><Eye className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditingBank(b); setBankForm({ title: b.title, subject_id: b.subject_id, class_id: b.class_id }); setBankDialog(true); }}><Edit className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteBank(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {banks.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No question banks yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Questions Tab */}
        <TabsContent value="questions">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Questions</CardTitle>
                  <CardDescription>
                    {selectedBankId ? `${questions.length} questions in selected bank` : "Select a question bank first"}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedBankId} onValueChange={loadQuestions}>
                    <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select bank" /></SelectTrigger>
                    <SelectContent>
                      {banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {selectedBankId && (
                    <Button onClick={() => { setEditingQuestion(null); setQForm({ question_text: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "A", marks: 1, explanation: "" }); setQuestionDialog(true); }}>
                      <Plus className="h-4 w-4 mr-2" />Add Question
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {questions.map((q, i) => (
                  <Card key={q.id} className="border">
                    <CardContent className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-sm">Q{i + 1}. {q.question_text}</p>
                          <div className="grid grid-cols-2 gap-1 mt-2 text-sm">
                            {["A", "B", "C", "D"].map((opt) => {
                              const val = q[`option_${opt.toLowerCase()}`];
                              if (!val) return null;
                              return (
                                <div key={opt} className={`px-2 py-1 rounded text-xs ${q.correct_answer === opt ? "bg-primary/10 text-primary font-medium border border-primary/20" : "bg-muted"}`}>
                                  {opt}. {val}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Badge variant="outline">{q.marks} mk{q.marks !== 1 ? "s" : ""}</Badge>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingQuestion(q); setQForm({ question_text: q.question_text, option_a: q.option_a || "", option_b: q.option_b || "", option_c: q.option_c || "", option_d: q.option_d || "", correct_answer: q.correct_answer, marks: q.marks, explanation: q.explanation || "" }); setQuestionDialog(true); }}><Edit className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteQuestion(q.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {questions.length === 0 && selectedBankId && <p className="text-center text-muted-foreground py-8">No questions in this bank yet</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exams Tab */}
        <TabsContent value="exams">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>CBT Exams</CardTitle>
                <Button onClick={() => { setEditingExam(null); setExamForm({ title: "", subject_id: "", class_arm_id: "", term_id: "", question_bank_id: "", duration_minutes: 60, total_marks: 100, pass_mark: 40, shuffle_questions: true, shuffle_options: false, show_result_immediately: true, max_attempts: 1, status: "draft", exam_type: "exam" }); setExamDialog(true); }}>
                  <Plus className="h-4 w-4 mr-2" />New Exam
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exams.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.title}</TableCell>
                      <TableCell>{subjectName(e.subject_id)}</TableCell>
                      <TableCell>{armName(e.class_arm_id)}</TableCell>
                      <TableCell>{e.duration_minutes} min</TableCell>
                      <TableCell>
                        <Badge variant={e.status === "published" ? "default" : e.status === "closed" ? "secondary" : "outline"}>
                          {e.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="space-x-1">
                        {e.status === "draft" && (
                          <Button size="sm" variant="outline" onClick={() => publishExam(e)}>Publish</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => { loadAttempts(e.id); setActiveTab("results"); }}>
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditingExam(e);
                          setExamForm({
                            title: e.title, subject_id: e.subject_id, class_arm_id: e.class_arm_id,
                            term_id: e.term_id, question_bank_id: e.question_bank_id || "",
                            duration_minutes: e.duration_minutes, total_marks: e.total_marks, pass_mark: e.pass_mark,
                            shuffle_questions: e.shuffle_questions, shuffle_options: e.shuffle_options,
                            show_result_immediately: e.show_result_immediately, max_attempts: e.max_attempts, status: e.status,
                            exam_type: e.exam_type || "exam",
                          });
                          setExamDialog(true);
                        }}><Edit className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {exams.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No exams created yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Exam Results</CardTitle>
                <Select value={selectedExamId} onValueChange={loadAttempts}>
                  <SelectTrigger className="w-[250px]"><SelectValue placeholder="Select exam" /></SelectTrigger>
                  <SelectContent>
                    {exams.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Adm No.</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.student ? `${a.student.first_name} ${a.student.last_name}` : "Unknown"}</TableCell>
                      <TableCell>{a.student?.admission_number || "—"}</TableCell>
                      <TableCell>{a.score ?? "—"}/{a.total_marks ?? "—"}</TableCell>
                      <TableCell>{a.percentage != null ? `${a.percentage}%` : "—"}</TableCell>
                      <TableCell><Badge variant={a.status === "completed" ? "default" : "secondary"}>{a.status}</Badge></TableCell>
                      <TableCell>{a.submitted_at ? format(new Date(a.submitted_at), "dd MMM yyyy HH:mm") : "In progress"}</TableCell>
                    </TableRow>
                  ))}
                  {attempts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{selectedExamId ? "No attempts yet" : "Select an exam to view results"}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bank Dialog */}
      <Dialog open={bankDialog} onOpenChange={setBankDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingBank ? "Edit" : "New"} Question Bank</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={bankForm.title} onChange={(e) => setBankForm({ ...bankForm, title: e.target.value })} /></div>
            <div><Label>Subject</Label>
              <Select value={bankForm.subject_id} onValueChange={(v) => setBankForm({ ...bankForm, subject_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Class</Label>
              <Select value={bankForm.class_id} onValueChange={(v) => setBankForm({ ...bankForm, class_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBankDialog(false)}>Cancel</Button>
            <Button onClick={saveBank}>{editingBank ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Question Dialog */}
      <Dialog open={questionDialog} onOpenChange={setQuestionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingQuestion ? "Edit" : "Add"} Question</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Question</Label><Textarea value={qForm.question_text} onChange={(e) => setQForm({ ...qForm, question_text: e.target.value })} rows={3} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Option A</Label><Input value={qForm.option_a} onChange={(e) => setQForm({ ...qForm, option_a: e.target.value })} /></div>
              <div><Label>Option B</Label><Input value={qForm.option_b} onChange={(e) => setQForm({ ...qForm, option_b: e.target.value })} /></div>
              <div><Label>Option C</Label><Input value={qForm.option_c} onChange={(e) => setQForm({ ...qForm, option_c: e.target.value })} /></div>
              <div><Label>Option D</Label><Input value={qForm.option_d} onChange={(e) => setQForm({ ...qForm, option_d: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Correct Answer</Label>
                <Select value={qForm.correct_answer} onValueChange={(v) => setQForm({ ...qForm, correct_answer: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["A", "B", "C", "D"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Marks</Label><Input type="number" value={qForm.marks} onChange={(e) => setQForm({ ...qForm, marks: parseInt(e.target.value) || 1 })} /></div>
            </div>
            <div><Label>Explanation (optional)</Label><Textarea value={qForm.explanation} onChange={(e) => setQForm({ ...qForm, explanation: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuestionDialog(false)}>Cancel</Button>
            <Button onClick={saveQuestion}>{editingQuestion ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exam Dialog */}
      <Dialog open={examDialog} onOpenChange={setExamDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingExam ? "Edit" : "New"} CBT Exam</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={examForm.title} onChange={(e) => setExamForm({ ...examForm, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Subject</Label>
                <Select value={examForm.subject_id} onValueChange={(v) => setExamForm({ ...examForm, subject_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Class Arm</Label>
                <Select value={examForm.class_arm_id} onValueChange={(v) => setExamForm({ ...examForm, class_arm_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{classArms.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Term</Label>
                <Select value={examForm.term_id} onValueChange={(v) => setExamForm({ ...examForm, term_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{terms.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Question Bank</Label>
                <Select value={examForm.question_bank_id} onValueChange={(v) => setExamForm({ ...examForm, question_bank_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Duration (min)</Label><Input type="number" value={examForm.duration_minutes} onChange={(e) => setExamForm({ ...examForm, duration_minutes: parseInt(e.target.value) || 60 })} /></div>
              <div><Label>Total Marks</Label><Input type="number" value={examForm.total_marks} onChange={(e) => setExamForm({ ...examForm, total_marks: parseInt(e.target.value) || 100 })} /></div>
              <div><Label>Pass Mark</Label><Input type="number" value={examForm.pass_mark} onChange={(e) => setExamForm({ ...examForm, pass_mark: parseInt(e.target.value) || 40 })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Exam Type (for Score Sync)</Label>
                <Select value={examForm.exam_type} onValueChange={(v) => setExamForm({ ...examForm, exam_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test1">Test 1</SelectItem>
                    <SelectItem value="test2">Test 2</SelectItem>
                    <SelectItem value="other">Other Assessment</SelectItem>
                    <SelectItem value="exam">Exam</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Max Attempts</Label><Input type="number" value={examForm.max_attempts} onChange={(e) => setExamForm({ ...examForm, max_attempts: parseInt(e.target.value) || 1 })} /></div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label>Shuffle Questions</Label><Switch checked={examForm.shuffle_questions} onCheckedChange={(v) => setExamForm({ ...examForm, shuffle_questions: v })} /></div>
              <div className="flex items-center justify-between"><Label>Shuffle Options</Label><Switch checked={examForm.shuffle_options} onCheckedChange={(v) => setExamForm({ ...examForm, shuffle_options: v })} /></div>
              <div className="flex items-center justify-between"><Label>Show Result Immediately</Label><Switch checked={examForm.show_result_immediately} onCheckedChange={(v) => setExamForm({ ...examForm, show_result_immediately: v })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExamDialog(false)}>Cancel</Button>
            <Button onClick={saveExam}>{editingExam ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
