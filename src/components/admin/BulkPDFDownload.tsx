import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Download,
  Loader2,
  FileArchive,
  Users,
  FileText,
} from "lucide-react";
import JSZip from "jszip";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getSchoolSettings } from "@/utils/pdfGenerator";

// Convert image URL to base64 for embedding in PDF
async function loadImageAsBase64(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  
  try {
    // Handle Google Drive URLs - convert to direct download link
    let directUrl = url;
    if (url.includes('drive.google.com')) {
      const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (fileIdMatch) {
        directUrl = `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
      }
    }
    
    const response = await fetch(directUrl);
    if (!response.ok) return null;
    
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to load image:', error);
    return null;
  }
}

// Add image to PDF document
function addImageToPDF(
  doc: jsPDF, 
  base64Image: string | null, 
  x: number, 
  y: number, 
  width: number, 
  height: number,
  fallbackText?: string,
  fallbackColor?: [number, number, number]
): void {
  if (base64Image) {
    try {
      const formatMatch = base64Image.match(/data:image\/(\w+);base64,/);
      const format = formatMatch ? formatMatch[1].toUpperCase() : 'PNG';
      doc.addImage(base64Image, format, x, y, width, height);
    } catch (error) {
      console.error('Failed to add image to PDF:', error);
      if (fallbackText) {
        doc.setFillColor(255, 255, 255);
        doc.circle(x + width / 2, y + height / 2, Math.min(width, height) / 2, 'F');
        doc.setFontSize(6);
        doc.setTextColor(...(fallbackColor || [30, 58, 138]));
        doc.text(fallbackText, x + width / 2, y + height / 2 + 2, { align: 'center' });
      }
    }
  } else if (fallbackText) {
    doc.setFillColor(255, 255, 255);
    doc.circle(x + width / 2, y + height / 2, Math.min(width, height) / 2, 'F');
    doc.setFontSize(6);
    doc.setTextColor(...(fallbackColor || [30, 58, 138]));
    doc.text(fallbackText, x + width / 2, y + height / 2 + 2, { align: 'center' });
  }
}

interface ClassArm {
  id: string;
  name: string;
  class: { name: string };
}

interface Term {
  id: string;
  name: string;
  session: { name: string };
}

interface StudentResult {
  id: string;
  student: {
    first_name: string;
    last_name: string;
    middle_name: string | null;
    admission_number: string;
  };
  total_score: number | null;
  average_score: number | null;
  class_position: number | null;
  term: {
    name: string;
    session: { name: string };
  };
  class_arm: {
    name: string;
    class: { name: string };
  };
  components: {
    subject: { name: string; code: string };
    test1_score: number | null;
    test2_score: number | null;
    other_assessment_score: number | null;
    exam_score: number | null;
    total_score: number | null;
    grade: string | null;
    remark: string | null;
  }[];
  approved_at: string | null;
  published_at: string | null;
}

export default function BulkPDFDownload() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [classArms, setClassArms] = useState<ClassArm[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedClassArm, setSelectedClassArm] = useState<string>("");
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [resultCount, setResultCount] = useState<number>(0);

  useEffect(() => {
    fetchFiltersData();
  }, []);

  useEffect(() => {
    if (selectedClassArm && selectedTerm) {
      fetchResultCount();
    } else {
      setResultCount(0);
    }
  }, [selectedClassArm, selectedTerm]);

  const fetchFiltersData = async () => {
    try {
      const [{ data: classArmsData }, { data: termsData }] = await Promise.all([
        supabase
          .from("class_arms")
          .select("id, name, class:classes(name)")
          .eq("is_active", true),
        supabase
          .from("terms")
          .select("id, name, session:academic_sessions(name)")
          .order("created_at", { ascending: false }),
      ]);

      setClassArms((classArmsData as ClassArm[]) || []);
      setTerms((termsData as Term[]) || []);
    } catch (error) {
      console.error("Error fetching filter data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchResultCount = async () => {
    const { count } = await supabase
      .from("results")
      .select("id", { count: "exact", head: true })
      .eq("class_arm_id", selectedClassArm)
      .eq("term_id", selectedTerm)
      .eq("status", "published");

    setResultCount(count || 0);
  };

  const generatePDFForStudent = async (
    result: StudentResult,
    schoolSettings: any,
    classSize: number,
    logoBase64: string | null,
    classTeacherSigBase64: string | null,
    formTeacherSigBase64: string | null,
    principalSigBase64: string | null
  ): Promise<Blob> => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const primaryColor: [number, number, number] = [30, 58, 138];
    const secondaryColor: [number, number, number] = [100, 100, 100];

    const schoolName = schoolSettings?.school_name || "School Name";
    const schoolAddress = schoolSettings?.address || "";
    const schoolMotto = schoolSettings?.motto;

    // Header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 45, "F");

    // School Logo (left side)
    addImageToPDF(doc, logoBase64, 13, 10, 25, 25, 'LOGO', primaryColor);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(schoolName, pageWidth / 2, 18, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(schoolAddress, pageWidth / 2, 26, { align: "center" });

    if (schoolMotto) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text(`"${schoolMotto}"`, pageWidth / 2, 33, { align: "center" });
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("ACADEMIC REPORT CARD", pageWidth / 2, 41, { align: "center" });

    // Student Info
    let yPos = 55;
    doc.setTextColor(...secondaryColor);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("STUDENT INFORMATION", margin, yPos);

    yPos += 8;
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);

    yPos += 8;
    doc.setTextColor(0, 0, 0);
    const col1X = margin;
    const col2X = pageWidth / 2 + 10;

    const studentName = `${result.student.last_name} ${result.student.first_name} ${result.student.middle_name || ""}`;

    doc.setFont("helvetica", "bold");
    doc.text("Name:", col1X, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(studentName, col1X + 25, yPos);

    doc.setFont("helvetica", "bold");
    doc.text("Admission No:", col2X, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(result.student.admission_number, col2X + 35, yPos);

    yPos += 7;
    doc.setFont("helvetica", "bold");
    doc.text("Class:", col1X, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(
      `${result.class_arm.class.name} ${result.class_arm.name}`,
      col1X + 25,
      yPos
    );

    doc.setFont("helvetica", "bold");
    doc.text("Term:", col2X, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(result.term.name, col2X + 35, yPos);

    yPos += 7;
    doc.setFont("helvetica", "bold");
    doc.text("Session:", col1X, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(result.term.session.name, col1X + 25, yPos);

    // Summary Box
    yPos += 15;
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(margin, yPos - 5, pageWidth - margin * 2, 25, 3, 3, "F");

    const summaryItems = [
      { label: "Total Score", value: result.total_score?.toFixed(1) || "N/A" },
      { label: "Average", value: result.average_score?.toFixed(1) || "N/A" },
      {
        label: "Position",
        value: result.class_position
          ? `${result.class_position} of ${classSize}`
          : "N/A",
      },
      { label: "Subjects", value: result.components.length.toString() },
    ];

    const summaryWidth = (pageWidth - margin * 2) / summaryItems.length;
    summaryItems.forEach((item, index) => {
      const x = margin + summaryWidth * index + summaryWidth / 2;
      doc.setFontSize(8);
      doc.setTextColor(...secondaryColor);
      doc.text(item.label, x, yPos + 4, { align: "center" });
      doc.setFontSize(14);
      doc.setTextColor(...primaryColor);
      doc.setFont("helvetica", "bold");
      doc.text(item.value, x, yPos + 14, { align: "center" });
    });

    // Subjects Table
    yPos += 35;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...secondaryColor);
    doc.text("DETAILED SCORE BREAKDOWN", margin, yPos);

    yPos += 5;

    const tableData = result.components.map((comp, index) => [
      (index + 1).toString(),
      comp.subject.name,
      comp.test1_score?.toString() || "-",
      comp.test2_score?.toString() || "-",
      comp.other_assessment_score?.toString() || "-",
      comp.exam_score?.toString() || "-",
      comp.total_score?.toFixed(1) || "-",
      comp.grade || "-",
      comp.remark || "-",
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [
        [
          "#",
          "Subject",
          "T1 (10)",
          "T2 (10)",
          "Other (10)",
          "Exam (70)",
          "Total",
          "Grade",
          "Remark",
        ],
      ],
      body: tableData,
      theme: "grid",
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [0, 0, 0],
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 8 },
        1: { cellWidth: 35 },
        2: { halign: "center", cellWidth: 14 },
        3: { halign: "center", cellWidth: 14 },
        4: { halign: "center", cellWidth: 18 },
        5: { halign: "center", cellWidth: 18 },
        6: { halign: "center", cellWidth: 14 },
        7: { halign: "center", cellWidth: 14 },
        8: { cellWidth: "auto" },
      },
      margin: { left: margin, right: margin },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
    });

    const tableEndY = (doc as any).lastAutoTable.finalY || yPos + 50;

    // ===== SIGNATURES SECTION =====
    let sigY = tableEndY + 15;
    const sigWidthHalf = (pageWidth - margin * 2) / 2;

    // First Row: Class Teacher + Form Teacher
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.setFontSize(7);

    // Class Teacher Signature
    doc.setFillColor(250, 250, 250);
    doc.rect(margin, sigY, sigWidthHalf - 10, 14, 'F');
    doc.line(margin, sigY + 15, margin + sigWidthHalf - 10, sigY + 15);
    if (classTeacherSigBase64) {
      addImageToPDF(doc, classTeacherSigBase64, margin + 5, sigY + 1, sigWidthHalf - 20, 12);
    } else {
      doc.setTextColor(100, 100, 100);
      doc.text('[e-Signature]', margin + (sigWidthHalf - 10) / 2, sigY + 8, { align: 'center' });
    }
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Class Teacher's Signature", margin, sigY + 22);
    if ((result as any).approved_at) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.text(`Date: ${new Date((result as any).approved_at).toLocaleDateString()}`, margin, sigY + 26);
    }

    // Form Teacher Signature
    const ftX = margin + sigWidthHalf;
    doc.setFillColor(250, 250, 250);
    doc.rect(ftX, sigY, sigWidthHalf - 10, 14, 'F');
    doc.line(ftX, sigY + 15, ftX + sigWidthHalf - 10, sigY + 15);
    if (formTeacherSigBase64) {
      addImageToPDF(doc, formTeacherSigBase64, ftX + 5, sigY + 1, sigWidthHalf - 20, 12);
    } else {
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(7);
      doc.text('[e-Signature]', ftX + (sigWidthHalf - 10) / 2, sigY + 8, { align: 'center' });
    }
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Form Teacher's Signature", ftX, sigY + 22);
    if ((result as any).approved_at) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.text(`Date: ${new Date((result as any).approved_at).toLocaleDateString()}`, ftX, sigY + 26);
    }

    // Second Row: Date + Principal
    const row2Y = sigY + 30;
    doc.setFillColor(250, 250, 250);
    doc.rect(margin, row2Y, sigWidthHalf - 10, 14, 'F');
    doc.line(margin, row2Y + 15, margin + sigWidthHalf - 10, row2Y + 15);
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(7);
    doc.text(new Date().toLocaleDateString(), margin + (sigWidthHalf - 10) / 2, row2Y + 8, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Date", margin, row2Y + 22);

    const prX = margin + sigWidthHalf;
    doc.setFillColor(250, 250, 250);
    doc.rect(prX, row2Y, sigWidthHalf - 10, 14, 'F');
    doc.line(prX, row2Y + 15, prX + sigWidthHalf - 10, row2Y + 15);
    if (principalSigBase64) {
      addImageToPDF(doc, principalSigBase64, prX + 5, row2Y + 1, sigWidthHalf - 20, 12);
    } else {
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(7);
      doc.text('[e-Signature]', prX + (sigWidthHalf - 10) / 2, row2Y + 8, { align: 'center' });
    }
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Principal's Signature", prX, row2Y + 22);
    if ((result as any).published_at) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.text(`Date: ${new Date((result as any).published_at).toLocaleDateString()}`, prX, row2Y + 26);
    }

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 10;
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Printed on: ${new Date().toLocaleDateString()}`,
      pageWidth / 2,
      footerY,
      { align: "center" }
    );

    return doc.output("blob");
  };

  const handleBulkDownload = async () => {
    if (!selectedClassArm || !selectedTerm) {
      toast({
        title: "Selection Required",
        description: "Please select both a class and term.",
        variant: "destructive",
      });
      return;
    }

    try {
      setGenerating(true);
      setProgress(0);

      // Fetch school settings
      const schoolSettings = await getSchoolSettings();
      
      // Load logo and principal signature once for all PDFs
      const logoBase64 = await loadImageAsBase64(schoolSettings?.logo_url);
      const principalSigBase64 = await loadImageAsBase64(schoolSettings?.principal_signature_url);

      // Fetch all published results for the selected class and term
      const { data: results, error } = await supabase
        .from("results")
        .select(
          `
          id,
          total_score,
          average_score,
          class_position,
          student_id,
          term_id,
          class_arm_id,
          class_teacher_id,
          form_teacher_id,
          approved_at,
          published_at
        `
        )
        .eq("class_arm_id", selectedClassArm)
        .eq("term_id", selectedTerm)
        .eq("status", "published");

      if (error) throw error;

      if (!results || results.length === 0) {
        toast({
          title: "No Results Found",
          description: "No published results found for the selected criteria.",
          variant: "destructive",
        });
        setGenerating(false);
        return;
      }

      const zip = new JSZip();
      const classSize = results.length;

      // Get class arm and term info
      const selectedClassArmData = classArms.find(
        (c) => c.id === selectedClassArm
      );
      const selectedTermData = terms.find((t) => t.id === selectedTerm);

      // Process each result
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        setProgress(Math.round(((i + 1) / results.length) * 100));

        // Fetch student info
        const { data: student } = await supabase
          .from("students")
          .select("first_name, last_name, middle_name, admission_number")
          .eq("id", result.student_id)
          .single();

        // Fetch result components
        const { data: components } = await supabase
          .from("result_components")
          .select(
            `
            test1_score,
            test2_score,
            other_assessment_score,
            exam_score,
            total_score,
            grade,
            remark,
            subject:subjects(name, code)
          `
          )
          .eq("result_id", result.id);

        if (!student || !components) continue;

        // Fetch class teacher and form teacher signatures
        let classTeacherSigBase64: string | null = null;
        let formTeacherSigBase64: string | null = null;

        if ((result as any).class_teacher_id) {
          const { data: teacher } = await supabase
            .from("teachers")
            .select("signature_url")
            .eq("id", (result as any).class_teacher_id)
            .maybeSingle();
          if (teacher?.signature_url) {
            classTeacherSigBase64 = await loadImageAsBase64(teacher.signature_url);
          }
        }

        if ((result as any).form_teacher_id) {
          const { data: teacher } = await supabase
            .from("teachers")
            .select("signature_url")
            .eq("id", (result as any).form_teacher_id)
            .maybeSingle();
          if (teacher?.signature_url) {
            formTeacherSigBase64 = await loadImageAsBase64(teacher.signature_url);
          }
        }

        const studentResult: StudentResult = {
          id: result.id,
          student: student,
          total_score: result.total_score ? Number(result.total_score) : null,
          average_score: result.average_score
            ? Number(result.average_score)
            : null,
          class_position: result.class_position,
          term: {
            name: selectedTermData?.name || "",
            session: { name: selectedTermData?.session?.name || "" },
          },
          class_arm: {
            name: selectedClassArmData?.name || "",
            class: { name: selectedClassArmData?.class?.name || "" },
          },
          components: components as any,
          approved_at: (result as any).approved_at || null,
          published_at: (result as any).published_at || null,
        };

        // Generate PDF
        const pdfBlob = await generatePDFForStudent(
          studentResult,
          schoolSettings,
          classSize,
          logoBase64,
          classTeacherSigBase64,
          formTeacherSigBase64,
          principalSigBase64
        );

        // Add to ZIP
        const fileName = `${student.admission_number}_${student.last_name}_${student.first_name}_Result.pdf`;
        zip.file(fileName.replace(/\s+/g, "_"), pdfBlob);
      }

      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ type: "blob" });

      // Download ZIP
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedClassArmData?.class?.name || "Class"}_${selectedClassArmData?.name || ""}_${selectedTermData?.name || "Term"}_Results.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download Complete",
        description: `${results.length} result PDFs have been downloaded as a ZIP file.`,
      });
    } catch (error) {
      console.error("Error generating bulk PDFs:", error);
      toast({
        title: "Error",
        description: "Failed to generate bulk PDFs. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
      setProgress(0);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileArchive className="h-5 w-5" />
          Bulk Result PDF Download
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Class</label>
            <Select value={selectedClassArm} onValueChange={setSelectedClassArm}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a class..." />
              </SelectTrigger>
              <SelectContent>
                {classArms.map((arm) => (
                  <SelectItem key={arm.id} value={arm.id}>
                    {arm.class.name} {arm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Select Term</label>
            <Select value={selectedTerm} onValueChange={setSelectedTerm}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a term..." />
              </SelectTrigger>
              <SelectContent>
                {terms.map((term) => (
                  <SelectItem key={term.id} value={term.id}>
                    {term.session.name} - {term.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedClassArm && selectedTerm && (
          <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Published Results Found
              </p>
              <p className="text-2xl font-bold">{resultCount}</p>
            </div>
          </div>
        )}

        {generating && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Generating PDFs...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        <Button
          onClick={handleBulkDownload}
          disabled={!selectedClassArm || !selectedTerm || resultCount === 0 || generating}
          className="w-full"
          size="lg"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating ZIP...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Download All Results as ZIP
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          This will generate individual PDF report cards for each student and
          package them into a single ZIP file for download.
        </p>
      </CardContent>
    </Card>
  );
}
