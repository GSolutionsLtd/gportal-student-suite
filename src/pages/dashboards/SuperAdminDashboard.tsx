import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  School, 
  GraduationCap, 
  Activity,
  Shield,
  Settings,
  Database,
  TrendingUp
} from "lucide-react";

export default function SuperAdminDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Super Admin Dashboard</h1>
        <p className="text-muted-foreground">System overview and management</p>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value="1,247"
          subtitle="All registered users"
          icon={Users}
          trend={{ value: 12, isPositive: true }}
          color="primary"
        />
        <StatCard
          title="Total Schools"
          value="8"
          subtitle="Active institutions"
          icon={School}
          color="accent"
        />
        <StatCard
          title="Total Students"
          value="892"
          subtitle="Registered students"
          icon={GraduationCap}
          trend={{ value: 8, isPositive: true }}
          color="success"
        />
        <StatCard
          title="System Health"
          value="99.9%"
          subtitle="Uptime this month"
          icon={Activity}
          color="warning"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Users className="h-5 w-5" />
              <span>Manage Users</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Shield className="h-5 w-5" />
              <span>View Audit Logs</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Database className="h-5 w-5" />
              <span>Database Backup</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Settings className="h-5 w-5" />
              <span>System Settings</span>
            </Button>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {[
              { action: "New admin registered", time: "2 minutes ago" },
              { action: "Database backup completed", time: "1 hour ago" },
              { action: "System update installed", time: "3 hours ago" },
              { action: "New school added", time: "Yesterday" },
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm text-foreground">{item.action}</span>
                <span className="text-xs text-muted-foreground">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* System Stats */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">System Statistics</h2>
          <Button variant="ghost" size="sm">
            <TrendingUp className="h-4 w-4 mr-2" />
            View Details
          </Button>
        </div>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          <p>Charts will be integrated with data</p>
        </div>
      </div>
    </div>
  );
}
