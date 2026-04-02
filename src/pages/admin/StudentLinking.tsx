import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Link2, Loader2, Search, ShieldAlert, Unlink } from "lucide-react";

interface StudentAccount {
  id: string;
  full_name: string;
  email: string;
}

interface StudentRecord {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string | null;
  user_id: string | null;
}

export default function StudentLinking() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [accounts, setAccounts] = useState<StudentAccount[]>([]);
  const [studentRecords, setStudentRecords] = useState<StudentRecord[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<StudentAccount | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    try {
      const { data: studentRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");

      if (rolesError) throw rolesError;

      const accountIds = studentRoles?.map((role) => role.user_id) ?? [];

      const [{ data: profiles, error: profilesError }, { data: students, error: studentsError }] = await Promise.all([
        accountIds.length > 0
          ? supabase.from("profiles").select("id, full_name, email").in("id", accountIds)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("students")
          .select("id, first_name, last_name, admission_number, user_id")
          .eq("is_active", true)
          .order("last_name"),
      ]);

      if (profilesError) throw profilesError;
      if (studentsError) throw studentsError;

      setAccounts((profiles || []).map((profile) => ({
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
      })));
      setStudentRecords(students || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const linkedStudentByAccountId = useMemo(() => {
    return new Map(studentRecords.filter((student) => student.user_id).map((student) => [student.user_id as string, student]));
  }, [studentRecords]);

  const filteredAccounts = useMemo(() => {
    const query = search.toLowerCase();

    return accounts.filter((account) => {
      const linkedStudent = linkedStudentByAccountId.get(account.id);
      const linkedName = linkedStudent ? `${linkedStudent.first_name} ${linkedStudent.last_name}`.toLowerCase() : "";
      const linkedAdmission = linkedStudent?.admission_number?.toLowerCase() || "";

      return [account.full_name.toLowerCase(), account.email.toLowerCase(), linkedName, linkedAdmission].some((value) =>
        value.includes(query),
      );
    });
  }, [accounts, linkedStudentByAccountId, search]);

  const availableStudentOptions = useMemo(() => {
    if (!selectedAccount) return studentRecords;

    return studentRecords.filter(
      (student) => !student.user_id || student.user_id === selectedAccount.id,
    );
  }, [selectedAccount, studentRecords]);

  const openLinkDialog = (account: StudentAccount) => {
    const linkedStudent = linkedStudentByAccountId.get(account.id);
    setSelectedAccount(account);
    setSelectedStudentId(linkedStudent?.id || "");
    setDialogOpen(true);
  };

  const handleSaveLink = async () => {
    if (!selectedAccount || !selectedStudentId) {
      toast({ title: "Missing selection", description: "Choose a student record to link.", variant: "destructive" });
      return;
    }

    const selectedStudent = studentRecords.find((student) => student.id === selectedStudentId);
    if (!selectedStudent) {
      toast({ title: "Invalid student", description: "The selected student record could not be found.", variant: "destructive" });
      return;
    }

    if (selectedStudent.user_id && selectedStudent.user_id !== selectedAccount.id) {
      toast({
        title: "Already linked",
        description: "That student record is already linked to another account. Unlink it first.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const previouslyLinkedStudent = linkedStudentByAccountId.get(selectedAccount.id);

      if (previouslyLinkedStudent && previouslyLinkedStudent.id !== selectedStudentId) {
        const { error: unlinkError } = await supabase
          .from("students")
          .update({ user_id: null })
          .eq("id", previouslyLinkedStudent.id);

        if (unlinkError) throw unlinkError;
      }

      const { error } = await supabase
        .from("students")
        .update({ user_id: selectedAccount.id })
        .eq("id", selectedStudentId);

      if (error) throw error;

      toast({
        title: "Student linked",
        description: "This student account can now see its dashboard results, CBT exams, and fee payments.",
      });

      setDialogOpen(false);
      setSelectedAccount(null);
      setSelectedStudentId("");
      await loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async (studentId: string) => {
    try {
      const { error } = await supabase.from("students").update({ user_id: null }).eq("id", studentId);
      if (error) throw error;

      toast({ title: "Link removed", description: "The student account has been disconnected from this record." });
      await loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Student Account Linking</h1>
        <p className="text-muted-foreground">
          Connect signed-up student accounts to existing student records, with or without an admission number.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Access Mapping</CardTitle>
          <CardDescription>
            Once linked, results, CBT exams, and school fee records will appear on the student dashboard automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search student accounts, names, or admission no..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Account</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Linked Record</TableHead>
                  <TableHead>Admission No.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No student accounts found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAccounts.map((account) => {
                    const linkedStudent = linkedStudentByAccountId.get(account.id);

                    return (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium">{account.full_name}</TableCell>
                        <TableCell>{account.email}</TableCell>
                        <TableCell>
                          {linkedStudent ? `${linkedStudent.first_name} ${linkedStudent.last_name}` : "Not linked"}
                        </TableCell>
                        <TableCell>{linkedStudent?.admission_number || "No admission no."}</TableCell>
                        <TableCell>
                          {linkedStudent ? (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Linked
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <ShieldAlert className="h-3 w-3" />
                              Pending Link
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openLinkDialog(account)}>
                              <Link2 className="mr-1 h-4 w-4" />
                              {linkedStudent ? "Relink" : "Link"}
                            </Button>
                            {linkedStudent && (
                              <Button size="sm" variant="destructive" onClick={() => handleUnlink(linkedStudent.id)}>
                                <Unlink className="mr-1 h-4 w-4" />
                                Unlink
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Student Account</DialogTitle>
            <DialogDescription>
              Choose the existing student record that should power this account’s results, CBT exams, and payments.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Signed-up Account</Label>
              <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-foreground">
                {selectedAccount ? `${selectedAccount.full_name} (${selectedAccount.email})` : "No account selected"}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Student Record</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a student record" />
                </SelectTrigger>
                <SelectContent>
                  {availableStudentOptions.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.last_name} {student.first_name}
                      {student.admission_number ? ` (${student.admission_number})` : " (No admission no.)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLink} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}