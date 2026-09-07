import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Users, 
  BookOpen,
  ClipboardList,
  Clock,
  CheckCircle,
  AlertCircle,
  Edit,
  Loader2,
  Layers,
  UserCircle,
  AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { TeacherWorkHistory } from "@/components/teacher/TeacherWorkHistory";

interface ClassAssignment {
  id: string;
  classArmName: string;
  className: string;
  subjectName: string;
  studentCount: number;
  status: "not_started" | "in_progress" | "submitted" | "approved";
}

interface RecentSubmission {
  id: string;
  className: string;
  subjectName: string;
  submittedAt: string;
  status: string;
}

interface TeacherProfile {
  id: string;
  staff_id: string;
  is_class_teacher: boolean | null;
  is_form_teacher: boolean | null;
  signature_url: string | null;
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<RecentSubmission[]>([]);
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(null);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [stats, setStats] = useState({
    assignedClasses: 0,
    subjectsTaught: 0,
    resultsSubmitted: 0,
    pendingEntry: 0,
  });

  useEffect(() => {
    fetchTeacherData();
  }, [user]);

  // Real-time subscription for result status updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('result-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'results',
        },
        (payload) => {
          const newStatus = payload.new.status;
          const oldStatus = payload.old?.status;

          if (newStatus !== oldStatus) {
            // Show toast notification
            let message = '';
            if (newStatus === 'approved') {
              message = 'A result you submitted has been approved!';
              toast({ title: '✅ Result Approved', description: message });
            } else if (newStatus === 'published') {
              message = 'A result has been published and is now visible to students.';
              toast({ title: '🎉 Result Published', description: message });
            } else if (newStatus === 'rejected') {
              message = 'A result has been rejected. Please review and resubmit.';
              toast({ title: '❌ Result Rejected', description: message, variant: 'destructive' });
            }

            // Refresh data
            fetchTeacherData();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  const fetchTeacherData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get teacher record with full profile
      const { data: teacher, error: teacherError } = await supabase
        .from("teachers")
        .select("id, staff_id, is_class_teacher, is_form_teacher, signature_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (teacherError) throw teacherError;
      if (!teacher) {
        setLoading(false);
        return;
      }

      setTeacherProfile(teacher);
      
      // Check if profile is incomplete
      const isClassOrFormTeacher = teacher.is_class_teacher || teacher.is_form_teacher;
      const needsSignature = isClassOrFormTeacher && !teacher.signature_url;
      const noDesignation = teacher.is_class_teacher === null && teacher.is_form_teacher === null;
      setProfileIncomplete(noDesignation || needsSignature || !teacher.staff_id);

      // Get current session
      const { data: currentSession } = await supabase
        .from("academic_sessions")
        .select("id")
        .eq("is_current", true)
        .maybeSingle();

      if (!currentSession) {
        setLoading(false);
        return;
      }

      // Get current term
      const { data: currentTerm } = await supabase
        .from("terms")
        .select("id")
        .eq("is_current", true)
        .maybeSingle();

      // Get teacher assignments for current session
      const { data: teacherSubjects, error: assignError } = await supabase
        .from("teacher_subjects")
        .select("id, class_arm_id, subject_id")
        .eq("teacher_id", teacher.id)
        .eq("session_id", currentSession.id);

      if (assignError) throw assignError;
      if (!teacherSubjects || teacherSubjects.length === 0) {
        setAssignments([]);
        setLoading(false);
        return;
      }

      // Get unique subjects count
      const uniqueSubjects = new Set(teacherSubjects.map((ts) => ts.subject_id));

      // Enrich assignments with details
      const enrichedAssignments = await Promise.all(
        teacherSubjects.slice(0, 8).map(async (ts) => {
          const [{ data: classArm }, { data: subject }] = await Promise.all([
            supabase.from("class_arms").select("id, name, class:classes(name)").eq("id", ts.class_arm_id).maybeSingle(),
            supabase.from("subjects").select("id, name").eq("id", ts.subject_id).maybeSingle(),
          ]);

          // Get student count
          const { count: studentCount } = await supabase
            .from("students")
            .select("id", { count: "exact", head: true })
            .eq("current_class_arm_id", ts.class_arm_id)
            .eq("is_active", true);

          // Determine status based on results
          let status: ClassAssignment["status"] = "not_started";
          if (currentTerm) {
            const { data: results } = await supabase
              .from("results")
              .select("id, status")
              .eq("class_arm_id", ts.class_arm_id)
              .eq("term_id", currentTerm.id);

            if (results && results.length > 0) {
              const resultIds = results.map((r) => r.id);
              const { count: componentCount } = await supabase
                .from("result_components")
                .select("id", { count: "exact", head: true })
                .eq("subject_id", ts.subject_id)
                .in("result_id", resultIds);

              if (componentCount && componentCount > 0) {
                const submittedResults = results.filter((r) => r.status === "submitted" || r.status === "approved" || r.status === "published");
                if (submittedResults.length === results.length) {
                  const approvedResults = results.filter((r) => r.status === "approved" || r.status === "published");
                  status = approvedResults.length > 0 ? "approved" : "submitted";
                } else if (componentCount < (studentCount || 0)) {
                  status = "in_progress";
                } else {
                  status = "in_progress";
                }
              }
            }
          }

          return {
            id: ts.id,
            classArmName: classArm?.name || "Unknown",
            className: classArm?.class?.name || "Unknown",
            subjectName: subject?.name || "Unknown",
            studentCount: studentCount || 0,
            status,
          };
        })
      );

      setAssignments(enrichedAssignments);

      // Calculate stats
      const submittedCount = enrichedAssignments.filter((a) => a.status === "submitted" || a.status === "approved").length;
      const pendingCount = enrichedAssignments.filter((a) => a.status === "not_started" || a.status === "in_progress").length;

      setStats({
        assignedClasses: teacherSubjects.length,
        subjectsTaught: uniqueSubjects.size,
        resultsSubmitted: submittedCount,
        pendingEntry: pendingCount,
      });

      // Get recent submissions
      if (currentTerm) {
        const classArmIds = teacherSubjects.map((ts) => ts.class_arm_id);
        const { data: submissions } = await supabase
          .from("results")
          .select("id, class_arm_id, submitted_at, status")
          .in("class_arm_id", classArmIds)
          .eq("term_id", currentTerm.id)
          .not("submitted_at", "is", null)
          .order("submitted_at", { ascending: false })
          .limit(5);

        if (submissions) {
          const recentSubs = await Promise.all(
            submissions.map(async (sub) => {
              const assignment = teacherSubjects.find((ts) => ts.class_arm_id === sub.class_arm_id);
              const [{ data: classArm }, { data: subject }] = await Promise.all([
                supabase.from("class_arms").select("name, class:classes(name)").eq("id", sub.class_arm_id).maybeSingle(),
                assignment ? supabase.from("subjects").select("name").eq("id", assignment.subject_id).maybeSingle() : Promise.resolve({ data: null }),
              ]);

              return {
                id: sub.id,
                className: `${classArm?.class?.name} ${classArm?.name}`,
                subjectName: subject?.name || "Unknown",
                submittedAt: sub.submitted_at || "",
                status: sub.status,
              };
            })
          );
          setRecentSubmissions(recentSubs);
        }
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: ClassAssignment["status"]) => {
    switch (status) {
      case "submitted":
        return (
          <Badge variant="secondary" className="bg-accent text-accent-foreground">
            <Clock className="h-3 w-3 mr-1" />
            Submitted
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="default" className="bg-success hover:bg-success/90">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="outline" className="border-warning text-warning">
            <Clock className="h-3 w-3 mr-1" />
            Draft
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <AlertCircle className="h-3 w-3 mr-1" />
            Not Started
          </Badge>
        );
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
      {/* Profile Incomplete Warning */}
      {profileIncomplete && (
        <Alert variant="destructive" className="border-warning bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-warning-foreground">
              Your profile is incomplete. Please update your staff ID, designation, and signature{" "}
              {(teacherProfile?.is_class_teacher || teacherProfile?.is_form_teacher) && !teacherProfile?.signature_url
                ? "(signature required for class/form teachers)"
                : ""}
            </span>
            <Button size="sm" variant="outline" onClick={() => navigate("/teacher/profile")} className="ml-4">
              <UserCircle className="h-4 w-4 mr-2" />
              Complete Profile
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Teacher Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {profile?.full_name || "Teacher"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/teacher/profile")}>
            <UserCircle className="h-4 w-4 mr-2" />
            My Profile
          </Button>
          <Button variant="outline" onClick={() => navigate("/teacher/classes")}>
            <Layers className="h-4 w-4 mr-2" />
            My Classes
          </Button>
          <Button onClick={() => navigate("/teacher/results")}>
            <Edit className="h-4 w-4 mr-2" />
            Enter Results
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Assigned Classes"
          value={stats.assignedClasses.toString()}
          subtitle="This term"
          icon={Users}
          color="primary"
        />
        <StatCard
          title="Subjects Taught"
          value={stats.subjectsTaught.toString()}
          subtitle="Unique subjects"
          icon={BookOpen}
          color="accent"
        />
        <StatCard
          title="Results Submitted"
          value={stats.resultsSubmitted.toString()}
          subtitle={`Out of ${stats.assignedClasses} required`}
          icon={ClipboardList}
          color="success"
        />
        <StatCard
          title="Pending Entry"
          value={stats.pendingEntry.toString()}
          subtitle="Classes remaining"
          icon={Clock}
          color="warning"
        />
      </div>

      {/* Classes Overview */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">My Classes & Subjects</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/teacher/classes")}>
            View All
          </Button>
        </div>
        {assignments.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No classes assigned yet.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {assignments.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => navigate("/teacher/results")}
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BookOpen className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{item.className} - {item.classArmName}</p>
                    <p className="text-sm text-muted-foreground">{item.subjectName} • {item.studentCount} students</p>
                  </div>
                </div>
                {getStatusBadge(item.status)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Submissions */}
      {recentSubmissions.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Recent Submissions</h2>
          <div className="space-y-3">
            {recentSubmissions.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div>
                  <p className="font-medium text-foreground">{item.className} - {item.subjectName}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.submittedAt ? format(new Date(item.submittedAt), "MMM d, yyyy h:mm a") : "-"}
                  </p>
                </div>
                {item.status === "approved" || item.status === "published" ? (
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
      )}

      <TeacherWorkHistory compact />
    </div>
  );
}
