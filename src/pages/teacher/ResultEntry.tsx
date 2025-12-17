import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  ArrowLeft, 
  Save, 
  Send, 
  Loader2,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TeacherAssignment {
  id: string;
  class_arm_id: string;
  subject_id: string;
  class_arm: {
    id: string;
    name: string;
    class: {
      id: string;
      name: string;
    };
  };
  subject: {
    id: string;
    name: string;
    code: string;
  };
}

interface Student {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
}

interface ScoreEntry {
  student_id: string;
  test1_score: number | null;
  test2_score: number | null;
  exam_score: number | null;
  total_score: number | null;
  result_component_id?: string;
}

interface ScoreWeights {
  test1_weight: number;
  test2_weight: number;
  exam_weight: number;
}

export default function ResultEntry() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [scores, setScores] = useState<Record<string, ScoreEntry>>({});
  const [currentTerm, setCurrentTerm] = useState<{ id: string; name: string } | null>(null);
  const [scoreWeights, setScoreWeights] = useState<ScoreWeights>({ 
    test1_weight: 10, 
    test2_weight: 20, 
    exam_weight: 70 
  });
  const [resultStatus, setResultStatus] = useState<string>("draft");
  const [resultId, setResultId] = useState<string | null>(null);

  // Fetch teacher assignments
  useEffect(() => {
    async function fetchAssignments() {
      if (!user) return;

      try {
        // Get teacher record
        const { data: teacher, error: teacherError } = await supabase
          .from("teachers")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (teacherError) throw teacherError;
        if (!teacher) {
          toast({ title: "Error", description: "Teacher record not found", variant: "destructive" });
          return;
        }

        // Get current session and term
        const { data: currentSession } = await supabase
          .from("academic_sessions")
          .select("id")
          .eq("is_current", true)
          .maybeSingle();

        const { data: term } = await supabase
          .from("terms")
          .select("id, name")
          .eq("is_current", true)
          .maybeSingle();

        if (term) {
          setCurrentTerm(term);
        }

        // Get score weights for current session
        if (currentSession) {
          const { data: weights } = await supabase
            .from("score_weights")
            .select("test1_weight, test2_weight, exam_weight")
            .eq("session_id", currentSession.id)
            .maybeSingle();

          if (weights) {
            setScoreWeights({
              test1_weight: Number(weights.test1_weight),
              test2_weight: Number(weights.test2_weight),
              exam_weight: Number(weights.exam_weight),
            });
          }
        }

        // Get teacher assignments with class and subject info
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from("teacher_subjects")
          .select(`
            id,
            class_arm_id,
            subject_id,
            class_arm:class_arms(
              id,
              name,
              class:classes(id, name)
            ),
            subject:subjects(id, name, code)
          `)
          .eq("teacher_id", teacher.id);

        if (assignmentsError) throw assignmentsError;
        
        // Type assertion for the nested data
        const typedAssignments = (assignmentsData || []).map((a: any) => ({
          id: a.id,
          class_arm_id: a.class_arm_id,
          subject_id: a.subject_id,
          class_arm: a.class_arm,
          subject: a.subject,
        })) as TeacherAssignment[];
        
        setAssignments(typedAssignments);
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }

    fetchAssignments();
  }, [user, toast]);

  // Fetch students and existing scores when assignment changes
  useEffect(() => {
    async function fetchStudentsAndScores() {
      if (!selectedAssignment || !currentTerm) return;

      const assignment = assignments.find(a => a.id === selectedAssignment);
      if (!assignment) return;

      setLoading(true);
      try {
        // Fetch students in the class arm
        const { data: studentsData, error: studentsError } = await supabase
          .from("students")
          .select("id, admission_number, first_name, last_name, middle_name")
          .eq("current_class_arm_id", assignment.class_arm_id)
          .eq("is_active", true)
          .order("last_name");

        if (studentsError) throw studentsError;
        setStudents(studentsData || []);

        // Initialize scores for all students
        const initialScores: Record<string, ScoreEntry> = {};
        (studentsData || []).forEach(student => {
          initialScores[student.id] = {
            student_id: student.id,
            test1_score: null,
            test2_score: null,
            exam_score: null,
            total_score: null,
          };
        });

        // Check for existing results
        const { data: existingResults, error: resultsError } = await supabase
          .from("results")
          .select(`
            id,
            status,
            student_id,
            result_components(
              id,
              subject_id,
              test1_score,
              test2_score,
              exam_score,
              total_score
            )
          `)
          .eq("class_arm_id", assignment.class_arm_id)
          .eq("term_id", currentTerm.id)
          .in("student_id", (studentsData || []).map(s => s.id));

        if (resultsError) throw resultsError;

        // Populate existing scores
        if (existingResults && existingResults.length > 0) {
          existingResults.forEach((result: any) => {
            const component = result.result_components?.find(
              (c: any) => c.subject_id === assignment.subject_id
            );
            if (component && initialScores[result.student_id]) {
              initialScores[result.student_id] = {
                ...initialScores[result.student_id],
                test1_score: component.test1_score !== null ? Number(component.test1_score) : null,
                test2_score: component.test2_score !== null ? Number(component.test2_score) : null,
                exam_score: component.exam_score !== null ? Number(component.exam_score) : null,
                total_score: component.total_score !== null ? Number(component.total_score) : null,
                result_component_id: component.id,
              };
            }
            // Use the first result's status as the overall status
            if (result.status) {
              setResultStatus(result.status);
              setResultId(result.id);
            }
          });
        } else {
          setResultStatus("draft");
          setResultId(null);
        }

        setScores(initialScores);
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }

    fetchStudentsAndScores();
  }, [selectedAssignment, currentTerm, assignments, toast]);

  // Calculate weighted total
  const calculateTotal = useCallback((entry: ScoreEntry): number | null => {
    const { test1_score, test2_score, exam_score } = entry;
    if (test1_score === null && test2_score === null && exam_score === null) {
      return null;
    }

    const t1 = test1_score || 0;
    const t2 = test2_score || 0;
    const exam = exam_score || 0;

    // Weighted calculation: scores are entered as raw values, weights as percentages
    const total = 
      (t1 * scoreWeights.test1_weight / 100) +
      (t2 * scoreWeights.test2_weight / 100) +
      (exam * scoreWeights.exam_weight / 100);

    return Math.round(total * 100) / 100;
  }, [scoreWeights]);

  // Handle score change
  const handleScoreChange = (studentId: string, field: keyof ScoreEntry, value: string) => {
    const numValue = value === "" ? null : Math.min(100, Math.max(0, parseFloat(value) || 0));
    
    setScores(prev => {
      const updated = {
        ...prev,
        [studentId]: {
          ...prev[studentId],
          [field]: numValue,
        },
      };
      // Recalculate total
      updated[studentId].total_score = calculateTotal(updated[studentId]);
      return updated;
    });
  };

  // Save scores as draft
  const handleSave = async () => {
    if (!selectedAssignment || !currentTerm) return;
    
    const assignment = assignments.find(a => a.id === selectedAssignment);
    if (!assignment) return;

    setSaving(true);
    try {
      for (const student of students) {
        const entry = scores[student.id];
        if (!entry) continue;

        // Check if result exists for this student
        let { data: existingResult } = await supabase
          .from("results")
          .select("id")
          .eq("student_id", student.id)
          .eq("term_id", currentTerm.id)
          .eq("class_arm_id", assignment.class_arm_id)
          .maybeSingle();

        let resultId = existingResult?.id;

        // Create result if doesn't exist
        if (!resultId) {
          const { data: newResult, error: resultError } = await supabase
            .from("results")
            .insert({
              student_id: student.id,
              term_id: currentTerm.id,
              class_arm_id: assignment.class_arm_id,
              status: "draft",
            })
            .select("id")
            .single();

          if (resultError) throw resultError;
          resultId = newResult.id;
        }

        // Upsert result component
        if (entry.result_component_id) {
          // Update existing
          const { error } = await supabase
            .from("result_components")
            .update({
              test1_score: entry.test1_score,
              test2_score: entry.test2_score,
              exam_score: entry.exam_score,
              total_score: entry.total_score,
              entered_by: user?.id,
              entered_at: new Date().toISOString(),
            })
            .eq("id", entry.result_component_id);

          if (error) throw error;
        } else {
          // Insert new
          const { data: newComponent, error } = await supabase
            .from("result_components")
            .insert({
              result_id: resultId,
              subject_id: assignment.subject_id,
              test1_score: entry.test1_score,
              test2_score: entry.test2_score,
              exam_score: entry.exam_score,
              total_score: entry.total_score,
              entered_by: user?.id,
            })
            .select("id")
            .single();

          if (error) throw error;
          
          // Update local state with new component id
          setScores(prev => ({
            ...prev,
            [student.id]: {
              ...prev[student.id],
              result_component_id: newComponent.id,
            },
          }));
        }
      }

      toast({ title: "Success", description: "Scores saved as draft" });
      setResultStatus("draft");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Submit scores for approval
  const handleSubmit = async () => {
    if (!selectedAssignment || !currentTerm) return;

    const assignment = assignments.find(a => a.id === selectedAssignment);
    if (!assignment) return;

    // Validate all scores are entered
    const incomplete = students.some(s => {
      const entry = scores[s.id];
      return !entry || entry.test1_score === null || entry.test2_score === null || entry.exam_score === null;
    });

    if (incomplete) {
      toast({ 
        title: "Incomplete Scores", 
        description: "Please enter all scores before submitting", 
        variant: "destructive" 
      });
      return;
    }

    setSubmitting(true);
    try {
      // First save all scores
      await handleSave();

      // Update all results to submitted status
      const { error } = await supabase
        .from("results")
        .update({
          status: "submitted",
          submitted_at: new Date().toISOString(),
          submitted_by: user?.id,
        })
        .eq("class_arm_id", assignment.class_arm_id)
        .eq("term_id", currentTerm.id)
        .in("student_id", students.map(s => s.id));

      if (error) throw error;

      toast({ title: "Success", description: "Results submitted for approval" });
      setResultStatus("submitted");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedAssignmentData = assignments.find(a => a.id === selectedAssignment);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/teacher")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Result Entry</h1>
          <p className="text-muted-foreground">
            {currentTerm ? currentTerm.name : "No active term"}
          </p>
        </div>
      </div>

      {/* Selection */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Select Class & Subject
            </label>
            <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
              <SelectTrigger>
                <SelectValue placeholder="Choose class and subject" />
              </SelectTrigger>
              <SelectContent>
                {assignments.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.class_arm?.class?.name} {a.class_arm?.name} - {a.subject?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedAssignmentData && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Score Weights</p>
                <p className="text-sm font-medium">
                  Test 1: {scoreWeights.test1_weight}% | Test 2: {scoreWeights.test2_weight}% | Exam: {scoreWeights.exam_weight}%
                </p>
              </div>
              <div className="flex items-center gap-2">
                {resultStatus === "draft" && (
                  <span className="flex items-center gap-1 text-xs font-medium text-warning bg-warning/10 px-2 py-1 rounded-full">
                    <AlertCircle className="h-3 w-3" />
                    Draft
                  </span>
                )}
                {resultStatus === "submitted" && (
                  <span className="flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                    <CheckCircle className="h-3 w-3" />
                    Submitted
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Spreadsheet */}
      {selectedAssignment && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead className="min-w-[120px]">Adm. No.</TableHead>
                  <TableHead className="min-w-[180px]">Student Name</TableHead>
                  <TableHead className="w-24 text-center">
                    Test 1
                    <span className="block text-xs font-normal text-muted-foreground">
                      (Max: 100)
                    </span>
                  </TableHead>
                  <TableHead className="w-24 text-center">
                    Test 2
                    <span className="block text-xs font-normal text-muted-foreground">
                      (Max: 100)
                    </span>
                  </TableHead>
                  <TableHead className="w-24 text-center">
                    Exam
                    <span className="block text-xs font-normal text-muted-foreground">
                      (Max: 100)
                    </span>
                  </TableHead>
                  <TableHead className="w-24 text-center">
                    Total
                    <span className="block text-xs font-normal text-muted-foreground">
                      (Weighted)
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No students found in this class
                    </TableCell>
                  </TableRow>
                ) : (
                  students.map((student, index) => {
                    const entry = scores[student.id] || {
                      test1_score: null,
                      test2_score: null,
                      exam_score: null,
                      total_score: null,
                    };
                    const isReadOnly = resultStatus === "submitted" || resultStatus === "approved" || resultStatus === "published";
                    
                    return (
                      <TableRow key={student.id} className="hover:bg-muted/30">
                        <TableCell className="text-center text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {student.admission_number}
                        </TableCell>
                        <TableCell className="font-medium">
                          {student.last_name}, {student.first_name} {student.middle_name || ""}
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={entry.test1_score ?? ""}
                            onChange={(e) => handleScoreChange(student.id, "test1_score", e.target.value)}
                            className="w-full text-center h-9"
                            placeholder="0"
                            disabled={isReadOnly}
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={entry.test2_score ?? ""}
                            onChange={(e) => handleScoreChange(student.id, "test2_score", e.target.value)}
                            className="w-full text-center h-9"
                            placeholder="0"
                            disabled={isReadOnly}
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={entry.exam_score ?? ""}
                            onChange={(e) => handleScoreChange(student.id, "exam_score", e.target.value)}
                            className="w-full text-center h-9"
                            placeholder="0"
                            disabled={isReadOnly}
                          />
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {entry.total_score !== null ? entry.total_score.toFixed(1) : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Actions */}
          {students.length > 0 && resultStatus !== "submitted" && resultStatus !== "approved" && resultStatus !== "published" && (
            <div className="flex items-center justify-end gap-3 p-4 border-t border-border bg-muted/30">
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={saving || submitting}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Draft
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving || submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Submit for Approval
              </Button>
            </div>
          )}
        </div>
      )}

      {!selectedAssignment && !loading && (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Select a Class</h3>
          <p className="text-muted-foreground">
            Choose a class and subject above to start entering results
          </p>
        </div>
      )}
    </div>
  );
}
