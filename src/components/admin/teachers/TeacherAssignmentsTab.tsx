import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Teacher {
  id: string;
  staff_id: string;
  profile?: {
    full_name: string;
  };
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface ClassArm {
  id: string;
  name: string;
  class?: {
    name: string;
  };
}

interface Session {
  id: string;
  name: string;
  is_current: boolean;
}

interface TeacherAssignment {
  id: string;
  teacher_id: string;
  subject_id: string;
  class_arm_id: string;
  session_id: string;
  assigned_at: string;
  teacher?: Teacher;
  subject?: Subject;
  class_arm?: ClassArm;
  session?: Session;
}

export const TeacherAssignmentsTab = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classArms, setClassArms] = useState<ClassArm[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    teacher_id: "",
    subject_id: "",
    class_arm_id: "",
    session_id: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    await Promise.all([
      fetchAssignments(),
      fetchTeachers(),
      fetchSubjects(),
      fetchClassArms(),
      fetchSessions(),
    ]);
    setLoading(false);
  };

  const fetchAssignments = async () => {
    const { data, error } = await supabase
      .from("teacher_subjects")
      .select(`
        *,
        teacher:teachers(id, staff_id, user_id),
        subject:subjects(id, name, code),
        class_arm:class_arms(id, name, class_id),
        session:academic_sessions(id, name, is_current)
      `)
      .order("assigned_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch assignments");
      return;
    }

    // Fetch related data separately
    const teacherUserIds = data?.map((a) => a.teacher?.user_id).filter(Boolean) || [];
    const classIds = data?.map((a) => a.class_arm?.class_id).filter(Boolean) || [];

    const [profilesRes, classesRes] = await Promise.all([
      teacherUserIds.length > 0
        ? supabase.from("profiles").select("id, full_name").in("id", teacherUserIds)
        : { data: [] },
      classIds.length > 0
        ? supabase.from("classes").select("id, name").in("id", classIds)
        : { data: [] },
    ]);

    const profileMap = new Map(profilesRes.data?.map((p) => [p.id, p] as const) || []);
    const classMap = new Map(classesRes.data?.map((c) => [c.id, c] as const) || []);

    const enrichedAssignments = data?.map((a) => ({
      ...a,
      teacher: a.teacher ? {
        ...a.teacher,
        profile: profileMap.get(a.teacher.user_id),
      } : undefined,
      class_arm: a.class_arm ? {
        ...a.class_arm,
        class: classMap.get(a.class_arm.class_id),
      } : undefined,
    })) as TeacherAssignment[];

    setAssignments(enrichedAssignments);
  };

  const fetchTeachers = async () => {
    const { data, error } = await supabase
      .from("teachers")
      .select("id, staff_id, user_id")
      .eq("is_active", true)
      .order("staff_id");

    if (error) {
      toast.error("Failed to fetch teachers");
      return;
    }

    // Fetch profiles separately
    const userIds = data?.map((t) => t.user_id) || [];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]));
      const teachersWithProfiles = data?.map((t) => ({
        id: t.id,
        staff_id: t.staff_id,
        profile: profileMap.get(t.user_id),
      })) as Teacher[];
      setTeachers(teachersWithProfiles);
    } else {
      setTeachers(data?.map((t) => ({ id: t.id, staff_id: t.staff_id })) || []);
    }
  };

  const fetchSubjects = async () => {
    const { data } = await supabase
      .from("subjects")
      .select("id, name, code")
      .eq("is_active", true)
      .order("name");
    setSubjects(data || []);
  };

  const fetchClassArms = async () => {
    const { data, error } = await supabase
      .from("class_arms")
      .select(`
        id,
        name,
        class:classes(name)
      `)
      .eq("is_active", true)
      .order("name");

    if (error) {
      const { data: fallbackData } = await supabase
        .from("class_arms")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      setClassArms(fallbackData || []);
    } else {
      setClassArms(data || []);
    }
  };

  const fetchSessions = async () => {
    const { data } = await supabase
      .from("academic_sessions")
      .select("id, name, is_current")
      .order("start_date", { ascending: false });
    setSessions(data || []);

    // Auto-select current session
    const currentSession = data?.find((s) => s.is_current);
    if (currentSession) {
      setFormData((prev) => ({ ...prev, session_id: currentSession.id }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if assignment already exists
    const { data: existing } = await supabase
      .from("teacher_subjects")
      .select("id")
      .eq("teacher_id", formData.teacher_id)
      .eq("subject_id", formData.subject_id)
      .eq("class_arm_id", formData.class_arm_id)
      .eq("session_id", formData.session_id)
      .maybeSingle();

    if (existing) {
      toast.error("This assignment already exists");
      return;
    }

    const { error } = await supabase.from("teacher_subjects").insert({
      teacher_id: formData.teacher_id,
      subject_id: formData.subject_id,
      class_arm_id: formData.class_arm_id,
      session_id: formData.session_id,
      assigned_by: user?.id,
    });

    if (error) {
      toast.error("Failed to create assignment: " + error.message);
    } else {
      toast.success("Assignment created successfully");
      fetchAssignments();
      resetForm();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this assignment?")) return;

    const { error } = await supabase.from("teacher_subjects").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete assignment");
    } else {
      toast.success("Assignment removed successfully");
      fetchAssignments();
    }
  };

  const resetForm = () => {
    const currentSession = sessions.find((s) => s.is_current);
    setFormData({
      teacher_id: "",
      subject_id: "",
      class_arm_id: "",
      session_id: currentSession?.id || "",
    });
    setDialogOpen(false);
  };

  const getTeacherDisplayName = (teacher?: Teacher) => {
    if (!teacher) return "N/A";
    const name = teacher.profile?.full_name || teacher.staff_id;
    return `${name} (${teacher.staff_id})`;
  };

  const getClassArmDisplayName = (classArm?: ClassArm) => {
    if (!classArm) return "N/A";
    const className = classArm.class?.name || "";
    return className ? `${className} - ${classArm.name}` : classArm.name;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Subject & Class Assignments</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Assignment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Subject to Teacher</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Session</Label>
                <Select
                  value={formData.session_id}
                  onValueChange={(value) => setFormData({ ...formData, session_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select session..." />
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

              <div className="space-y-2">
                <Label>Teacher</Label>
                <Select
                  value={formData.teacher_id}
                  onValueChange={(value) => setFormData({ ...formData, teacher_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select teacher..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {getTeacherDisplayName(teacher)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Subject</Label>
                <Select
                  value={formData.subject_id}
                  onValueChange={(value) => setFormData({ ...formData, subject_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject..." />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name} ({subject.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Class Arm</Label>
                <Select
                  value={formData.class_arm_id}
                  onValueChange={(value) => setFormData({ ...formData, class_arm_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class arm..." />
                  </SelectTrigger>
                  <SelectContent>
                    {classArms.map((arm) => (
                      <SelectItem key={arm.id} value={arm.id}>
                        {getClassArmDisplayName(arm)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={!formData.teacher_id || !formData.subject_id || !formData.class_arm_id || !formData.session_id}
                >
                  Create Assignment
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">Loading...</div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No assignments found. Create your first assignment.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teacher</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Class Arm</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Assigned Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell className="font-medium">
                    {getTeacherDisplayName(assignment.teacher)}
                  </TableCell>
                  <TableCell>
                    {assignment.subject?.name || "N/A"}
                    <span className="text-muted-foreground ml-1">
                      ({assignment.subject?.code})
                    </span>
                  </TableCell>
                  <TableCell>{getClassArmDisplayName(assignment.class_arm)}</TableCell>
                  <TableCell>
                    {assignment.session?.name}
                    {assignment.session?.is_current && (
                      <Badge variant="secondary" className="ml-2">Current</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(assignment.assigned_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(assignment.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
