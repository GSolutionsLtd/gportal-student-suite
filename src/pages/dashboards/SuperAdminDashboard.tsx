import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, 
  School, 
  GraduationCap, 
  Activity,
  Shield,
  Settings,
  TrendingUp,
  Loader2,
  UserCheck,
  BookOpen,
  Calendar,
  UserPlus,
  Copy,
} from "lucide-react";
import { format } from "date-fns";
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
  Legend,
} from "recharts";

interface DashboardStats {
  totalUsers: number;
  totalSchools: number;
  totalStudents: number;
  totalTeachers: number;
  totalAdmins: number;
  activeSchools: number;
  trialSchools: number;
}

interface RecentActivity {
  id: string;
  action: string;
  table_name: string;
  created_at: string;
  user_id: string | null;
}

interface SchoolDistribution {
  name: string;
  value: number;
}

interface InviteSchoolOption {
  id: string;
  name: string;
  code: string;
  subscription_status: string | null;
}

const STATUS_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalSchools: 0,
    totalStudents: 0,
    totalTeachers: 0,
    totalAdmins: 0,
    activeSchools: 0,
    trialSchools: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [schoolDistribution, setSchoolDistribution] = useState<SchoolDistribution[]>([]);
  const [userRoleData, setUserRoleData] = useState<{ role: string; count: number }[]>([]);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [eligibleInviteSchools, setEligibleInviteSchools] = useState<InviteSchoolOption[]>([]);
  const [selectedInviteSchoolId, setSelectedInviteSchoolId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCreating, setInviteCreating] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ code: string; link: string; expires_at: string } | null>(null);
  const [inviteError, setInviteError] = useState("");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch all stats in parallel
      const [
        { count: studentsCount },
        { count: teachersCount },
        { data: userRoles },
        { data: schools },
        { data: auditLogs },
      ] = await Promise.all([
        supabase.from("students").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("teachers").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("user_roles").select("role"),
        supabase.from("schools").select("subscription_status"),
        supabase.from("audit_logs").select("id, action, table_name, created_at, user_id").order("created_at", { ascending: false }).limit(10),
      ]);

      // Calculate user role counts
      const roleCounts: Record<string, number> = {};
      (userRoles || []).forEach((r: any) => {
        roleCounts[r.role] = (roleCounts[r.role] || 0) + 1;
      });

      const roleData = Object.entries(roleCounts).map(([role, count]) => ({
        role: role.replace("_", " ").toUpperCase(),
        count,
      }));

      setUserRoleData(roleData);

      // Calculate school distribution
      const schoolStatusCounts: Record<string, number> = {
        trial: 0,
        active: 0,
        suspended: 0,
        expired: 0,
      };
      (schools || []).forEach((s: any) => {
        schoolStatusCounts[s.subscription_status] = (schoolStatusCounts[s.subscription_status] || 0) + 1;
      });

      setSchoolDistribution(
        Object.entries(schoolStatusCounts)
          .filter(([_, count]) => count > 0)
          .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
      );

      setStats({
        totalUsers: (userRoles || []).length,
        totalSchools: (schools || []).length,
        totalStudents: studentsCount || 0,
        totalTeachers: teachersCount || 0,
        totalAdmins: roleCounts["admin"] || 0,
        activeSchools: schoolStatusCounts.active || 0,
        trialSchools: schoolStatusCounts.trial || 0,
      });

      setRecentActivity((auditLogs as RecentActivity[]) || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatAction = (action: string) => {
    return action.charAt(0).toUpperCase() + action.slice(1);
  };

  const formatTableName = (name: string) => {
    return name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const openInviteDialog = async () => {
    setInviteDialogOpen(true);
    setInviteResult(null);
    setInviteError("");
    setInviteEmail("");
    setSelectedInviteSchoolId("");

    const [{ data: schools }, { data: admins }] = await Promise.all([
      supabase
        .from("schools")
        .select("id, name, code, subscription_status")
        .in("subscription_status", ["trial", "active"])
        .order("name", { ascending: true }),
      supabase.from("school_admins").select("school_id").eq("is_primary", true),
    ]);

    const assignedSchoolIds = new Set((admins || []).map((admin) => admin.school_id));
    const eligible = ((schools || []) as InviteSchoolOption[]).filter(
      (school) => !assignedSchoolIds.has(school.id)
    );
    setEligibleInviteSchools(eligible);
    if (eligible[0]) setSelectedInviteSchoolId(eligible[0].id);
  };

  const generateInvite = async () => {
    if (!selectedInviteSchoolId) return;
    setInviteCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("school-admin-invites", {
        body: {
          action: "create",
          schoolId: selectedInviteSchoolId,
          email: inviteEmail.trim(),
        },
      });
      const backendError = (data as { error?: string } | null)?.error || error?.message;
      if (backendError) throw new Error(backendError);
      if (!data?.invite?.code) throw new Error("Failed to generate invite code.");
      setInviteResult({
        code: data.invite.code,
        link: `${window.location.origin}/auth?invite=${data.invite.code}`,
        expires_at: data.invite.expires_at,
      });
      toast({ title: "Invite created", description: "Share the code or link with the new Admin." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate invite code.";
      setInviteError(message);
      toast({ title: "Invite failed", description: message, variant: "destructive" });
    } finally {
      setInviteCreating(false);
    }
  };

  const copyInvite = async (text: string) => {
    await navigator.clipboard.writeText(text);
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
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Super Admin Dashboard</h1>
            <p className="text-muted-foreground">System overview and management</p>
          </div>
          <Button onClick={openInviteDialog} className="gap-2 sm:w-auto w-full">
            <UserPlus className="h-4 w-4" />
            Invite School Admin
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={stats.totalUsers.toString()}
          subtitle="All registered users"
          icon={Users}
          color="primary"
        />
        <StatCard
          title="Total Schools"
          value={stats.totalSchools.toString()}
          subtitle={`${stats.activeSchools} active, ${stats.trialSchools} trial`}
          icon={School}
          color="accent"
        />
        <StatCard
          title="Total Students"
          value={stats.totalStudents.toString()}
          subtitle="Active students"
          icon={GraduationCap}
          color="success"
        />
        <StatCard
          title="Total Teachers"
          value={stats.totalTeachers.toString()}
          subtitle="Active teachers"
          icon={UserCheck}
          color="warning"
        />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* User Roles Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Roles Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userRoleData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={userRoleData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="role" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No user data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* School Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5" />
              School Subscription Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {schoolDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={schoolDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {schoolDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No schools registered yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2"
                onClick={() => navigate("/super-admin/users")}
              >
                <Users className="h-5 w-5" />
                <span>Manage Users</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2"
                onClick={() => navigate("/super-admin/schools")}
              >
                <School className="h-5 w-5" />
                <span>Manage Schools</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2"
                onClick={openInviteDialog}
              >
                <UserPlus className="h-5 w-5" />
                <span>Invite School Admin</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2"
                onClick={() => navigate("/super-admin/audit")}
              >
                <Shield className="h-5 w-5" />
                <span>View Audit Logs</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2"
                onClick={() => navigate("/super-admin/settings")}
              >
                <Settings className="h-5 w-5" />
                <span>System Settings</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/super-admin/audit")}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recent activity
                </p>
              ) : (
                recentActivity.slice(0, 5).map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="text-sm text-foreground">
                        <Badge variant="outline" className="mr-2">
                          {formatAction(activity.action)}
                        </Badge>
                        {formatTableName(activity.table_name)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(activity.created_at), "MMM d, h:mm a")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Admin Users
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAdmins}</div>
            <p className="text-xs text-muted-foreground">School administrators</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Schools
            </CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSchools}</div>
            <p className="text-xs text-muted-foreground">Paid subscriptions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Trial Schools
            </CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.trialSchools}</div>
            <p className="text-xs text-muted-foreground">Free trial period</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite School Admin
            </DialogTitle>
            <DialogDescription>
              Generate a one-time signup invite for an eligible school without a primary Admin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>School</Label>
              <Select value={selectedInviteSchoolId} onValueChange={setSelectedInviteSchoolId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a school" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleInviteSchools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name} ({school.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dashboard-invite-email">Restrict to email (optional)</Label>
              <Input
                id="dashboard-invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="admin@school.com"
              />
            </div>
            <Button onClick={generateInvite} disabled={!selectedInviteSchoolId || inviteCreating} className="w-full">
              {inviteCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate Invite
            </Button>
            {inviteResult && (
              <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-background border rounded px-2 py-1 font-mono">{inviteResult.code}</code>
                  <Button variant="outline" size="icon" onClick={() => copyInvite(inviteResult.code)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-background border rounded px-2 py-1 text-xs truncate">{inviteResult.link}</code>
                  <Button variant="outline" size="icon" onClick={() => copyInvite(inviteResult.link)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Status: unused · Expires {format(new Date(inviteResult.expires_at), "MMM d, yyyy 'at' h:mm a")}</p>
              </div>
            )}
            {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
