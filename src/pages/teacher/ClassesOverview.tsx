import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  BookOpen,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Edit,
  FileText,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ClassAssignment {
  id: string;
  classArmId: string;
  classArmName: string;
  className: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  studentCount: number;
  resultsEntered: number;
  resultsDraft: number;
  resultsSubmitted: number;
  resultsApproved: number;
  resultsPublished: number;
}

interface Session {
  id: string;
  name: string;
  is_current: boolean;
}

interface Term {
  id: string;
  name: string;
  session_id: string;
  is_current: boolean;
}

export default function ClassesOverview() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [filteredTerms, setFilteredTerms] = useState<Term[]>([]);

  useEffect(() => {
    fetchSessionsAndTerms();
  }, []);

  useEffect(() => {
    if (selectedSession) {
      const filtered = terms.filter((t) => t.session_id === selectedSession);
      setFilteredTerms(filtered);
      const currentTerm = filtered.find((t) => t.is_current);
      if (currentTerm) {
        setSelectedTerm(currentTerm.id);
      } else if (filtered.length > 0) {
        setSelectedTerm(filtered[0].id);
      }
    }
  }, [selectedSession, terms]);

  useEffect(() => {
    if (selectedTerm) {
      fetchAssignments();
    }
  }, [selectedTerm, user]);

  const fetchSessionsAndTerms = async () => {
    try {
      const [{ data: sessionsData }, { data: termsData }] = await Promise.all([
        supabase.from("academic_sessions").select("id, name, is_current").order("start_date", { ascending: false }),
        supabase.from("terms").select("id, name, session_id, is_current").order("start_date", { ascending: false }),
      ]);

      setSessions(sessionsData || []);
      setTerms(termsData || []);

      const currentSession = sessionsData?.find((s) => s.is_current);
      if (currentSession) {
        setSelectedSession(currentSession.id);
      } else if (sessionsData && sessionsData.length > 0) {
        setSelectedSession(sessionsData[0].id);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const fetchAssignments = async () => {
    if (!user || !selectedTerm) return;

    try {
      setLoading(true);

      // Get teacher record
      const { data: teacher, error: teacherError } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (teacherError) throw teacherError;
      if (!teacher) {
        setLoading(false);
        return;
      }

      // Get current session from selected term
      const { data: termData } = await supabase
        .from("terms")
        .select("session_id")
        .eq("id", selectedTerm)
        .single();

      if (!termData) {
        setLoading(false);
        return;
      }

      // Get teacher assignments for current session
      const { data: teacherSubjects, error: assignError } = await supabase
        .from("teacher_subjects")
        .select("id, class_arm_id, subject_id")
        .eq("teacher_id", teacher.id)
        .eq("session_id", termData.session_id);

      if (assignError) throw assignError;
      if (!teacherSubjects || teacherSubjects.length === 0) {
        setAssignments([]);
        setLoading(false);
        return;
      }

      // Enrich assignments with details
      const enrichedAssignments = await Promise.all(
        teacherSubjects.map(async (ts) => {
          const [{ data: classArm }, { data: subject }] = await Promise.all([
            supabase.from("class_arms").select("id, name, class:classes(name)").eq("id", ts.class_arm_id).maybeSingle(),
            supabase.from("subjects").select("id, name, code").eq("id", ts.subject_id).maybeSingle(),
          ]);

          // Get student count in this class arm
          const { count: studentCount } = await supabase
            .from("students")
            .select("id", { count: "exact", head: true })
            .eq("current_class_arm_id", ts.class_arm_id)
            .eq("is_active", true);

          // Get results status for this class/term
          const { data: results } = await supabase
            .from("results")
            .select("id, status")
            .eq("class_arm_id", ts.class_arm_id)
            .eq("term_id", selectedTerm);

          // Count result components for this subject
          let resultsEntered = 0;
          let resultsDraft = 0;
          let resultsSubmitted = 0;
          let resultsApproved = 0;
          let resultsPublished = 0;

          if (results && results.length > 0) {
            const resultIds = results.map((r) => r.id);
            const { data: components } = await supabase
              .from("result_components")
              .select("id, result_id")
              .eq("subject_id", ts.subject_id)
              .in("result_id", resultIds);

            resultsEntered = components?.length || 0;

            // Count by status
            const resultStatusMap = new Map(results.map((r) => [r.id, r.status]));
            components?.forEach((comp) => {
              const status = resultStatusMap.get(comp.result_id);
              if (status === "draft") resultsDraft++;
              else if (status === "submitted") resultsSubmitted++;
              else if (status === "approved") resultsApproved++;
              else if (status === "published") resultsPublished++;
            });
          }

          return {
            id: ts.id,
            classArmId: ts.class_arm_id,
            classArmName: classArm?.name || "Unknown",
            className: classArm?.class?.name || "Unknown",
            subjectId: ts.subject_id,
            subjectName: subject?.name || "Unknown",
            subjectCode: subject?.code || "N/A",
            studentCount: studentCount || 0,
            resultsEntered,
            resultsDraft,
            resultsSubmitted,
            resultsApproved,
            resultsPublished,
          };
        })
      );

      setAssignments(enrichedAssignments);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (assignment: ClassAssignment) => {
    if (assignment.resultsPublished > 0 && assignment.resultsPublished === assignment.studentCount) {
      return (
        <Badge variant="default" className="bg-success hover:bg-success/90">
          <CheckCircle className="h-3 w-3 mr-1" />
          Published
        </Badge>
      );
    }
    if (assignment.resultsApproved > 0) {
      return (
        <Badge variant="default" className="bg-primary hover:bg-primary/90">
          <CheckCircle className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      );
    }
    if (assignment.resultsSubmitted > 0) {
      return (
        <Badge variant="secondary" className="bg-accent text-accent-foreground">
          <Clock className="h-3 w-3 mr-1" />
          Submitted
        </Badge>
      );
    }
    if (assignment.resultsDraft > 0 || assignment.resultsEntered > 0) {
      return (
        <Badge variant="outline" className="border-warning text-warning">
          <Clock className="h-3 w-3 mr-1" />
          In Progress
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <AlertCircle className="h-3 w-3 mr-1" />
        Not Started
      </Badge>
    );
  };

  const getProgress = (assignment: ClassAssignment) => {
    if (assignment.studentCount === 0) return 0;
    return Math.round((assignment.resultsEntered / assignment.studentCount) * 100);
  };

  const stats = {
    totalClasses: assignments.length,
    completed: assignments.filter((a) => a.resultsEntered === a.studentCount && a.studentCount > 0).length,
    inProgress: assignments.filter((a) => a.resultsEntered > 0 && a.resultsEntered < a.studentCount).length,
    notStarted: assignments.filter((a) => a.resultsEntered === 0).length,
    totalStudents: assignments.reduce((sum, a) => sum + a.studentCount, 0),
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
          <h1 className="text-2xl font-bold text-foreground">My Classes</h1>
          <p className="text-muted-foreground">
            View all assigned classes and result entry status
          </p>
        </div>
        <Button onClick={() => navigate("/teacher/results")}>
          <Edit className="h-4 w-4 mr-2" />
          Enter Results
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="w-full sm:w-auto min-w-[200px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Session</label>
              <Select value={selectedSession} onValueChange={setSelectedSession}>
                <SelectTrigger>
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.name} {session.is_current && "(Current)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-auto min-w-[200px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Term</label>
              <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                <SelectTrigger>
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTerms.map((term) => (
                    <SelectItem key={term.id} value={term.id}>
                      {term.name} {term.is_current && "(Current)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalClasses}</p>
                <p className="text-xs text-muted-foreground">Total Classes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.notStarted}</p>
                <p className="text-xs text-muted-foreground">Not Started</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent">
                <Users className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalStudents}</p>
                <p className="text-xs text-muted-foreground">Total Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Classes Grid */}
      {assignments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No Classes Assigned</h3>
            <p className="text-muted-foreground">
              You don't have any classes assigned for this term.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignments.map((assignment) => (
            <Card
              key={assignment.id}
              className="hover:border-primary/30 hover:shadow-md transition-all cursor-pointer"
              onClick={() => navigate("/teacher/results")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {assignment.className} - {assignment.classArmName}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {assignment.subjectName} ({assignment.subjectCode})
                    </p>
                  </div>
                  {getStatusBadge(assignment)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {assignment.studentCount} students
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    {assignment.resultsEntered} / {assignment.studentCount} entered
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{getProgress(assignment)}%</span>
                  </div>
                  <Progress value={getProgress(assignment)} className="h-2" />
                </div>

                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border">
                  <div className="text-center">
                    <p className="text-lg font-bold text-muted-foreground">{assignment.resultsDraft}</p>
                    <p className="text-xs text-muted-foreground">Draft</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-accent-foreground">{assignment.resultsSubmitted}</p>
                    <p className="text-xs text-muted-foreground">Submitted</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-primary">{assignment.resultsApproved}</p>
                    <p className="text-xs text-muted-foreground">Approved</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-success">{assignment.resultsPublished}</p>
                    <p className="text-xs text-muted-foreground">Published</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
