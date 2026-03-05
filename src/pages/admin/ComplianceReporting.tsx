import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Download, FileSpreadsheet, FileText, Loader2, TrendingUp, TrendingDown, BarChart3, Users } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from "recharts";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const CHART_COLORS = [
  "hsl(238, 66%, 55%)", "hsl(160, 60%, 45%)", "hsl(30, 90%, 55%)",
  "hsl(350, 70%, 55%)", "hsl(200, 70%, 50%)", "hsl(270, 50%, 55%)",
];

interface SessionOption { id: string; name: string }
interface TermOption { id: string; name: string; session_id: string }
interface ClassOption { id: string; name: string }
interface ClassArmOption { id: string; name: string; class_id: string }

interface PerformanceRow {
  student_id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  gender: string | null;
  average_score: number | null;
  total_score: number | null;
  class_position: number | null;
  term_name: string;
  session_name: string;
}

const ComplianceReporting = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classArms, setClassArms] = useState<ClassArmOption[]>([]);
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedClassArm, setSelectedClassArm] = useState("");
  const [data, setData] = useState<PerformanceRow[]>([]);
  const [yoyData, setYoyData] = useState<any[]>([]);
  const [subjectDifficulty, setSubjectDifficulty] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [s, c] = await Promise.all([
        supabase.from("academic_sessions").select("id, name").order("start_date", { ascending: false }),
        supabase.from("classes").select("id, name").eq("is_active", true).order("level"),
      ]);
      if (s.data) setSessions(s.data);
      if (c.data) setClasses(c.data);
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedSession) return;
    supabase.from("terms").select("id, name, session_id").eq("session_id", selectedSession).order("term_type")
      .then(({ data }) => { if (data) setTerms(data); });
  }, [selectedSession]);

  useEffect(() => {
    if (!selectedClass) return;
    supabase.from("class_arms").select("id, name, class_id").eq("class_id", selectedClass).eq("is_active", true)
      .then(({ data }) => { if (data) setClassArms(data); });
  }, [selectedClass]);

  useEffect(() => {
    if (!selectedSession) return;
    fetchData();
  }, [selectedSession, selectedTerm, selectedClassArm]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch results with student data
      let query = supabase.from("results").select(`
        id, average_score, total_score, class_position, status,
        student:students!inner(id, first_name, last_name, admission_number, gender),
        term:terms!inner(id, name, session_id, session:academic_sessions(name)),
        class_arm:class_arms!inner(id, name, class_id)
      `).in("status", ["approved", "published"]);

      if (selectedTerm) {
        query = query.eq("term_id", selectedTerm);
      } else {
        query = query.eq("term.session_id", selectedSession);
      }
      if (selectedClassArm) {
        query = query.eq("class_arm_id", selectedClassArm);
      } else if (selectedClass) {
        query = query.eq("class_arm.class_id", selectedClass);
      }

      const { data: results, error } = await query;
      if (error) throw error;

      const rows: PerformanceRow[] = (results || []).map((r: any) => ({
        student_id: r.student.id,
        first_name: r.student.first_name,
        last_name: r.student.last_name,
        admission_number: r.student.admission_number,
        gender: r.student.gender,
        average_score: r.average_score,
        total_score: r.total_score,
        class_position: r.class_position,
        term_name: r.term.name,
        session_name: r.term.session?.name || "",
      }));
      setData(rows);

      // Year-on-year data
      const { data: allResults } = await supabase.from("results").select(`
        average_score, term:terms!inner(name, session:academic_sessions(name))
      `).in("status", ["approved", "published"]);

      if (allResults) {
        const sessionMap = new Map<string, { total: number; count: number }>();
        allResults.forEach((r: any) => {
          const sn = r.term?.session?.name || "Unknown";
          const entry = sessionMap.get(sn) || { total: 0, count: 0 };
          if (r.average_score != null) {
            entry.total += r.average_score;
            entry.count++;
          }
          sessionMap.set(sn, entry);
        });
        setYoyData(Array.from(sessionMap.entries()).map(([name, v]) => ({
          session: name,
          averageScore: v.count ? +(v.total / v.count).toFixed(1) : 0,
          studentCount: v.count,
        })));
      }

      // Subject difficulty
      const { data: components } = await supabase.from("result_components").select(`
        total_score, subject:subjects!inner(id, name, code)
      `);

      if (components) {
        const subjectMap = new Map<string, { name: string; code: string; scores: number[] }>();
        components.forEach((c: any) => {
          if (c.total_score == null) return;
          const key = c.subject.id;
          const entry = subjectMap.get(key) || { name: c.subject.name, code: c.subject.code, scores: [] };
          entry.scores.push(c.total_score);
          subjectMap.set(key, entry);
        });
        const difficulty = Array.from(subjectMap.values()).map((s) => {
          const avg = s.scores.reduce((a, b) => a + b, 0) / s.scores.length;
          const passRate = (s.scores.filter((sc) => sc >= 40).length / s.scores.length) * 100;
          const failRate = 100 - passRate;
          return {
            subject: s.code,
            subjectName: s.name,
            averageScore: +avg.toFixed(1),
            passRate: +passRate.toFixed(1),
            failRate: +failRate.toFixed(1),
            difficultyIndex: +(100 - avg).toFixed(1),
            totalStudents: s.scores.length,
          };
        }).sort((a, b) => b.difficultyIndex - a.difficultyIndex);
        setSubjectDifficulty(difficulty);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Gender analytics
  const genderStats = useMemo(() => {
    const male = data.filter((d) => d.gender?.toLowerCase() === "male");
    const female = data.filter((d) => d.gender?.toLowerCase() === "female");
    const avgM = male.length ? +(male.reduce((s, d) => s + (d.average_score || 0), 0) / male.length).toFixed(1) : 0;
    const avgF = female.length ? +(female.reduce((s, d) => s + (d.average_score || 0), 0) / female.length).toFixed(1) : 0;
    return [
      { gender: "Male", count: male.length, averageScore: avgM },
      { gender: "Female", count: female.length, averageScore: avgF },
    ];
  }, [data]);

  // WAEC/NECO grading
  const waecGrading = (score: number | null): { grade: string; remark: string } => {
    if (score == null) return { grade: "-", remark: "-" };
    if (score >= 75) return { grade: "A1", remark: "Excellent" };
    if (score >= 70) return { grade: "B2", remark: "Very Good" };
    if (score >= 65) return { grade: "B3", remark: "Good" };
    if (score >= 60) return { grade: "C4", remark: "Credit" };
    if (score >= 55) return { grade: "C5", remark: "Credit" };
    if (score >= 50) return { grade: "C6", remark: "Credit" };
    if (score >= 45) return { grade: "D7", remark: "Pass" };
    if (score >= 40) return { grade: "E8", remark: "Pass" };
    return { grade: "F9", remark: "Fail" };
  };

  const gradeDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    data.forEach((d) => {
      const { grade } = waecGrading(d.average_score);
      dist[grade] = (dist[grade] || 0) + 1;
    });
    return Object.entries(dist).map(([grade, count]) => ({ grade, count })).sort((a, b) => a.grade.localeCompare(b.grade));
  }, [data]);

  const exportPDF = (title: string, headers: string[], rows: string[][]) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);
    autoTable(doc, { head: [headers], body: rows, startY: 35 });
    doc.save(`${title.replace(/\s+/g, "_")}.pdf`);
  };

  const exportExcel = (title: string, headers: string[], rows: string[][]) => {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${title.replace(/\s+/g, "_")}.xlsx`);
  };

  const exportMinistryReport = (format: "pdf" | "excel") => {
    const headers = ["S/N", "Admission No", "Name", "Gender", "Average", "WAEC Grade", "Position", "Remark"];
    const rows = data.sort((a, b) => (a.class_position || 999) - (b.class_position || 999)).map((d, i) => {
      const { grade, remark } = waecGrading(d.average_score);
      return [
        String(i + 1), d.admission_number, `${d.last_name} ${d.first_name}`,
        d.gender || "-", d.average_score?.toFixed(1) || "-", grade, String(d.class_position || "-"), remark,
      ];
    });
    const title = "Ministry_of_Education_Report";
    if (format === "pdf") exportPDF(title, headers, rows);
    else exportExcel(title, headers, rows);
  };

  const exportSubjectDifficultyReport = (format: "pdf" | "excel") => {
    const headers = ["Subject", "Code", "Avg Score", "Pass Rate %", "Fail Rate %", "Difficulty Index", "Students"];
    const rows = subjectDifficulty.map((s) => [
      s.subjectName, s.subject, String(s.averageScore), String(s.passRate),
      String(s.failRate), String(s.difficultyIndex), String(s.totalStudents),
    ]);
    const title = "Subject_Difficulty_Report";
    if (format === "pdf") exportPDF(title, headers, rows);
    else exportExcel(title, headers, rows);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Compliance & Reporting</h1>
        <p className="text-muted-foreground">
          Ministry-ready reports, WAEC/NECO grading views, and institutional analytics
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select value={selectedSession} onValueChange={setSelectedSession}>
              <SelectTrigger><SelectValue placeholder="Select Session" /></SelectTrigger>
              <SelectContent>
                {sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedTerm} onValueChange={setSelectedTerm}>
              <SelectTrigger><SelectValue placeholder="All Terms" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Terms</SelectItem>
                {terms.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedClassArm(""); }}>
              <SelectTrigger><SelectValue placeholder="All Classes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedClassArm} onValueChange={setSelectedClassArm}>
              <SelectTrigger><SelectValue placeholder="All Arms" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Arms</SelectItem>
                {classArms.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : !selectedSession ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Select a session to view reports</CardContent></Card>
      ) : (
        <Tabs defaultValue="ministry" className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="ministry">Ministry Reports</TabsTrigger>
            <TabsTrigger value="waec">WAEC/NECO Grading</TabsTrigger>
            <TabsTrigger value="yoy">Year-on-Year Trends</TabsTrigger>
            <TabsTrigger value="gender">Gender Analytics</TabsTrigger>
            <TabsTrigger value="difficulty">Subject Difficulty</TabsTrigger>
          </TabsList>

          {/* Ministry Reports Tab */}
          <TabsContent value="ministry">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Ministry of Education Report</CardTitle>
                  <CardDescription>Inspection-ready student performance summary</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => exportMinistryReport("excel")}>
                    <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportMinistryReport("pdf")}>
                    <FileText className="h-4 w-4 mr-1" /> PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <Card><CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold">{data.length}</p>
                    <p className="text-xs text-muted-foreground">Total Students</p>
                  </CardContent></Card>
                  <Card><CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold">{data.filter(d => (d.average_score || 0) >= 50).length}</p>
                    <p className="text-xs text-muted-foreground">Pass (≥50%)</p>
                  </CardContent></Card>
                  <Card><CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold">{data.filter(d => (d.average_score || 0) < 50).length}</p>
                    <p className="text-xs text-muted-foreground">Below Average</p>
                  </CardContent></Card>
                  <Card><CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold">
                      {data.length ? (data.reduce((s, d) => s + (d.average_score || 0), 0) / data.length).toFixed(1) : "0"}%
                    </p>
                    <p className="text-xs text-muted-foreground">School Average</p>
                  </CardContent></Card>
                </div>
                <div className="rounded-md border overflow-auto max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>S/N</TableHead>
                        <TableHead>Admission No</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Gender</TableHead>
                        <TableHead>Average</TableHead>
                        <TableHead>WAEC Grade</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Remark</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.sort((a, b) => (a.class_position || 999) - (b.class_position || 999)).map((d, i) => {
                        const { grade, remark } = waecGrading(d.average_score);
                        return (
                          <TableRow key={d.student_id + d.term_name}>
                            <TableCell>{i + 1}</TableCell>
                            <TableCell className="font-mono">{d.admission_number}</TableCell>
                            <TableCell>{d.last_name} {d.first_name}</TableCell>
                            <TableCell>{d.gender || "-"}</TableCell>
                            <TableCell>{d.average_score?.toFixed(1) || "-"}</TableCell>
                            <TableCell><Badge variant={(d.average_score || 0) >= 50 ? "default" : "destructive"}>{grade}</Badge></TableCell>
                            <TableCell>{d.class_position || "-"}</TableCell>
                            <TableCell>{remark}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* WAEC/NECO Grading Tab */}
          <TabsContent value="waec">
            <Card>
              <CardHeader>
                <CardTitle>WAEC/NECO Grade Distribution</CardTitle>
                <CardDescription>Performance mapped to national examination grading scale</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={gradeDistribution}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="grade" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(238, 66%, 55%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Grade</TableHead>
                          <TableHead>Score Range</TableHead>
                          <TableHead>Count</TableHead>
                          <TableHead>Remark</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[
                          { grade: "A1", range: "75-100", remark: "Excellent" },
                          { grade: "B2", range: "70-74", remark: "Very Good" },
                          { grade: "B3", range: "65-69", remark: "Good" },
                          { grade: "C4", range: "60-64", remark: "Credit" },
                          { grade: "C5", range: "55-59", remark: "Credit" },
                          { grade: "C6", range: "50-54", remark: "Credit" },
                          { grade: "D7", range: "45-49", remark: "Pass" },
                          { grade: "E8", range: "40-44", remark: "Pass" },
                          { grade: "F9", range: "0-39", remark: "Fail" },
                        ].map((g) => (
                          <TableRow key={g.grade}>
                            <TableCell><Badge variant="outline">{g.grade}</Badge></TableCell>
                            <TableCell>{g.range}</TableCell>
                            <TableCell>{gradeDistribution.find((d) => d.grade === g.grade)?.count || 0}</TableCell>
                            <TableCell>{g.remark}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Year-on-Year Trends Tab */}
          <TabsContent value="yoy">
            <Card>
              <CardHeader>
                <CardTitle>Year-on-Year Performance Trends</CardTitle>
                <CardDescription>Institutional performance across academic sessions</CardDescription>
              </CardHeader>
              <CardContent>
                {yoyData.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={yoyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="session" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="averageScore" name="Average Score" stroke="hsl(238, 66%, 55%)" strokeWidth={2} dot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No multi-session data available yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Gender Analytics Tab */}
          <TabsContent value="gender">
            <Card>
              <CardHeader>
                <CardTitle>Gender-Based Academic Insights</CardTitle>
                <CardDescription>Performance analysis by gender</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={genderStats} dataKey="count" nameKey="gender" cx="50%" cy="50%" outerRadius={100} label={({ gender, count }) => `${gender}: ${count}`}>
                          {genderStats.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-4">
                    {genderStats.map((g) => (
                      <Card key={g.gender}>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Users className="h-8 w-8 text-primary" />
                              <div>
                                <p className="font-semibold">{g.gender}</p>
                                <p className="text-sm text-muted-foreground">{g.count} students</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold">{g.averageScore}%</p>
                              <p className="text-xs text-muted-foreground">Average Score</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subject Difficulty Tab */}
          <TabsContent value="difficulty">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Subject Difficulty Index</CardTitle>
                  <CardDescription>Subjects ranked by difficulty (higher index = harder subject)</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => exportSubjectDifficultyReport("excel")}>
                    <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportSubjectDifficultyReport("pdf")}>
                    <FileText className="h-4 w-4 mr-1" /> PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-80 mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subjectDifficulty} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis dataKey="subject" type="category" width={60} />
                      <Tooltip formatter={(value: number, name: string) => [
                        name === "passRate" ? `${value}%` : name === "difficultyIndex" ? value : `${value}%`,
                        name === "passRate" ? "Pass Rate" : name === "difficultyIndex" ? "Difficulty" : "Avg Score",
                      ]} />
                      <Legend />
                      <Bar dataKey="passRate" name="Pass Rate %" fill="hsl(160, 60%, 45%)" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="difficultyIndex" name="Difficulty Index" fill="hsl(350, 70%, 55%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead>Avg Score</TableHead>
                        <TableHead>Pass Rate</TableHead>
                        <TableHead>Fail Rate</TableHead>
                        <TableHead>Difficulty Index</TableHead>
                        <TableHead>Students</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subjectDifficulty.map((s) => (
                        <TableRow key={s.subject}>
                          <TableCell className="font-medium">{s.subjectName}</TableCell>
                          <TableCell>{s.averageScore}%</TableCell>
                          <TableCell>
                            <Badge variant={s.passRate >= 60 ? "default" : "destructive"}>{s.passRate}%</Badge>
                          </TableCell>
                          <TableCell>{s.failRate}%</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {s.difficultyIndex > 60 ? <TrendingUp className="h-4 w-4 text-destructive" /> : <TrendingDown className="h-4 w-4 text-primary" />}
                              {s.difficultyIndex}
                            </div>
                          </TableCell>
                          <TableCell>{s.totalStudents}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default ComplianceReporting;
