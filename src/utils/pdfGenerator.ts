import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';

interface SubjectData {
  name: string;
  test1: number | null;
  test2: number | null;
  other: number | null;
  exam: number | null;
  total: number | null;
  grade: string | null;
  remark: string | null;
  position: number | null;
  classAverage?: number | null;
}

interface ResultData {
  studentName: string;
  admissionNumber: string;
  className: string;
  termName: string;
  sessionName: string;
  totalScore: number | null;
  averageScore: number | null;
  classPosition: number | null;
  classSize: number;
  subjects: SubjectData[];
  schoolName?: string;
  schoolAddress?: string;
  schoolMotto?: string;
  schoolLogo?: string;
  schoolEmail?: string;
  schoolPhone?: string;
  principalName?: string;
  principalSignature?: string;
  classTeacherSignature?: string;
  classTeacherRemark?: string;
  principalRemark?: string;
}

interface CumulativeTermData {
  termName: string;
  sessionName: string;
  averageScore: number | null;
  classPosition: number | null;
  classSize: number;
  totalSubjects: number;
  subjects: SubjectData[];
}

interface CumulativeResultData {
  studentName: string;
  admissionNumber: string;
  className: string;
  terms: CumulativeTermData[];
  schoolName?: string;
  schoolAddress?: string;
  schoolMotto?: string;
  schoolEmail?: string;
  schoolPhone?: string;
}

interface SchoolSettings {
  school_name: string;
  address: string | null;
  motto: string | null;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
  principal_name: string | null;
  principal_signature_url: string | null;
}

interface GradingScale {
  grade: string;
  min_score: number;
  max_score: number;
  remark: string;
}

export async function getSchoolSettings(): Promise<SchoolSettings | null> {
  const { data, error } = await supabase
    .from('school_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function getGradingScales(): Promise<GradingScale[]> {
  const { data } = await supabase
    .from('grading_scales')
    .select('grade, min_score, max_score, remark')
    .order('min_score', { ascending: false });

  return data || [];
}

// Get ordinal suffix
function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Calculate grade distribution for pie chart
function getGradeDistribution(subjects: SubjectData[]): { grade: string; count: number; color: [number, number, number] }[] {
  const gradeColors: Record<string, [number, number, number]> = {
    'A1': [34, 197, 94],
    'B2': [59, 130, 246],
    'B3': [99, 102, 241],
    'C4': [168, 85, 247],
    'C5': [236, 72, 153],
    'C6': [249, 115, 22],
    'D7': [234, 179, 8],
    'E8': [239, 68, 68],
    'F9': [127, 29, 29],
  };

  const distribution: Record<string, number> = {};
  subjects.forEach((s) => {
    if (s.grade) {
      distribution[s.grade] = (distribution[s.grade] || 0) + 1;
    }
  });

  return Object.entries(distribution).map(([grade, count]) => ({
    grade,
    count,
    color: gradeColors[grade] || [100, 100, 100],
  }));
}

// Draw a simple bar chart for subject comparison
function drawSubjectComparisonChart(
  doc: jsPDF,
  subjects: SubjectData[],
  startY: number,
  pageWidth: number,
  margin: number,
  primaryColor: [number, number, number]
): number {
  const chartWidth = pageWidth - margin * 2;
  const barHeight = 8;
  const labelWidth = 45;
  const maxBarWidth = chartWidth - labelWidth - 60;
  const spacing = 3;

  // Title
  doc.setTextColor(...primaryColor);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('SUBJECT-WISE PERFORMANCE COMPARISON', margin, startY);

  // Legend
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  const legendY = startY + 5;
  
  // Student score legend
  doc.setFillColor(34, 197, 94);
  doc.rect(pageWidth - margin - 80, legendY - 3, 8, 4, 'F');
  doc.setTextColor(0, 0, 0);
  doc.text('Student Score', pageWidth - margin - 70, legendY);
  
  // Class average legend
  doc.setFillColor(99, 102, 241);
  doc.rect(pageWidth - margin - 40, legendY - 3, 8, 4, 'F');
  doc.text('Class Avg', pageWidth - margin - 30, legendY);

  let yPos = startY + 12;

  // Draw bars for each subject (max 12 to fit on page)
  const subjectsToShow = subjects.slice(0, 12);

  subjectsToShow.forEach((subject) => {
    const studentScore = subject.total || 0;
    const classAvg = subject.classAverage || 0;

    // Subject name
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const truncatedName = subject.name.length > 12 ? subject.name.substring(0, 11) + '..' : subject.name;
    doc.text(truncatedName, margin, yPos + 3);

    const barStartX = margin + labelWidth;

    // Background bar
    doc.setFillColor(240, 240, 240);
    doc.rect(barStartX, yPos - 2, maxBarWidth, barHeight, 'F');

    // Student score bar
    const studentBarWidth = (studentScore / 100) * maxBarWidth;
    doc.setFillColor(34, 197, 94);
    doc.rect(barStartX, yPos - 2, studentBarWidth, barHeight / 2 - 0.5, 'F');

    // Class average bar
    const classBarWidth = (classAvg / 100) * maxBarWidth;
    doc.setFillColor(99, 102, 241);
    doc.rect(barStartX, yPos + barHeight / 2 - 1.5, classBarWidth, barHeight / 2 - 0.5, 'F');

    // Score labels
    doc.setFontSize(5);
    doc.setTextColor(0, 0, 0);
    doc.text(`${studentScore.toFixed(0)}`, barStartX + maxBarWidth + 3, yPos + 1);
    doc.text(`${classAvg.toFixed(0)}`, barStartX + maxBarWidth + 3, yPos + 5);

    yPos += barHeight + spacing;
  });

  return yPos + 5;
}

// Draw performance trend chart for cumulative results
function drawPerformanceTrendChart(
  doc: jsPDF,
  terms: CumulativeTermData[],
  startY: number,
  pageWidth: number,
  margin: number,
  primaryColor: [number, number, number]
): number {
  const chartWidth = pageWidth - margin * 2;
  const chartHeight = 50;
  const padding = 20;

  // Title
  doc.setTextColor(...primaryColor);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('PERFORMANCE TREND ACROSS TERMS', margin, startY);

  const chartStartY = startY + 8;

  // Draw chart background
  doc.setFillColor(250, 250, 255);
  doc.rect(margin, chartStartY, chartWidth, chartHeight, 'F');

  // Draw grid lines
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.2);
  for (let i = 0; i <= 4; i++) {
    const y = chartStartY + (chartHeight * i) / 4;
    doc.line(margin, y, margin + chartWidth, y);
    
    // Y-axis labels
    doc.setFontSize(5);
    doc.setTextColor(100, 100, 100);
    const scoreLabel = 100 - (i * 25);
    doc.text(scoreLabel.toString(), margin - 8, y + 1.5);
  }

  // Draw data points and lines
  if (terms.length > 0) {
    const pointSpacing = (chartWidth - padding * 2) / Math.max(terms.length - 1, 1);
    
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(1);

    const points: { x: number; y: number; avg: number; term: string }[] = [];

    terms.forEach((term, index) => {
      const x = margin + padding + index * pointSpacing;
      const avg = term.averageScore || 0;
      const y = chartStartY + chartHeight - (avg / 100) * chartHeight;
      points.push({ x, y, avg, term: term.termName });
    });

    // Draw connecting lines
    doc.setDrawColor(34, 197, 94);
    for (let i = 0; i < points.length - 1; i++) {
      doc.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }

    // Draw points and labels
    points.forEach((point) => {
      // Draw point
      doc.setFillColor(34, 197, 94);
      doc.circle(point.x, point.y, 2, 'F');
      
      // Draw white inner circle
      doc.setFillColor(255, 255, 255);
      doc.circle(point.x, point.y, 1, 'F');

      // Score label
      doc.setFontSize(6);
      doc.setTextColor(34, 197, 94);
      doc.setFont('helvetica', 'bold');
      doc.text(`${point.avg.toFixed(1)}%`, point.x, point.y - 4, { align: 'center' });

      // Term label at bottom
      doc.setFontSize(5);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      const shortTerm = point.term.length > 8 ? point.term.substring(0, 7) + '..' : point.term;
      doc.text(shortTerm, point.x, chartStartY + chartHeight + 6, { align: 'center' });
    });
  }

  return chartStartY + chartHeight + 15;
}

export async function generateComprehensiveResultPDF(data: ResultData): Promise<void> {
  const schoolSettings = await getSchoolSettings();
  const gradingScales = await getGradingScales();

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // Colors
  const primaryColor: [number, number, number] = [30, 58, 138];
  const secondaryColor: [number, number, number] = [100, 100, 100];
  const accentColor: [number, number, number] = [34, 197, 94];

  const schoolName = schoolSettings?.school_name || data.schoolName || 'School Name';
  const schoolAddress = schoolSettings?.address || data.schoolAddress || '';
  const schoolMotto = schoolSettings?.motto || data.schoolMotto;
  const schoolEmail = schoolSettings?.email || data.schoolEmail || '';
  const schoolPhone = schoolSettings?.phone || data.schoolPhone || '';
  const principalName = schoolSettings?.principal_name || data.principalName || '';

  // ========== PAGE 1: HEADER & STUDENT INFO ==========

  // Header Background with gradient effect
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 50, 'F');

  // School Logo placeholder (left side)
  doc.setFillColor(255, 255, 255);
  doc.circle(25, 25, 12, 'F');
  doc.setFontSize(8);
  doc.setTextColor(...primaryColor);
  doc.text('LOGO', 25, 27, { align: 'center' });

  // School Name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(schoolName.toUpperCase(), pageWidth / 2, 18, { align: 'center' });

  // School Address
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(schoolAddress, pageWidth / 2, 26, { align: 'center' });

  // Contact info
  if (schoolPhone || schoolEmail) {
    doc.setFontSize(8);
    const contactText = [schoolPhone, schoolEmail].filter(Boolean).join(' | ');
    doc.text(contactText, pageWidth / 2, 33, { align: 'center' });
  }

  // Motto
  if (schoolMotto) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(`"${schoolMotto}"`, pageWidth / 2, 40, { align: 'center' });
  }

  // Report Title Banner
  doc.setFillColor(245, 247, 250);
  doc.rect(0, 50, pageWidth, 12, 'F');
  doc.setTextColor(...primaryColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('STUDENT ACADEMIC REPORT CARD', pageWidth / 2, 58, { align: 'center' });

  // Session/Term info banner
  doc.setFillColor(240, 245, 255);
  doc.rect(margin, 65, pageWidth - margin * 2, 10, 'F');
  doc.setTextColor(...primaryColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`${data.sessionName} Academic Session - ${data.termName}`, pageWidth / 2, 72, { align: 'center' });

  // Student Information Card
  let yPos = 82;
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, yPos, pageWidth - margin * 2, 35, 3, 3, 'S');

  // Student info header
  doc.setFillColor(...primaryColor);
  doc.roundedRect(margin, yPos, pageWidth - margin * 2, 8, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('STUDENT INFORMATION', margin + 5, yPos + 6);

  yPos += 14;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);

  const col1X = margin + 5;
  const col2X = pageWidth / 2 + 5;

  // Row 1
  doc.setFont('helvetica', 'bold');
  doc.text('Name:', col1X, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.studentName, col1X + 22, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text('Admission No:', col2X, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.admissionNumber, col2X + 32, yPos);

  // Row 2
  yPos += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Class:', col1X, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.className, col1X + 22, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text('No. of Subjects:', col2X, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.subjects.length.toString(), col2X + 32, yPos);

  // Row 3
  yPos += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Position:', col1X, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.classPosition ? `${getOrdinalSuffix(data.classPosition)} out of ${data.classSize} students` : 'N/A', col1X + 22, yPos);

  // Performance Summary Cards
  yPos = 125;
  const cardWidth = (pageWidth - margin * 2 - 15) / 4;

  const summaryCards = [
    { label: 'Total Score', value: data.totalScore?.toFixed(1) || 'N/A', color: primaryColor },
    { label: 'Average', value: data.averageScore ? `${data.averageScore.toFixed(1)}%` : 'N/A', color: accentColor },
    { label: 'Position', value: data.classPosition ? getOrdinalSuffix(data.classPosition) : 'N/A', color: [168, 85, 247] as [number, number, number] },
    { label: 'Class Size', value: data.classSize.toString(), color: [249, 115, 22] as [number, number, number] },
  ];

  summaryCards.forEach((card, index) => {
    const x = margin + (cardWidth + 5) * index;
    doc.setFillColor(...card.color);
    doc.roundedRect(x, yPos, cardWidth, 22, 2, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(card.label, x + cardWidth / 2, yPos + 7, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(card.value, x + cardWidth / 2, yPos + 17, { align: 'center' });
  });

  // Subject Scores Table
  yPos = 155;
  doc.setTextColor(...secondaryColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DETAILED SCORE BREAKDOWN', margin, yPos);

  yPos += 5;

  const tableData = data.subjects.map((subject, index) => [
    (index + 1).toString(),
    subject.name,
    subject.test1?.toString() || '-',
    subject.test2?.toString() || '-',
    subject.other?.toString() || '-',
    subject.exam?.toString() || '-',
    subject.total?.toFixed(1) || '-',
    subject.grade || '-',
    subject.remark || '-',
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['S/N', 'Subject', 'T1 (10)', 'T2 (10)', 'Other (10)', 'Exam (70)', 'Total (100)', 'Grade', 'Remark']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [0, 0, 0],
      cellPadding: 2,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 32 },
      2: { halign: 'center', cellWidth: 14 },
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'center', cellWidth: 16 },
      5: { halign: 'center', cellWidth: 16 },
      6: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
      7: { halign: 'center', cellWidth: 14, fontStyle: 'bold' },
      8: { cellWidth: 'auto' },
    },
    margin: { left: margin, right: margin },
    alternateRowStyles: {
      fillColor: [250, 250, 255],
    },
    didParseCell: function (data) {
      // Color grades
      if (data.column.index === 7 && data.section === 'body') {
        const grade = data.cell.raw as string;
        if (grade === 'A1') {
          data.cell.styles.textColor = [34, 197, 94];
        } else if (grade === 'F9') {
          data.cell.styles.textColor = [239, 68, 68];
        }
      }
    },
  });

  const tableEndY = (doc as any).lastAutoTable.finalY || yPos + 50;

  // ========== SUBJECT COMPARISON CHART ==========
  let chartY = tableEndY + 10;

  // Check if any subjects have class averages
  const hasClassAverages = data.subjects.some(s => s.classAverage !== null && s.classAverage !== undefined);

  if (hasClassAverages) {
    if (chartY > pageHeight - 80) {
      doc.addPage();
      chartY = 20;
    }
    chartY = drawSubjectComparisonChart(doc, data.subjects, chartY, pageWidth, margin, primaryColor);
  }

  // ========== GRADING KEY ==========
  let gradeKeyY = chartY + 5;

  // Check if we need a new page
  if (gradeKeyY > pageHeight - 80) {
    doc.addPage();
    gradeKeyY = 20;
  }

  // Grading Key Box
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, gradeKeyY, pageWidth - margin * 2, 28, 2, 2, 'S');

  doc.setFillColor(...primaryColor);
  doc.roundedRect(margin, gradeKeyY, pageWidth - margin * 2, 7, 2, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('GRADING KEY', margin + 5, gradeKeyY + 5);

  // Display grading scales
  gradeKeyY += 12;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');

  const gradeScalesToShow = gradingScales.length > 0 ? gradingScales : [
    { grade: 'A1', min_score: 75, max_score: 100, remark: 'Excellent' },
    { grade: 'B2', min_score: 70, max_score: 74, remark: 'Very Good' },
    { grade: 'B3', min_score: 65, max_score: 69, remark: 'Good' },
    { grade: 'C4', min_score: 60, max_score: 64, remark: 'Credit' },
    { grade: 'C5', min_score: 55, max_score: 59, remark: 'Credit' },
    { grade: 'C6', min_score: 50, max_score: 54, remark: 'Credit' },
    { grade: 'D7', min_score: 45, max_score: 49, remark: 'Pass' },
    { grade: 'E8', min_score: 40, max_score: 44, remark: 'Pass' },
    { grade: 'F9', min_score: 0, max_score: 39, remark: 'Fail' },
  ];

  const gradePerRow = 3;
  const gradeWidth = (pageWidth - margin * 2 - 10) / gradePerRow;

  gradeScalesToShow.forEach((scale, index) => {
    const row = Math.floor(index / gradePerRow);
    const col = index % gradePerRow;
    const x = margin + 5 + col * gradeWidth;
    const y = gradeKeyY + row * 5;

    doc.setFont('helvetica', 'bold');
    doc.text(`${scale.grade}:`, x, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${scale.min_score}-${scale.max_score} (${scale.remark})`, x + 10, y);
  });

  // ========== REMARKS SECTION ==========
  let remarksY = gradeKeyY + 25;

  if (remarksY > pageHeight - 70) {
    doc.addPage();
    remarksY = 20;
  }

  // Remarks Box
  doc.setDrawColor(...primaryColor);
  doc.roundedRect(margin, remarksY, pageWidth - margin * 2, 40, 2, 2, 'S');

  doc.setFillColor(...primaryColor);
  doc.roundedRect(margin, remarksY, pageWidth - margin * 2, 7, 2, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('REMARKS & COMMENTS', margin + 5, remarksY + 5);

  remarksY += 12;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);

  // Class Teacher Remark
  doc.setFont('helvetica', 'bold');
  doc.text("Class Teacher's Remark:", margin + 5, remarksY);
  doc.setFont('helvetica', 'normal');
  const classTeacherRemark = data.classTeacherRemark || 'Good performance. Keep it up!';
  const ctRemarkLines = doc.splitTextToSize(classTeacherRemark, pageWidth - margin * 2 - 10);
  doc.text(ctRemarkLines, margin + 5, remarksY + 5);

  remarksY += 15;

  // Principal Remark
  doc.setFont('helvetica', 'bold');
  doc.text("Principal's Remark:", margin + 5, remarksY);
  doc.setFont('helvetica', 'normal');
  const principalRemark = data.principalRemark || 'A commendable result. Continue to strive for excellence.';
  const prRemarkLines = doc.splitTextToSize(principalRemark, pageWidth - margin * 2 - 10);
  doc.text(prRemarkLines, margin + 5, remarksY + 5);

  // ========== SIGNATURES SECTION ==========
  let signaturesY = remarksY + 25;

  if (signaturesY > pageHeight - 45) {
    doc.addPage();
    signaturesY = 20;
  }

  const sigWidth = (pageWidth - margin * 2) / 3;

  // Class Teacher Signature
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(margin, signaturesY + 15, margin + sigWidth - 10, signaturesY + 15);

  // Signature placeholder box
  doc.setFillColor(250, 250, 250);
  doc.rect(margin, signaturesY, sigWidth - 10, 14, 'F');
  doc.setTextColor(...secondaryColor);
  doc.setFontSize(6);
  doc.text('[e-Signature]', margin + (sigWidth - 10) / 2, signaturesY + 8, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text("Class Teacher's Signature", margin, signaturesY + 22);

  // Date
  const dateX = margin + sigWidth;
  doc.line(dateX, signaturesY + 15, dateX + sigWidth - 10, signaturesY + 15);
  doc.setFillColor(250, 250, 250);
  doc.rect(dateX, signaturesY, sigWidth - 10, 14, 'F');
  doc.setTextColor(...secondaryColor);
  doc.setFontSize(7);
  doc.text(new Date().toLocaleDateString(), dateX + (sigWidth - 10) / 2, signaturesY + 8, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Date', dateX, signaturesY + 22);

  // Principal Signature
  const principalX = margin + sigWidth * 2;
  doc.line(principalX, signaturesY + 15, principalX + sigWidth - 10, signaturesY + 15);
  doc.setFillColor(250, 250, 250);
  doc.rect(principalX, signaturesY, sigWidth - 10, 14, 'F');
  doc.setTextColor(...secondaryColor);
  doc.setFontSize(6);
  doc.text('[e-Signature]', principalX + (sigWidth - 10) / 2, signaturesY + 8, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text("Principal's Signature", principalX, signaturesY + 22);

  if (principalName) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(principalName, principalX, signaturesY + 27);
  }

  // ========== PERFORMANCE CHART (Simple bar representation) ==========
  let perfChartY = signaturesY + 35;

  if (perfChartY > pageHeight - 40) {
    doc.addPage();
    perfChartY = 20;
  }

  // Performance Overview Title
  doc.setTextColor(...primaryColor);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('GRADE DISTRIBUTION OVERVIEW', margin, perfChartY);

  perfChartY += 8;

  // Grade Distribution Mini Chart
  const gradeDistribution = getGradeDistribution(data.subjects);
  const chartWidth = pageWidth - margin * 2;
  const barHeight = 12;

  // Background bar
  doc.setFillColor(240, 240, 240);
  doc.roundedRect(margin, perfChartY, chartWidth, barHeight, 2, 2, 'F');

  // Draw grade distribution
  let barX = margin;
  const totalSubjects = data.subjects.length;
  gradeDistribution.forEach((item) => {
    const width = (item.count / totalSubjects) * chartWidth;
    if (width > 0) {
      doc.setFillColor(...item.color);
      doc.rect(barX, perfChartY, width, barHeight, 'F');

      // Add grade label if wide enough
      if (width > 15) {
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text(`${item.grade}(${item.count})`, barX + width / 2, perfChartY + 8, { align: 'center' });
      }
      barX += width;
    }
  });

  // ========== FOOTER ==========
  const footerY = pageHeight - 12;
  doc.setTextColor(...secondaryColor);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on: ${new Date().toLocaleString()} | This is a computer-generated document`, pageWidth / 2, footerY, { align: 'center' });

  // Decorative line
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(1);
  doc.line(0, pageHeight - 5, pageWidth, pageHeight - 5);

  // Save
  const fileName = `${data.studentName.replace(/\s+/g, '_')}_${data.termName.replace(/\s+/g, '_')}_Result.pdf`;
  doc.save(fileName);
}

// Generate Cumulative Result PDF across multiple terms
export async function generateCumulativeResultPDF(data: CumulativeResultData): Promise<void> {
  const schoolSettings = await getSchoolSettings();
  const gradingScales = await getGradingScales();

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  const primaryColor: [number, number, number] = [30, 58, 138];
  const secondaryColor: [number, number, number] = [100, 100, 100];
  const accentColor: [number, number, number] = [34, 197, 94];

  const schoolName = schoolSettings?.school_name || data.schoolName || 'School Name';
  const schoolAddress = schoolSettings?.address || data.schoolAddress || '';
  const schoolMotto = schoolSettings?.motto || data.schoolMotto;
  const schoolEmail = schoolSettings?.email || data.schoolEmail || '';
  const schoolPhone = schoolSettings?.phone || data.schoolPhone || '';

  // ========== HEADER ==========
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 45, 'F');

  doc.setFillColor(240, 245, 255);
  for (let i = 0; i < pageWidth; i += 20) {
    doc.circle(i, 22, 8, 'F');
  }

  doc.setFillColor(255, 255, 255);
  doc.circle(25, 22, 10, 'F');
  doc.setFontSize(6);
  doc.setTextColor(...primaryColor);
  doc.text('LOGO', 25, 24, { align: 'center' });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(schoolName.toUpperCase(), pageWidth / 2, 15, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(schoolAddress, pageWidth / 2, 22, { align: 'center' });

  if (schoolPhone || schoolEmail) {
    doc.setFontSize(7);
    const contactText = [schoolPhone, schoolEmail].filter(Boolean).join(' | ');
    doc.text(contactText, pageWidth / 2, 28, { align: 'center' });
  }

  if (schoolMotto) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.text(`"${schoolMotto}"`, pageWidth / 2, 35, { align: 'center' });
  }

  // Title Banner
  doc.setFillColor(245, 247, 250);
  doc.rect(0, 45, pageWidth, 12, 'F');
  doc.setTextColor(...primaryColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('CUMULATIVE ACADEMIC PERFORMANCE REPORT', pageWidth / 2, 53, { align: 'center' });

  // Student Info
  let yPos = 65;
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, yPos, pageWidth - margin * 2, 20, 3, 3, 'S');

  doc.setFillColor(...primaryColor);
  doc.roundedRect(margin, yPos, pageWidth - margin * 2, 7, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('STUDENT INFORMATION', margin + 5, yPos + 5);

  yPos += 12;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Name:', margin + 5, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.studentName, margin + 25, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text('Adm. No:', pageWidth / 2, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.admissionNumber, pageWidth / 2 + 22, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text('Class:', pageWidth - margin - 50, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.className, pageWidth - margin - 30, yPos);

  // ========== PERFORMANCE TREND CHART ==========
  yPos = 95;
  yPos = drawPerformanceTrendChart(doc, data.terms, yPos, pageWidth, margin, primaryColor);

  // ========== TERM-BY-TERM SUMMARY TABLE ==========
  doc.setTextColor(...primaryColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('TERM-BY-TERM PERFORMANCE SUMMARY', margin, yPos);

  yPos += 5;

  const summaryTableData = data.terms.map((term, index) => [
    (index + 1).toString(),
    `${term.sessionName} - ${term.termName}`,
    term.totalSubjects.toString(),
    term.averageScore !== null ? `${term.averageScore.toFixed(1)}%` : 'N/A',
    term.classPosition !== null ? `${getOrdinalSuffix(term.classPosition)} of ${term.classSize}` : 'N/A',
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Session / Term', 'Subjects', 'Average', 'Position']],
    body: summaryTableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [0, 0, 0],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { cellWidth: 70 },
      2: { halign: 'center', cellWidth: 25 },
      3: { halign: 'center', cellWidth: 30 },
      4: { halign: 'center', cellWidth: 40 },
    },
    margin: { left: margin, right: margin },
    alternateRowStyles: { fillColor: [250, 250, 255] },
  });

  const summaryTableEndY = (doc as any).lastAutoTable.finalY || yPos + 30;

  // ========== OVERALL STATISTICS ==========
  let statsY = summaryTableEndY + 10;

  if (statsY > pageHeight - 60) {
    doc.addPage();
    statsY = 20;
  }

  // Calculate overall stats
  const validTerms = data.terms.filter(t => t.averageScore !== null);
  const overallAverage = validTerms.length > 0
    ? validTerms.reduce((sum, t) => sum + (t.averageScore || 0), 0) / validTerms.length
    : 0;
  const bestTerm = validTerms.reduce((best, t) => 
    (t.averageScore || 0) > (best?.averageScore || 0) ? t : best, validTerms[0]);
  const improvement = validTerms.length >= 2
    ? (validTerms[validTerms.length - 1].averageScore || 0) - (validTerms[0].averageScore || 0)
    : 0;

  doc.setTextColor(...primaryColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('OVERALL STATISTICS', margin, statsY);

  statsY += 8;
  const statCardWidth = (pageWidth - margin * 2 - 10) / 3;

  const stats = [
    { label: 'Cumulative Average', value: `${overallAverage.toFixed(1)}%`, color: primaryColor },
    { label: 'Best Performance', value: bestTerm ? `${(bestTerm.averageScore || 0).toFixed(1)}% (${bestTerm.termName})` : 'N/A', color: accentColor },
    { label: 'Progress', value: `${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}%`, color: improvement >= 0 ? accentColor : [239, 68, 68] as [number, number, number] },
  ];

  stats.forEach((stat, index) => {
    const x = margin + (statCardWidth + 5) * index;
    doc.setFillColor(...stat.color);
    doc.roundedRect(x, statsY, statCardWidth, 20, 2, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(stat.label, x + statCardWidth / 2, statsY + 6, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const valueText = stat.value.length > 18 ? stat.value.substring(0, 17) + '..' : stat.value;
    doc.text(valueText, x + statCardWidth / 2, statsY + 15, { align: 'center' });
  });

  // ========== FOOTER ==========
  const footerY = pageHeight - 12;
  doc.setTextColor(...secondaryColor);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on: ${new Date().toLocaleString()} | Cumulative Performance Report`, pageWidth / 2, footerY, { align: 'center' });

  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(1);
  doc.line(0, pageHeight - 5, pageWidth, pageHeight - 5);

  // Save
  const fileName = `${data.studentName.replace(/\s+/g, '_')}_Cumulative_Report.pdf`;
  doc.save(fileName);
}

// Generate PDF as base64 for email attachment
export async function generateResultPDFAsBase64(data: ResultData): Promise<string> {
  const schoolSettings = await getSchoolSettings();
  const gradingScales = await getGradingScales();

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  const primaryColor: [number, number, number] = [30, 58, 138];
  const secondaryColor: [number, number, number] = [100, 100, 100];
  const accentColor: [number, number, number] = [34, 197, 94];

  const schoolName = schoolSettings?.school_name || data.schoolName || 'School Name';
  const schoolAddress = schoolSettings?.address || data.schoolAddress || '';
  const schoolMotto = schoolSettings?.motto || data.schoolMotto;
  const schoolEmail = schoolSettings?.email || data.schoolEmail || '';
  const schoolPhone = schoolSettings?.phone || data.schoolPhone || '';

  // ========== Simplified PDF for email attachment ==========
  
  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(schoolName.toUpperCase(), pageWidth / 2, 15, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(schoolAddress, pageWidth / 2, 23, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('STUDENT RESULT REPORT', pageWidth / 2, 35, { align: 'center' });

  // Student Info
  let yPos = 50;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);

  doc.setFont('helvetica', 'bold');
  doc.text('Student:', margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.studentName, margin + 25, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text('Adm. No:', pageWidth / 2, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.admissionNumber, pageWidth / 2 + 25, yPos);

  yPos += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Class:', margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.className, margin + 25, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text('Term:', pageWidth / 2, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.sessionName} - ${data.termName}`, pageWidth / 2 + 25, yPos);

  yPos += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Average:', margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.averageScore !== null ? `${data.averageScore.toFixed(1)}%` : 'N/A', margin + 25, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text('Position:', pageWidth / 2, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.classPosition !== null ? `${getOrdinalSuffix(data.classPosition)} of ${data.classSize}` : 'N/A', pageWidth / 2 + 25, yPos);

  // Table
  yPos += 10;
  const tableData = data.subjects.map((subject, index) => [
    (index + 1).toString(),
    subject.name,
    subject.total?.toFixed(1) || '-',
    subject.grade || '-',
    subject.remark || '-',
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Subject', 'Total', 'Grade', 'Remark']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: { fontSize: 8 },
    margin: { left: margin, right: margin },
  });

  const tableEndY = (doc as any).lastAutoTable.finalY || yPos + 50;

  // Remarks
  let remarksY = tableEndY + 10;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text("Class Teacher's Remark:", margin, remarksY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.classTeacherRemark || 'Good performance.', margin, remarksY + 5);

  remarksY += 15;
  doc.setFont('helvetica', 'bold');
  doc.text("Principal's Remark:", margin, remarksY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.principalRemark || 'Keep up the good work.', margin, remarksY + 5);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(...secondaryColor);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

  // Return as base64
  return doc.output('datauristring').split(',')[1];
}

// Keep backward compatibility with the original function
export async function generateResultPDF(data: ResultData): Promise<void> {
  return generateComprehensiveResultPDF(data);
}

export async function generateBulkResultsPDF(results: ResultData[]): Promise<void> {
  const schoolSettings = await getSchoolSettings();

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const primaryColor: [number, number, number] = [30, 58, 138];

  results.forEach((data, index) => {
    if (index > 0) {
      doc.addPage();
    }

    const margin = 15;
    const schoolName = schoolSettings?.school_name || data.schoolName || 'School Name';
    const schoolAddress = schoolSettings?.address || data.schoolAddress || '';

    // Header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(schoolName.toUpperCase(), pageWidth / 2, 15, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(schoolAddress, pageWidth / 2, 23, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('ACADEMIC REPORT CARD', pageWidth / 2, 35, { align: 'center' });

    // Student Info
    let yPos = 50;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);

    doc.setFont('helvetica', 'bold');
    doc.text('Name:', margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(data.studentName, margin + 18, yPos);

    doc.setFont('helvetica', 'bold');
    doc.text('Class:', pageWidth / 2, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(data.className, pageWidth / 2 + 18, yPos);

    yPos += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Term:', margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(data.termName, margin + 18, yPos);

    doc.setFont('helvetica', 'bold');
    doc.text('Position:', pageWidth / 2, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(data.classPosition ? `${data.classPosition} of ${data.classSize}` : 'N/A', pageWidth / 2 + 22, yPos);

    yPos += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Average:', margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(data.averageScore ? `${data.averageScore.toFixed(1)}%` : 'N/A', margin + 22, yPos);

    // Table
    yPos += 8;
    const tableData = data.subjects.map((subject, idx) => [
      (idx + 1).toString(),
      subject.name,
      subject.test1?.toString() || '-',
      subject.test2?.toString() || '-',
      subject.other?.toString() || '-',
      subject.exam?.toString() || '-',
      subject.total?.toFixed(1) || '-',
      subject.grade || '-',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Subject', 'T1', 'T2', 'Other', 'Exam', 'Total', 'Grade']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: primaryColor,
        fontSize: 7,
        fontStyle: 'bold',
      },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        2: { halign: 'center', cellWidth: 12 },
        3: { halign: 'center', cellWidth: 12 },
        4: { halign: 'center', cellWidth: 14 },
        5: { halign: 'center', cellWidth: 14 },
        6: { halign: 'center', cellWidth: 14 },
        7: { halign: 'center', cellWidth: 14 },
      },
      margin: { left: margin, right: margin },
    });
  });

  doc.save(`Bulk_Results_Report_${new Date().toISOString().split('T')[0]}.pdf`);
}

export type { ResultData, CumulativeResultData, CumulativeTermData, SubjectData };
