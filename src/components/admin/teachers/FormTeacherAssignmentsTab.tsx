import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Trash2, Users, Loader2 } from "lucide-react";

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
  const [selectedClassArms, setSelectedClassArms] = useState<Set<string>>(new Set());
  const [bulkTeacherId, setBulkTeacherId] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

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
      .select(`id, name, form_teacher_id, class:classes(name)`)
      .eq("is_active", true)
      .order("name");

    if (error) {
      toast.error("Failed to fetch class arms");
      return;
    }

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
      .order("staff_id");

    if (error) {
      toast.error("Failed to fetch teachers");
      return;
    }

    if (data) {
      const userIds = data.map(t => t.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]));
      setTeachers(data.map(t => ({
        id: t.id,
        staff_id: t.staff_id,
        profile: profileMap.get(t.user_id),
      })) as Teacher[]);
    }
  };

  const handleAssignmentChange = (classArmId: string, teacherId: string) => {
    setAssignments(prev => ({ ...prev, [classArmId]: teacherId }));
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

  const toggleClassArm = (id: string) => {
    setSelectedClassArms(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedClassArms.size === classArms.length) {
      setSelectedClassArms(new Set());
    } else {
      setSelectedClassArms(new Set(classArms.map(ca => ca.id)));
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkTeacherId || selectedClassArms.size === 0) return;
    setBulkSaving(true);

    const ids = Array.from(selectedClassArms);
    const { error } = await supabase
      .from("class_arms")
      .update({ form_teacher_id: bulkTeacherId })
      .in("id", ids);

    if (error) {
      toast.error("Failed to bulk assign form teacher");
    } else {
      toast.success(`Form teacher assigned to ${ids.length} class arm(s)`);
      setSelectedClassArms(new Set());
      setBulkTeacherId("");
      fetchClassArms();
    }
    setBulkSaving(false);
  };

  const handleBulkRemove = async () => {
    if (selectedClassArms.size === 0) return;
    setBulkSaving(true);

    const ids = Array.from(selectedClassArms);
    const { error } = await supabase
      .from("class_arms")
      .update({ form_teacher_id: null })
      .in("id", ids);

    if (error) {
      toast.error("Failed to bulk remove assignments");
    } else {
      toast.success(`Form teacher removed from ${ids.length} class arm(s)`);
      setSelectedClassArms(new Set());
      fetchClassArms();
    }
    setBulkSaving(false);
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
      <CardContent className="space-y-4">
        {/* Bulk actions bar */}
        {selectedClassArms.size > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
            <Badge variant="secondary">{selectedClassArms.size} selected</Badge>
            <Select value={bulkTeacherId} onValueChange={setBulkTeacherId}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select teacher for bulk assign..." />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {getTeacherDisplayName(teacher)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleBulkAssign}
              disabled={!bulkTeacherId || bulkSaving}
            >
              {bulkSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Users className="h-4 w-4 mr-1" />}
              Bulk Assign
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkRemove}
              disabled={bulkSaving}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Bulk Remove
            </Button>
          </div>
        )}

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
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedClassArms.size === classArms.length && classArms.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Class Arm</TableHead>
                <TableHead>Current Form Teacher</TableHead>
                <TableHead>Assign Form Teacher</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classArms.map((classArm) => (
                <TableRow key={classArm.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedClassArms.has(classArm.id)}
                      onCheckedChange={() => toggleClassArm(classArm.id)}
                    />
                  </TableCell>
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
