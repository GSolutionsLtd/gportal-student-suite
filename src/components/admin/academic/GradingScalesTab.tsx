import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface GradingScale {
  id: string;
  grade: string;
  min_score: number;
  max_score: number;
  grade_point: number | null;
  remark: string;
}

export const GradingScalesTab = () => {
  const [scales, setScales] = useState<GradingScale[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingScale, setEditingScale] = useState<GradingScale | null>(null);
  const [formData, setFormData] = useState({
    grade: "",
    min_score: 0,
    max_score: 100,
    grade_point: 0,
    remark: "",
  });

  useEffect(() => {
    fetchScales();
  }, []);

  const fetchScales = async () => {
    const { data, error } = await supabase
      .from("grading_scales")
      .select("*")
      .order("min_score", { ascending: false });

    if (error) {
      toast.error("Failed to fetch grading scales");
    } else {
      setScales(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.min_score >= formData.max_score) {
      toast.error("Min score must be less than max score");
      return;
    }

    const payload = {
      grade: formData.grade,
      min_score: formData.min_score,
      max_score: formData.max_score,
      grade_point: formData.grade_point || null,
      remark: formData.remark,
    };

    if (editingScale) {
      const { error } = await supabase
        .from("grading_scales")
        .update(payload)
        .eq("id", editingScale.id);

      if (error) {
        toast.error("Failed to update grading scale");
      } else {
        toast.success("Grading scale updated successfully");
        fetchScales();
        resetForm();
      }
    } else {
      const { error } = await supabase.from("grading_scales").insert(payload);

      if (error) {
        toast.error("Failed to create grading scale");
      } else {
        toast.success("Grading scale created successfully");
        fetchScales();
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this grading scale?")) return;

    const { error } = await supabase.from("grading_scales").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete grading scale");
    } else {
      toast.success("Grading scale deleted successfully");
      fetchScales();
    }
  };

  const resetForm = () => {
    setFormData({ grade: "", min_score: 0, max_score: 100, grade_point: 0, remark: "" });
    setEditingScale(null);
    setDialogOpen(false);
  };

  const openEditDialog = (scale: GradingScale) => {
    setEditingScale(scale);
    setFormData({
      grade: scale.grade,
      min_score: Number(scale.min_score),
      max_score: Number(scale.max_score),
      grade_point: Number(scale.grade_point) || 0,
      remark: scale.remark,
    });
    setDialogOpen(true);
  };

  const getGradeColor = (grade: string) => {
    switch (grade.toUpperCase()) {
      case "A":
      case "A1":
        return "bg-green-500";
      case "B":
      case "B2":
      case "B3":
        return "bg-blue-500";
      case "C":
      case "C4":
      case "C5":
      case "C6":
        return "bg-yellow-500";
      case "D":
      case "D7":
        return "bg-orange-500";
      case "E":
      case "E8":
        return "bg-red-400";
      case "F":
      case "F9":
        return "bg-red-600";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Grading Scales</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Grade
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingScale ? "Edit Grade" : "Add New Grade"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="grade">Grade</Label>
                  <Input
                    id="grade"
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: e.target.value.toUpperCase() })}
                    placeholder="e.g., A, B, C"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grade_point">Grade Point</Label>
                  <Input
                    id="grade_point"
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={formData.grade_point}
                    onChange={(e) => setFormData({ ...formData, grade_point: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min_score">Min Score (%)</Label>
                  <Input
                    id="min_score"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.min_score}
                    onChange={(e) => setFormData({ ...formData, min_score: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_score">Max Score (%)</Label>
                  <Input
                    id="max_score"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.max_score}
                    onChange={(e) => setFormData({ ...formData, max_score: parseInt(e.target.value) })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="remark">Remark</Label>
                <Input
                  id="remark"
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  placeholder="e.g., Excellent, Very Good"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingScale ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">Loading...</div>
        ) : scales.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No grading scales found. Create your first grade.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grade</TableHead>
                <TableHead>Score Range</TableHead>
                <TableHead>Grade Point</TableHead>
                <TableHead>Remark</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scales.map((scale) => (
                <TableRow key={scale.id}>
                  <TableCell>
                    <Badge className={`${getGradeColor(scale.grade)} text-white`}>
                      {scale.grade}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {scale.min_score}% - {scale.max_score}%
                  </TableCell>
                  <TableCell>{scale.grade_point || "-"}</TableCell>
                  <TableCell>{scale.remark}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(scale)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(scale.id)}>
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
