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
import { format } from "date-fns";
import { Database } from "@/integrations/supabase/types";

type TermType = Database["public"]["Enums"]["term_type"];

interface Term {
  id: string;
  name: string;
  term_type: TermType;
  session_id: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  result_entry_deadline: string | null;
}

interface Session {
  id: string;
  name: string;
}

export const TermsTab = () => {
  const [terms, setTerms] = useState<Term[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    term_type: "first" as TermType,
    session_id: "",
    start_date: "",
    end_date: "",
    is_current: false,
    result_entry_deadline: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [termsRes, sessionsRes] = await Promise.all([
      supabase.from("terms").select("*").order("start_date", { ascending: false }),
      supabase.from("academic_sessions").select("id, name").order("start_date", { ascending: false }),
    ]);

    if (termsRes.error) toast.error("Failed to fetch terms");
    else setTerms(termsRes.data || []);

    if (sessionsRes.error) toast.error("Failed to fetch sessions");
    else setSessions(sessionsRes.data || []);

    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      ...formData,
      result_entry_deadline: formData.result_entry_deadline || null,
    };

    if (formData.is_current) {
      await supabase
        .from("terms")
        .update({ is_current: false })
        .neq("id", editingTerm?.id || "00000000-0000-0000-0000-000000000000");
    }

    if (editingTerm) {
      const { error } = await supabase
        .from("terms")
        .update(payload)
        .eq("id", editingTerm.id);

      if (error) {
        toast.error("Failed to update term");
      } else {
        toast.success("Term updated successfully");
        fetchData();
        resetForm();
      }
    } else {
      const { error } = await supabase.from("terms").insert(payload);

      if (error) {
        toast.error("Failed to create term");
      } else {
        toast.success("Term created successfully");
        fetchData();
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this term?")) return;

    const { error } = await supabase.from("terms").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete term");
    } else {
      toast.success("Term deleted successfully");
      fetchData();
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      term_type: "first",
      session_id: "",
      start_date: "",
      end_date: "",
      is_current: false,
      result_entry_deadline: "",
    });
    setEditingTerm(null);
    setDialogOpen(false);
  };

  const openEditDialog = (term: Term) => {
    setEditingTerm(term);
    setFormData({
      name: term.name,
      term_type: term.term_type,
      session_id: term.session_id,
      start_date: term.start_date,
      end_date: term.end_date,
      is_current: term.is_current,
      result_entry_deadline: term.result_entry_deadline?.split("T")[0] || "",
    });
    setDialogOpen(true);
  };

  const getSessionName = (sessionId: string) => {
    return sessions.find((s) => s.id === sessionId)?.name || "Unknown";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Terms</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Term
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTerm ? "Edit Term" : "Add New Term"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="session">Session</Label>
                <Select
                  value={formData.session_id}
                  onValueChange={(value) => setFormData({ ...formData, session_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select session" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Term Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., First Term"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="term_type">Term Type</Label>
                  <Select
                    value={formData.term_type}
                    onValueChange={(value: TermType) => setFormData({ ...formData, term_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="first">First Term</SelectItem>
                      <SelectItem value="second">Second Term</SelectItem>
                      <SelectItem value="third">Third Term</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline">Result Entry Deadline</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={formData.result_entry_deadline}
                  onChange={(e) => setFormData({ ...formData, result_entry_deadline: e.target.value })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_current"
                  checked={formData.is_current}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_current: checked })}
                />
                <Label htmlFor="is_current">Set as current term</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingTerm ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">Loading...</div>
        ) : terms.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No terms found. Create your first term.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {terms.map((term) => (
                <TableRow key={term.id}>
                  <TableCell className="font-medium">{term.name}</TableCell>
                  <TableCell>{getSessionName(term.session_id)}</TableCell>
                  <TableCell className="capitalize">{term.term_type}</TableCell>
                  <TableCell>
                    {format(new Date(term.start_date), "MMM d")} - {format(new Date(term.end_date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    {term.is_current ? (
                      <Badge>Current</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(term)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(term.id)}>
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
