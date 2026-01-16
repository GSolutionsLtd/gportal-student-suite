import { useState, useEffect } from "react";
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
  School,
  FileDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateComprehensiveResultPDF } from "@/utils/pdfGenerator";

interface SchoolSettings {
  school_name: string;
  address: string | null;
  motto: string | null;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
}

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
  class_teacher_remark?: string | null;
  principal_remark?: string | null;
  class_teacher_signature_url?: string | null;
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
    admissionNumber: "",
    pin: "",
  });
  const [result, setResult] = useState<Result | null>(null);
  const [gradingScales, setGradingScales] = useState<GradingScale[]>([]);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [classSize, setClassSize] = useState<number>(0);
  const [generatedRemarks, setGeneratedRemarks] = useState<{ classTeacher?: string; principal?: string }>({});

  useEffect(() => {
    // Fetch school settings on component mount
    fetchSchoolSettings();
  }, []);

  const fetchSchoolSettings = async () => {
    const { data, error } = await supabase
      .from("school_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setSchoolSettings(data);
    }
  };

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

    if (!formData.admissionNumber || !formData.pin) {
      toast({
        title: "Missing Information",
        description: "Please enter both admission number and PIN.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);
    setGeneratedRemarks({});

    try {
      const { data, error } = await supabase.functions.invoke("check-result", {
        body: {
          admissionNumber: formData.admissionNumber,
          pin: formData.pin,
        },
      });

      if (error) throw error;

      // Edge function returns a consistent shape
      setSchoolSettings(data.schoolSettings || null);
      setGradingScales((data.gradingScales as GradingScale[]) || []);
      setClassSize(Number(data.classSize || 0));
      setResult(data.result as Result);

      toast({
        title: "Result Retrieved",
        description: "Your result has been successfully retrieved.",
      });

      // Generate remarks if missing
      const fetchedResult = data.result as Result;
      const summaryAverage = fetchedResult.average_score !== null ? Number(fetchedResult.average_score) : 0;
      const position = fetchedResult.class_position ?? 0;

      if (!fetchedResult.class_teacher_remark || !fetchedResult.principal_remark) {
        const performance = {
          studentName: `${fetchedResult.student.last_name} ${fetchedResult.student.first_name} ${fetchedResult.student.middle_name || ""}`.trim(),
          averageScore: summaryAverage,
          position: position || 1,
          classSize: Number(data.classSize || 0) || 1,
          subjectCount: fetchedResult.result_components?.length || 0,
          termName: `${fetchedResult.term?.session?.name || ""} - ${fetchedResult.term?.name || ""}`.trim(),
          className: `${fetchedResult.student.class_arm?.class?.name || ""} ${fetchedResult.student.class_arm?.name || ""}`.trim(),
        };

        const tasks: Promise<any>[] = [];

        if (!fetchedResult.class_teacher_remark) {
          tasks.push(
            supabase.functions.invoke("generate-student-remark", {
              body: { performance, remarkType: "class_teacher" },
            })
          );
        } else {
          tasks.push(Promise.resolve({ data: { remark: fetchedResult.class_teacher_remark } }));
        }

        if (!fetchedResult.principal_remark) {
          tasks.push(
            supabase.functions.invoke("generate-student-remark", {
              body: { performance, remarkType: "principal" },
            })
          );
        } else {
          tasks.push(Promise.resolve({ data: { remark: fetchedResult.principal_remark } }));
        }

        const [classTeacherRes, principalRes] = await Promise.all(tasks);
        setGeneratedRemarks({
          classTeacher: classTeacherRes?.data?.remark,
          principal: principalRes?.data?.remark,
        });
      }
    } catch (error: any) {
      console.error("Error checking result:", error);
      const message = error?.message || "An error occurred while checking your result.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!result) return;

    const pdfData = {
      studentName: `${result.student.last_name} ${result.student.first_name} ${result.student.middle_name || ""}`.trim(),
      admissionNumber: result.student.admission_number,
      className: `${result.student.class_arm?.class?.name || ""} ${result.student.class_arm?.name || ""}`.trim(),
      termName: result.term?.name || "",
      sessionName: result.term?.session?.name || "",
      totalScore: result.total_score !== null ? Number(result.total_score) : null,
      averageScore: result.average_score !== null ? Number(result.average_score) : null,
      classPosition: result.class_position,
      classSize: classSize,
      subjects: result.result_components.map((comp) => {
        const gradeInfo = getGradeForScore(comp.total_score !== null ? Number(comp.total_score) : null);
        return {
          name: comp.subject?.name || "Unknown",
          test1: comp.test1_score !== null ? Number(comp.test1_score) : null,
          test2: comp.test2_score !== null ? Number(comp.test2_score) : null,
          other: comp.other_assessment_score !== null ? Number(comp.other_assessment_score) : null,
          exam: comp.exam_score !== null ? Number(comp.exam_score) : null,
          total: comp.total_score !== null ? Number(comp.total_score) : null,
          grade: comp.grade || gradeInfo.grade,
          remark: comp.remark || gradeInfo.remark,
          position: null,
        };
      }),
      schoolName: schoolSettings?.school_name,
      schoolAddress: schoolSettings?.address || undefined,
      schoolMotto: schoolSettings?.motto || undefined,
      schoolEmail: schoolSettings?.email || undefined,
      schoolPhone: schoolSettings?.phone || undefined,
      classTeacherRemark: result.class_teacher_remark || generatedRemarks.classTeacher,
      principalRemark: result.principal_remark || generatedRemarks.principal,
      classTeacherSignature: result.class_teacher_signature_url || undefined,
      principalSignature: (schoolSettings as any)?.principal_signature_url || undefined,
      principalName: (schoolSettings as any)?.principal_name || undefined,
    };

    try {
      await generateComprehensiveResultPDF(pdfData);
      toast({ title: "PDF Downloaded", description: "Your result has been downloaded as PDF." });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
    }
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
              <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                <FileDown className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setResult(null);
                  setFormData({ admissionNumber: "", pin: "" });
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
          {/* School Header */}
          <div className="bg-primary text-primary-foreground rounded-xl p-6 mb-6 print:rounded-none print:bg-primary">
            <div className="flex items-center gap-4">
              {schoolSettings?.logo_url && (
                <img 
                  src={schoolSettings.logo_url} 
                  alt="School Logo" 
                  className="h-16 w-16 object-contain bg-white rounded-lg p-1"
                />
              )}
              <div className="flex-1 text-center">
                <h1 className="text-2xl font-bold">
                  {schoolSettings?.school_name || "School Name"}
                </h1>
                {schoolSettings?.address && (
                  <p className="text-sm opacity-90">{schoolSettings.address}</p>
                )}
                {schoolSettings?.motto && (
                  <p className="text-xs italic opacity-80">"{schoolSettings.motto}"</p>
                )}
                {(schoolSettings?.phone || schoolSettings?.email) && (
                  <p className="text-xs opacity-80 mt-1">
                    {schoolSettings.phone && `Tel: ${schoolSettings.phone}`}
                    {schoolSettings.phone && schoolSettings.email && " | "}
                    {schoolSettings.email && `Email: ${schoolSettings.email}`}
                  </p>
                )}
              </div>
              {schoolSettings?.logo_url && <div className="w-16" />}
            </div>
            <div className="text-center mt-4 pt-4 border-t border-primary-foreground/20">
              <h2 className="text-lg font-semibold">STUDENT RESULT REPORT</h2>
              <p className="text-sm opacity-90">
                {result.term?.session?.name} - {result.term?.name}
              </p>
            </div>
          </div>

          {/* Student Info Card */}
          <div className="bg-card rounded-xl border border-border p-6 mb-6 print:border print:p-4 print:mb-4">
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
                    Admission No: {result.student.admission_number}
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
                    ? `${result.class_position}${getOrdinalSuffix(result.class_position)} of ${classSize}`
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

          {/* Remarks + Signatures */}
          <div className="bg-card rounded-xl border border-border p-6 mt-6 print:border print:rounded-none print:mt-4">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Class Teacher's Remark</h3>
                <p className="text-muted-foreground">
                  {result.class_teacher_remark || generatedRemarks.classTeacher || "______________________________"}
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Principal's Remark</h3>
                <p className="text-muted-foreground">
                  {result.principal_remark || generatedRemarks.principal || "______________________________"}
                </p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 mt-8">
              <div>
                <div className="h-16 border-b border-border flex items-end pb-2">
                  {result.class_teacher_signature_url ? (
                    <img
                      src={result.class_teacher_signature_url}
                      alt="Class teacher signature"
                      className="h-14 object-contain"
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Class Teacher Signature</p>
              </div>
              <div>
                <div className="h-16 border-b border-border flex items-end pb-2 justify-start">
                  {(schoolSettings as any)?.principal_signature_url ? (
                    <img
                      src={(schoolSettings as any).principal_signature_url}
                      alt="Principal signature"
                      className="h-14 object-contain"
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Principal Signature</p>
              </div>
            </div>
          </div>

          {/* Grading Scale */}
          <div className="mt-6 border rounded-lg p-4 print:border print:mt-4">
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

          {/* Footer */}
          <div className="mt-8 pt-4 border-t text-center text-xs text-muted-foreground print:mt-4">
            <p>This is a computer-generated result. For any queries, please contact the school administration.</p>
            <p className="mt-1">Printed on: {new Date().toLocaleDateString()}</p>
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
          {/* School Info Banner */}
          {schoolSettings && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                {schoolSettings.logo_url ? (
                  <img 
                    src={schoolSettings.logo_url} 
                    alt="School Logo" 
                    className="h-12 w-12 object-contain"
                  />
                ) : (
                  <School className="h-8 w-8 text-primary" />
                )}
                <h2 className="text-lg font-bold text-foreground">
                  {schoolSettings.school_name}
                </h2>
              </div>
              {schoolSettings.motto && (
                <p className="text-xs text-muted-foreground italic">"{schoolSettings.motto}"</p>
              )}
            </div>
          )}

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
                <Label htmlFor="admissionNumber">Admission Number / Registration Number</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="admissionNumber"
                    type="text"
                    placeholder="e.g., 2024/0001 or ADM001"
                    className="pl-10"
                    value={formData.admissionNumber}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        admissionNumber: e.target.value,
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
