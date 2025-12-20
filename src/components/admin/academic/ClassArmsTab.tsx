import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface ClassArm {
  id: string;
  name: string;
  class_id: string;
  capacity: number | null;
  is_active: boolean;
}

interface Class {
  id: string;
  name: string;
}

export const ClassArmsTab = () => {
  const [classArms, setClassArms] = useState<ClassArm[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArm, setEditingArm] = useState<ClassArm | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    class_id: "",
    capacity: 40,
    is_active: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [armsRes, classesRes] = await Promise.all([
      supabase.from("class_arms").select("*").order("name"),
      supabase.from("classes").select("id, name").order("level"),
    ]);

    if (armsRes.error) toast.error("Failed to fetch class arms");
    else setClassArms(armsRes.data || []);

    if (classesRes.error) toast.error("Failed to fetch classes");
    else setClasses(classesRes.data || []);

    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingArm) {
      const { error } = await supabase
        .from("class_arms")
        .update(formData)
        .eq("id", editingArm.id);

      if (error) {
        toast.error("Failed to update class arm");
      } else {
        toast.success("Class arm updated successfully");
        fetchData();
        resetForm();
      }
    } else {
      const { error } = await supabase.from("class_arms").insert(formData);

      if (error) {
        toast.error("Failed to create class arm");
      } else {
        toast.success("Class arm created successfully");
        fetchData();
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this class arm?")) return;

    const { error } = await supabase.from("class_arms").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete class arm. It may have associated data.");
    } else {
      toast.success("Class arm deleted successfully");
      fetchData();
    }
  };

  const resetForm = () => {
    setFormData({ name: "", class_id: "", capacity: 40, is_active: true });
    setEditingArm(null);
    setDialogOpen(false);
  };

  const openEditDialog = (arm: ClassArm) => {
    setEditingArm(arm);
    setFormData({
      name: arm.name,
      class_id: arm.class_id,
      capacity: arm.capacity || 40,
      is_active: arm.is_active,
    });
    setDialogOpen(true);
  };

  const getClassName = (classId: string) => {
    return classes.find((c) => c.id === classId)?.name || "Unknown";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Class Arms</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Class Arm
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingArm ? "Edit Class Arm" : "Add New Class Arm"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="class">Class</Label>
                <Select
                  value={formData.class_id}
                  onValueChange={(value) => setFormData({ ...formData, class_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((classItem) => (
                      <SelectItem key={classItem.id} value={classItem.id}>
                        {classItem.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Arm Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., A, B, Gold"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacity</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min="1"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                  />
                </div>
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
                <Button type="submit">
                  {editingArm ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">Loading...</div>
        ) : classArms.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No class arms found. Create your first class arm.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>Arm</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classArms.map((arm) => (
                <TableRow key={arm.id}>
                  <TableCell className="font-medium">{getClassName(arm.class_id)}</TableCell>
                  <TableCell>{arm.name}</TableCell>
                  <TableCell>{arm.capacity || "-"}</TableCell>
                  <TableCell>
                    {arm.is_active ? (
                      <Badge>Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(arm)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(arm.id)}>
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
