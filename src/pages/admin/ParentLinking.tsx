import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Link2, Unlink, Search, Users, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface ParentProfile {
  id: string;
  full_name: string;
  email: string;
}

interface StudentRecord {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
}

interface LinkRecord {
  id: string;
  parent_user_id: string;
  student_id: string;
  relationship: string;
  is_active: boolean;
  linked_at: string;
  parent?: ParentProfile;
  student?: StudentRecord;
}

export default function ParentLinking() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<LinkRecord[]>([]);
  const [parents, setParents] = useState<ParentProfile[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newLink, setNewLink] = useState({
    parent_user_id: "",
    student_id: "",
    relationship: "guardian",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch parents (users with parent role)
      const { data: parentRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "parent");

      const parentIds = parentRoles?.map((r) => r.user_id) || [];

      const [{ data: parentProfiles }, { data: studentData }, { data: linkData }] = await Promise.all([
        parentIds.length > 0
          ? supabase.from("profiles").select("id, full_name, email").in("id", parentIds)
          : Promise.resolve({ data: [] as ParentProfile[] }),
        supabase.from("students").select("id, first_name, last_name, admission_number").eq("is_active", true).order("last_name"),
        supabase.from("parent_students").select("*").order("linked_at", { ascending: false }),
      ]);

      setParents(parentProfiles || []);
      setStudents(studentData || []);

      // Enrich links
      const enriched: LinkRecord[] = (linkData || []).map((link: any) => ({
        ...link,
        parent: parentProfiles?.find((p) => p.id === link.parent_user_id),
        student: studentData?.find((s) => s.id === link.student_id),
      }));

      setLinks(enriched);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLink = async () => {
    if (!newLink.parent_user_id || !newLink.student_id) {
      toast({ title: "Missing fields", description: "Select both parent and student.", variant: "destructive" });
      return;
    }

    // Check for duplicate
    const exists = links.find(
      (l) => l.parent_user_id === newLink.parent_user_id && l.student_id === newLink.student_id && l.is_active
    );
    if (exists) {
      toast({ title: "Already linked", description: "This parent is already linked to this student.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("parent_students").insert({
        parent_user_id: newLink.parent_user_id,
        student_id: newLink.student_id,
        relationship: newLink.relationship,
        linked_by: user?.id,
      });

      if (error) throw error;

      toast({ title: "Success", description: "Parent linked to student successfully." });
      setDialogOpen(false);
      setNewLink({ parent_user_id: "", student_id: "", relationship: "guardian" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLink = async (link: LinkRecord) => {
    try {
      const { error } = await supabase
        .from("parent_students")
        .update({ is_active: !link.is_active })
        .eq("id", link.id);

      if (error) throw error;

      toast({ title: "Updated", description: `Link ${link.is_active ? "deactivated" : "activated"}.` });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const filteredLinks = links.filter((link) => {
    const q = searchQuery.toLowerCase();
    return (
      link.parent?.full_name?.toLowerCase().includes(q) ||
      link.parent?.email?.toLowerCase().includes(q) ||
      link.student?.first_name?.toLowerCase().includes(q) ||
      link.student?.last_name?.toLowerCase().includes(q) ||
      link.student?.admission_number?.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Parent-Student Linking</h1>
          <p className="text-muted-foreground">Link parents to their children so they can view results</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Link Parent to Student
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Link Parent to Student</DialogTitle>
              <DialogDescription>Select a parent and student to create a link.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Parent</Label>
                <Select value={newLink.parent_user_id} onValueChange={(v) => setNewLink({ ...newLink, parent_user_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent..." />
                  </SelectTrigger>
                  <SelectContent>
                    {parents.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name} ({p.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {parents.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">No parents registered yet. Parents must sign up first.</p>
                )}
              </div>
              <div>
                <Label>Student</Label>
                <Select value={newLink.student_id} onValueChange={(v) => setNewLink({ ...newLink, student_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select student..." />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.last_name} {s.first_name} ({s.admission_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Relationship</Label>
                <Select value={newLink.relationship} onValueChange={(v) => setNewLink({ ...newLink, relationship: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="father">Father</SelectItem>
                    <SelectItem value="mother">Mother</SelectItem>
                    <SelectItem value="guardian">Guardian</SelectItem>
                    <SelectItem value="sibling">Sibling</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateLink} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Link
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Parent-Student Links
          </CardTitle>
          <CardDescription>{links.length} total links</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or admission number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parent</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Admission No.</TableHead>
                  <TableHead>Relationship</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Linked</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLinks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No links found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLinks.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell className="font-medium">{link.parent?.full_name || "Unknown"}</TableCell>
                      <TableCell>
                        {link.student?.first_name} {link.student?.last_name}
                      </TableCell>
                      <TableCell>{link.student?.admission_number}</TableCell>
                      <TableCell className="capitalize">{link.relationship}</TableCell>
                      <TableCell>
                        <Badge variant={link.is_active ? "default" : "secondary"}>
                          {link.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(link.linked_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant={link.is_active ? "destructive" : "outline"} onClick={() => handleToggleLink(link)}>
                          {link.is_active ? (
                            <>
                              <Unlink className="h-4 w-4 mr-1" /> Deactivate
                            </>
                          ) : (
                            <>
                              <Link2 className="h-4 w-4 mr-1" /> Activate
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
