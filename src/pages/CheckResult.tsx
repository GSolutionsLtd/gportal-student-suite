import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Key,
  Hash,
  Search,
  ShieldCheck,
  Download,
  Printer,
  User,
  Calendar,
  BookOpen,
  Award,
  TrendingUp,
  GraduationCap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface StudentInfo {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  class_arm: {
    name: string;
    class: {
      name: string;
    };
  };
}

interface ResultComponent {
  id: string;
  test1_score: number | null;
  test2_score: number | null;
  other_assessment_score: number | null;
  exam_score: number | null;
  total_score: number | null;
  grade: string | null;
  remark: string | null;
  subject: {
    name: string;
    code: string;
  };
}

interface Result {
  id: string;
  total_score: number | null;
  average_score: number | null;
  class_position: number | null;
  remarks: string | null;
  term: {
    name: string;
    session: {
      name: string;
    };
  };
  student: StudentInfo;
  result_components: ResultComponent[];
}

interface GradingScale {
  grade: string;
  min_score: number;
  max_score: number;
  remark: string;
}

export default function CheckResult() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    registrationNumber: "",
    pin: "",
  });
  const [result, setResult] = useState<Result | null>(null);
  const [gradingScales, setGradingScales] = useState<GradingScale[]>([]);

  const getGradeForScore = (score: number | null): { grade: string; remark: string } => {
    if (score === null) return { grade: "-", remark: "-" };
    
    const scale = gradingScales.find(
      (g) => score >= g.min_score && score <= g.max_score
    );
    return scale
      ? { grade: scale.grade, remark: scale.remark }
      : { grade: "-", remark: "-" };
  };

  const getGradeColor = (grade: string): string => {
    switch (grade) {
      case "A":
      case "A1":
        return "text-success bg-success/10";
      case "B":
      case "B2":
      case "B3":
        return "text-primary bg-primary/10";
      case "C":
      case "C4":
      case "C5":
      case "C6":
        return "text-warning bg-warning/10";
      case "D":
      case "D7":
        return "text-orange-600 bg-orange-100";
      case "E":
      case "E8":
        return "text-destructive bg-destructive/10";
      case "F":
      case "F9":
        return "text-destructive bg-destructive/10";
      default:
        return "text-muted-foreground bg-secondary";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.registrationNumber || !formData.pin) {
      toast({
        title: "Missing Information",
        description: "Please enter both registration number and PIN.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      // Find the student by admission number
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select(`
          id,
          admission_number,
          first_name,
          last_name,
          middle_name,
          current_class_arm_id
        `)
        .eq("admission_number", formData.registrationNumber.trim())
        .maybeSingle();

      if (studentError) throw studentError;

      if (!student) {
        toast({
          title: "Student Not Found",
          description: "No student found with that registration number.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Verify PIN
      const { data: pin, error: pinError } = await supabase
        .from("pins")
        .select("id, status, usage_count, max_usage, expires_at, term_id")
        .eq("pin_code", formData.pin.trim().toUpperCase())
        .maybeSingle();

      if (pinError) throw pinError;

      if (!pin) {
        toast({
          title: "Invalid PIN",
          description: "The PIN you entered is not valid.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Check PIN status
      if (pin.status !== "active") {
        toast({
          title: "PIN Not Active",
          description: `This PIN is ${pin.status}. Please contact your school administrator.`,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Check PIN expiration
      if (pin.expires_at && new Date(pin.expires_at) < new Date()) {
        toast({
          title: "PIN Expired",
          description: "This PIN has expired. Please contact your school administrator.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Check usage limit
      if (pin.usage_count >= pin.max_usage) {
        toast({
          title: "Usage Limit Reached",
          description: "This PIN has reached its maximum usage limit.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Fetch published results for this student
      // If PIN has a term_id, only show results for that term
      let resultsQuery = supabase
        .from("results")
        .select(`
          id,
          total_score,
          average_score,
          class_position,
          remarks,
          term:terms(
            name,
            session:academic_sessions(name)
          )
        `)
        .eq("student_id", student.id)
        .eq("status", "published");

      if (pin.term_id) {
        resultsQuery = resultsQuery.eq("term_id", pin.term_id);
      }

      const { data: results, error: resultsError } = await resultsQuery
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (resultsError) throw resultsError;

      if (!results) {
        toast({
          title: "No Results Available",
          description: "No published results found for this student.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Fetch result components (subject scores)
      const { data: components, error: componentsError } = await supabase
        .from("result_components")
        .select(`
          id,
          test1_score,
          test2_score,
          other_assessment_score,
          exam_score,
          total_score,
          grade,
          remark,
          subject:subjects(name, code)
        `)
        .eq("result_id", results.id);

      if (componentsError) throw componentsError;

      // Fetch class arm info
      const { data: classArm, error: classArmError } = await supabase
        .from("class_arms")
        .select(`
          name,
          class:classes(name)
        `)
        .eq("id", student.current_class_arm_id)
        .maybeSingle();

      if (classArmError) throw classArmError;

      // Fetch grading scales
      const { data: scales, error: scalesError } = await supabase
        .from("grading_scales")
        .select("grade, min_score, max_score, remark")
        .order("min_score", { ascending: false });

      if (scalesError) throw scalesError;
      setGradingScales((scales as GradingScale[]) || []);

      // Log PIN usage
      await supabase.from("pin_usage_logs").insert({
        pin_id: pin.id,
        student_id: student.id,
        ip_address: null, // Could be obtained from a backend
        user_agent: navigator.userAgent,
      });

      // Increment PIN usage count
      await supabase
        .from("pins")
        .update({
          usage_count: pin.usage_count + 1,
          used_at: new Date().toISOString(),
          student_id: student.id,
        })
        .eq("id", pin.id);

      // Build result object
      const fullResult: Result = {
        id: results.id,
        total_score: results.total_score ? Number(results.total_score) : null,
        average_score: results.average_score ? Number(results.average_score) : null,
        class_position: results.class_position,
        remarks: results.remarks,
        term: results.term as any,
        student: {
          ...student,
          class_arm: classArm as any,
        },
        result_components: (components as any[]) || [],
      };

      setResult(fullResult);

      toast({
        title: "Result Retrieved",
        description: "Your result has been successfully retrieved.",
      });
    } catch (error) {
      console.error("Error checking result:", error);
      toast({
        title: "Error",
        description: "An error occurred while checking your result. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const calculateSummary = () => {
    if (!result || !result.result_components.length) {
      return { totalScore: 0, average: 0, subjectCount: 0 };
    }

    const validComponents = result.result_components.filter(
      (c) => c.total_score !== null
    );
    const totalScore = validComponents.reduce(
      (sum, c) => sum + (c.total_score || 0),
      0
    );
    const average =
      validComponents.length > 0 ? totalScore / validComponents.length : 0;

    return {
      totalScore: Math.round(totalScore * 100) / 100,
      average: Math.round(average * 100) / 100,
      subjectCount: validComponents.length,
    };
  };

  if (result) {
    const summary = calculateSummary();

    return (
      <div className="min-h-screen bg-background print:bg-white">
        {/* Header - Hidden when printing */}
        <header className="glass border-b border-border print:hidden">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Logo />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setResult(null);
                  setFormData({ registrationNumber: "", pin: "" });
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Check Another
              </Button>
            </div>
          </div>
        </header>

        {/* Result Content */}
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          {/* School Header for Print */}
          <div className="hidden print:block text-center mb-8">
            <h1 className="text-2xl font-bold">STUDENT RESULT REPORT</h1>
            <p className="text-muted-foreground">
              {result.term?.session?.name} - {result.term?.name}
            </p>
          </div>

          {/* Student Info Card */}
          <div className="bg-card rounded-xl border border-border p-6 mb-6 print:border-0 print:p-0 print:mb-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {result.student.last_name} {result.student.first_name}{" "}
                    {result.student.middle_name || ""}
                  </h2>
                  <p className="text-muted-foreground">
                    {result.student.admission_number}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-primary border-primary">
                {result.student.class_arm?.class?.name}{" "}
                {result.student.class_arm?.name}
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Session:</span>
                <span className="font-medium">
                  {result.term?.session?.name}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Term:</span>
                <span className="font-medium">{result.term?.name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Award className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Position:</span>
                <span className="font-medium">
                  {result.class_position
                    ? `${result.class_position}${getOrdinalSuffix(result.class_position)}`
                    : "-"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Average:</span>
                <span className="font-medium">{summary.average}%</span>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6 print:mb-4">
            <div className="bg-card rounded-xl border border-border p-4 text-center print:border print:rounded-none">
              <p className="text-sm text-muted-foreground mb-1">Total Score</p>
              <p className="text-2xl font-bold text-foreground">
                {summary.totalScore}
              </p>
              <p className="text-xs text-muted-foreground">
                out of {summary.subjectCount * 100}
              </p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center print:border print:rounded-none">
              <p className="text-sm text-muted-foreground mb-1">Average</p>
              <p className="text-2xl font-bold text-primary">{summary.average}%</p>
              <p className="text-xs text-muted-foreground">
                {getGradeForScore(summary.average).grade} -{" "}
                {getGradeForScore(summary.average).remark}
              </p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center print:border print:rounded-none">
              <p className="text-sm text-muted-foreground mb-1">Subjects</p>
              <p className="text-2xl font-bold text-foreground">
                {summary.subjectCount}
              </p>
              <p className="text-xs text-muted-foreground">subjects taken</p>
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden print:border print:rounded-none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-center w-16">T1 (10)</TableHead>
                  <TableHead className="text-center w-16">T2 (10)</TableHead>
                  <TableHead className="text-center w-16">Other (10)</TableHead>
                  <TableHead className="text-center w-16">Exam (70)</TableHead>
                  <TableHead className="text-center w-16">Total</TableHead>
                  <TableHead className="text-center w-14">Grade</TableHead>
                  <TableHead className="w-24">Remark</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.result_components.map((component, index) => {
                  const gradeInfo = getGradeForScore(
                    component.total_score !== null
                      ? Number(component.total_score)
                      : null
                  );
                  return (
                    <TableRow key={component.id}>
                      <TableCell className="text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {component.subject?.name}
                      </TableCell>
                      <TableCell className="text-center">
                        {component.test1_score ?? "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {component.test2_score ?? "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {component.other_assessment_score ?? "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {component.exam_score ?? "-"}
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {component.total_score !== null
                          ? Number(component.total_score).toFixed(1)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-sm font-bold ${getGradeColor(
                            component.grade || gradeInfo.grade
                          )}`}
                        >
                          {component.grade || gradeInfo.grade}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {component.remark || gradeInfo.remark}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Teacher's Remark */}
          {result.remarks && (
            <div className="bg-card rounded-xl border border-border p-6 mt-6 print:border print:rounded-none print:mt-4">
              <h3 className="font-semibold text-foreground mb-2">
                Teacher's Remark
              </h3>
              <p className="text-muted-foreground">{result.remarks}</p>
            </div>
          )}

          {/* Grading Scale - Print only */}
          <div className="hidden print:block mt-8 border-t pt-4">
            <h3 className="font-semibold text-sm mb-2">Grading Scale</h3>
            <div className="flex flex-wrap gap-4 text-xs">
              {gradingScales.map((scale) => (
                <span key={scale.grade}>
                  {scale.grade}: {scale.min_score}-{scale.max_score}% (
                  {scale.remark})
                </span>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="glass border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl gradient-primary mb-6">
              <GraduationCap className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Check Your Result
            </h1>
            <p className="text-muted-foreground">
              Enter your admission number and result PIN to view your
              academic results.
            </p>
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 shadow-lg">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="registrationNumber">Admission Number</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="registrationNumber"
                    type="text"
                    placeholder="e.g., 2024/0001"
                    className="pl-10"
                    value={formData.registrationNumber}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        registrationNumber: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="pin">Result PIN</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="pin"
                    type="text"
                    placeholder="Enter your PIN"
                    className="pl-10 tracking-widest"
                    value={formData.pin}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pin: e.target.value.toUpperCase(),
                      })
                    }
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Your PIN was provided by your school. Contact admin if lost.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Checking...
                  </span>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Check Result
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-border">
              <div className="flex items-start gap-3 text-sm text-muted-foreground">
                <ShieldCheck className="h-5 w-5 text-success flex-shrink-0" />
                <p>
                  Your result information is secure. Each PIN can only be used a
                  limited number of times as set by your school.
                </p>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Need help?{" "}
            <button
              type="button"
              className="text-primary font-medium hover:underline"
            >
              Contact your school administrator
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
