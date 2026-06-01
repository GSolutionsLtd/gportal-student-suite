import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolFeatures } from "@/hooks/useSchoolFeatures";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileText, Download, CheckCircle2, X, Search } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface AssignmentRow {
  id: string;
  title: string;
  max_score: number;
  due_at: string | null;
  status: string;
  scores_approved: boolean;
  teacher_id: string;
  class_arm_id: string;
  subject_id: string;
  session_id: string | null;
  term_id: string | null;
  created_at: string;
  teachers?: { id: string; profiles?: { full_name: string } | null };
  class_arms?: { name: string };
  subjects?: { name: string };
  submission_count?: number;
}

export default function AdminAssignments() {
  const { user } = useAuth();
  const { features, schoolId, loading: featuresLoading } = useSchoolFeatures();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [search, setSearch] = useState("");
  const [teacherFilter, setTeacherFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (!schoolId) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("assignments")
        .select(
          "id, title, max_score, due_at, status, scores_approved, teacher_id, class_arm_id, subject_id, session_id, term_id, created_at, teachers(id, profiles:profiles!teachers_user_id_fkey(full_name)), class_arms(name), subjects(name)"
        )
        .eq("school_id", schoolId!)
        .order("created_at", { ascending: false });

      if (error) {
        // Fallback (FK alias may differ); fetch without nested profile
        const { data: simple } = await supabase
          .from("assignments")
          .select(
            "id, title, max_score, due_at, status, scores_approved, teacher_id, class_arm_id, subject_id, session_id, term_id, created_at, class_arms(name), subjects(name)"
          )
          .eq("school_id", schoolId!)
          .order("created_at", { ascending: false });

        // Resolve teacher names manually
        const ids = Array.from(new Set((simple || []).map((r: any) => r.teacher_id)));
        const { data: teachers } = await supabase
          .from("teachers")
          .select("id, user_id")
          .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
        const userIds = (teachers || []).map((t: any) => t.user_id);
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
        const teacherToName = new Map(
          (teachers || []).map((t: any) => [
            t.id,
            (profs || []).find((p: any) => p.id === t.user_id)?.full_name || "Teacher",
          ])
        );
        const merged = (simple || []).map((r: any) => ({
          ...r,
          teachers: { id: r.teacher_id, profiles: { full_name: teacherToName.get(r.teacher_id) || "Teacher" } },
        }));
        await attachSubmissionCounts(merged);
        return;
      }

      await attachSubmissionCounts((data as any) || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const attachSubmissionCounts = async (list: AssignmentRow[]) => {
    if (list.length === 0) {
      setRows([]);
      return;
    }
    const ids = list.map((r) => r.id);
    const { data: subs } = await supabase
      .from("assignment_submissions")
      .select("assignment_id, submitted_at")
      .in("assignment_id", ids);
    const counts = new Map<string, number>();
    (subs || []).forEach((s: any) => {
      if (s.submitted_at) counts.set(s.assignment_id, (counts.get(s.assignment_id) || 0) + 1);
    });
    setRows(list.map((r) => ({ ...r, submission_count: counts.get(r.id) || 0 })));
  };

  const toggleApproval = async (a: AssignmentRow) => {
    const next = !a.scores_approved;
    const { error } = await supabase
      .from("assignments")
      .update({
        scores_approved: next,
        approved_by: next ? user!.id : null,
        approved_at: next ? new Date().toISOString() : null,
      })
      .eq("id", a.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: next ? "Approved" : "Approval revoked" });
    refresh();
  };

  const teacherOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      map.set(r.teacher_id, r.teachers?.profiles?.full_name || "Teacher");
    });
    return Array.from(map.entries());
  }, [rows]);

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => map.set(r.class_arm_id, r.class_arms?.name || "Class"));
    return Array.from(map.entries());
  }, [rows]);

  const filtered = rows.filter((r) => {
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (teacherFilter !== "all" && r.teacher_id !== teacherFilter) return false;
    if (classFilter !== "all" && r.class_arm_id !== classFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  });

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Assignment Report", 14, 16);
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), "PPP p")}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [["Title", "Teacher", "Class", "Subject", "Due", "Status", "Approval", "Submissions", "Max"]],
      body: filtered.map((r) => [
        r.title,
        r.teachers?.profiles?.full_name || "—",
        r.class_arms?.name || "—",
        r.subjects?.name || "—",
        r.due_at ? format(new Date(r.due_at), "PP") : "—",
        r.status,
        r.scores_approved ? "Approved" : "Pending",
        String(r.submission_count ?? 0),
        String(r.max_score),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [55, 65, 200] },
    });

    doc.save(`assignments-report-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`);
  };

  if (featuresLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!features.assignments) {
    return (
      <div className="max-w-xl mx-auto mt-12 text-center space-y-3">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
        <h2 className="text-xl font-bold">Assignments module is disabled</h2>
        <p className="text-muted-foreground">
          Enable it in Lovable Cloud → School Features to allow teachers and students to use this module.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Assignment Monitoring</h1>
          <p className="text-muted-foreground">
            Oversee all assignments created by teachers. Approve scores and export reports.
          </p>
        </div>
        <Button onClick={exportPDF} disabled={filtered.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Export PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search title..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={teacherFilter} onValueChange={setTeacherFilter}>
              <SelectTrigger><SelectValue placeholder="Teacher" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teachers</SelectItem>
                {teacherOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submissions</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No assignments match the current filters.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell>{r.teachers?.profiles?.full_name || "—"}</TableCell>
                  <TableCell>{r.class_arms?.name || "—"}</TableCell>
                  <TableCell>{r.subjects?.name || "—"}</TableCell>
                  <TableCell>{r.due_at ? format(new Date(r.due_at), "PP") : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "published" ? "default" : "outline"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.submission_count ?? 0}</TableCell>
                  <TableCell>
                    {r.scores_approved ? (
                      <Badge>Approved</Badge>
                    ) : (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant={r.scores_approved ? "outline" : "default"}
                      onClick={() => toggleApproval(r)}
                    >
                      {r.scores_approved ? (
                        <><X className="h-4 w-4 mr-1" /> Revoke</>
                      ) : (
                        <><CheckCircle2 className="h-4 w-4 mr-1" /> Approve</>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
