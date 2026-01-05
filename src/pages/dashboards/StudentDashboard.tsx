import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  GraduationCap,
  Award,
  TrendingUp,
  Calendar,
  FileText,
  Download,
  Eye,
  Loader2,
  BarChart3,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ResultSummary {
  id: string;
  term_name: string;
  session_name: string;
  average_score: number | null;
  class_position: number | null;
  total_subjects: number;
}

interface LatestResult {
  subject: string;
  test1: number | null;
  test2: number | null;
  exam: number | null;
  total: number | null;
  grade: string | null;
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [studentInfo, setStudentInfo] = useState<{
    name: string;
    className: string;
    admissionNumber: string;
  } | null>(null);
  const [currentTermInfo, setCurrentTermInfo] = useState<{ name: string; session: string } | null>(null);
  const [stats, setStats] = useState({
    position: "-",
    positionOf: 0,
    average: "-",
    subjects: 0,
  });
  const [latestResults, setLatestResults] = useState<LatestResult[]>([]);
  const [resultHistory, setResultHistory] = useState<ResultSummary[]>([]);

  useEffect(() => {
    fetchStudentData();
  }, [user]);

  const fetchStudentData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get student record
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("id, first_name, last_name, admission_number, current_class_arm_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (studentError) throw studentError;
      if (!student) {
        setLoading(false);
        return;
      }

      // Get class info
      let className = "";
      if (student.current_class_arm_id) {
        const { data: classArm } = await supabase
          .from("class_arms")
          .select("name, class:classes(name)")
          .eq("id", student.current_class_arm_id)
          .maybeSingle();
        if (classArm) {
          className = `${classArm.class?.name} - ${classArm.name}`;
        }
      }

      setStudentInfo({
        name: `${student.first_name} ${student.last_name}`,
        className,
        admissionNumber: student.admission_number,
      });

      // Get current term
      const { data: currentTerm } = await supabase
        .from("terms")
        .select("id, name, session:academic_sessions(name)")
        .eq("is_current", true)
        .maybeSingle();

      if (currentTerm) {
        setCurrentTermInfo({
          name: currentTerm.name,
          session: currentTerm.session?.name || "",
        });
      }

      // Get published results
      const { data: results } = await supabase
        .from("results")
        .select("id, total_score, average_score, class_position, term_id, class_arm_id, status")
        .eq("student_id", student.id)
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (results && results.length > 0) {
        // Get latest result details
        const latestResult = results[0];

        // Get class size for position context
        const { count: classSize } = await supabase
          .from("students")
          .select("id", { count: "exact", head: true })
          .eq("current_class_arm_id", latestResult.class_arm_id)
          .eq("is_active", true);

        // Get result components for latest result
        const { data: components } = await supabase
          .from("result_components")
          .select("test1_score, test2_score, exam_score, total_score, grade, subject_id")
          .eq("result_id", latestResult.id);

        const enrichedComponents = await Promise.all(
          (components || []).map(async (comp) => {
            const { data: subject } = await supabase
              .from("subjects")
              .select("name")
              .eq("id", comp.subject_id)
              .maybeSingle();
            return {
              subject: subject?.name || "Unknown",
              test1: comp.test1_score ? Number(comp.test1_score) : null,
              test2: comp.test2_score ? Number(comp.test2_score) : null,
              exam: comp.exam_score ? Number(comp.exam_score) : null,
              total: comp.total_score ? Number(comp.total_score) : null,
              grade: comp.grade,
            };
          })
        );

        setLatestResults(enrichedComponents);

        setStats({
          position: latestResult.class_position ? `${latestResult.class_position}${getOrdinalSuffix(latestResult.class_position)}` : "-",
          positionOf: classSize || 0,
          average: latestResult.average_score ? `${Number(latestResult.average_score).toFixed(1)}%` : "-",
          subjects: enrichedComponents.length,
        });

        // Get result history
        const history = await Promise.all(
          results.map(async (result) => {
            const { data: term } = await supabase
              .from("terms")
              .select("name, session:academic_sessions(name)")
              .eq("id", result.term_id)
              .maybeSingle();

            const { count: subjectCount } = await supabase
              .from("result_components")
              .select("id", { count: "exact", head: true })
              .eq("result_id", result.id);

            return {
              id: result.id,
              term_name: term?.name || "Unknown",
              session_name: term?.session?.name || "Unknown",
              average_score: result.average_score ? Number(result.average_score) : null,
              class_position: result.class_position,
              total_subjects: subjectCount || 0,
            };
          })
        );

        setResultHistory(history);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (grade: string | null) => {
    switch (grade) {
      case "A":
        return "bg-success/10 text-success";
      case "B":
        return "bg-primary/10 text-primary";
      case "C":
        return "bg-accent/10 text-accent-foreground";
      case "D":
        return "bg-warning/10 text-warning";
      default:
        return "bg-destructive/10 text-destructive";
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Student Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {studentInfo?.name || profile?.full_name || "Student"}{" "}
            {studentInfo?.className && `• ${studentInfo.className}`}
          </p>
        </div>
        <Button onClick={() => navigate("/student/results")}>
          <Eye className="h-4 w-4 mr-2" />
          View All Results
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Current Position"
          value={stats.position}
          subtitle={stats.positionOf > 0 ? `Out of ${stats.positionOf} students` : "No data"}
          icon={Award}
          color="primary"
        />
        <StatCard
          title="Average Score"
          value={stats.average}
          subtitle={currentTermInfo ? `${currentTermInfo.name}` : "This term"}
          icon={TrendingUp}
          color="accent"
        />
        <StatCard
          title="Subjects"
          value={stats.subjects.toString()}
          subtitle="Enrolled subjects"
          icon={GraduationCap}
          color="success"
        />
        <StatCard
          title="Current Term"
          value={currentTermInfo?.name || "-"}
          subtitle={currentTermInfo?.session || "-"}
          icon={Calendar}
          color="warning"
        />
      </div>

      {/* Results Overview */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Latest Results</h2>
            <Button variant="outline" size="sm" disabled>
              <Download className="h-4 w-4 mr-2" />
              Download Report
            </Button>
          </div>
          {latestResults.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No Results Yet</h3>
              <p className="text-muted-foreground">Your results will appear here once published.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Subject</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Test 1</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Test 2</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Exam</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {latestResults.map((item, index) => (
                    <tr key={index} className="border-b border-border last:border-0 hover:bg-secondary/30">
                      <td className="py-3 px-4 font-medium text-foreground">{item.subject}</td>
                      <td className="py-3 px-4 text-center text-muted-foreground">{item.test1 ?? "-"}</td>
                      <td className="py-3 px-4 text-center text-muted-foreground">{item.test2 ?? "-"}</td>
                      <td className="py-3 px-4 text-center text-muted-foreground">{item.exam ?? "-"}</td>
                      <td className="py-3 px-4 text-center font-medium text-foreground">{item.total ?? "-"}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${getGradeColor(item.grade)}`}>
                          {item.grade || "-"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Performance Summary */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Performance Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center p-4 rounded-lg bg-primary/5">
                <p className="text-4xl font-bold text-primary">{stats.average}</p>
                <p className="text-sm text-muted-foreground mt-1">Overall Average</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 rounded-lg bg-secondary">
                  <p className="text-xl font-bold text-foreground">
                    {latestResults.reduce((sum, r) => sum + (r.total || 0), 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Score</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-secondary">
                  <p className="text-xl font-bold text-foreground">{latestResults.length * 100}</p>
                  <p className="text-xs text-muted-foreground">Max Score</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Result History</CardTitle>
            </CardHeader>
            <CardContent>
              {resultHistory.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No result history available</p>
              ) : (
                <div className="space-y-2">
                  {resultHistory.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => navigate("/student/results")}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-secondary/30 transition-all"
                    >
                      <div className="text-left">
                        <p className="font-medium text-foreground">{item.term_name}</p>
                        <p className="text-xs text-muted-foreground">{item.session_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">
                          {item.average_score ? `${item.average_score.toFixed(1)}%` : "-"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Pos: {item.class_position ? `${item.class_position}${getOrdinalSuffix(item.class_position)}` : "-"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
