import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

interface BroadsheetRow {
  student: string;
  admission_number: string;
  class: string;
  class_arm: string;
  term: string;
  session: string;
  status: string;
  subject_score: number | null;
  total_score: number | null;
  average_score: number | null;
  class_position: number | null;
}

interface CumulativeRow {
  student: string;
  admission_number: string;
  class: string;
  terms_count: number;
  sessions_count: number;
  average_score: number;
  best_score: number;
  lowest_score: number;
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

  const [selectedSession, setSelectedSession] = useState<string>("all");
  const [selectedTerm, setSelectedTerm] = useState<string>("all");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [selectedClassArm, setSelectedClassArm] = useState<string>("all");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");

  const [results, setResults] = useState<ResultRow[]>([]);

  const filteredTerms = useMemo(
    () => terms.filter((term) => selectedSession === "all" || term.session_id === selectedSession),
    [terms, selectedSession]
  );

  const filteredClassArms = useMemo(
    () => classArms.filter((arm) => selectedClass === "all" || arm.class_id === selectedClass),
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
          .select(`
            id,
            status,
            total_score,
            average_score,
            class_position,
            submitted_at,
            student_id,
            term_id,
            class_arm_id,
            student:students(first_name, last_name, admission_number),
            term:terms(name, session:academic_sessions(name)),
            class_arm:class_arms(name, class:classes(name)),
            components:result_components(total_score, grade, subject_id)
          `)
          .in("status", ["submitted", "approved", "published"])
          .order("submitted_at", { ascending: false });

        if (selectedTerm !== "all") query = query.eq("term_id", selectedTerm);

        if (selectedClassArm !== "all") {
          query = query.eq("class_arm_id", selectedClassArm);
        } else if (selectedClass !== "all") {
          const armIds = classArms.filter((arm) => arm.class_id === selectedClass).map((arm) => arm.id);
          query = armIds.length ? query.in("class_arm_id", armIds) : query.eq("class_arm_id", "00000000-0000-0000-0000-000000000000");
        }

        if (selectedSession !== "all" && selectedTerm === "all") {
          const termIds = terms.filter((term) => term.session_id === selectedSession).map((term) => term.id);
          query = termIds.length ? query.in("term_id", termIds) : query.eq("term_id", "00000000-0000-0000-0000-000000000000");
        }

        const { data, error } = await query;
        if (error) throw error;

        const normalized = ((data || []) as ResultRow[]).filter((row) => {
          if (selectedSubject === "all") return true;
          return row.components?.some((component) => component.subject_id === selectedSubject);
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
    return results.map((result) => {
      const subjectScore =
        selectedSubject === "all"
          ? null
          : result.components?.find((component) => component.subject_id === selectedSubject)?.total_score ?? null;

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

      const existing = grouped.get(key) || {
        student: row.student,
        admission: row.admission_number,
        className: `${row.class} - ${row.class_arm}`,
        terms: new Set<string>(),
        sessions: new Set<string>(),
        scores: [],
      };

      existing.terms.add(row.term);
      existing.sessions.add(row.session);
      existing.scores.push(Number(value));
      grouped.set(key, existing);
    }

    return Array.from(grouped.values()).map((entry) => {
      const total = entry.scores.reduce((sum, score) => sum + score, 0);
      const average = entry.scores.length ? total / entry.scores.length : 0;

      return {
        student: entry.student,
        admission_number: entry.admission,
        class: entry.className,
        terms_count: entry.terms.size,
        sessions_count: entry.sessions.size,
        average_score: Number(average.toFixed(2)),
        best_score: Number(Math.max(...entry.scores).toFixed(2)),
        lowest_score: Number(Math.min(...entry.scores).toFixed(2)),
      };
    });
  }, [broadsheetRows, selectedSubject]);

  const exportExcel = (dataset: BroadsheetRow[] | CumulativeRow[], sheetName: string, fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(dataset);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileName}-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportPdf = (headers: string[], body: (string | number)[][], fileName: string) => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(fileName.replace(/-/g, " ").toUpperCase(), 14, 14);

    autoTable(doc, {
      startY: 20,
      head: [headers],
      body,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 185, 129] },
    });

    doc.save(`${fileName}-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const handleExport = async (type: "broadsheet" | "cumulative", format: "excel" | "pdf") => {
    setExporting(true);
    try {
      if (type === "broadsheet") {
        if (format === "excel") {
          exportExcel(broadsheetRows, "Broadsheet", "broadsheet-report");
        } else {
          exportPdf(
            ["Student", "Admission No", "Class", "Class Arm", "Term", "Session", selectedSubject === "all" ? "Average" : "Subject Score", "Total", "Position", "Status"],
            broadsheetRows.map((row) => [
              row.student,
              row.admission_number,
              row.class,
              row.class_arm,
              row.term,
              row.session,
              selectedSubject === "all" ? row.average_score ?? "-" : row.subject_score ?? "-",
              row.total_score ?? "-",
              row.class_position ?? "-",
              row.status,
            ]),
            "broadsheet-report"
          );
        }
      } else {
        if (format === "excel") {
          exportExcel(cumulativeRows, "Cumulative", "cumulative-results");
        } else {
          exportPdf(
            ["Student", "Admission No", "Class", "Terms", "Sessions", "Average", "Best", "Lowest"],
            cumulativeRows.map((row) => [
              row.student,
              row.admission_number,
              row.class,
              row.terms_count,
              row.sessions_count,
              row.average_score,
              row.best_score,
              row.lowest_score,
            ]),
            "cumulative-results"
          );
        }
      }

      toast({ title: "Export complete", description: `${type === "broadsheet" ? "Broadsheet" : "Cumulative result"} ${format.toUpperCase()} downloaded.` });
    } catch (error: any) {
      toast({ title: "Export failed", description: error.message || "Could not export report", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Broadsheet & Cumulative Results</h1>
        <p className="text-muted-foreground">Filter by subject, class, class arm, term, and session to analyze and export result summaries.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Select value={selectedSession} onValueChange={(value) => { setSelectedSession(value); if (value !== "all") setSelectedTerm("all"); }}>
              <SelectTrigger><SelectValue placeholder="Session" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sessions</SelectItem>
                {sessions.map((session) => <SelectItem key={session.id} value={session.id}>{session.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedTerm} onValueChange={setSelectedTerm}>
              <SelectTrigger><SelectValue placeholder="Term" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Terms</SelectItem>
                {filteredTerms.map((term) => <SelectItem key={term.id} value={term.id}>{term.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedClass} onValueChange={(value) => { setSelectedClass(value); setSelectedClassArm("all"); }}>
              <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((cls) => <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedClassArm} onValueChange={setSelectedClassArm}>
              <SelectTrigger><SelectValue placeholder="Class Arm" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Class Arms</SelectItem>
                {filteredClassArms.map((arm) => <SelectItem key={arm.id} value={arm.id}>{arm.class?.name} - {arm.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name} ({subject.code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="broadsheet" className="space-y-4">
        <TabsList>
          <TabsTrigger value="broadsheet">Broadsheet</TabsTrigger>
          <TabsTrigger value="cumulative">Cumulative</TabsTrigger>
        </TabsList>

        <TabsContent value="broadsheet" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => handleExport("broadsheet", "excel")} disabled={exporting || loading}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Download Excel
            </Button>
            <Button variant="outline" onClick={() => handleExport("broadsheet", "pdf")} disabled={exporting || loading}>
              <FileText className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="h-48 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Admission No</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Class Arm</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Session</TableHead>
                      <TableHead>{selectedSubject === "all" ? "Average" : "Subject Score"}</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {broadsheetRows.map((row, index) => (
                      <TableRow key={`${row.admission_number}-${index}`}>
                        <TableCell>{row.student}</TableCell>
                        <TableCell>{row.admission_number}</TableCell>
                        <TableCell>{row.class}</TableCell>
                        <TableCell>{row.class_arm}</TableCell>
                        <TableCell>{row.term}</TableCell>
                        <TableCell>{row.session}</TableCell>
                        <TableCell>{selectedSubject === "all" ? (row.average_score ?? "-") : (row.subject_score ?? "-")}</TableCell>
                        <TableCell>{row.total_score ?? "-"}</TableCell>
                        <TableCell>{row.class_position ?? "-"}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{row.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cumulative" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => handleExport("cumulative", "excel")} disabled={exporting || loading}>
              <Download className="h-4 w-4 mr-2" />
              Download Excel
            </Button>
            <Button variant="outline" onClick={() => handleExport("cumulative", "pdf")} disabled={exporting || loading}>
              <FileText className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="h-48 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Admission No</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Terms Covered</TableHead>
                      <TableHead>Sessions Covered</TableHead>
                      <TableHead>Cumulative Avg</TableHead>
                      <TableHead>Best Score</TableHead>
                      <TableHead>Lowest Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cumulativeRows.map((row, index) => (
                      <TableRow key={`${row.admission_number}-${index}`}>
                        <TableCell>{row.student}</TableCell>
                        <TableCell>{row.admission_number}</TableCell>
                        <TableCell>{row.class}</TableCell>
                        <TableCell>{row.terms_count}</TableCell>
                        <TableCell>{row.sessions_count}</TableCell>
                        <TableCell>{row.average_score}</TableCell>
                        <TableCell>{row.best_score}</TableCell>
                        <TableCell>{row.lowest_score}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
