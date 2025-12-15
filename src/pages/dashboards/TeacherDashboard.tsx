import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  BookOpen,
  ClipboardList,
  FileCheck,
  Clock,
  CheckCircle,
  AlertCircle,
  Edit
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TeacherDashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Teacher Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, Mrs. Johnson</p>
        </div>
        <Button onClick={() => navigate("/teacher/results")}>
          <Edit className="h-4 w-4 mr-2" />
          Enter Results
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Assigned Classes"
          value="4"
          subtitle="This term"
          icon={Users}
          color="primary"
        />
        <StatCard
          title="Subjects Taught"
          value="2"
          subtitle="Mathematics & Physics"
          icon={BookOpen}
          color="accent"
        />
        <StatCard
          title="Results Submitted"
          value="3"
          subtitle="Out of 8 required"
          icon={ClipboardList}
          color="success"
        />
        <StatCard
          title="Pending Entry"
          value="5"
          subtitle="Classes remaining"
          icon={Clock}
          color="warning"
        />
      </div>

      {/* Classes Overview */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">My Classes & Subjects</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { class: "JSS 1A", subject: "Mathematics", students: 45, status: "submitted" },
            { class: "JSS 1B", subject: "Mathematics", students: 42, status: "draft" },
            { class: "JSS 2A", subject: "Mathematics", students: 38, status: "pending" },
            { class: "JSS 2B", subject: "Mathematics", students: 40, status: "submitted" },
            { class: "SS 1A", subject: "Physics", students: 35, status: "pending" },
            { class: "SS 1B", subject: "Physics", students: 32, status: "pending" },
            { class: "SS 2A", subject: "Physics", students: 28, status: "draft" },
            { class: "SS 2B", subject: "Physics", students: 30, status: "submitted" },
          ].map((item, index) => (
            <div 
              key={index} 
              className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
              onClick={() => navigate("/teacher/results")}
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{item.class}</p>
                  <p className="text-sm text-muted-foreground">{item.subject} • {item.students} students</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {item.status === "submitted" && (
                  <span className="flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2 py-1 rounded-full">
                    <CheckCircle className="h-3 w-3" />
                    Submitted
                  </span>
                )}
                {item.status === "draft" && (
                  <span className="flex items-center gap-1 text-xs font-medium text-warning bg-warning/10 px-2 py-1 rounded-full">
                    <Clock className="h-3 w-3" />
                    Draft
                  </span>
                )}
                {item.status === "pending" && (
                  <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                    <AlertCircle className="h-3 w-3" />
                    Not Started
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Submissions */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Recent Submissions</h2>
        <div className="space-y-3">
          {[
            { class: "SS 2B", subject: "Physics", date: "Today, 2:30 PM", status: "approved" },
            { class: "JSS 1A", subject: "Mathematics", date: "Yesterday, 10:15 AM", status: "approved" },
            { class: "JSS 2B", subject: "Mathematics", date: "Dec 10, 4:45 PM", status: "pending" },
          ].map((item, index) => (
            <div key={index} className="flex items-center justify-between py-3 border-b border-border last:border-0">
              <div>
                <p className="font-medium text-foreground">{item.class} - {item.subject}</p>
                <p className="text-sm text-muted-foreground">{item.date}</p>
              </div>
              {item.status === "approved" ? (
                <span className="flex items-center gap-1 text-sm text-success">
                  <CheckCircle className="h-4 w-4" />
                  Approved
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm text-warning">
                  <Clock className="h-4 w-4" />
                  Pending Review
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
