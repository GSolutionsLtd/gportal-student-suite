import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  subjects: {
    name: string;
    test1: number | null;
    test2: number | null;
    exam: number | null;
    total: number | null;
    grade: string | null;
    remark: string | null;
    position: number | null;
  }[];
  schoolName: string;
  schoolAddress: string;
  schoolMotto?: string;
  principalName?: string;
}

export function generateResultPDF(data: ResultData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  
  // Colors
  const primaryColor: [number, number, number] = [30, 58, 138]; // Blue
  const secondaryColor: [number, number, number] = [100, 100, 100];
  
  // Header - School Letterhead
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // School Name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(data.schoolName, pageWidth / 2, 18, { align: 'center' });
  
  // School Address
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(data.schoolAddress, pageWidth / 2, 26, { align: 'center' });
  
  if (data.schoolMotto) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text(`"${data.schoolMotto}"`, pageWidth / 2, 33, { align: 'center' });
  }
  
  // Report Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ACADEMIC REPORT CARD', pageWidth / 2, 41, { align: 'center' });
  
  // Student Information Section
  let yPos = 55;
  
  doc.setTextColor(...secondaryColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('STUDENT INFORMATION', margin, yPos);
  
  yPos += 8;
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  
  // Two-column layout for student info
  const col1X = margin;
  const col2X = pageWidth / 2 + 10;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Name:', col1X, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.studentName, col1X + 25, yPos);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Admission No:', col2X, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.admissionNumber, col2X + 35, yPos);
  
  yPos += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Class:', col1X, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.className, col1X + 25, yPos);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Term:', col2X, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.termName, col2X + 35, yPos);
  
  yPos += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Session:', col1X, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.sessionName, col1X + 25, yPos);
  
  // Performance Summary Box
  yPos += 15;
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, yPos - 5, pageWidth - margin * 2, 25, 3, 3, 'F');
  
  const summaryItems = [
    { label: 'Total Score', value: data.totalScore?.toFixed(1) || 'N/A' },
    { label: 'Average', value: data.averageScore?.toFixed(1) || 'N/A' },
    { label: 'Position', value: data.classPosition ? `${data.classPosition} of ${data.classSize}` : 'N/A' },
    { label: 'Subjects', value: data.subjects.length.toString() },
  ];
  
  const summaryWidth = (pageWidth - margin * 2) / summaryItems.length;
  summaryItems.forEach((item, index) => {
    const x = margin + summaryWidth * index + summaryWidth / 2;
    doc.setFontSize(8);
    doc.setTextColor(...secondaryColor);
    doc.text(item.label, x, yPos + 4, { align: 'center' });
    doc.setFontSize(14);
    doc.setTextColor(...primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.text(item.value, x, yPos + 14, { align: 'center' });
  });
  
  // Subjects Table
  yPos += 35;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...secondaryColor);
  doc.text('DETAILED SCORE BREAKDOWN', margin, yPos);
  
  yPos += 5;
  
  const tableData = data.subjects.map((subject, index) => [
    (index + 1).toString(),
    subject.name,
    subject.test1?.toString() || '-',
    subject.test2?.toString() || '-',
    subject.exam?.toString() || '-',
    subject.total?.toFixed(1) || '-',
    subject.grade || '-',
    subject.remark || '-',
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Subject', 'Test 1', 'Test 2', 'Exam', 'Total', 'Grade', 'Remark']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [0, 0, 0],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 45 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'center', cellWidth: 15 },
      7: { cellWidth: 'auto' },
    },
    margin: { left: margin, right: margin },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
  });
  
  // Get final Y position after table
  const finalY = (doc as any).lastAutoTable.finalY || yPos + 50;
  
  // Grading Key
  let gradeKeyY = finalY + 15;
  
  // Check if we need a new page
  if (gradeKeyY > doc.internal.pageSize.getHeight() - 60) {
    doc.addPage();
    gradeKeyY = 20;
  }
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...secondaryColor);
  doc.text('GRADING KEY:', margin, gradeKeyY);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  const gradingKey = 'A (75-100): Excellent | B (65-74): Very Good | C (55-64): Good | D (45-54): Pass | E (40-44): Fair | F (0-39): Fail';
  doc.text(gradingKey, margin, gradeKeyY + 8);
  
  // Footer with signature lines
  const footerY = doc.internal.pageSize.getHeight() - 40;
  
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  
  // Principal Signature
  doc.line(margin, footerY, margin + 50, footerY);
  doc.setFontSize(8);
  doc.text('Principal\'s Signature', margin, footerY + 5);
  
  // Date
  doc.line(pageWidth / 2 - 25, footerY, pageWidth / 2 + 25, footerY);
  doc.text('Date', pageWidth / 2, footerY + 5, { align: 'center' });
  
  // School Stamp
  doc.line(pageWidth - margin - 50, footerY, pageWidth - margin, footerY);
  doc.text('School Stamp', pageWidth - margin - 25, footerY + 5, { align: 'center' });
  
  // Print Date
  doc.setFontSize(7);
  doc.setTextColor(...secondaryColor);
  doc.text(`Printed on: ${new Date().toLocaleDateString()}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
  
  // Save the PDF
  const fileName = `${data.studentName.replace(/\s+/g, '_')}_${data.termName.replace(/\s+/g, '_')}_Report.pdf`;
  doc.save(fileName);
}

export function generateBulkResultsPDF(results: ResultData[]): void {
  const doc = new jsPDF();
  
  results.forEach((data, index) => {
    if (index > 0) {
      doc.addPage();
    }
    
    // Generate each student's report on a new page
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const primaryColor: [number, number, number] = [30, 58, 138];
    const secondaryColor: [number, number, number] = [100, 100, 100];
    
    // Header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(data.schoolName, pageWidth / 2, 15, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(data.schoolAddress, pageWidth / 2, 23, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ACADEMIC REPORT CARD', pageWidth / 2, 35, { align: 'center' });
    
    // Student Info
    let yPos = 50;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Name:', margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(data.studentName, margin + 20, yPos);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Class:', pageWidth / 2, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(data.className, pageWidth / 2 + 20, yPos);
    
    yPos += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('Term:', margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(data.termName, margin + 20, yPos);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Position:', pageWidth / 2, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(data.classPosition ? `${data.classPosition} of ${data.classSize}` : 'N/A', pageWidth / 2 + 25, yPos);
    
    // Table
    yPos += 10;
    const tableData = data.subjects.map((subject, idx) => [
      (idx + 1).toString(),
      subject.name,
      subject.test1?.toString() || '-',
      subject.test2?.toString() || '-',
      subject.exam?.toString() || '-',
      subject.total?.toFixed(1) || '-',
      subject.grade || '-',
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Subject', 'T1', 'T2', 'Exam', 'Total', 'Grade']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: primaryColor,
        fontSize: 8,
        fontStyle: 'bold',
      },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        2: { halign: 'center', cellWidth: 12 },
        3: { halign: 'center', cellWidth: 12 },
        4: { halign: 'center', cellWidth: 15 },
        5: { halign: 'center', cellWidth: 15 },
        6: { halign: 'center', cellWidth: 12 },
      },
      margin: { left: margin, right: margin },
    });
  });
  
  doc.save(`Bulk_Results_Report_${new Date().toISOString().split('T')[0]}.pdf`);
}
