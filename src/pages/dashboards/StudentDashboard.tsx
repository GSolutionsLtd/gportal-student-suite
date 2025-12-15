import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { 
  GraduationCap,
  Award,
  TrendingUp,
  Calendar,
  FileText,
  Download,
  Eye
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function StudentDashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Student Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, John Doe • JSS 2A</p>
        </div>
        <Button onClick={() => navigate("/student/results")}>
          <Eye className="h-4 w-4 mr-2" />
          View Results
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Current Position"
          value="5th"
          subtitle="Out of 42 students"
          icon={Award}
          color="primary"
        />
        <StatCard
          title="Average Score"
          value="72.5%"
          subtitle="This term"
          icon={TrendingUp}
          trend={{ value: 3.2, isPositive: true }}
          color="accent"
        />
        <StatCard
          title="Subjects"
          value="12"
          subtitle="Enrolled subjects"
          icon={GraduationCap}
          color="success"
        />
        <StatCard
          title="Current Term"
          value="1st"
          subtitle="2024/2025 Session"
          icon={Calendar}
          color="warning"
        />
      </div>

      {/* Results Overview */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Latest Results</h2>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download Report
            </Button>
          </div>
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
                {[
                  { subject: "Mathematics", test1: 18, test2: 17, exam: 52, total: 87, grade: "A" },
                  { subject: "English Language", test1: 15, test2: 16, exam: 48, total: 79, grade: "B" },
                  { subject: "Physics", test1: 16, test2: 14, exam: 45, total: 75, grade: "B" },
                  { subject: "Chemistry", test1: 14, test2: 15, exam: 42, total: 71, grade: "B" },
                  { subject: "Biology", test1: 17, test2: 18, exam: 50, total: 85, grade: "A" },
                ].map((item, index) => (
                  <tr key={index} className="border-b border-border last:border-0 hover:bg-secondary/30">
                    <td className="py-3 px-4 font-medium text-foreground">{item.subject}</td>
                    <td className="py-3 px-4 text-center text-muted-foreground">{item.test1}</td>
                    <td className="py-3 px-4 text-center text-muted-foreground">{item.test2}</td>
                    <td className="py-3 px-4 text-center text-muted-foreground">{item.exam}</td>
                    <td className="py-3 px-4 text-center font-medium text-foreground">{item.total}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${
                        item.grade === "A" 
                          ? "bg-success/10 text-success" 
                          : item.grade === "B"
                          ? "bg-primary/10 text-primary"
                          : "bg-warning/10 text-warning"
                      }`}>
                        {item.grade}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Performance Summary */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Performance Summary</h2>
            <div className="space-y-4">
              <div className="text-center p-4 rounded-lg bg-primary/5">
                <p className="text-4xl font-bold text-primary">72.5%</p>
                <p className="text-sm text-muted-foreground mt-1">Overall Average</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 rounded-lg bg-secondary">
                  <p className="text-xl font-bold text-foreground">870</p>
                  <p className="text-xs text-muted-foreground">Total Score</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-secondary">
                  <p className="text-xl font-bold text-foreground">1200</p>
                  <p className="text-xs text-muted-foreground">Max Score</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Available Results</h2>
            <div className="space-y-2">
              {[
                { term: "First Term", session: "2024/2025", available: true },
                { term: "Third Term", session: "2023/2024", available: true },
                { term: "Second Term", session: "2023/2024", available: true },
              ].map((item, index) => (
                <button
                  key={index}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-secondary/30 transition-all"
                >
                  <div className="text-left">
                    <p className="font-medium text-foreground">{item.term}</p>
                    <p className="text-xs text-muted-foreground">{item.session}</p>
                  </div>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
