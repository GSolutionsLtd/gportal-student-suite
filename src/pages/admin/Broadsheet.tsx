import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BroadsheetFilters } from "@/components/admin/broadsheet/BroadsheetFilters";
import { BroadsheetTable, type BroadsheetRow } from "@/components/admin/broadsheet/BroadsheetTable";
import { CumulativeTable, type CumulativeRow } from "@/components/admin/broadsheet/CumulativeTable";
import { CrossTermAnalysis } from "@/components/admin/broadsheet/CrossTermAnalysis";
import { BroadsheetSummary } from "@/components/admin/broadsheet/BroadsheetSummary";

interface SessionOption { id: string; name: string }
interface TermOption { id: string; name: string; session_id: string; session?: { name: string } }
interface ClassOption { id: string; name: string }
interface ClassArmOption { id: string; name: string; class_id: string; class?: { name: string } }
interface SubjectOption { id: string; name: string; code: string }

interface ResultRow {
  id: string;
  status: string;
  total_score: number | null;
  average_score: number | null;
  class_position: number | null;
  submitted_at: string | null;
  student_id: string;
  term_id: string;
  class_arm_id: string;
  student: { first_name: string; last_name: string; admission_number: string };
  term: { name: string; session?: { name: string } };
  class_arm: { name: string; class?: { name: string } };
  components: { total_score: number | null; grade: string | null; subject_id: string }[];
}

export default function Broadsheet() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classArms, setClassArms] = useState<ClassArmOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);

  const [selectedSession, setSelectedSession] = useState("all");
  const [selectedTerm, setSelectedTerm] = useState("all");
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedClassArm, setSelectedClassArm] = useState("all");
  const [selectedSubject, setSelectedSubject] = useState("all");

  const [results, setResults] = useState<ResultRow[]>([]);

  const filteredTerms = useMemo(
    () => terms.filter(t => selectedSession === "all" || t.session_id === selectedSession),
    [terms, selectedSession]
  );

  const filteredClassArms = useMemo(
    () => classArms.filter(a => selectedClass === "all" || a.class_id === selectedClass),
    [classArms, selectedClass]
  );

  useEffect(() => {
    const fetchOptions = async () => {
      const [sessionRes, termRes, classRes, classArmRes, subjectRes] = await Promise.all([
        supabase.from("academic_sessions").select("id, name").order("start_date", { ascending: false }),
        supabase.from("terms").select("id, name, session_id, session:academic_sessions(name)").order("start_date", { ascending: false }),
        supabase.from("classes").select("id, name").eq("is_active", true).order("level", { ascending: true }),
        supabase.from("class_arms").select("id, name, class_id, class:classes(name)").eq("is_active", true).order("name", { ascending: true }),
        supabase.from("subjects").select("id, name, code").eq("is_active", true).order("name", { ascending: true }),
      ]);
      setSessions((sessionRes.data as SessionOption[]) || []);
      setTerms((termRes.data as TermOption[]) || []);
      setClasses((classRes.data as ClassOption[]) || []);
      setClassArms((classArmRes.data as ClassArmOption[]) || []);
      setSubjects((subjectRes.data as SubjectOption[]) || []);
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("results")
          .select(`id, status, total_score, average_score, class_position, submitted_at, student_id, term_id, class_arm_id,
            student:students(first_name, last_name, admission_number),
            term:terms(name, session:academic_sessions(name)),
            class_arm:class_arms(name, class:classes(name)),
            components:result_components(total_score, grade, subject_id)`)
          .in("status", ["submitted", "approved", "published"])
          .order("submitted_at", { ascending: false });

        if (selectedTerm !== "all") query = query.eq("term_id", selectedTerm);
        if (selectedClassArm !== "all") {
          query = query.eq("class_arm_id", selectedClassArm);
        } else if (selectedClass !== "all") {
          const armIds = classArms.filter(a => a.class_id === selectedClass).map(a => a.id);
          query = armIds.length ? query.in("class_arm_id", armIds) : query.eq("class_arm_id", "00000000-0000-0000-0000-000000000000");
        }
        if (selectedSession !== "all" && selectedTerm === "all") {
          const termIds = terms.filter(t => t.session_id === selectedSession).map(t => t.id);
          query = termIds.length ? query.in("term_id", termIds) : query.eq("term_id", "00000000-0000-0000-0000-000000000000");
        }

        const { data, error } = await query;
        if (error) throw error;

        const normalized = ((data || []) as ResultRow[]).filter(row => {
          if (selectedSubject === "all") return true;
          return row.components?.some(c => c.subject_id === selectedSubject);
        });
        setResults(normalized);
      } catch (error: any) {
        toast({ title: "Error", description: error.message || "Failed to load broadsheet", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [selectedSession, selectedTerm, selectedClass, selectedClassArm, selectedSubject, terms, classArms, toast]);

  const broadsheetRows = useMemo<BroadsheetRow[]>(() => {
    return results.map(result => {
      const subjectScore = selectedSubject === "all"
        ? null
        : result.components?.find(c => c.subject_id === selectedSubject)?.total_score ?? null;
      return {
        student: `${result.student?.last_name || ""} ${result.student?.first_name || ""}`.trim(),
        admission_number: result.student?.admission_number || "-",
        class: result.class_arm?.class?.name || "-",
        class_arm: result.class_arm?.name || "-",
        term: result.term?.name || "-",
        session: result.term?.session?.name || "-",
        status: result.status,
        subject_score: subjectScore,
        total_score: result.total_score,
        average_score: result.average_score,
        class_position: result.class_position,
      };
    });
  }, [results, selectedSubject]);

  const cumulativeRows = useMemo<CumulativeRow[]>(() => {
    const grouped = new Map<string, { student: string; admission: string; className: string; terms: Set<string>; sessions: Set<string>; scores: number[] }>();
    for (const row of broadsheetRows) {
      const key = `${row.admission_number}-${row.class}-${row.class_arm}`;
      const value = selectedSubject === "all" ? row.average_score : row.subject_score;
      if (value === null || value === undefined) continue;
      const existing = grouped.get(key) || { student: row.student, admission: row.admission_number, className: `${row.class} - ${row.class_arm}`, terms: new Set<string>(), sessions: new Set<string>(), scores: [] };
      existing.terms.add(row.term);
      existing.sessions.add(row.session);
      existing.scores.push(Number(value));
      grouped.set(key, existing);
    }
    return Array.from(grouped.values()).map(entry => {
      const total = entry.scores.reduce((sum, s) => sum + s, 0);
      const avg = entry.scores.length ? total / entry.scores.length : 0;
      return {
        student: entry.student, admission_number: entry.admission, class: entry.className,
        terms_count: entry.terms.size, sessions_count: entry.sessions.size,
        average_score: Number(avg.toFixed(2)), best_score: Number(Math.max(...entry.scores).toFixed(2)),
        lowest_score: Number(Math.min(...entry.scores).toFixed(2)),
      };
    });
  }, [broadsheetRows, selectedSubject]);

  const exportExcel = (dataset: any[], sheetName: string, fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(dataset);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileName}-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportPdf = (headers: string[], body: (string | number)[][], fileName: string) => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(fileName.replace(/-/g, " ").toUpperCase(), 14, 14);
    autoTable(doc, { startY: 20, head: [headers], body, styles: { fontSize: 8 }, headStyles: { fillColor: [16, 185, 129] } });
    doc.save(`${fileName}-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const handleExport = async (type: "broadsheet" | "cumulative" | "crossterm", format: "excel" | "pdf") => {
    setExporting(true);
    try {
      if (type === "broadsheet") {
        if (format === "excel") {
          exportExcel(broadsheetRows, "Broadsheet", "broadsheet-report");
        } else {
          exportPdf(
            ["Student", "Adm No", "Class", "Arm", "Term", "Session", selectedSubject === "all" ? "Average" : "Subject Score", "Total", "Position", "Status"],
            broadsheetRows.map(r => [r.student, r.admission_number, r.class, r.class_arm, r.term, r.session, selectedSubject === "all" ? r.average_score ?? "-" : r.subject_score ?? "-", r.total_score ?? "-", r.class_position ?? "-", r.status]),
            "broadsheet-report"
          );
        }
      } else if (type === "cumulative") {
        if (format === "excel") {
          exportExcel(cumulativeRows, "Cumulative", "cumulative-results");
        } else {
          exportPdf(
            ["Student", "Adm No", "Class", "Terms", "Sessions", "Average", "Best", "Lowest"],
            cumulativeRows.map(r => [r.student, r.admission_number, r.class, r.terms_count, r.sessions_count, r.average_score, r.best_score, r.lowest_score]),
            "cumulative-results"
          );
        }
      } else {
        // Cross-term export
        const termSet = new Set<string>();
        const studentMap = new Map<string, Record<string, any>>();
        for (const row of broadsheetRows) {
          const termLabel = `${row.term}`;
          termSet.add(termLabel);
          const score = selectedSubject === "all" ? row.average_score : row.subject_score;
          if (score === null) continue;
          const key = row.admission_number;
          const existing = studentMap.get(key) || { Student: row.student, "Adm No": row.admission_number, Class: `${row.class} - ${row.class_arm}` };
          existing[termLabel] = score;
          studentMap.set(key, existing);
        }
        const crossData = Array.from(studentMap.values());
        if (format === "excel") {
          exportExcel(crossData, "Cross-Term", "cross-term-analysis");
        } else {
          const termsList = Array.from(termSet);
          exportPdf(
            ["Student", "Adm No", "Class", ...termsList],
            crossData.map(r => [r.Student, r["Adm No"], r.Class, ...termsList.map(t => r[t] ?? "-")]),
            "cross-term-analysis"
          );
        }
      }
      toast({ title: "Export complete", description: `Report downloaded successfully.` });
    } catch (error: any) {
      toast({ title: "Export failed", description: error.message || "Could not export", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Advanced Broadsheet & Reports</h1>
        <p className="text-muted-foreground">Cross-term analysis, cumulative results, and exportable reports for academic oversight.</p>
      </div>

      <BroadsheetFilters
        sessions={sessions} filteredTerms={filteredTerms} classes={classes}
        filteredClassArms={filteredClassArms} subjects={subjects}
        selectedSession={selectedSession} selectedTerm={selectedTerm}
        selectedClass={selectedClass} selectedClassArm={selectedClassArm}
        selectedSubject={selectedSubject}
        onSessionChange={(v) => { setSelectedSession(v); if (v !== "all") setSelectedTerm("all"); }}
        onTermChange={setSelectedTerm}
        onClassChange={(v) => { setSelectedClass(v); setSelectedClassArm("all"); }}
        onClassArmChange={setSelectedClassArm}
        onSubjectChange={setSelectedSubject}
      />

      <BroadsheetSummary rows={broadsheetRows} selectedSubject={selectedSubject} />

      <Tabs defaultValue="broadsheet" className="space-y-4">
        <TabsList>
          <TabsTrigger value="broadsheet">Broadsheet</TabsTrigger>
          <TabsTrigger value="crossterm">Cross-Term</TabsTrigger>
          <TabsTrigger value="cumulative">Cumulative</TabsTrigger>
        </TabsList>

        <TabsContent value="broadsheet">
          <BroadsheetTable
            rows={broadsheetRows} loading={loading} exporting={exporting}
            selectedSubject={selectedSubject}
            onExportExcel={() => handleExport("broadsheet", "excel")}
            onExportPdf={() => handleExport("broadsheet", "pdf")}
          />
        </TabsContent>

        <TabsContent value="crossterm">
          <CrossTermAnalysis
            rows={broadsheetRows} loading={loading} exporting={exporting}
            selectedSubject={selectedSubject}
            onExportExcel={() => handleExport("crossterm", "excel")}
            onExportPdf={() => handleExport("crossterm", "pdf")}
          />
        </TabsContent>

        <TabsContent value="cumulative">
          <CumulativeTable
            rows={cumulativeRows} loading={loading} exporting={exporting}
            onExportExcel={() => handleExport("cumulative", "excel")}
            onExportPdf={() => handleExport("cumulative", "pdf")}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
