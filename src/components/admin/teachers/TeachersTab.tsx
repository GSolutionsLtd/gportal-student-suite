import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, UserPlus } from "lucide-react";

interface Teacher {
  id: string;
  user_id: string;
  staff_id: string;
  qualification: string | null;
  specialization: string | null;
  date_joined: string;
  is_active: boolean;
  profile?: {
    full_name: string;
    email: string;
    phone: string | null;
  };
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

export const TeachersTab = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [availableProfiles, setAvailableProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [formData, setFormData] = useState({
    user_id: "",
    staff_id: "",
    qualification: "",
    specialization: "",
    date_joined: new Date().toISOString().split("T")[0],
    is_active: true,
  });

  useEffect(() => {
    fetchTeachers();
    fetchAvailableProfiles();
  }, []);

  const fetchTeachers = async () => {
    const { data, error } = await supabase
      .from("teachers")
      .select("*")
      .order("staff_id");

    if (error) {
      toast.error("Failed to fetch teachers");
      setLoading(false);
      return;
    }

    // Fetch profiles separately
    const userIds = data?.map((t) => t.user_id) || [];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]));
      const teachersWithProfiles = data?.map((t) => ({
        ...t,
        profile: profileMap.get(t.user_id),
      })) as Teacher[];
      setTeachers(teachersWithProfiles);
    } else {
      setTeachers(data || []);
    }
    setLoading(false);
  };

  const fetchAvailableProfiles = async () => {
    // Get profiles that have 'teacher' role but aren't already in teachers table
    const { data: teacherRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "teacher");

    const teacherUserIds = teacherRoles?.map((r) => r.user_id) || [];

    const { data: existingTeachers } = await supabase
      .from("teachers")
      .select("user_id");

    const existingUserIds = existingTeachers?.map((t) => t.user_id) || [];
    const availableUserIds = teacherUserIds.filter((id) => !existingUserIds.includes(id));

    if (availableUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", availableUserIds);

      setAvailableProfiles(profiles || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      user_id: formData.user_id,
      staff_id: formData.staff_id,
      qualification: formData.qualification || null,
      specialization: formData.specialization || null,
      date_joined: formData.date_joined,
      is_active: formData.is_active,
    };

    if (editingTeacher) {
      const { error } = await supabase
        .from("teachers")
        .update({
          staff_id: payload.staff_id,
          qualification: payload.qualification,
          specialization: payload.specialization,
          date_joined: payload.date_joined,
          is_active: payload.is_active,
        })
        .eq("id", editingTeacher.id);

      if (error) {
        toast.error("Failed to update teacher");
      } else {
        toast.success("Teacher updated successfully");
        fetchTeachers();
        resetForm();
      }
    } else {
      const { error } = await supabase.from("teachers").insert(payload);

      if (error) {
        toast.error("Failed to create teacher: " + error.message);
      } else {
        toast.success("Teacher created successfully");
        fetchTeachers();
        fetchAvailableProfiles();
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this teacher?")) return;

    const { error } = await supabase.from("teachers").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete teacher. They may have associated assignments.");
    } else {
      toast.success("Teacher deleted successfully");
      fetchTeachers();
      fetchAvailableProfiles();
    }
  };

  const resetForm = () => {
    setFormData({
      user_id: "",
      staff_id: "",
      qualification: "",
      specialization: "",
      date_joined: new Date().toISOString().split("T")[0],
      is_active: true,
    });
    setEditingTeacher(null);
    setDialogOpen(false);
  };

  const openEditDialog = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      user_id: teacher.user_id,
      staff_id: teacher.staff_id,
      qualification: teacher.qualification || "",
      specialization: teacher.specialization || "",
      date_joined: teacher.date_joined,
      is_active: teacher.is_active,
    });
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Teachers</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Teacher
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingTeacher ? "Edit Teacher" : "Add New Teacher"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingTeacher && (
                <div className="space-y-2">
                  <Label htmlFor="user_id">Select User</Label>
                  {availableProfiles.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-3 border rounded-md">
                      <UserPlus className="h-4 w-4 inline mr-2" />
                      No available users with teacher role. Users must first sign up and be assigned the teacher role.
                    </div>
                  ) : (
                    <select
                      id="user_id"
                      value={formData.user_id}
                      onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                      className="w-full h-10 px-3 border rounded-md bg-background"
                      required
                    >
                      <option value="">Select a user...</option>
                      {availableProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.full_name} ({profile.email})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="staff_id">Staff ID</Label>
                <Input
                  id="staff_id"
                  value={formData.staff_id}
                  onChange={(e) => setFormData({ ...formData, staff_id: e.target.value.toUpperCase() })}
                  placeholder="e.g., TCH001"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="qualification">Qualification</Label>
                  <Input
                    id="qualification"
                    value={formData.qualification}
                    onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                    placeholder="e.g., B.Ed, M.Sc"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialization">Specialization</Label>
                  <Input
                    id="specialization"
                    value={formData.specialization}
                    onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                    placeholder="e.g., Mathematics"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date_joined">Date Joined</Label>
                <Input
                  id="date_joined"
                  type="date"
                  value={formData.date_joined}
                  onChange={(e) => setFormData({ ...formData, date_joined: e.target.value })}
                  required
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!editingTeacher && availableProfiles.length === 0}>
                  {editingTeacher ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">Loading...</div>
        ) : teachers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No teachers found. Add your first teacher.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Qualification</TableHead>
                <TableHead>Specialization</TableHead>
                <TableHead>Date Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map((teacher) => (
                <TableRow key={teacher.id}>
                  <TableCell className="font-mono">{teacher.staff_id}</TableCell>
                  <TableCell className="font-medium">
                    {teacher.profile?.full_name || "N/A"}
                  </TableCell>
                  <TableCell>{teacher.profile?.email || "N/A"}</TableCell>
                  <TableCell>{teacher.qualification || "-"}</TableCell>
                  <TableCell>{teacher.specialization || "-"}</TableCell>
                  <TableCell>{new Date(teacher.date_joined).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {teacher.is_active ? (
                      <Badge>Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(teacher)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(teacher.id)}>
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
