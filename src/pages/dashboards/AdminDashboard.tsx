import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  GraduationCap, 
  BookOpen,
  ClipboardList,
  FileCheck,
  AlertCircle,
  Calendar,
  TrendingUp
} from "lucide-react";

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground">Academic year 2024/2025 - First Term</p>
        </div>
        <Button>
          <Calendar className="h-4 w-4 mr-2" />
          Manage Sessions
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Students"
          value="456"
          subtitle="Across all classes"
          icon={GraduationCap}
          trend={{ value: 5, isPositive: true }}
          color="primary"
        />
        <StatCard
          title="Total Teachers"
          value="32"
          subtitle="Active teachers"
          icon={Users}
          color="accent"
        />
        <StatCard
          title="Subjects"
          value="18"
          subtitle="Configured subjects"
          icon={BookOpen}
          color="success"
        />
        <StatCard
          title="Pending Results"
          value="12"
          subtitle="Awaiting approval"
          icon={ClipboardList}
          color="warning"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Pending Approvals */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Pending Result Approvals</h2>
            <Button variant="ghost" size="sm">View All</Button>
          </div>
          <div className="space-y-3">
            {[
              { teacher: "Mrs. Johnson", class: "JSS 1A", subject: "Mathematics", submitted: "2 hours ago" },
              { teacher: "Mr. Adams", class: "JSS 2B", subject: "English", submitted: "5 hours ago" },
              { teacher: "Ms. Brown", class: "SS 1A", subject: "Physics", submitted: "Yesterday" },
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                <div className="flex-1">
                  <p className="font-medium text-foreground">{item.teacher}</p>
                  <p className="text-sm text-muted-foreground">{item.class} - {item.subject}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-2">{item.submitted}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="success">Approve</Button>
                    <Button size="sm" variant="outline">Review</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Result Status</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Approved</span>
                  <span className="font-medium text-foreground">68%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full w-[68%] bg-success rounded-full" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Pending</span>
                  <span className="font-medium text-foreground">24%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full w-[24%] bg-warning rounded-full" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Not Submitted</span>
                  <span className="font-medium text-foreground">8%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full w-[8%] bg-destructive rounded-full" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Alerts</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10">
                <AlertCircle className="h-5 w-5 text-warning flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Deadline Approaching</p>
                  <p className="text-xs text-muted-foreground">Result submission ends in 3 days</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10">
                <FileCheck className="h-5 w-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">PIN Stocks Low</p>
                  <p className="text-xs text-muted-foreground">Only 45 PINs remaining</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
