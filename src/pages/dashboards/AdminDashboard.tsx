import { useState, useEffect } from "react";
import { StatCard } from "@/components/dashboard/StatCard";
import { PinStatisticsWidget } from "@/components/dashboard/PinStatisticsWidget";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { 
  Users, 
  GraduationCap, 
  BookOpen,
  ClipboardList,
  FileCheck,
  AlertCircle,
  Calendar,
  Loader2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Key,
  Globe,
  Sparkles
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

interface PendingResult {
  id: string;
  class_arm: { name: string; class: { name: string } };
  term: { name: string };
  student: { first_name: string; last_name: string; admission_number: string };
  contributing_teachers: string[];
  submitted_at: string;
}

interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalSubjects: number;
  pendingResults: number;
  approvedResults: number;
  publishedResults: number;
}

interface ClassPerformance {
  name: string;
  average: number;
  students: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalTeachers: 0,
    totalSubjects: 0,
    pendingResults: 0,
    approvedResults: 0,
    publishedResults: 0,
  });
  const [pendingApprovals, setPendingApprovals] = useState<PendingResult[]>([]);
  const [currentSession, setCurrentSession] = useState<string>("");
  const [currentTerm, setCurrentTerm] = useState<{ id: string; name: string } | null>(null);
  const [classPerformance, setClassPerformance] = useState<ClassPerformance[]>([]);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // Fetch current session and term
        const { data: session } = await supabase
          .from("academic_sessions")
          .select("id, name")
          .eq("is_current", true)
          .maybeSingle();

        if (session) {
          setCurrentSession(session.name);
        }

        const { data: term } = await supabase
          .from("terms")
          .select("id, name")
          .eq("is_current", true)
          .maybeSingle();

        if (term) {
          setCurrentTerm(term);
        }

        // Fetch counts
        const [studentsRes, teachersRes, subjectsRes, resultsRes] = await Promise.all([
          supabase.from("students").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("teachers").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("subjects").select("id", { count: "exact", head: true }).eq("is_active", true),
          term ? supabase.from("results").select("id, status").eq("term_id", term.id) : Promise.resolve({ data: [] }),
        ]);

        const results = resultsRes.data || [];
        const pending = results.filter((r: any) => r.status === "submitted").length;
        const approved = results.filter((r: any) => r.status === "approved").length;
        const published = results.filter((r: any) => r.status === "published").length;

        setStats({
          totalStudents: studentsRes.count || 0,
          totalTeachers: teachersRes.count || 0,
          totalSubjects: subjectsRes.count || 0,
          pendingResults: pending,
          approvedResults: approved,
          publishedResults: published,
        });

        // Fetch class performance for analytics
        if (term) {
          const { data: classArms } = await supabase
            .from("class_arms")
            .select("id, name, class:classes(name)")
            .eq("is_active", true);

          if (classArms) {
            const performanceData: ClassPerformance[] = [];
            
            for (const arm of classArms) {
              const { data: resultsData } = await supabase
                .from("results")
                .select("average_score")
                .eq("class_arm_id", arm.id)
                .eq("term_id", term.id)
                .eq("status", "published");

              if (resultsData && resultsData.length > 0) {
                const avgScores = resultsData
                  .filter((r: any) => r.average_score !== null)
                  .map((r: any) => Number(r.average_score));
                
                if (avgScores.length > 0) {
                  const classAvg = avgScores.reduce((a, b) => a + b, 0) / avgScores.length;
                  performanceData.push({
                    name: `${(arm.class as any)?.name || ''} ${arm.name}`,
                    average: Math.round(classAvg * 10) / 10,
                    students: resultsData.length,
                  });
                }
              }
            }

            setClassPerformance(performanceData.sort((a, b) => b.average - a.average).slice(0, 8));
          }
        }

        // Fetch pending approvals with details - show individual student results
        if (term) {
          const { data: pendingData } = await supabase
            .from("results")
            .select(`
              id,
              submitted_at,
              class_arm_id,
              student:students(first_name, last_name, admission_number),
              class_arm:class_arms(
                name,
                class:classes(name)
              ),
              term:terms(name)
            `)
            .eq("status", "submitted")
            .eq("term_id", term.id)
            .order("submitted_at", { ascending: false })
            .limit(100);

          const resultIds = (pendingData || []).map((result: any) => result.id);
          const { data: components } = resultIds.length
            ? await supabase
                .from("result_components")
                .select("result_id, entered_by")
                .in("result_id", resultIds)
                .not("entered_by", "is", null)
            : { data: [] as { result_id: string; entered_by: string }[] };

          const teacherIds = [
            ...new Set((components || []).map((component: any) => component.entered_by).filter(Boolean)),
          ] as string[];

          const { data: profiles } = teacherIds.length
            ? await supabase
                .from("profiles")
                .select("id, full_name")
                .in("id", teacherIds)
            : { data: [] as { id: string; full_name: string }[] };

          const teacherNameById = new Map((profiles || []).map((profile: any) => [profile.id, profile.full_name]));

          const contributorsByResult = new Map<string, string[]>();
          (components || []).forEach((component: any) => {
            const teacherName = teacherNameById.get(component.entered_by);
            if (!teacherName) return;

            const existing = contributorsByResult.get(component.result_id) || [];
            if (!existing.includes(teacherName)) {
              existing.push(teacherName);
              contributorsByResult.set(component.result_id, existing);
            }
          });

          const enriched = (pendingData || []).map((result: any) => ({
            ...result,
            contributing_teachers: contributorsByResult.get(result.id) || [],
          }));

          setPendingApprovals(enriched);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const totalResults = stats.pendingResults + stats.approvedResults + stats.publishedResults;
  const approvedPercent = totalResults > 0 ? Math.round((stats.approvedResults / totalResults) * 100) : 0;
  const pendingPercent = totalResults > 0 ? Math.round((stats.pendingResults / totalResults) * 100) : 0;
  const publishedPercent = totalResults > 0 ? Math.round((stats.publishedResults / totalResults) * 100) : 0;

  const pieData = [
    { name: 'Published', value: stats.publishedResults, color: 'hsl(var(--success))' },
    { name: 'Approved', value: stats.approvedResults, color: 'hsl(var(--primary))' },
    { name: 'Pending', value: stats.pendingResults, color: 'hsl(var(--warning))' },
  ].filter(d => d.value > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            {currentSession} {currentTerm ? `- ${currentTerm.name}` : ""}
          </p>
        </div>
        <Button onClick={() => navigate("/admin/academic")}>
          <Calendar className="h-4 w-4 mr-2" />
          Manage Sessions
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Students"
          value={stats.totalStudents.toString()}
          subtitle="Active students"
          icon={GraduationCap}
          color="primary"
        />
        <StatCard
          title="Total Teachers"
          value={stats.totalTeachers.toString()}
          subtitle="Active teachers"
          icon={Users}
          color="accent"
        />
        <StatCard
          title="Subjects"
          value={stats.totalSubjects.toString()}
          subtitle="Configured subjects"
          icon={BookOpen}
          color="success"
        />
        <StatCard
          title="Pending Results"
          value={stats.pendingResults.toString()}
          subtitle="Awaiting approval"
          icon={ClipboardList}
          color="warning"
        />
      </div>

      {/* Analytics Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Class Performance Chart */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Class Performance
            </h2>
          </div>
          {classPerformance.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={classPerformance} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: number) => [`${value}%`, 'Average']}
                  labelFormatter={(label) => `Class: ${label}`}
                />
                <Bar 
                  dataKey="average" 
                  fill="hsl(var(--primary))" 
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              <p>No published results yet</p>
            </div>
          )}
        </div>

        {/* Result Status Pie Chart */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Result Status Distribution</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              <p>No results data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Pending Approvals */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Pending Result Approvals</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/results")}>
              View All
            </Button>
          </div>
          <div className="space-y-3">
            {pendingApprovals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No pending approvals</p>
              </div>
            ) : (
              pendingApprovals.map((item, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {item.student?.first_name} {item.student?.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {item.class_arm?.class?.name} {item.class_arm?.name} • {item.term?.name}
                    </p>
                    {item.contributing_teachers.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Scores by: {item.contributing_teachers.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-2">
                      {item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : ""}
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => navigate("/admin/results")}
                      >
                        Review
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Stats & Actions */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Result Status</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Published</span>
                  <span className="font-medium text-foreground">{publishedPercent}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-success rounded-full transition-all" 
                    style={{ width: `${publishedPercent}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Approved</span>
                  <span className="font-medium text-foreground">{approvedPercent}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all" 
                    style={{ width: `${approvedPercent}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Pending</span>
                  <span className="font-medium text-foreground">{pendingPercent}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-warning rounded-full transition-all" 
                    style={{ width: `${pendingPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate("/admin/students")}
              >
                <GraduationCap className="h-4 w-4 mr-2" />
                Manage Students
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate("/admin/teachers")}
              >
                <Users className="h-4 w-4 mr-2" />
                Manage Teachers
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate("/admin/results")}
              >
                <ClipboardList className="h-4 w-4 mr-2" />
                Review Results
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate("/admin/pins")}
              >
                <Key className="h-4 w-4 mr-2" />
                Manage PINs
              </Button>
            </div>
          </div>

          {stats.pendingResults > 0 && (
            <div className="bg-card rounded-xl border border-border p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Alerts</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10">
                  <AlertCircle className="h-5 w-5 text-warning flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Pending Approvals</p>
                    <p className="text-xs text-muted-foreground">
                      {stats.pendingResults} result{stats.pendingResults !== 1 ? "s" : ""} awaiting review
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PIN Statistics Widget */}
      <div className="mt-6">
        <PinStatisticsWidget />
      </div>
    </div>
  );
}
