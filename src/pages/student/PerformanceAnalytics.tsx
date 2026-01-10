import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, TrendingUp, TrendingDown, Minus, Award, BarChart3 } from "lucide-react";
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
} from "recharts";

interface PerformanceData {
  term_name: string;
  session_name: string;
  average_score: number | null;
  class_position: number | null;
  total_score: number | null;
  term_type: string;
}

interface SubjectPerformance {
  subject_name: string;
  subject_code: string;
  total_score: number;
  grade: string;
}

const GRADE_COLORS: Record<string, string> = {
  A: "hsl(var(--chart-1))",
  B: "hsl(var(--chart-2))",
  C: "hsl(var(--chart-3))",
  D: "hsl(var(--chart-4))",
  E: "hsl(var(--chart-5))",
  F: "hsl(var(--destructive))",
};

export default function PerformanceAnalytics() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [subjectPerformance, setSubjectPerformance] = useState<SubjectPerformance[]>([]);
  const [gradeDistribution, setGradeDistribution] = useState<{ name: string; value: number }[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("all");
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([]);
  const [studentInfo, setStudentInfo] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (user) {
      fetchStudentData();
    }
  }, [user]);

  useEffect(() => {
    if (studentInfo) {
      fetchPerformanceData();
    }
  }, [studentInfo, selectedSession]);

  const fetchStudentData = async () => {
    try {
      // Get student info
      const { data: student, error } = await supabase
        .from("students")
        .select("id, first_name, last_name")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (error) throw error;
      if (student) {
        setStudentInfo({
          id: student.id,
          name: `${student.first_name} ${student.last_name}`,
        });
      }

      // Fetch sessions
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

      // Fetch results with term info
      let query = supabase
        .from("results")
        .select(`
          id,
          average_score,
          class_position,
          total_score,
          term:terms(
            name,
            term_type,
            session:academic_sessions(id, name)
          )
        `)
        .eq("student_id", studentInfo.id)
        .eq("status", "published")
        .order("created_at", { ascending: true });

      const { data: results, error } = await query;

      if (error) throw error;

      // Filter by session if selected
      const filteredResults = (results || []).filter((r: any) => {
        if (selectedSession === "all") return true;
        return r.term?.session?.id === selectedSession;
      });

      const performanceList: PerformanceData[] = filteredResults.map((r: any) => ({
        term_name: r.term?.name || "Unknown",
        session_name: r.term?.session?.name || "Unknown",
        average_score: r.average_score,
        class_position: r.class_position,
        total_score: r.total_score,
        term_type: r.term?.term_type || "unknown",
      }));

      setPerformanceData(performanceList);

      // Fetch subject performance for the latest result
      if (filteredResults.length > 0) {
        const latestResult = filteredResults[filteredResults.length - 1];
        const { data: components } = await supabase
          .from("result_components")
          .select(`
            total_score,
            grade,
            subject:subjects(name, code)
          `)
          .eq("result_id", latestResult.id);

        const subjectData: SubjectPerformance[] = (components || []).map((c: any) => ({
          subject_name: c.subject?.name || "Unknown",
          subject_code: c.subject?.code || "N/A",
          total_score: c.total_score || 0,
          grade: c.grade || "N/A",
        }));

        setSubjectPerformance(subjectData);

        // Calculate grade distribution
        const gradeCount: Record<string, number> = {};
        subjectData.forEach((s) => {
          gradeCount[s.grade] = (gradeCount[s.grade] || 0) + 1;
        });

        setGradeDistribution(
          Object.entries(gradeCount).map(([name, value]) => ({ name, value }))
        );
      }
    } catch (error) {
      console.error("Error fetching performance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (data: PerformanceData[]) => {
    if (data.length < 2) return <Minus className="h-4 w-4 text-muted-foreground" />;
    const last = data[data.length - 1].average_score || 0;
    const prev = data[data.length - 2].average_score || 0;
    if (last > prev) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (last < prev) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getAverageScore = () => {
    if (performanceData.length === 0) return 0;
    const sum = performanceData.reduce((acc, p) => acc + (p.average_score || 0), 0);
    return (sum / performanceData.length).toFixed(1);
  };

  const getBestPosition = () => {
    const positions = performanceData.filter((p) => p.class_position).map((p) => p.class_position!);
    if (positions.length === 0) return "N/A";
    return Math.min(...positions);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Performance Analytics</h1>
          <p className="text-muted-foreground">
            Track your academic progress across terms
          </p>
        </div>
        <Select value={selectedSession} onValueChange={setSelectedSession}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select Session" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sessions</SelectItem>
            {sessions.map((session) => (
              <SelectItem key={session.id} value={session.id}>
                {session.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overall Average
            </CardTitle>
            {getTrendIcon(performanceData)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getAverageScore()}%</div>
            <p className="text-xs text-muted-foreground">
              Across {performanceData.length} term(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Best Position
            </CardTitle>
            <Award className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getBestPosition()}</div>
            <p className="text-xs text-muted-foreground">
              Highest class ranking
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Latest Score
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {performanceData.length > 0
                ? `${performanceData[performanceData.length - 1].average_score?.toFixed(1) || 0}%`
                : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {performanceData.length > 0
                ? performanceData[performanceData.length - 1].term_name
                : "No results yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Subjects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subjectPerformance.length}</div>
            <p className="text-xs text-muted-foreground">
              Total subjects taken
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Performance Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {performanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="term_name"
                    tick={{ fontSize: 12 }}
                    interval={0}
                  />
                  <YAxis domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="average_score"
                    name="Average Score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No performance data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grade Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Grade Distribution (Latest Term)</CardTitle>
          </CardHeader>
          <CardContent>
            {gradeDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={gradeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {gradeDistribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={GRADE_COLORS[entry.name] || "hsl(var(--muted))"}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No grade data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Subject Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Subject Performance (Latest Term)</CardTitle>
        </CardHeader>
        <CardContent>
          {subjectPerformance.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={subjectPerformance} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis
                  dataKey="subject_code"
                  type="category"
                  width={60}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                  }}
                  formatter={(value: number, name: string, props: any) => [
                    `${value}% (${props.payload.grade})`,
                    props.payload.subject_name,
                  ]}
                />
                <Bar
                  dataKey="total_score"
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No subject performance data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Class Position Trend */}
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
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="class_position"
                  name="Class Position"
                  stroke="hsl(var(--accent))"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
