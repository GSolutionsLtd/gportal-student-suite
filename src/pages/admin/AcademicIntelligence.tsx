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
import {
  Loader2, TrendingUp, TrendingDown, AlertTriangle, Brain,
  Target, BarChart3, Lightbulb, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ScatterChart, Scatter, ZAxis,
} from "recharts";

interface StudentTrend {
  student_id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  scores: { term: string; average: number }[];
  trend: "improving" | "declining" | "stable";
  currentAvg: number;
  previousAvg: number;
  changePercent: number;
  atRisk: boolean;
}

interface SubjectTrend {
  subject_id: string;
  name: string;
  code: string;
  avgScore: number;
  trend: "improving" | "declining" | "stable";
  passRate: number;
}

interface ClassTrend {
  class_arm_id: string;
  className: string;
  armName: string;
  avgScore: number;
  studentCount: number;
  atRiskCount: number;
}

interface Insight {
  type: "warning" | "success" | "info";
  title: string;
  description: string;
  icon: typeof AlertTriangle;
}

const AcademicIntelligence = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([]);
  const [selectedSession, setSelectedSession] = useState("");
  const [studentTrends, setStudentTrends] = useState<StudentTrend[]>([]);
  const [subjectTrends, setSubjectTrends] = useState<SubjectTrend[]>([]);
  const [classTrends, setClassTrends] = useState<ClassTrend[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    supabase.from("academic_sessions").select("id, name").order("start_date", { ascending: false })
      .then(({ data }) => { if (data) setSessions(data); });
  }, []);

  useEffect(() => {
    if (selectedSession) fetchIntelligence();
  }, [selectedSession]);

  const fetchIntelligence = async () => {
    setLoading(true);
    try {
      // Fetch all results with students and terms
      const { data: results, error } = await supabase.from("results").select(`
        id, average_score, total_score, class_position, status, student_id, class_arm_id,
        student:students!inner(id, first_name, last_name, admission_number),
        term:terms!inner(id, name, term_type, session_id, session:academic_sessions(name)),
        class_arm:class_arms!inner(id, name, class:classes(name))
      `).in("status", ["approved", "published"]);

      if (error) throw error;
      if (!results) return;

      // Filter to current and previous sessions for trends
      const sessionResults = results.filter((r: any) => r.term.session_id === selectedSession);

      // Build student trends
      const studentMap = new Map<string, any>();
      results.forEach((r: any) => {
        const key = r.student_id;
        if (!studentMap.has(key)) {
          studentMap.set(key, {
            student_id: r.student.id,
            first_name: r.student.first_name,
            last_name: r.student.last_name,
            admission_number: r.student.admission_number,
            scores: [],
          });
        }
        if (r.average_score != null) {
          studentMap.get(key).scores.push({
            term: r.term.name,
            average: r.average_score,
            session: r.term.session?.name,
            termType: r.term.term_type,
          });
        }
      });

      const trends: StudentTrend[] = [];
      studentMap.forEach((student) => {
        if (student.scores.length < 1) return;
        const sorted = student.scores.sort((a: any, b: any) => a.term.localeCompare(b.term));
        const current = sorted[sorted.length - 1].average;
        const previous = sorted.length > 1 ? sorted[sorted.length - 2].average : current;
        const change = previous ? ((current - previous) / previous) * 100 : 0;
        const trend = change > 5 ? "improving" : change < -5 ? "declining" : "stable";
        
        trends.push({
          ...student,
          trend,
          currentAvg: +current.toFixed(1),
          previousAvg: +previous.toFixed(1),
          changePercent: +change.toFixed(1),
          atRisk: current < 40,
        });
      });
      setStudentTrends(trends);

      // Build subject trends
      const { data: components } = await supabase.from("result_components").select(`
        total_score, subject:subjects!inner(id, name, code),
        result:results!inner(term:terms!inner(session_id))
      `);

      const subjectMap = new Map<string, { name: string; code: string; scores: number[] }>();
      (components || []).forEach((c: any) => {
        if (c.total_score == null) return;
        const key = c.subject.id;
        if (!subjectMap.has(key)) {
          subjectMap.set(key, { name: c.subject.name, code: c.subject.code, scores: [] });
        }
        subjectMap.get(key)!.scores.push(c.total_score);
      });

      const subjTrends: SubjectTrend[] = [];
      subjectMap.forEach((subj, id) => {
        const avg = subj.scores.reduce((a, b) => a + b, 0) / subj.scores.length;
        const passRate = (subj.scores.filter(s => s >= 40).length / subj.scores.length) * 100;
        subjTrends.push({
          subject_id: id, name: subj.name, code: subj.code,
          avgScore: +avg.toFixed(1), passRate: +passRate.toFixed(1),
          trend: avg >= 60 ? "improving" : avg < 40 ? "declining" : "stable",
        });
      });
      setSubjectTrends(subjTrends.sort((a, b) => b.avgScore - a.avgScore));

      // Build class trends
      const classMap = new Map<string, ClassTrend>();
      sessionResults.forEach((r: any) => {
        const key = r.class_arm_id;
        if (!classMap.has(key)) {
          classMap.set(key, {
            class_arm_id: r.class_arm.id,
            className: r.class_arm.class?.name || "",
            armName: r.class_arm.name,
            avgScore: 0, studentCount: 0, atRiskCount: 0,
          });
        }
        const entry = classMap.get(key)!;
        entry.studentCount++;
        if (r.average_score != null) {
          entry.avgScore = ((entry.avgScore * (entry.studentCount - 1)) + r.average_score) / entry.studentCount;
          if (r.average_score < 40) entry.atRiskCount++;
        }
      });
      setClassTrends(Array.from(classMap.values()).map(c => ({ ...c, avgScore: +c.avgScore.toFixed(1) })));

      // Generate insights
      const newInsights: Insight[] = [];
      const atRiskStudents = trends.filter(t => t.atRisk);
      const decliningStudents = trends.filter(t => t.trend === "declining");
      const improvingStudents = trends.filter(t => t.trend === "improving");
      const weakSubjects = subjTrends.filter(s => s.passRate < 50);

      if (atRiskStudents.length > 0) {
        newInsights.push({
          type: "warning", icon: AlertTriangle,
          title: `${atRiskStudents.length} At-Risk Students`,
          description: `${atRiskStudents.length} student(s) have averages below 40%. Immediate intervention recommended.`,
        });
      }
      if (decliningStudents.length > 0) {
        newInsights.push({
          type: "warning", icon: TrendingDown,
          title: `${decliningStudents.length} Declining Performance`,
          description: `${decliningStudents.length} student(s) show declining trends. Consider extra monitoring.`,
        });
      }
      if (improvingStudents.length > 0) {
        newInsights.push({
          type: "success", icon: TrendingUp,
          title: `${improvingStudents.length} Improving Students`,
          description: `${improvingStudents.length} student(s) show positive performance trends. Great progress!`,
        });
      }
      if (weakSubjects.length > 0) {
        newInsights.push({
          type: "warning", icon: Target,
          title: `${weakSubjects.length} Weak Subjects Detected`,
          description: `${weakSubjects.map(s => s.name).join(", ")} have pass rates below 50%.`,
        });
      }
      if (trends.length > 0) {
        const topPerformer = trends.reduce((a, b) => a.currentAvg > b.currentAvg ? a : b);
        newInsights.push({
          type: "info", icon: Lightbulb,
          title: "Top Performer",
          description: `${topPerformer.first_name} ${topPerformer.last_name} leads with ${topPerformer.currentAvg}% average.`,
        });
      }
      setInsights(newInsights);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Predictive data
  const predictiveData = useMemo(() => {
    return studentTrends.filter(s => s.scores.length >= 2).map(s => {
      const scores = s.scores.map((sc: any) => sc.average);
      const lastTwo = scores.slice(-2);
      const predicted = lastTwo.length === 2 ? lastTwo[1] + (lastTwo[1] - lastTwo[0]) * 0.5 : lastTwo[0];
      const clampedPrediction = Math.max(0, Math.min(100, predicted));
      return {
        name: `${s.first_name} ${s.last_name.charAt(0)}.`,
        current: s.currentAvg,
        predicted: +clampedPrediction.toFixed(1),
        atRisk: clampedPrediction < 40,
      };
    }).sort((a, b) => a.predicted - b.predicted).slice(0, 20);
  }, [studentTrends]);

  // Heatmap data for subjects
  const heatmapData = useMemo(() => {
    return subjectTrends.map(s => ({
      subject: s.code,
      fullName: s.name,
      score: s.avgScore,
      passRate: s.passRate,
      fill: s.avgScore >= 70 ? "hsl(160, 60%, 45%)" : s.avgScore >= 50 ? "hsl(45, 90%, 50%)" : "hsl(350, 70%, 55%)",
    }));
  }, [subjectTrends]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Brain className="h-8 w-8 text-primary" />
          Academic Intelligence
        </h1>
        <p className="text-muted-foreground">
          AI-powered trend detection, predictive analytics, and early warning system
        </p>
      </div>

      {/* Session Filter */}
      <Card>
        <CardContent className="pt-6">
          <Select value={selectedSession} onValueChange={setSelectedSession}>
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="Select Academic Session" />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : !selectedSession ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Select a session to view intelligence</CardContent></Card>
      ) : (
        <>
          {/* Insight Cards */}
          {insights.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {insights.map((insight, i) => (
                <Card key={i} className={
                  insight.type === "warning" ? "border-destructive/30 bg-destructive/5" :
                  insight.type === "success" ? "border-primary/30 bg-primary/5" :
                  "border-border"
                }>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <insight.icon className={`h-5 w-5 mt-0.5 ${
                        insight.type === "warning" ? "text-destructive" :
                        insight.type === "success" ? "text-primary" : "text-muted-foreground"
                      }`} />
                      <div>
                        <p className="font-semibold text-sm">{insight.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{insight.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Tabs defaultValue="trends" className="space-y-4">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="trends">Student Trends</TabsTrigger>
              <TabsTrigger value="subjects">Subject Analysis</TabsTrigger>
              <TabsTrigger value="classes">Class Overview</TabsTrigger>
              <TabsTrigger value="predictions">Predictive Analytics</TabsTrigger>
              <TabsTrigger value="earlywarning">Early Warning</TabsTrigger>
            </TabsList>

            {/* Student Trends */}
            <TabsContent value="trends">
              <Card>
                <CardHeader>
                  <CardTitle>Student Performance Trends</CardTitle>
                  <CardDescription>Track improvement, decline, and stability across terms</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <Card><CardContent className="pt-4 text-center">
                      <TrendingUp className="h-6 w-6 mx-auto text-primary mb-1" />
                      <p className="text-2xl font-bold">{studentTrends.filter(s => s.trend === "improving").length}</p>
                      <p className="text-xs text-muted-foreground">Improving</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-4 text-center">
                      <BarChart3 className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                      <p className="text-2xl font-bold">{studentTrends.filter(s => s.trend === "stable").length}</p>
                      <p className="text-xs text-muted-foreground">Stable</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-4 text-center">
                      <TrendingDown className="h-6 w-6 mx-auto text-destructive mb-1" />
                      <p className="text-2xl font-bold">{studentTrends.filter(s => s.trend === "declining").length}</p>
                      <p className="text-xs text-muted-foreground">Declining</p>
                    </CardContent></Card>
                  </div>
                  <div className="rounded-md border overflow-auto max-h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Admission No</TableHead>
                          <TableHead>Current Avg</TableHead>
                          <TableHead>Previous Avg</TableHead>
                          <TableHead>Change</TableHead>
                          <TableHead>Trend</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentTrends.sort((a, b) => a.changePercent - b.changePercent).map((s) => (
                          <TableRow key={s.student_id} className={s.atRisk ? "bg-destructive/5" : ""}>
                            <TableCell className="font-medium">{s.last_name} {s.first_name}</TableCell>
                            <TableCell className="font-mono text-sm">{s.admission_number}</TableCell>
                            <TableCell>{s.currentAvg}%</TableCell>
                            <TableCell>{s.previousAvg}%</TableCell>
                            <TableCell>
                              <span className={`flex items-center gap-1 ${s.changePercent > 0 ? "text-primary" : s.changePercent < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                                {s.changePercent > 0 ? <ArrowUpRight className="h-3 w-3" /> : s.changePercent < 0 ? <ArrowDownRight className="h-3 w-3" /> : null}
                                {s.changePercent > 0 ? "+" : ""}{s.changePercent}%
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={s.trend === "improving" ? "default" : s.trend === "declining" ? "destructive" : "secondary"}>
                                {s.trend}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Subject Analysis */}
            <TabsContent value="subjects">
              <Card>
                <CardHeader>
                  <CardTitle>Subject Performance Heatmap</CardTitle>
                  <CardDescription>Visual overview of subject strength and weakness</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
                    {heatmapData.map((s) => (
                      <div key={s.subject} className="rounded-lg p-3 text-center border" style={{ backgroundColor: `${s.fill}15`, borderColor: s.fill }}>
                        <p className="font-bold text-sm" style={{ color: s.fill }}>{s.subject}</p>
                        <p className="text-xl font-bold">{s.score}%</p>
                        <p className="text-xs text-muted-foreground">Pass: {s.passRate}%</p>
                      </div>
                    ))}
                  </div>
                  {subjectTrends.length > 0 && (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={subjectTrends.slice(0, 8).map(s => ({ subject: s.code, score: s.avgScore, passRate: s.passRate }))}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="subject" />
                          <PolarRadiusAxis domain={[0, 100]} />
                          <Radar name="Avg Score" dataKey="score" stroke="hsl(238, 66%, 55%)" fill="hsl(238, 66%, 55%)" fillOpacity={0.3} />
                          <Radar name="Pass Rate" dataKey="passRate" stroke="hsl(160, 60%, 45%)" fill="hsl(160, 60%, 45%)" fillOpacity={0.2} />
                          <Legend />
                          <Tooltip />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Class Overview */}
            <TabsContent value="classes">
              <Card>
                <CardHeader>
                  <CardTitle>Class-Level Performance</CardTitle>
                  <CardDescription>Performance overview by class arm</CardDescription>
                </CardHeader>
                <CardContent>
                  {classTrends.length > 0 ? (
                    <>
                      <div className="h-80 mb-6">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={classTrends}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="armName" />
                            <YAxis domain={[0, 100]} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="avgScore" name="Average Score" fill="hsl(238, 66%, 55%)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {classTrends.map((c) => (
                          <Card key={c.class_arm_id}>
                            <CardContent className="pt-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-semibold">{c.className} - {c.armName}</p>
                                  <p className="text-sm text-muted-foreground">{c.studentCount} students</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xl font-bold">{c.avgScore}%</p>
                                  {c.atRiskCount > 0 && (
                                    <Badge variant="destructive" className="text-xs">{c.atRiskCount} at risk</Badge>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No class data for this session</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Predictive Analytics */}
            <TabsContent value="predictions">
              <Card>
                <CardHeader>
                  <CardTitle>Predictive End-of-Term Outcomes</CardTitle>
                  <CardDescription>Based on continuous assessment patterns (Test 1, Test 2, Exam trends)</CardDescription>
                </CardHeader>
                <CardContent>
                  {predictiveData.length > 0 ? (
                    <>
                      <div className="h-80 mb-6">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={predictiveData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                            <YAxis domain={[0, 100]} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="current" name="Current Average" fill="hsl(238, 66%, 55%)" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="predicted" name="Predicted Score" fill="hsl(160, 60%, 45%)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="rounded-md border overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Student</TableHead>
                              <TableHead>Current</TableHead>
                              <TableHead>Predicted</TableHead>
                              <TableHead>Risk Level</TableHead>
                              <TableHead>Intervention</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {predictiveData.map((p) => (
                              <TableRow key={p.name} className={p.atRisk ? "bg-destructive/5" : ""}>
                                <TableCell className="font-medium">{p.name}</TableCell>
                                <TableCell>{p.current}%</TableCell>
                                <TableCell>{p.predicted}%</TableCell>
                                <TableCell>
                                  <Badge variant={p.atRisk ? "destructive" : p.predicted < 50 ? "secondary" : "default"}>
                                    {p.atRisk ? "High Risk" : p.predicted < 50 ? "Moderate" : "Low Risk"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {p.atRisk ? "Extra lessons, parent notification" :
                                   p.predicted < 50 ? "Monitor closely" : "Continue current approach"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Need at least 2 terms of data for predictions
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Early Warning */}
            <TabsContent value="earlywarning">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Early Warning Dashboard
                  </CardTitle>
                  <CardDescription>Students flagged for immediate academic intervention</CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const atRisk = studentTrends.filter(s => s.atRisk || s.trend === "declining");
                    if (atRisk.length === 0) return (
                      <div className="text-center py-8">
                        <Target className="h-12 w-12 mx-auto text-primary mb-3" />
                        <p className="font-semibold">No at-risk students detected!</p>
                        <p className="text-sm text-muted-foreground">All students are performing above the threshold.</p>
                      </div>
                    );
                    return (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <Card className="border-destructive/30 bg-destructive/5">
                            <CardContent className="pt-4 text-center">
                              <p className="text-3xl font-bold text-destructive">{atRisk.filter(s => s.atRisk).length}</p>
                              <p className="text-xs text-muted-foreground">Below 40% Average</p>
                            </CardContent>
                          </Card>
                          <Card className="border-border">
                            <CardContent className="pt-4 text-center">
                              <p className="text-3xl font-bold">{atRisk.filter(s => s.trend === "declining").length}</p>
                              <p className="text-xs text-muted-foreground">Declining Trend</p>
                            </CardContent>
                          </Card>
                        </div>
                        <div className="rounded-md border overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Student</TableHead>
                                <TableHead>Admission No</TableHead>
                                <TableHead>Average</TableHead>
                                <TableHead>Trend</TableHead>
                                <TableHead>Risk</TableHead>
                                <TableHead>Recommended Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {atRisk.sort((a, b) => a.currentAvg - b.currentAvg).map((s) => (
                                <TableRow key={s.student_id} className="bg-destructive/5">
                                  <TableCell className="font-medium">{s.last_name} {s.first_name}</TableCell>
                                  <TableCell className="font-mono text-sm">{s.admission_number}</TableCell>
                                  <TableCell>{s.currentAvg}%</TableCell>
                                  <TableCell>
                                    <Badge variant={s.trend === "declining" ? "destructive" : "secondary"}>{s.trend}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="destructive">
                                      {s.atRisk && s.trend === "declining" ? "Critical" : s.atRisk ? "High" : "Moderate"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {s.atRisk && s.trend === "declining"
                                      ? "Urgent: Schedule parent meeting, assign remedial classes"
                                      : s.atRisk
                                      ? "Extra lessons, weekly monitoring"
                                      : "Monitor performance, encourage study habits"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default AcademicIntelligence;
