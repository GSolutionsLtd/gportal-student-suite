import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  FileText,
  Download,
  Loader2,
  TrendingUp,
  TrendingDown,
  Award,
  BarChart3,
} from "lucide-react";
import { generateResultPDF } from "@/utils/pdfGenerator";

interface ResultComponent {
  id: string;
  subject: { name: string; code: string };
  test1_score: number | null;
  test2_score: number | null;
  exam_score: number | null;
  total_score: number | null;
  grade: string | null;
}

interface Result {
  id: string;
  term: { id: string; name: string; session: { name: string } };
  class_arm: { name: string; class: { name: string } };
  total_score: number | null;
  average_score: number | null;
  class_position: number | null;
  status: string;
  published_at: string | null;
  components: ResultComponent[];
}

interface Term {
  id: string;
  name: string;
  session: { id: string; name: string };
}

export default function MyResults() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<Result[]>([]);
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [studentInfo, setStudentInfo] = useState<{ id: string; name: string; admission_number: string } | null>(null);

  useEffect(() => {
    fetchStudentAndResults();
  }, [user]);

  const fetchStudentAndResults = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get student record
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("id, first_name, last_name, admission_number")
        .eq("user_id", user.id)
        .maybeSingle();

      if (studentError) throw studentError;
      if (!student) {
        toast({ title: "Error", description: "Student record not found", variant: "destructive" });
        return;
      }

      setStudentInfo({
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        admission_number: student.admission_number,
      });

      // Get all published results for this student
      const { data: resultsData, error: resultsError } = await supabase
        .from("results")
        .select("id, total_score, average_score, class_position, status, published_at, term_id, class_arm_id")
        .eq("student_id", student.id)
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (resultsError) throw resultsError;

      // Enrich results with related data
      const enrichedResults = await Promise.all(
        (resultsData || []).map(async (result) => {
          const { data: term } = await supabase
            .from("terms")
            .select("id, name, session:academic_sessions(name)")
            .eq("id", result.term_id)
            .maybeSingle();

          const { data: classArm } = await supabase
            .from("class_arms")
            .select("name, class:classes(name)")
            .eq("id", result.class_arm_id)
            .maybeSingle();

          const { data: components } = await supabase
            .from("result_components")
            .select("id, test1_score, test2_score, exam_score, total_score, grade, subject_id")
            .eq("result_id", result.id);

          const enrichedComponents = await Promise.all(
            (components || []).map(async (comp) => {
              const { data: subject } = await supabase
                .from("subjects")
                .select("name, code")
                .eq("id", comp.subject_id)
                .maybeSingle();
              return { ...comp, subject: subject || { name: "Unknown", code: "N/A" } };
            })
          );

          return {
            ...result,
            term: term || { id: "", name: "Unknown", session: { name: "Unknown" } },
            class_arm: classArm || { name: "Unknown", class: { name: "Unknown" } },
            components: enrichedComponents,
          };
        })
      );

      setResults(enrichedResults as Result[]);

      // Extract unique terms
      const uniqueTerms = enrichedResults.reduce((acc: Term[], result) => {
        if (!acc.find((t) => t.id === result.term.id)) {
          acc.push({ 
            id: result.term.id, 
            name: result.term.name, 
            session: { id: "", name: result.term.session.name } 
          });
        }
        return acc;
      }, []);
      setTerms(uniqueTerms);

      // Select first result by default
      if (enrichedResults.length > 0) {
        setSelectedResult(enrichedResults[0] as Result);
        setSelectedTermId(enrichedResults[0].term.id);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleTermChange = (termId: string) => {
    setSelectedTermId(termId);
    const result = results.find((r) => r.term.id === termId);
    setSelectedResult(result || null);
  };

  const getGradeColor = (grade: string | null) => {
    switch (grade) {
      case "A":
        return "bg-success/10 text-success";
      case "B":
        return "bg-primary/10 text-primary";
      case "C":
        return "bg-accent/10 text-accent-foreground";
      case "D":
        return "bg-warning/10 text-warning";
      case "E":
      case "F":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const calculateStats = () => {
    if (!selectedResult) return { totalSubjects: 0, passed: 0, failed: 0, highestScore: 0, lowestScore: 0 };

    const scores = selectedResult.components.map((c) => c.total_score || 0);
    const passed = selectedResult.components.filter((c) => (c.total_score || 0) >= 40).length;

    return {
      totalSubjects: selectedResult.components.length,
      passed,
      failed: selectedResult.components.length - passed,
      highestScore: Math.max(...scores, 0),
      lowestScore: Math.min(...scores.filter((s) => s > 0), 0),
    };
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Results</h1>
          <p className="text-muted-foreground">View your academic performance</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Results Available</h3>
            <p className="text-muted-foreground text-center max-w-sm mt-2">
              Your results will appear here once they are published by the school administration.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Results</h1>
          <p className="text-muted-foreground">
            {studentInfo?.name} • {studentInfo?.admission_number}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedTermId} onValueChange={handleTermChange}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select term" />
            </SelectTrigger>
            <SelectContent>
              {terms.map((term) => (
                <SelectItem key={term.id} value={term.id}>
                  {term.name} - {term.session.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="outline"
            onClick={() => {
              if (selectedResult && studentInfo) {
                generateResultPDF({
                  studentName: studentInfo.name,
                  admissionNumber: studentInfo.admission_number,
                  className: `${selectedResult.class_arm.class.name} ${selectedResult.class_arm.name}`,
                  termName: selectedResult.term.name,
                  sessionName: selectedResult.term.session.name,
                  totalScore: selectedResult.total_score ? Number(selectedResult.total_score) : null,
                  averageScore: selectedResult.average_score ? Number(selectedResult.average_score) : null,
                  classPosition: selectedResult.class_position,
                  classSize: 30,
                  subjects: selectedResult.components.map(c => ({
                    name: c.subject.name,
                    test1: c.test1_score ? Number(c.test1_score) : null,
                    test2: c.test2_score ? Number(c.test2_score) : null,
                    exam: c.exam_score ? Number(c.exam_score) : null,
                    total: c.total_score ? Number(c.total_score) : null,
                    grade: c.grade,
                    remark: c.grade === 'A' ? 'Excellent' : c.grade === 'B' ? 'Very Good' : c.grade === 'C' ? 'Good' : c.grade === 'D' ? 'Pass' : 'Needs Improvement',
                    position: null,
                  })),
                  schoolName: "Excellence Academy",
                  schoolAddress: "123 Education Street, Knowledge City",
                  schoolMotto: "Excellence in Education",
                });
              }
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </div>

      {selectedResult && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Award className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {selectedResult.class_position ? `${selectedResult.class_position}${getOrdinalSuffix(selectedResult.class_position)}` : "-"}
                    </p>
                    <p className="text-xs text-muted-foreground">Class Position</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <BarChart3 className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {selectedResult.average_score ? `${Number(selectedResult.average_score).toFixed(1)}%` : "-"}
                    </p>
                    <p className="text-xs text-muted-foreground">Average Score</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-success/10">
                    <TrendingUp className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.highestScore}</p>
                    <p className="text-xs text-muted-foreground">Highest Score</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-warning/10">
                    <TrendingDown className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.lowestScore}</p>
                    <p className="text-xs text-muted-foreground">Lowest Score</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Result Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {selectedResult.term.name} - {selectedResult.term.session.name}
                </CardTitle>
                <Badge variant="outline">
                  {selectedResult.class_arm.class.name} - {selectedResult.class_arm.name}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-center">Test 1</TableHead>
                    <TableHead className="text-center">Test 2</TableHead>
                    <TableHead className="text-center">Exam</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedResult.components.map((comp) => (
                    <TableRow key={comp.id}>
                      <TableCell className="font-medium">{comp.subject.name}</TableCell>
                      <TableCell className="text-center">{comp.test1_score ?? "-"}</TableCell>
                      <TableCell className="text-center">{comp.test2_score ?? "-"}</TableCell>
                      <TableCell className="text-center">{comp.exam_score ?? "-"}</TableCell>
                      <TableCell className="text-center font-medium">{comp.total_score ?? "-"}</TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold ${getGradeColor(comp.grade)}`}>
                          {comp.grade || "-"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Summary */}
              <div className="mt-6 pt-4 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-secondary">
                  <p className="text-lg font-bold text-foreground">{stats.totalSubjects}</p>
                  <p className="text-xs text-muted-foreground">Total Subjects</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-success/10">
                  <p className="text-lg font-bold text-success">{stats.passed}</p>
                  <p className="text-xs text-muted-foreground">Passed</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-destructive/10">
                  <p className="text-lg font-bold text-destructive">{stats.failed}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-primary/10">
                  <p className="text-lg font-bold text-primary">{selectedResult.total_score ?? "-"}</p>
                  <p className="text-xs text-muted-foreground">Total Score</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Performance History */}
          <Card>
            <CardHeader>
              <CardTitle>Performance History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {results.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleTermChange(result.term.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all ${
                      result.id === selectedResult.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30 hover:bg-secondary/50"
                    }`}
                  >
                    <div className="text-left">
                      <p className="font-medium text-foreground">{result.term.name}</p>
                      <p className="text-sm text-muted-foreground">{result.term.session.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">
                        {result.average_score ? `${Number(result.average_score).toFixed(1)}%` : "-"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Position: {result.class_position ? `${result.class_position}${getOrdinalSuffix(result.class_position)}` : "-"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
