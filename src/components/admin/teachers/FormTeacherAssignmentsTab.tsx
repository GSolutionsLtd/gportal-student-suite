import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Trash2 } from "lucide-react";

interface Teacher {
  id: string;
  staff_id: string;
  profile?: {
    full_name: string;
  };
}

interface ClassArm {
  id: string;
  name: string;
  form_teacher_id: string | null;
  class: {
    name: string;
  };
  form_teacher?: Teacher | null;
}

export const FormTeacherAssignmentsTab = () => {
  const [classArms, setClassArms] = useState<ClassArm[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchClassArms(), fetchTeachers()]);
    setLoading(false);
  };

  const fetchClassArms = async () => {
    const { data, error } = await supabase
      .from("class_arms")
      .select(`
        id,
        name,
        form_teacher_id,
        class:classes(name)
      `)
      .eq("is_active", true)
      .order("name");

    if (error) {
      toast.error("Failed to fetch class arms");
      return;
    }

    // Fetch form teacher details
    const formTeacherIds = data?.map(ca => ca.form_teacher_id).filter(Boolean) || [];
    let teacherMap = new Map<string, Teacher>();
    
    if (formTeacherIds.length > 0) {
      const { data: teacherData } = await supabase
        .from("teachers")
        .select("id, staff_id, user_id")
        .in("id", formTeacherIds);

      if (teacherData) {
        const userIds = teacherData.map(t => t.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]));
        teacherData.forEach(t => {
          teacherMap.set(t.id, {
            id: t.id,
            staff_id: t.staff_id,
            profile: profileMap.get(t.user_id),
          });
        });
      }
    }

    const classArmsWithTeachers = data?.map(ca => ({
      ...ca,
      form_teacher: ca.form_teacher_id ? teacherMap.get(ca.form_teacher_id) : null,
    })) as ClassArm[];

    setClassArms(classArmsWithTeachers);

    // Initialize assignments state
    const initialAssignments: Record<string, string> = {};
    classArmsWithTeachers.forEach(ca => {
      if (ca.form_teacher_id) {
        initialAssignments[ca.id] = ca.form_teacher_id;
      }
    });
    setAssignments(initialAssignments);
  };

  const fetchTeachers = async () => {
    const { data, error } = await supabase
      .from("teachers")
      .select("id, staff_id, user_id")
      .eq("is_active", true)
      .eq("is_form_teacher", true)
      .order("staff_id");

    if (error) {
      // Fallback: get all active teachers if is_form_teacher filter fails
      const { data: allTeachers } = await supabase
        .from("teachers")
        .select("id, staff_id, user_id")
        .eq("is_active", true)
        .order("staff_id");
      
      if (allTeachers) {
        await enrichTeachersWithProfiles(allTeachers);
      }
      return;
    }

    if (data && data.length === 0) {
      // No form teachers found, get all active teachers
      const { data: allTeachers } = await supabase
        .from("teachers")
        .select("id, staff_id, user_id")
        .eq("is_active", true)
        .order("staff_id");
      
      if (allTeachers) {
        await enrichTeachersWithProfiles(allTeachers);
      }
      return;
    }

    if (data) {
      await enrichTeachersWithProfiles(data);
    }
  };

  const enrichTeachersWithProfiles = async (teacherData: { id: string; staff_id: string; user_id: string }[]) => {
    const userIds = teacherData.map(t => t.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]));
    const teachersWithProfiles = teacherData.map(t => ({
      id: t.id,
      staff_id: t.staff_id,
      profile: profileMap.get(t.user_id),
    })) as Teacher[];
    
    setTeachers(teachersWithProfiles);
  };

  const handleAssignmentChange = (classArmId: string, teacherId: string) => {
    setAssignments(prev => ({
      ...prev,
      [classArmId]: teacherId,
    }));
  };

  const handleSave = async (classArmId: string) => {
    setSaving(classArmId);
    const teacherId = assignments[classArmId] || null;

    const { error } = await supabase
      .from("class_arms")
      .update({ form_teacher_id: teacherId })
      .eq("id", classArmId);

    if (error) {
      toast.error("Failed to save assignment");
    } else {
      toast.success("Form teacher assigned successfully");
      fetchClassArms();
    }
    setSaving(null);
  };

  const handleRemove = async (classArmId: string) => {
    setSaving(classArmId);
    
    const { error } = await supabase
      .from("class_arms")
      .update({ form_teacher_id: null })
      .eq("id", classArmId);

    if (error) {
      toast.error("Failed to remove assignment");
    } else {
      toast.success("Form teacher removed");
      setAssignments(prev => {
        const next = { ...prev };
        delete next[classArmId];
        return next;
      });
      fetchClassArms();
    }
    setSaving(null);
  };

  const getTeacherDisplayName = (teacher?: Teacher | null) => {
    if (!teacher) return "Not Assigned";
    const name = teacher.profile?.full_name || teacher.staff_id;
    return `${name} (${teacher.staff_id})`;
  };

  const getClassDisplayName = (classArm: ClassArm) => {
    return `${classArm.class?.name || ""} - ${classArm.name}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Form Teacher Assignments</CardTitle>
        <p className="text-sm text-muted-foreground">
          Assign form teachers to class arms. Form teachers provide additional oversight and their signatures appear on result reports.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">Loading...</div>
        ) : classArms.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No class arms found. Create class arms in Academic Configuration first.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class Arm</TableHead>
                <TableHead>Current Form Teacher</TableHead>
                <TableHead>Assign Form Teacher</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classArms.map((classArm) => (
                <TableRow key={classArm.id}>
                  <TableCell className="font-medium">
                    {getClassDisplayName(classArm)}
                  </TableCell>
                  <TableCell>
                    {classArm.form_teacher ? (
                      <Badge variant="secondary">
                        {getTeacherDisplayName(classArm.form_teacher)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">Not Assigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={assignments[classArm.id] || ""}
                      onValueChange={(value) => handleAssignmentChange(classArm.id, value)}
                    >
                      <SelectTrigger className="w-[250px]">
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
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSave(classArm.id)}
                        disabled={saving === classArm.id || !assignments[classArm.id]}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      {classArm.form_teacher_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemove(classArm.id)}
                          disabled={saving === classArm.id}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>
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
