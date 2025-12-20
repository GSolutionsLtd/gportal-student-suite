import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ScoreWeight {
  id: string;
  session_id: string;
  test1_weight: number;
  test2_weight: number;
  exam_weight: number;
}

interface Session {
  id: string;
  name: string;
}

export const ScoreWeightsTab = () => {
  const [weights, setWeights] = useState<ScoreWeight[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWeight, setEditingWeight] = useState<ScoreWeight | null>(null);
  const [formData, setFormData] = useState({
    session_id: "",
    test1_weight: 10,
    test2_weight: 20,
    exam_weight: 70,
  });

  const totalWeight = formData.test1_weight + formData.test2_weight + formData.exam_weight;
  const isValidTotal = totalWeight === 100;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [weightsRes, sessionsRes] = await Promise.all([
      supabase.from("score_weights").select("*").order("created_at", { ascending: false }),
      supabase.from("academic_sessions").select("id, name").order("start_date", { ascending: false }),
    ]);

    if (weightsRes.error) toast.error("Failed to fetch score weights");
    else setWeights(weightsRes.data || []);

    if (sessionsRes.error) toast.error("Failed to fetch sessions");
    else setSessions(sessionsRes.data || []);

    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidTotal) {
      toast.error("Weights must add up to 100%");
      return;
    }

    if (editingWeight) {
      const { error } = await supabase
        .from("score_weights")
        .update({
          test1_weight: formData.test1_weight,
          test2_weight: formData.test2_weight,
          exam_weight: formData.exam_weight,
        })
        .eq("id", editingWeight.id);

      if (error) {
        toast.error("Failed to update score weights");
      } else {
        toast.success("Score weights updated successfully");
        fetchData();
        resetForm();
      }
    } else {
      // Check if session already has weights
      const existing = weights.find((w) => w.session_id === formData.session_id);
      if (existing) {
        toast.error("This session already has score weights configured");
        return;
      }

      const { error } = await supabase.from("score_weights").insert(formData);

      if (error) {
        toast.error("Failed to create score weights");
      } else {
        toast.success("Score weights created successfully");
        fetchData();
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete these score weights?")) return;

    const { error } = await supabase.from("score_weights").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete score weights");
    } else {
      toast.success("Score weights deleted successfully");
      fetchData();
    }
  };

  const resetForm = () => {
    setFormData({ session_id: "", test1_weight: 10, test2_weight: 20, exam_weight: 70 });
    setEditingWeight(null);
    setDialogOpen(false);
  };

  const openEditDialog = (weight: ScoreWeight) => {
    setEditingWeight(weight);
    setFormData({
      session_id: weight.session_id,
      test1_weight: Number(weight.test1_weight),
      test2_weight: Number(weight.test2_weight),
      exam_weight: Number(weight.exam_weight),
    });
    setDialogOpen(true);
  };

  const getSessionName = (sessionId: string) => {
    return sessions.find((s) => s.id === sessionId)?.name || "Unknown";
  };

  const availableSessions = sessions.filter(
    (s) => !weights.some((w) => w.session_id === s.id) || editingWeight?.session_id === s.id
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Score Weights</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Configure how test and exam scores are weighted for each session
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Weights
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingWeight ? "Edit Score Weights" : "Add Score Weights"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="session">Session</Label>
                <Select
                  value={formData.session_id}
                  onValueChange={(value) => setFormData({ ...formData, session_id: value })}
                  disabled={!!editingWeight}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select session" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="test1">Test 1 (%)</Label>
                  <Input
                    id="test1"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.test1_weight}
                    onChange={(e) => setFormData({ ...formData, test1_weight: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="test2">Test 2 (%)</Label>
                  <Input
                    id="test2"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.test2_weight}
                    onChange={(e) => setFormData({ ...formData, test2_weight: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exam">Exam (%)</Label>
                  <Input
                    id="exam"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.exam_weight}
                    onChange={(e) => setFormData({ ...formData, exam_weight: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>

              <div className={`text-sm font-medium ${isValidTotal ? "text-green-600" : "text-destructive"}`}>
                Total: {totalWeight}% {isValidTotal ? "✓" : "(must equal 100%)"}
              </div>

              {!isValidTotal && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    The weights must add up to exactly 100%
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!isValidTotal || !formData.session_id}>
                  {editingWeight ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">Loading...</div>
        ) : weights.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No score weights configured. Add weights for an academic session.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session</TableHead>
                <TableHead className="text-center">Test 1</TableHead>
                <TableHead className="text-center">Test 2</TableHead>
                <TableHead className="text-center">Exam</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weights.map((weight) => (
                <TableRow key={weight.id}>
                  <TableCell className="font-medium">{getSessionName(weight.session_id)}</TableCell>
                  <TableCell className="text-center">{weight.test1_weight}%</TableCell>
                  <TableCell className="text-center">{weight.test2_weight}%</TableCell>
                  <TableCell className="text-center">{weight.exam_weight}%</TableCell>
                  <TableCell className="text-center font-medium">
                    {Number(weight.test1_weight) + Number(weight.test2_weight) + Number(weight.exam_weight)}%
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(weight)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(weight.id)}>
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
