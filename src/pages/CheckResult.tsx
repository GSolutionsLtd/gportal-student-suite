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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Key,
  Hash,
  Search,
  ShieldCheck,
  Printer,
  User,
  Calendar,
  BookOpen,
  Award,
  TrendingUp,
  GraduationCap,
  School,
  FileDown,
  Mail,
  BarChart3,
  Loader2,
  CheckCircle,
  MessageSquare,
  Trophy,
  Users,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  generateComprehensiveResultPDF, 
  generateCumulativeResultPDF,
  generateResultPDFAsBase64,
  type CumulativeTermData 
} from "@/utils/pdfGenerator";

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
  class_average?: number | null;
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
  form_teacher_signature_url?: string | null;
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

interface CumulativeResult {
  termId: string;
  termName: string;
  sessionName: string;
  averageScore: number | null;
  classPosition: number | null;
  classSize: number;
  totalSubjects: number;
}

interface SubjectScore {
  subjectId: string;
  subjectName: string;
  score: number | null;
}

interface ClassComparison {
  topPerformer: {
    name: string;
    averageScore: number;
    subjectScores: SubjectScore[];
  };
  bottomQuartile: {
    averageScore: number;
    subjectAverages: { subjectId: string; averageScore: number }[];
  };
  classAverage: number;
  totalStudents: number;
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
  const [cumulativeResults, setCumulativeResults] = useState<CumulativeResult[]>([]);
  const [classComparison, setClassComparison] = useState<ClassComparison | null>(null);
  const [guardianEmail, setGuardianEmail] = useState<string | null>(null);
  const [guardianName, setGuardianName] = useState<string | null>(null);
  const [guardianPhone, setGuardianPhone] = useState<string | null>(null);

  // Email dialog state
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // SMS dialog state
  const [showSMSDialog, setShowSMSDialog] = useState(false);
  const [smsPhoneNumber, setSmsPhoneNumber] = useState("");
  const [isSendingSMS, setIsSendingSMS] = useState(false);

  // Comparison dialog state
  const [showComparisonDialog, setShowComparisonDialog] = useState(false);

  useEffect(() => {
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
    setCumulativeResults([]);
    setClassComparison(null);

    try {
      const { data, error } = await supabase.functions.invoke("check-result", {
        body: {
          admissionNumber: formData.admissionNumber,
          pin: formData.pin,
        },
      });

      if (error) throw error;

      setSchoolSettings(data.schoolSettings || null);
      setGradingScales((data.gradingScales as GradingScale[]) || []);
      setClassSize(Number(data.classSize || 0));
      setResult(data.result as Result);
      setCumulativeResults(data.cumulativeResults || []);
      setClassComparison(data.classComparison || null);
      setGuardianEmail(data.guardianEmail || null);
      setGuardianName(data.guardianName || null);
      setGuardianPhone(data.guardianPhone || null);

      // Pre-fill email dialog with guardian info
      if (data.guardianEmail) {
        setEmailAddress(data.guardianEmail);
      }
      if (data.guardianName) {
        setRecipientName(data.guardianName);
      }
      // Pre-fill SMS dialog with guardian phone
      if (data.guardianPhone) {
        setSmsPhoneNumber(data.guardianPhone);
      }

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
          classAverage: comp.class_average !== null ? Number(comp.class_average) : null,
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
      formTeacherSignature: result.form_teacher_signature_url || undefined,
      principalSignature: (schoolSettings as any)?.principal_signature_url || undefined,
      principalName: (schoolSettings as any)?.principal_name || undefined,
      approvedAt: (result as any).approved_at || undefined,
      publishedAt: (result as any).published_at || undefined,
    };

    try {
      await generateComprehensiveResultPDF(pdfData);
      toast({ title: "PDF Downloaded", description: "Your result has been downloaded as PDF." });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
    }
  };

  const handleDownloadCumulativePDF = async () => {
    if (!result || cumulativeResults.length === 0) {
      toast({
        title: "No Data",
        description: "No cumulative results available.",
        variant: "destructive",
      });
      return;
    }

    const terms: CumulativeTermData[] = cumulativeResults.map((cr) => ({
      termName: cr.termName,
      sessionName: cr.sessionName,
      averageScore: cr.averageScore,
      classPosition: cr.classPosition,
      classSize: cr.classSize,
      totalSubjects: cr.totalSubjects,
      subjects: [], // Subjects per term not needed for cumulative summary
    }));

    const cumulativeData = {
      studentName: `${result.student.last_name} ${result.student.first_name} ${result.student.middle_name || ""}`.trim(),
      admissionNumber: result.student.admission_number,
      className: `${result.student.class_arm?.class?.name || ""} ${result.student.class_arm?.name || ""}`.trim(),
      terms,
      schoolName: schoolSettings?.school_name,
      schoolAddress: schoolSettings?.address || undefined,
      schoolMotto: schoolSettings?.motto || undefined,
      schoolEmail: schoolSettings?.email || undefined,
      schoolPhone: schoolSettings?.phone || undefined,
    };

    try {
      await generateCumulativeResultPDF(cumulativeData);
      toast({ title: "PDF Downloaded", description: "Cumulative result report has been downloaded." });
    } catch (error) {
      console.error("Error generating cumulative PDF:", error);
      toast({ title: "Error", description: "Failed to generate cumulative PDF.", variant: "destructive" });
    }
  };

  const handleSendEmail = async () => {
    if (!emailAddress || !result) {
      toast({
        title: "Missing Information",
        description: "Please enter an email address.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingEmail(true);

    try {
      // Generate PDF as base64
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
            classAverage: comp.class_average !== null ? Number(comp.class_average) : null,
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
        formTeacherSignature: result.form_teacher_signature_url || undefined,
        principalSignature: (schoolSettings as any)?.principal_signature_url || undefined,
        principalName: (schoolSettings as any)?.principal_name || undefined,
        approvedAt: (result as any).approved_at || undefined,
        publishedAt: (result as any).published_at || undefined,
      };

      const pdfBase64 = await generateResultPDFAsBase64(pdfData);

      // Send email via edge function
      const { data, error } = await supabase.functions.invoke("send-result-email", {
        body: {
          recipientEmail: emailAddress,
          recipientName: recipientName || undefined,
          studentName: pdfData.studentName,
          admissionNumber: pdfData.admissionNumber,
          className: pdfData.className,
          termName: pdfData.termName,
          sessionName: pdfData.sessionName,
          averageScore: pdfData.averageScore,
          classPosition: result.class_position,
          classSize: classSize,
          pdfBase64,
        },
      });

      if (error) throw error;

      toast({
        title: "Email Sent",
        description: `Result has been sent to ${emailAddress}`,
      });
      setShowEmailDialog(false);
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to send email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSendSMS = async () => {
    if (!smsPhoneNumber || !result) {
      toast({
        title: "Missing Information",
        description: "Please enter a phone number.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingSMS(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-sms-notification", {
        body: {
          phoneNumber: smsPhoneNumber,
          studentName: `${result.student.last_name} ${result.student.first_name}`.trim(),
          admissionNumber: result.student.admission_number,
          termName: result.term?.name || "",
          sessionName: result.term?.session?.name || "",
          averageScore: result.average_score !== null ? Number(result.average_score) : null,
          classPosition: result.class_position,
          classSize: classSize,
          schoolName: schoolSettings?.school_name,
        },
      });

      if (error) throw error;

      toast({
        title: "SMS Sent",
        description: `Result notification sent to ${smsPhoneNumber}`,
      });
      setShowSMSDialog(false);
    } catch (error: any) {
      console.error("Error sending SMS:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to send SMS. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSendingSMS(false);
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
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                <FileDown className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              {cumulativeResults.length > 1 && (
                <Button variant="outline" size="sm" onClick={handleDownloadCumulativePDF}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Cumulative Report
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowEmailDialog(true)}>
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowSMSDialog(true)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                SMS
              </Button>
              {classComparison && (
                <Button variant="outline" size="sm" onClick={() => setShowComparisonDialog(true)}>
                  <Trophy className="h-4 w-4 mr-2" />
                  Compare
                </Button>
              )}
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

        {/* Email Dialog */}
        <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Result to Email</DialogTitle>
              <DialogDescription>
                Send this result as a PDF attachment to the parent/guardian email address.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="recipient-name">Recipient Name (Optional)</Label>
                <Input
                  id="recipient-name"
                  placeholder="e.g., Mr. John Doe"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-address">Email Address</Label>
                <Input
                  id="email-address"
                  type="email"
                  placeholder="parent@example.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                />
                {guardianEmail && emailAddress !== guardianEmail && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => {
                      setEmailAddress(guardianEmail);
                      if (guardianName) setRecipientName(guardianName);
                    }}
                  >
                    Use guardian email: {guardianEmail}
                  </Button>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendEmail} disabled={isSendingEmail}>
                {isSendingEmail ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* SMS Dialog */}
        <Dialog open={showSMSDialog} onOpenChange={setShowSMSDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Result via SMS</DialogTitle>
              <DialogDescription>
                Send a result summary notification to the parent/guardian phone number.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="sms-phone">Phone Number</Label>
                <Input
                  id="sms-phone"
                  type="tel"
                  placeholder="08012345678"
                  value={smsPhoneNumber}
                  onChange={(e) => setSmsPhoneNumber(e.target.value)}
                />
                {guardianPhone && smsPhoneNumber !== guardianPhone && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => setSmsPhoneNumber(guardianPhone)}
                  >
                    Use guardian phone: {guardianPhone}
                  </Button>
                )}
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-medium mb-1">SMS Preview:</p>
                <p className="text-muted-foreground text-xs">
                  Dear Parent, {result.student.first_name} ({result.student.admission_number}) result for {result.term?.name} is ready. 
                  Average: {result.average_score !== null ? `${Number(result.average_score).toFixed(1)}%` : 'N/A'}, 
                  Position: {result.class_position ? `${result.class_position}${getOrdinalSuffix(result.class_position)} of ${classSize}` : 'N/A'}. 
                  Check result portal for details.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSMSDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendSMS} disabled={isSendingSMS}>
                {isSendingSMS ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Send SMS
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Comparison Dialog */}
        <Dialog open={showComparisonDialog} onOpenChange={setShowComparisonDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-warning" />
                Performance Comparison
              </DialogTitle>
              <DialogDescription>
                Compare your performance against the class top performer and bottom quartile.
              </DialogDescription>
            </DialogHeader>
            {classComparison && (
              <div className="space-y-6 py-4">
                {/* Overall Comparison */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-success/10 border border-success/30 rounded-lg p-4 text-center">
                    <Trophy className="h-6 w-6 text-success mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Top Performer</p>
                    <p className="text-xl font-bold text-success">{classComparison.topPerformer.averageScore.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">{classComparison.topPerformer.name}</p>
                  </div>
                  <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 text-center">
                    <User className="h-6 w-6 text-primary mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Your Score</p>
                    <p className="text-xl font-bold text-primary">
                      {result.average_score !== null ? `${Number(result.average_score).toFixed(1)}%` : 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {result.class_position ? `${result.class_position}${getOrdinalSuffix(result.class_position)} of ${classComparison.totalStudents}` : '-'}
                    </p>
                  </div>
                  <div className="bg-muted border border-border rounded-lg p-4 text-center">
                    <Users className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Bottom 25%</p>
                    <p className="text-xl font-bold text-muted-foreground">{classComparison.bottomQuartile.averageScore.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">Class Avg: {classComparison.classAverage.toFixed(1)}%</p>
                  </div>
                </div>

                {/* Subject-wise Comparison */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Subject-wise Comparison
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {result.result_components.map((comp) => {
                      const studentScore = comp.total_score !== null ? Number(comp.total_score) : 0;
                      const topScore = classComparison.topPerformer.subjectScores.find(
                        (s) => s.subjectId === comp.subject?.code || s.subjectName === comp.subject?.name
                      )?.score || 0;
                      const bottomQuartileAvg = classComparison.bottomQuartile.subjectAverages.find(
                        (s) => s.subjectId === comp.subject?.code
                      )?.averageScore || 0;
                      const classAvg = comp.class_average !== null ? Number(comp.class_average) : 0;

                      const isAboveAvg = studentScore >= classAvg;
                      const diffFromTop = studentScore - (topScore || 0);

                      return (
                        <div key={comp.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                          <span className="font-medium text-sm w-32 truncate">{comp.subject?.name}</span>
                          <div className="flex-1 flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary transition-all"
                                style={{ width: `${Math.min(studentScore, 100)}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold w-12 text-right">{studentScore.toFixed(0)}</span>
                          </div>
                          <div className="flex items-center gap-1 w-20">
                            {isAboveAvg ? (
                              <ArrowUpRight className="h-4 w-4 text-success" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 text-destructive" />
                            )}
                            <span className={`text-xs ${isAboveAvg ? 'text-success' : 'text-destructive'}`}>
                              {diffFromTop >= 0 ? '' : diffFromTop.toFixed(0)} from top
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Performance Tips */}
                <div className="bg-primary/5 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-2">Performance Summary</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {result.average_score !== null && classComparison.topPerformer.averageScore - Number(result.average_score) <= 5 && (
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-success" />
                        You're within 5% of the top performer! Keep it up!
                      </li>
                    )}
                    {result.average_score !== null && Number(result.average_score) >= classComparison.classAverage && (
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-success" />
                        Your performance is above the class average.
                      </li>
                    )}
                    {result.average_score !== null && Number(result.average_score) < classComparison.classAverage && (
                      <li className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-warning" />
                        Focus on improvement to reach the class average of {classComparison.classAverage.toFixed(1)}%.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowComparisonDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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

          {/* Cumulative Performance Summary (if multiple terms) */}
          {cumulativeResults.length > 1 && (
            <div className="bg-card rounded-xl border border-border p-4 mb-6 print:hidden">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Performance Trend
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {cumulativeResults.slice(-4).map((cr, index) => (
                  <div 
                    key={cr.termId} 
                    className={`p-3 rounded-lg ${
                      index === cumulativeResults.slice(-4).length - 1 
                        ? 'bg-primary/10 border-2 border-primary' 
                        : 'bg-muted/50'
                    }`}
                  >
                    <p className="text-xs text-muted-foreground truncate">{cr.termName}</p>
                    <p className="text-lg font-bold text-foreground">
                      {cr.averageScore !== null ? `${cr.averageScore.toFixed(1)}%` : 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {cr.classPosition !== null ? `${getOrdinalSuffix(cr.classPosition)} of ${cr.classSize}` : '-'}
                    </p>
                  </div>
                ))}
              </div>
              <Button 
                variant="link" 
                size="sm" 
                className="mt-2 h-auto p-0"
                onClick={handleDownloadCumulativePDF}
              >
                Download Full Cumulative Report →
              </Button>
            </div>
          )}

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
                  <TableHead className="text-center w-20 print:hidden">Class Avg</TableHead>
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
                  const studentScore = component.total_score !== null ? Number(component.total_score) : 0;
                  const classAvg = component.class_average !== null ? Number(component.class_average) : 0;
                  const isAboveAvg = studentScore >= classAvg;

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
                      <TableCell className="text-center print:hidden">
                        {component.class_average !== null ? (
                          <span className={`text-xs ${isAboveAvg ? 'text-success' : 'text-destructive'}`}>
                            {Number(component.class_average).toFixed(1)}
                            {isAboveAvg ? ' ↑' : ' ↓'}
                          </span>
                        ) : (
                          "-"
                        )}
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

            <div className="grid gap-6 md:grid-cols-3 mt-8">
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
                <p className="text-xs text-muted-foreground mt-2">Class Teacher's Signature</p>
                {(result as any).approved_at && (
                  <p className="text-xs text-muted-foreground">Date: {new Date((result as any).approved_at).toLocaleDateString()}</p>
                )}
              </div>
              <div>
                <div className="h-16 border-b border-border flex items-end pb-2">
                  {result.form_teacher_signature_url ? (
                    <img
                      src={result.form_teacher_signature_url}
                      alt="Form teacher signature"
                      className="h-14 object-contain"
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Form Teacher's Signature</p>
                {(result as any).approved_at && (
                  <p className="text-xs text-muted-foreground">Date: {new Date((result as any).approved_at).toLocaleDateString()}</p>
                )}
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
                <p className="text-xs text-muted-foreground mt-2">Principal's Signature</p>
                {(result as any).published_at && (
                  <p className="text-xs text-muted-foreground">Date: {new Date((result as any).published_at).toLocaleDateString()}</p>
                )}
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
