import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Users, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Student = Tables<"students">;
type ClassArm = Tables<"class_arms">;
type Class = Tables<"classes">;

interface StudentFormData {
  first_name: string;
  middle_name: string;
  last_name: string;
  admission_number: string;
  gender: string;
  date_of_birth: string;
  current_class_arm_id: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string;
  address: string;
}

const defaultFormData: StudentFormData = {
  first_name: "",
  middle_name: "",
  last_name: "",
  admission_number: "",
  gender: "",
  date_of_birth: "",
  current_class_arm_id: "",
  guardian_name: "",
  guardian_phone: "",
  guardian_email: "",
  address: "",
};

export default function StudentManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState<StudentFormData>(defaultFormData);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClass, setFilterClass] = useState<string>("all");

  // Fetch students
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("last_name", { ascending: true });
      if (error) throw error;
      return data as Student[];
    },
  });

  // Fetch class arms with class info
  const { data: classArms = [] } = useQuery({
    queryKey: ["class-arms-with-classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_arms")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return data as ClassArm[];
    },
  });

  // Fetch classes
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("is_active", true)
        .order("level", { ascending: true });
      if (error) throw error;
      return data as Class[];
    },
  });

  // Create student mutation
  const createMutation = useMutation({
    mutationFn: async (data: TablesInsert<"students">) => {
      const { error } = await supabase.from("students").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast({ title: "Student added successfully" });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error adding student", description: error.message, variant: "destructive" });
    },
  });

  // Update student mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TablesUpdate<"students"> }) => {
      const { error } = await supabase.from("students").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast({ title: "Student updated successfully" });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error updating student", description: error.message, variant: "destructive" });
    },
  });

  // Delete student mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast({ title: "Student deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting student", description: error.message, variant: "destructive" });
    },
  });

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("students").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast({ title: "Student status updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating status", description: error.message, variant: "destructive" });
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingStudent(null);
    setFormData(defaultFormData);
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      first_name: student.first_name,
      middle_name: student.middle_name || "",
      last_name: student.last_name,
      admission_number: student.admission_number,
      gender: student.gender || "",
      date_of_birth: student.date_of_birth || "",
      current_class_arm_id: student.current_class_arm_id || "",
      guardian_name: student.guardian_name || "",
      guardian_phone: student.guardian_phone || "",
      guardian_email: student.guardian_email || "",
      address: student.address || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const studentData = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      middle_name: formData.middle_name || null,
      admission_number: formData.admission_number,
      gender: formData.gender || null,
      date_of_birth: formData.date_of_birth || null,
      current_class_arm_id: formData.current_class_arm_id || null,
      guardian_name: formData.guardian_name || null,
      guardian_phone: formData.guardian_phone || null,
      guardian_email: formData.guardian_email || null,
      address: formData.address || null,
    };

    if (editingStudent) {
      updateMutation.mutate({ id: editingStudent.id, data: studentData });
    } else {
      createMutation.mutate(studentData);
    }
  };

  const getClassName = (classArmId: string | null) => {
    if (!classArmId) return "Not Assigned";
    const classArm = classArms.find((ca) => ca.id === classArmId);
    if (!classArm) return "Unknown";
    const classInfo = classes.find((c) => c.id === classArm.class_id);
    return classInfo ? `${classInfo.name} - ${classArm.name}` : classArm.name;
  };

  // Group class arms by class
  const classArmsGrouped = classes.map((cls) => ({
    class: cls,
    arms: classArms.filter((arm) => arm.class_id === cls.id),
  }));

  // Filter students
  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      searchQuery === "" ||
      `${student.first_name} ${student.middle_name || ""} ${student.last_name}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      student.admission_number.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesClass =
      filterClass === "all" || student.current_class_arm_id === filterClass;

    return matchesSearch && matchesClass;
  });

  const activeCount = students.filter((s) => s.is_active).length;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Student Management</h1>
          <p className="text-muted-foreground">Manage student records and class assignments</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Student
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{students.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Students</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {students.length - activeCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or admission number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classArmsGrouped.map((group) =>
                  group.arms.map((arm) => (
                    <SelectItem key={arm.id} value={arm.id}>
                      {group.class.name} - {arm.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card>
        <CardContent className="pt-6">
          {studentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admission No.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Guardian</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No students found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-mono">{student.admission_number}</TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium">
                              {student.last_name}, {student.first_name}{" "}
                              {student.middle_name || ""}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getClassName(student.current_class_arm_id)}</TableCell>
                        <TableCell className="capitalize">{student.gender || "-"}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{student.guardian_name || "-"}</div>
                            {student.guardian_phone && (
                              <div className="text-muted-foreground text-xs">
                                {student.guardian_phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={student.is_active ? "default" : "secondary"}
                            className="cursor-pointer"
                            onClick={() =>
                              toggleActiveMutation.mutate({
                                id: student.id,
                                is_active: !student.is_active,
                              })
                            }
                          >
                            {student.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(student)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this student?")) {
                                  deleteMutation.mutate(student.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingStudent ? "Edit Student" : "Add New Student"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="middle_name">Middle Name</Label>
                <Input
                  id="middle_name"
                  value={formData.middle_name}
                  onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="admission_number">Admission Number *</Label>
                <Input
                  id="admission_number"
                  value={formData.admission_number}
                  onChange={(e) => setFormData({ ...formData, admission_number: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => setFormData({ ...formData, gender: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="current_class_arm_id">Class</Label>
                <Select
                  value={formData.current_class_arm_id}
                  onValueChange={(value) => setFormData({ ...formData, current_class_arm_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classArmsGrouped.map((group) =>
                      group.arms.map((arm) => (
                        <SelectItem key={arm.id} value={arm.id}>
                          {group.class.name} - {arm.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Guardian Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="guardian_name">Guardian Name</Label>
                  <Input
                    id="guardian_name"
                    value={formData.guardian_name}
                    onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guardian_phone">Guardian Phone</Label>
                  <Input
                    id="guardian_phone"
                    value={formData.guardian_phone}
                    onChange={(e) => setFormData({ ...formData, guardian_phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2 mt-4">
                <Label htmlFor="guardian_email">Guardian Email</Label>
                <Input
                  id="guardian_email"
                  type="email"
                  value={formData.guardian_email}
                  onChange={(e) => setFormData({ ...formData, guardian_email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingStudent ? "Update" : "Add"} Student
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
