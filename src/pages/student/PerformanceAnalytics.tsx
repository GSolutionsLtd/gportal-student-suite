import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  BarChart3,
  Clock,
  GitCompare,
  GraduationCap,
  Star,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
} from "recharts";

interface PerformanceData {
  term_name: string;
  session_name: string;
  average_score: number | null;
  class_position: number | null;
  total_score: number | null;
  term_type: string;
  term_id: string;
  result_id: string;
  class_arm_name: string;
  class_name: string;
  published_at: string | null;
}

interface SubjectPerformance {
  subject_name: string;
  subject_code: string;
  total_score: number;
  grade: string;
  test1_score: number;
  test2_score: number;
  exam_score: number;
}

interface TermSubjectData {
  term_name: string;
  term_id: string;
  subjects: SubjectPerformance[];
}

const GRADE_COLORS: Record<string, string> = {
  A: "hsl(var(--chart-1))",
  B: "hsl(var(--chart-2))",
  C: "hsl(var(--chart-3))",
  D: "hsl(var(--chart-4))",
  E: "hsl(var(--chart-5))",
  F: "hsl(var(--destructive))",
};

const GRADE_POINTS: Record<string, number> = {
  A: 5.0, B: 4.0, C: 3.0, D: 2.0, E: 1.0, F: 0.0,
};

export default function PerformanceAnalytics() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [termSubjectData, setTermSubjectData] = useState<TermSubjectData[]>([]);
  const [gradeDistribution, setGradeDistribution] = useState<{ name: string; value: number }[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("all");
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([]);
  const [studentInfo, setStudentInfo] = useState<{ id: string; name: string } | null>(null);
  const [compareTerm1, setCompareTerm1] = useState<string>("");
  const [compareTerm2, setCompareTerm2] = useState<string>("");

  useEffect(() => {
    if (user) fetchStudentData();
  }, [user]);

  useEffect(() => {
    if (studentInfo) fetchPerformanceData();
  }, [studentInfo, selectedSession]);

  const fetchStudentData = async () => {
    try {
      const { data: student } = await supabase
        .from("students")
        .select("id, first_name, last_name")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (student) {
        setStudentInfo({ id: student.id, name: `${student.first_name} ${student.last_name}` });
      }

      const { data: sessionsData } = await supabase
        .from("academic_sessions")
        .select("id, name")
        .order("start_date", { ascending: false });

      setSessions(sessionsData || []);
    } catch (error) {
      console.error("Error fetching student data:", error);
    }
  };

  const fetchPerformanceData = async () => {
    if (!studentInfo) return;
    try {
      setLoading(true);

      const { data: results, error } = await supabase
        .from("results")
        .select(`
          id, average_score, class_position, total_score, published_at,
          term:terms(id, name, term_type, session:academic_sessions(id, name)),
          class_arm:class_arms(name, class:classes(name))
        `)
        .eq("student_id", studentInfo.id)
        .eq("status", "published")
        .order("created_at", { ascending: true });

      if (error) throw error;

      const filteredResults = (results || []).filter((r: any) => {
        if (selectedSession === "all") return true;
        return r.term?.session?.id === selectedSession;
      });

      const performanceList: PerformanceData[] = filteredResults.map((r: any) => ({
        term_name: r.term?.name || "Unknown",
        session_name: r.term?.session?.name || "Unknown",
        average_score: r.average_score ? Number(r.average_score) : null,
        class_position: r.class_position,
        total_score: r.total_score ? Number(r.total_score) : null,
        term_type: r.term?.term_type || "unknown",
        term_id: r.term?.id || "",
        result_id: r.id,
        class_arm_name: r.class_arm?.name || "",
        class_name: r.class_arm?.class?.name || "",
        published_at: r.published_at,
      }));

      setPerformanceData(performanceList);

      // Fetch subject data for all results
      const allTermSubjects: TermSubjectData[] = [];
      for (const result of filteredResults) {
        const { data: components } = await supabase
          .from("result_components")
          .select(`total_score, grade, test1_score, test2_score, exam_score, subject:subjects(name, code)`)
          .eq("result_id", result.id);

        allTermSubjects.push({
          term_name: (result as any).term?.name || "Unknown",
          term_id: (result as any).term?.id || "",
          subjects: (components || []).map((c: any) => ({
            subject_name: c.subject?.name || "Unknown",
            subject_code: c.subject?.code || "N/A",
            total_score: Number(c.total_score) || 0,
            grade: c.grade || "N/A",
            test1_score: Number(c.test1_score) || 0,
            test2_score: Number(c.test2_score) || 0,
            exam_score: Number(c.exam_score) || 0,
          })),
        });
      }

      setTermSubjectData(allTermSubjects);

      // Set comparison defaults
      if (allTermSubjects.length >= 2) {
        setCompareTerm1(allTermSubjects[allTermSubjects.length - 2].term_id);
        setCompareTerm2(allTermSubjects[allTermSubjects.length - 1].term_id);
      } else if (allTermSubjects.length === 1) {
        setCompareTerm1(allTermSubjects[0].term_id);
        setCompareTerm2(allTermSubjects[0].term_id);
      }

      // Grade distribution from latest
      if (allTermSubjects.length > 0) {
        const latest = allTermSubjects[allTermSubjects.length - 1];
        const gradeCount: Record<string, number> = {};
        latest.subjects.forEach((s) => { gradeCount[s.grade] = (gradeCount[s.grade] || 0) + 1; });
        setGradeDistribution(Object.entries(gradeCount).map(([name, value]) => ({ name, value })));
      }
    } catch (error) {
      console.error("Error fetching performance data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Cumulative GPA calculation
  const getCumulativeGPAData = () => {
    let totalPoints = 0;
    let totalSubjects = 0;
    return termSubjectData.map((term) => {
      const termPoints = term.subjects.reduce((sum, s) => sum + (GRADE_POINTS[s.grade] || 0), 0);
      totalPoints += termPoints;
      totalSubjects += term.subjects.length;
      const termGPA = term.subjects.length > 0 ? termPoints / term.subjects.length : 0;
      const cumulativeGPA = totalSubjects > 0 ? totalPoints / totalSubjects : 0;
      return {
        term: term.term_name,
        termGPA: Number(termGPA.toFixed(2)),
        cumulativeGPA: Number(cumulativeGPA.toFixed(2)),
      };
    });
  };

  // Smart comparison data
  const getComparisonData = () => {
    const term1Data = termSubjectData.find((t) => t.term_id === compareTerm1);
    const term2Data = termSubjectData.find((t) => t.term_id === compareTerm2);
    if (!term1Data || !term2Data) return [];

    const allSubjects = new Set([
      ...term1Data.subjects.map((s) => s.subject_name),
      ...term2Data.subjects.map((s) => s.subject_name),
    ]);

    return Array.from(allSubjects).map((name) => {
      const s1 = term1Data.subjects.find((s) => s.subject_name === name);
      const s2 = term2Data.subjects.find((s) => s.subject_name === name);
      return {
        subject: name,
        [term1Data.term_name]: s1?.total_score || 0,
        [term2Data.term_name]: s2?.total_score || 0,
        change: (s2?.total_score || 0) - (s1?.total_score || 0),
      };
    });
  };

  // Radar chart for latest term
  const getRadarData = () => {
    if (termSubjectData.length === 0) return [];
    const latest = termSubjectData[termSubjectData.length - 1];
    return latest.subjects.map((s) => ({
      subject: s.subject_code,
      score: s.total_score,
      fullMark: 100,
    }));
  };

  const getTrendIcon = (data: PerformanceData[]) => {
    if (data.length < 2) return <Minus className="h-4 w-4 text-muted-foreground" />;
    const last = data[data.length - 1].average_score || 0;
    const prev = data[data.length - 2].average_score || 0;
    if (last > prev) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (last < prev) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getOverallAverage = () => {
    if (performanceData.length === 0) return "0.0";
    return (performanceData.reduce((s, p) => s + (p.average_score || 0), 0) / performanceData.length).toFixed(1);
  };

  const getCurrentGPA = () => {
    const gpaData = getCumulativeGPAData();
    if (gpaData.length === 0) return "0.00";
    return gpaData[gpaData.length - 1].cumulativeGPA.toFixed(2);
  };

  const getBestPosition = () => {
    const positions = performanceData.filter((p) => p.class_position).map((p) => p.class_position!);
    return positions.length === 0 ? "N/A" : Math.min(...positions).toString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const gpaData = getCumulativeGPAData();
  const comparisonData = getComparisonData();
  const radarData = getRadarData();
  const term1Data = termSubjectData.find((t) => t.term_id === compareTerm1);
  const term2Data = termSubjectData.find((t) => t.term_id === compareTerm2);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Student Experience Intelligence</h1>
          <p className="text-muted-foreground">
            Academic history, GPA tracking & result comparison
          </p>
        </div>
        <Select value={selectedSession} onValueChange={setSelectedSession}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select Session" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sessions</SelectItem>
            {sessions.map((session) => (
              <SelectItem key={session.id} value={session.id}>{session.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overall Average</CardTitle>
            {getTrendIcon(performanceData)}
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{getOverallAverage()}%</div>
            <p className="text-xs text-muted-foreground">Across {performanceData.length} term(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cumulative GPA</CardTitle>
            <GraduationCap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{getCurrentGPA()}</div>
            <p className="text-xs text-muted-foreground">On a 5.0 scale</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Best Position</CardTitle>
            <Award className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{getBestPosition()}</div>
            <p className="text-xs text-muted-foreground">Highest class ranking</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Terms Completed</CardTitle>
            <Star className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{performanceData.length}</div>
            <p className="text-xs text-muted-foreground">Published results</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="timeline" className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> Timeline
          </TabsTrigger>
          <TabsTrigger value="gpa" className="flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4" /> GPA
          </TabsTrigger>
          <TabsTrigger value="compare" className="flex items-center gap-1.5">
            <GitCompare className="h-4 w-4" /> Compare
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-1.5">
            <Target className="h-4 w-4" /> Insights
          </TabsTrigger>
        </TabsList>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-6">
          {/* Score Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Trend</CardTitle>
              <CardDescription>Average score across all terms</CardDescription>
            </CardHeader>
            <CardContent>
              {performanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={performanceData}>
                    <defs>
                      <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="term_name" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Area type="monotone" dataKey="average_score" name="Average" stroke="hsl(var(--primary))" fill="url(#scoreGradient)" strokeWidth={2} dot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data available</div>
              )}
            </CardContent>
          </Card>

          {/* Academic History Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Academic History</CardTitle>
              <CardDescription>Complete academic journey</CardDescription>
            </CardHeader>
            <CardContent>
              {performanceData.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No academic history available</p>
              ) : (
                <div className="relative pl-8 space-y-0">
                  <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border" />
                  {[...performanceData].reverse().map((item, index) => {
                    const prevItem = index < performanceData.length - 1 ? [...performanceData].reverse()[index + 1] : null;
                    const scoreDiff = prevItem && item.average_score && prevItem.average_score
                      ? item.average_score - prevItem.average_score : null;
                    return (
                      <div key={item.result_id} className="relative pb-8 last:pb-0">
                        <div className="absolute -left-5 top-1 w-4 h-4 rounded-full border-2 border-primary bg-background z-10" />
                        <div className="p-4 rounded-lg border border-border bg-card hover:shadow-sm transition-shadow">
                          <div className="flex items-start justify-between flex-wrap gap-2">
                            <div>
                              <p className="font-semibold text-foreground">{item.term_name}</p>
                              <p className="text-sm text-muted-foreground">{item.session_name}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {item.class_name} {item.class_arm_name}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-foreground">
                                {item.average_score?.toFixed(1) || "-"}%
                              </p>
                              <div className="flex items-center gap-1 justify-end">
                                {item.class_position && (
                                  <Badge variant="outline" className="text-xs">
                                    Pos: {item.class_position}
                                  </Badge>
                                )}
                                {scoreDiff !== null && (
                                  <Badge variant={scoreDiff >= 0 ? "default" : "destructive"} className="text-xs">
                                    {scoreDiff >= 0 ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                                    {Math.abs(scoreDiff).toFixed(1)}%
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Position Trend */}
          {performanceData.some((p) => p.class_position) && (
            <Card>
              <CardHeader>
                <CardTitle>Class Position Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={performanceData.filter((p) => p.class_position)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="term_name" tick={{ fontSize: 12 }} />
                    <YAxis reversed domain={[1, "auto"]} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Line type="monotone" dataKey="class_position" name="Position" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* GPA Tab */}
        <TabsContent value="gpa" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Current CGPA</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <div className="relative w-40 h-40">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--primary))" strokeWidth="8"
                      strokeDasharray={`${(Number(getCurrentGPA()) / 5) * 251.2} 251.2`}
                      strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-foreground">{getCurrentGPA()}</span>
                    <span className="text-xs text-muted-foreground">of 5.00</span>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    {Number(getCurrentGPA()) >= 4.5 ? "First Class" :
                     Number(getCurrentGPA()) >= 3.5 ? "Second Class Upper" :
                     Number(getCurrentGPA()) >= 2.5 ? "Second Class Lower" :
                     Number(getCurrentGPA()) >= 1.5 ? "Third Class" : "Below Average"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>GPA Progression</CardTitle>
                <CardDescription>Term GPA vs Cumulative GPA over time</CardDescription>
              </CardHeader>
              <CardContent>
                {gpaData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={gpaData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="term" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 5]} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Legend />
                      <Line type="monotone" dataKey="termGPA" name="Term GPA" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="cumulativeGPA" name="Cumulative GPA" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="5 5" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">No GPA data available</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* GPA Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle>GPA Breakdown by Term</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Term</th>
                      <th className="text-center py-3 px-4 font-medium text-muted-foreground">Subjects</th>
                      <th className="text-center py-3 px-4 font-medium text-muted-foreground">Term GPA</th>
                      <th className="text-center py-3 px-4 font-medium text-muted-foreground">Cumulative GPA</th>
                      <th className="text-center py-3 px-4 font-medium text-muted-foreground">Classification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gpaData.map((item, i) => (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-secondary/30">
                        <td className="py-3 px-4 font-medium text-foreground">{item.term}</td>
                        <td className="py-3 px-4 text-center text-muted-foreground">{termSubjectData[i]?.subjects.length || 0}</td>
                        <td className="py-3 px-4 text-center font-semibold text-foreground">{item.termGPA}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={item.cumulativeGPA >= 3.5 ? "default" : "secondary"}>{item.cumulativeGPA}</Badge>
                        </td>
                        <td className="py-3 px-4 text-center text-xs text-muted-foreground">
                          {item.cumulativeGPA >= 4.5 ? "First Class" :
                           item.cumulativeGPA >= 3.5 ? "2nd Upper" :
                           item.cumulativeGPA >= 2.5 ? "2nd Lower" :
                           item.cumulativeGPA >= 1.5 ? "Third Class" : "Below Avg"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compare Tab */}
        <TabsContent value="compare" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Smart Result Comparison</CardTitle>
              <CardDescription>Compare your performance across two terms side by side</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <Select value={compareTerm1} onValueChange={setCompareTerm1}>
                  <SelectTrigger><SelectValue placeholder="Select Term 1" /></SelectTrigger>
                  <SelectContent>
                    {termSubjectData.map((t) => (
                      <SelectItem key={t.term_id} value={t.term_id}>{t.term_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={compareTerm2} onValueChange={setCompareTerm2}>
                  <SelectTrigger><SelectValue placeholder="Select Term 2" /></SelectTrigger>
                  <SelectContent>
                    {termSubjectData.map((t) => (
                      <SelectItem key={t.term_id} value={t.term_id}>{t.term_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {comparisonData.length > 0 && term1Data && term2Data ? (
                <>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={comparisonData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis dataKey="subject" type="category" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Legend />
                      <Bar dataKey={term1Data.term_name} fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                      <Bar dataKey={term2Data.term_name} fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Change Summary */}
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {comparisonData.map((item) => (
                      <div key={item.subject} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                        <span className="text-sm font-medium text-foreground truncate mr-2">{item.subject}</span>
                        <Badge variant={item.change > 0 ? "default" : item.change < 0 ? "destructive" : "secondary"} className="shrink-0">
                          {item.change > 0 ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : item.change < 0 ? <ArrowDownRight className="h-3 w-3 mr-0.5" /> : null}
                          {item.change > 0 ? "+" : ""}{item.change}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">Select two terms to compare</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Subject Radar */}
            <Card>
              <CardHeader>
                <CardTitle>Subject Proficiency (Latest)</CardTitle>
              </CardHeader>
              <CardContent>
                {radarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis domain={[0, 100]} />
                      <Radar name="Score" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data</div>
                )}
              </CardContent>
            </Card>

            {/* Grade Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Grade Distribution (Latest)</CardTitle>
              </CardHeader>
              <CardContent>
                {gradeDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={gradeDistribution} cx="50%" cy="50%" labelLine={false}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={100} dataKey="value">
                        {gradeDistribution.map((entry, i) => (
                          <Cell key={i} fill={GRADE_COLORS[entry.name] || "hsl(var(--muted))"} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Strengths & Weaknesses */}
          {termSubjectData.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <TrendingUp className="h-5 w-5" /> Strongest Subjects
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {[...termSubjectData[termSubjectData.length - 1].subjects]
                    .sort((a, b) => b.total_score - a.total_score)
                    .slice(0, 5)
                    .map((s, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <span className="text-sm font-medium text-foreground">{s.subject_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{s.total_score}%</span>
                          <Badge variant="outline" className="text-xs">{s.grade}</Badge>
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-500">
                    <TrendingDown className="h-5 w-5" /> Areas for Improvement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {[...termSubjectData[termSubjectData.length - 1].subjects]
                    .sort((a, b) => a.total_score - b.total_score)
                    .slice(0, 5)
                    .map((s, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <span className="text-sm font-medium text-foreground">{s.subject_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{s.total_score}%</span>
                          <Badge variant="outline" className="text-xs">{s.grade}</Badge>
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
