import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  XCircle,
  Eye,
  Clock,
  FileCheck,
  Loader2,
  AlertCircle,
  Send,
  CheckCheck,
  Search,
  Filter,
  Calendar,
  Globe,
  EyeOff,
} from "lucide-react";
import { format } from "date-fns";

interface ResultItem {
  id: string;
  student_id: string;
  term_id: string;
  class_arm_id: string;
  status: string;
  total_score: number | null;
  average_score: number | null;
  submitted_at: string | null;
  submitted_by: string | null;
  approved_at: string | null;
  student: {
    first_name: string;
    last_name: string;
    admission_number: string;
  };
  term: {
    name: string;
    session: {
      name: string;
    };
  };
  class_arm: {
    name: string;
    class: {
      name: string;
    };
  };
  submitter?: {
    full_name: string;
  };
  components: {
    id: string;
    subject_id: string;
    test1_score: number | null;
    test2_score: number | null;
    exam_score: number | null;
    total_score: number | null;
    grade: string | null;
    subject: {
      name: string;
      code: string;
    };
  }[];
}

interface ClassArm {
  id: string;
  name: string;
  class: { name: string };
}

interface Term {
  id: string;
  name: string;
  session: { name: string };
}

export default function ResultApproval() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submittedResults, setSubmittedResults] = useState<ResultItem[]>([]);
  const [approvedResults, setApprovedResults] = useState<ResultItem[]>([]);
  const [publishedResults, setPublishedResults] = useState<ResultItem[]>([]);
  const [filteredSubmitted, setFilteredSubmitted] = useState<ResultItem[]>([]);
  const [filteredApproved, setFilteredApproved] = useState<ResultItem[]>([]);
  const [filteredPublished, setFilteredPublished] = useState<ResultItem[]>([]);
  const [selectedResult, setSelectedResult] = useState<ResultItem | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedApprovedIds, setSelectedApprovedIds] = useState<Set<string>>(new Set());
  const [selectedPublishedIds, setSelectedPublishedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("pending");

  // Filters
  const [classArms, setClassArms] = useState<ClassArm[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassArm, setSelectedClassArm] = useState<string>("all");
  const [selectedTerm, setSelectedTerm] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  useEffect(() => {
    fetchFiltersData();
    fetchResults();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [submittedResults, approvedResults, publishedResults, searchQuery, selectedClassArm, selectedTerm, dateFrom, dateTo]);

  const fetchFiltersData = async () => {
    const [{ data: classArmsData }, { data: termsData }] = await Promise.all([
      supabase.from("class_arms").select("id, name, class:classes(name)").eq("is_active", true),
      supabase.from("terms").select("id, name, session:academic_sessions(name)").order("created_at", { ascending: false }),
    ]);
    setClassArms((classArmsData as ClassArm[]) || []);
    setTerms((termsData as Term[]) || []);
  };

  const applyFilters = () => {
    const filterResults = (results: ResultItem[]) => {
      return results.filter((result) => {
        const matchesSearch =
          searchQuery === "" ||
          result.student.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          result.student.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          result.student.admission_number.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesClass = selectedClassArm === "all" || result.class_arm_id === selectedClassArm;
        const matchesTerm = selectedTerm === "all" || result.term_id === selectedTerm;

        let matchesDate = true;
        if (result.submitted_at) {
          const submittedDate = new Date(result.submitted_at);
          if (dateFrom) matchesDate = matchesDate && submittedDate >= new Date(dateFrom);
          if (dateTo) matchesDate = matchesDate && submittedDate <= new Date(dateTo + "T23:59:59");
        }

        return matchesSearch && matchesClass && matchesTerm && matchesDate;
      });
    };

    setFilteredSubmitted(filterResults(submittedResults));
    setFilteredApproved(filterResults(approvedResults));
    setFilteredPublished(filterResults(publishedResults));
  };

  const fetchResults = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchSubmittedResults(), fetchApprovedResults(), fetchPublishedResults()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchResultsByStatus = async (status: "submitted" | "approved" | "published"): Promise<ResultItem[]> => {
    const { data: results, error } = await supabase
      .from("results")
      .select("id, student_id, term_id, class_arm_id, status, total_score, average_score, submitted_at, submitted_by, approved_at")
      .eq("status", status)
      .order("submitted_at", { ascending: false });

    if (error) throw error;
    if (!results || results.length === 0) return [];

    const enrichedResults = await Promise.all(
      results.map(async (result) => {
        const [{ data: student }, { data: term }, { data: classArm }, { data: components }] = await Promise.all([
          supabase.from("students").select("first_name, last_name, admission_number").eq("id", result.student_id).maybeSingle(),
          supabase.from("terms").select("name, session:academic_sessions(name)").eq("id", result.term_id).maybeSingle(),
          supabase.from("class_arms").select("name, class:classes(name)").eq("id", result.class_arm_id).maybeSingle(),
          supabase.from("result_components").select("id, subject_id, test1_score, test2_score, exam_score, total_score, grade").eq("result_id", result.id),
        ]);

        let submitter = null;
        if (result.submitted_by) {
          const { data: submitterData } = await supabase.from("profiles").select("full_name").eq("id", result.submitted_by).maybeSingle();
          submitter = submitterData;
        }

        const enrichedComponents = await Promise.all(
          (components || []).map(async (comp) => {
            const { data: subject } = await supabase.from("subjects").select("name, code").eq("id", comp.subject_id).maybeSingle();
            return { ...comp, subject: subject || { name: "Unknown", code: "N/A" } };
          })
        );

        return {
          ...result,
          student: student || { first_name: "Unknown", last_name: "Student", admission_number: "N/A" },
          term: term || { name: "Unknown Term", session: { name: "Unknown Session" } },
          class_arm: classArm || { name: "Unknown", class: { name: "Unknown Class" } },
          submitter,
          components: enrichedComponents,
        };
      })
    );

    return enrichedResults as ResultItem[];
  };

  const fetchSubmittedResults = async () => {
    try {
      const results = await fetchResultsByStatus("submitted");
      setSubmittedResults(results);
    } catch (error) {
      console.error("Error fetching submitted results:", error);
      toast({ title: "Error", description: "Failed to fetch submitted results", variant: "destructive" });
    }
  };

  const fetchApprovedResults = async () => {
    try {
      const results = await fetchResultsByStatus("approved");
      setApprovedResults(results);
    } catch (error) {
      console.error("Error fetching approved results:", error);
      toast({ title: "Error", description: "Failed to fetch approved results", variant: "destructive" });
    }
  };

  const fetchPublishedResults = async () => {
    try {
      const results = await fetchResultsByStatus("published");
      setPublishedResults(results);
    } catch (error) {
      console.error("Error fetching published results:", error);
      toast({ title: "Error", description: "Failed to fetch published results", variant: "destructive" });
    }
  };

  const sendNotification = async (type: "approved" | "published", resultIds: string[]) => {
    try {
      const { error } = await supabase.functions.invoke("send-result-notification", {
        body: { type, resultIds },
      });
      if (error) console.error("Failed to send notification:", error);
    } catch (err) {
      console.error("Notification error:", err);
    }
  };

  const computeResultAggregates = async (resultId: string): Promise<{ success: boolean; hasScores: boolean }> => {
    // Get result components
    const { data: components, error: compError } = await supabase
      .from("result_components")
      .select("total_score")
      .eq("result_id", resultId);

    if (compError) throw compError;
    if (!components || components.length === 0) return { success: false, hasScores: false };

    const validScores = components.filter((c) => c.total_score !== null);
    if (validScores.length === 0) return { success: false, hasScores: false };

    const totalScore = validScores.reduce((sum, c) => sum + Number(c.total_score), 0);
    const avgScore = totalScore / validScores.length;

    // Update result with computed aggregates
    const { error: updateError } = await supabase
      .from("results")
      .update({
        total_score: Math.round(totalScore * 100) / 100,
        average_score: Math.round(avgScore * 100) / 100,
      })
      .eq("id", resultId);

    if (updateError) throw updateError;
    return { success: true, hasScores: true };
  };

  const computeClassPositions = async (classArmId: string, termId: string) => {
    // Get all results for the class/term
    const { data: results, error } = await supabase
      .from("results")
      .select("id, average_score")
      .eq("class_arm_id", classArmId)
      .eq("term_id", termId)
      .not("average_score", "is", null)
      .order("average_score", { ascending: false });

    if (error) throw error;
    if (!results || results.length === 0) return;

    // Update positions
    for (let i = 0; i < results.length; i++) {
      await supabase
        .from("results")
        .update({ class_position: i + 1 })
        .eq("id", results[i].id);
    }
  };

  const computeGrades = async (resultId: string) => {
    // Get grading scales
    const { data: scales } = await supabase
      .from("grading_scales")
      .select("grade, min_score, max_score, remark")
      .order("min_score", { ascending: false });

    if (!scales || scales.length === 0) return;

    // Get result components
    const { data: components } = await supabase
      .from("result_components")
      .select("id, total_score")
      .eq("result_id", resultId);

    if (!components) return;

    // Update each component with grade
    for (const comp of components) {
      if (comp.total_score === null) continue;
      const scale = scales.find((s) => comp.total_score! >= s.min_score && comp.total_score! <= s.max_score);
      if (scale) {
        await supabase
          .from("result_components")
          .update({ grade: scale.grade, remark: scale.remark })
          .eq("id", comp.id);
      }
    }
  };

  const handleApprove = async (result: ResultItem) => {
    try {
      setProcessing(true);

      // First compute aggregates
      const { success, hasScores } = await computeResultAggregates(result.id);
      if (!hasScores) {
        toast({ title: "Cannot Approve", description: "No scores entered for this result. Cannot approve.", variant: "destructive" });
        return;
      }

      // Compute grades
      await computeGrades(result.id);

      // Update status
      const { error } = await supabase
        .from("results")
        .update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() })
        .eq("id", result.id);

      if (error) throw error;

      // Compute class positions
      await computeClassPositions(result.class_arm_id, result.term_id);

      // Send email notification
      sendNotification("approved", [result.id]);

      toast({ title: "Result Approved", description: `Result for ${result.student.first_name} ${result.student.last_name} has been approved.` });
      fetchResults();
    } catch (error) {
      console.error("Error approving result:", error);
      toast({ title: "Error", description: "Failed to approve result", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;

    try {
      setProcessing(true);
      const ids = Array.from(selectedIds);
      let skipped = 0;
      const classTermPairs = new Set<string>();

      for (const id of ids) {
        const result = submittedResults.find((r) => r.id === id);
        if (!result) continue;

        const { success, hasScores } = await computeResultAggregates(id);
        if (!hasScores) {
          skipped++;
          continue;
        }

        await computeGrades(id);

        await supabase
          .from("results")
          .update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() })
          .eq("id", id);

        classTermPairs.add(`${result.class_arm_id}|${result.term_id}`);
      }

      // Compute positions for all affected classes
      for (const pair of classTermPairs) {
        const [classArmId, termId] = pair.split("|");
        await computeClassPositions(classArmId, termId);
      }

      // Send email notifications
      sendNotification("approved", ids.filter((id) => !submittedResults.find((r) => r.id === id && !r.components.some((c) => c.total_score !== null))));

      const approved = ids.length - skipped;
      toast({
        title: "Results Approved",
        description: `${approved} result(s) approved.${skipped > 0 ? ` ${skipped} skipped (no scores).` : ""}`,
      });
      setSelectedIds(new Set());
      fetchResults();
    } catch (error) {
      console.error("Error bulk approving results:", error);
      toast({ title: "Error", description: "Failed to approve results", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handlePublish = async (result: ResultItem) => {
    try {
      setProcessing(true);
      const { error } = await supabase
        .from("results")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", result.id);

      if (error) throw error;

      // Send email notification
      sendNotification("published", [result.id]);

      toast({ title: "Result Published", description: `Result for ${result.student.first_name} ${result.student.last_name} is now visible to the student.` });
      fetchResults();
    } catch (error) {
      console.error("Error publishing result:", error);
      toast({ title: "Error", description: "Failed to publish result", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkPublish = async () => {
    if (selectedApprovedIds.size === 0) return;

    try {
      setProcessing(true);
      const ids = Array.from(selectedApprovedIds);

      const { error } = await supabase
        .from("results")
        .update({ status: "published", published_at: new Date().toISOString() })
        .in("id", ids);

      if (error) throw error;

      // Send email notifications
      sendNotification("published", ids);

      toast({ title: "Results Published", description: `${ids.length} result(s) are now visible to students.` });
      setSelectedApprovedIds(new Set());
      fetchResults();
    } catch (error) {
      console.error("Error bulk publishing results:", error);
      toast({ title: "Error", description: "Failed to publish results", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleUnpublish = async (result: ResultItem) => {
    try {
      setProcessing(true);
      const { error } = await supabase
        .from("results")
        .update({ status: "approved", published_at: null })
        .eq("id", result.id);

      if (error) throw error;

      toast({ title: "Result Unpublished", description: `Result for ${result.student.first_name} ${result.student.last_name} is no longer visible to students.` });
      fetchResults();
    } catch (error) {
      console.error("Error unpublishing result:", error);
      toast({ title: "Error", description: "Failed to unpublish result", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkUnpublish = async () => {
    if (selectedPublishedIds.size === 0) return;

    try {
      setProcessing(true);
      const ids = Array.from(selectedPublishedIds);

      const { error } = await supabase
        .from("results")
        .update({ status: "approved", published_at: null })
        .in("id", ids);

      if (error) throw error;

      toast({ title: "Results Unpublished", description: `${ids.length} result(s) are no longer visible to students.` });
      setSelectedPublishedIds(new Set());
      fetchResults();
    } catch (error) {
      console.error("Error bulk unpublishing results:", error);
      toast({ title: "Error", description: "Failed to unpublish results", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedResult) return;

    try {
      setProcessing(true);
      const { error } = await supabase
        .from("results")
        .update({ status: "rejected", remarks: rejectReason })
        .eq("id", selectedResult.id);

      if (error) throw error;

      toast({ title: "Result Rejected", description: `Result for ${selectedResult.student.first_name} ${selectedResult.student.last_name} has been rejected.` });
      setRejectDialogOpen(false);
      setRejectReason("");
      setSelectedResult(null);
      fetchResults();
    } catch (error) {
      console.error("Error rejecting result:", error);
      toast({ title: "Error", description: "Failed to reject result", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const toggleSelect = (id: string, tab: "pending" | "approved" | "published") => {
    const setter = tab === "published" ? setSelectedPublishedIds : tab === "approved" ? setSelectedApprovedIds : setSelectedIds;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (results: ResultItem[], tab: "pending" | "approved" | "published") => {
    const setter = tab === "published" ? setSelectedPublishedIds : tab === "approved" ? setSelectedApprovedIds : setSelectedIds;
    const selected = tab === "published" ? selectedPublishedIds : tab === "approved" ? selectedApprovedIds : selectedIds;
    if (selected.size === results.length) {
      setter(new Set());
    } else {
      setter(new Set(results.map((r) => r.id)));
    }
  };

  const openViewDialog = (result: ResultItem) => {
    setSelectedResult(result);
    setViewDialogOpen(true);
  };

  const openRejectDialog = (result: ResultItem) => {
    setSelectedResult(result);
    setRejectDialogOpen(true);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedClassArm("all");
    setSelectedTerm("all");
    setDateFrom("");
    setDateTo("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Result Approval</h1>
        <p className="text-muted-foreground">Review, approve, and publish student results</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 rounded-full bg-warning/10">
              <Clock className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{submittedResults.length}</p>
              <p className="text-sm text-muted-foreground">Pending Approval</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 rounded-full bg-success/10">
              <CheckCircle className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{approvedResults.length}</p>
              <p className="text-sm text-muted-foreground">Approved (Ready)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 rounded-full bg-primary/10">
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{publishedResults.length}</p>
              <p className="text-sm text-muted-foreground">Published</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 rounded-full bg-secondary">
              <Send className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{submittedResults.length + approvedResults.length + publishedResults.length}</p>
              <p className="text-sm text-muted-foreground">Total Results</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedClassArm} onValueChange={setSelectedClassArm}>
              <SelectTrigger>
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classArms.map((ca) => (
                  <SelectItem key={ca.id} value={ca.id}>
                    {ca.class.name} - {ca.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedTerm} onValueChange={setSelectedTerm}>
              <SelectTrigger>
                <SelectValue placeholder="All Terms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Terms</SelectItem>
                {terms.map((term) => (
                  <SelectItem key={term.id} value={term.id}>
                    {term.name} - {term.session.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input type="date" placeholder="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Input type="date" placeholder="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pending ({filteredSubmitted.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Approved ({filteredApproved.length})
          </TabsTrigger>
          <TabsTrigger value="published" className="gap-2">
            <Globe className="h-4 w-4" />
            Published ({filteredPublished.length})
          </TabsTrigger>
        </TabsList>

        {/* Pending Approval Tab */}
        <TabsContent value="pending">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Submitted Results Queue
              </CardTitle>
              {selectedIds.size > 0 && (
                <Button onClick={handleBulkApprove} disabled={processing} className="gap-2">
                  <CheckCheck className="h-4 w-4" />
                  Approve Selected ({selectedIds.size})
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {filteredSubmitted.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">No pending results</h3>
                  <p className="text-muted-foreground">All submitted results have been reviewed.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.size === filteredSubmitted.length && filteredSubmitted.length > 0}
                          onCheckedChange={() => toggleSelectAll(filteredSubmitted, "pending")}
                        />
                      </TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Submitted By</TableHead>
                      <TableHead>Submitted At</TableHead>
                      <TableHead>Average</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubmitted.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell>
                          <Checkbox checked={selectedIds.has(result.id)} onCheckedChange={() => toggleSelect(result.id, "pending")} />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{result.student.first_name} {result.student.last_name}</p>
                            <p className="text-sm text-muted-foreground">{result.student.admission_number}</p>
                          </div>
                        </TableCell>
                        <TableCell>{result.class_arm.class?.name} - {result.class_arm.name}</TableCell>
                        <TableCell>
                          <div>
                            <p>{result.term.name}</p>
                            <p className="text-sm text-muted-foreground">{result.term.session?.name}</p>
                          </div>
                        </TableCell>
                        <TableCell>{result.submitter?.full_name || "-"}</TableCell>
                        <TableCell>
                          {result.submitted_at ? format(new Date(result.submitted_at), "MMM d, yyyy HH:mm") : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{result.average_score ? `${Number(result.average_score).toFixed(1)}%` : "-"}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openViewDialog(result)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-success hover:text-success" onClick={() => handleApprove(result)} disabled={processing}>
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => openRejectDialog(result)}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approved Tab */}
        <TabsContent value="approved">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Approved Results (Ready to Publish)
              </CardTitle>
              {selectedApprovedIds.size > 0 && (
                <Button onClick={handleBulkPublish} disabled={processing} className="gap-2">
                  <Send className="h-4 w-4" />
                  Publish Selected ({selectedApprovedIds.size})
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {filteredApproved.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">No approved results</h3>
                  <p className="text-muted-foreground">Approve results to publish them for students.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedApprovedIds.size === filteredApproved.length && filteredApproved.length > 0}
                          onCheckedChange={() => toggleSelectAll(filteredApproved, "approved")}
                        />
                      </TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Approved At</TableHead>
                      <TableHead>Average</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredApproved.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell>
                          <Checkbox checked={selectedApprovedIds.has(result.id)} onCheckedChange={() => toggleSelect(result.id, "approved")} />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{result.student.first_name} {result.student.last_name}</p>
                            <p className="text-sm text-muted-foreground">{result.student.admission_number}</p>
                          </div>
                        </TableCell>
                        <TableCell>{result.class_arm.class?.name} - {result.class_arm.name}</TableCell>
                        <TableCell>
                          <div>
                            <p>{result.term.name}</p>
                            <p className="text-sm text-muted-foreground">{result.term.session?.name}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {result.approved_at ? format(new Date(result.approved_at), "MMM d, yyyy HH:mm") : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{result.average_score ? `${Number(result.average_score).toFixed(1)}%` : "-"}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openViewDialog(result)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" onClick={() => handlePublish(result)} disabled={processing} className="gap-1">
                              <Send className="h-3 w-3" />
                              Publish
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Published Tab */}
        <TabsContent value="published">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Published Results (Visible to Students)
              </CardTitle>
              {selectedPublishedIds.size > 0 && (
                <Button onClick={handleBulkUnpublish} disabled={processing} variant="outline" className="gap-2">
                  <EyeOff className="h-4 w-4" />
                  Unpublish Selected ({selectedPublishedIds.size})
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {filteredPublished.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">No published results</h3>
                  <p className="text-muted-foreground">Published results will appear here.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedPublishedIds.size === filteredPublished.length && filteredPublished.length > 0}
                          onCheckedChange={() => toggleSelectAll(filteredPublished, "published")}
                        />
                      </TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Published At</TableHead>
                      <TableHead>Average</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPublished.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell>
                          <Checkbox checked={selectedPublishedIds.has(result.id)} onCheckedChange={() => toggleSelect(result.id, "published")} />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{result.student.first_name} {result.student.last_name}</p>
                            <p className="text-sm text-muted-foreground">{result.student.admission_number}</p>
                          </div>
                        </TableCell>
                        <TableCell>{result.class_arm.class?.name} - {result.class_arm.name}</TableCell>
                        <TableCell>
                          <div>
                            <p>{result.term.name}</p>
                            <p className="text-sm text-muted-foreground">{result.term.session?.name}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {result.submitted_at ? format(new Date(result.submitted_at), "MMM d, yyyy HH:mm") : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{result.average_score ? `${Number(result.average_score).toFixed(1)}%` : "-"}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openViewDialog(result)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleUnpublish(result)} disabled={processing} className="gap-1">
                              <EyeOff className="h-3 w-3" />
                              Unpublish
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Result Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Result Details</DialogTitle>
            <DialogDescription>
              {selectedResult && `${selectedResult.student.first_name} ${selectedResult.student.last_name} - ${selectedResult.term.name}`}
            </DialogDescription>
          </DialogHeader>
          {selectedResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-secondary">
                  <p className="text-xs text-muted-foreground">Admission No.</p>
                  <p className="font-medium">{selectedResult.student.admission_number}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary">
                  <p className="text-xs text-muted-foreground">Class</p>
                  <p className="font-medium">{selectedResult.class_arm.class?.name} - {selectedResult.class_arm.name}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary">
                  <p className="text-xs text-muted-foreground">Total Score</p>
                  <p className="font-medium">{selectedResult.total_score ?? "-"}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary">
                  <p className="text-xs text-muted-foreground">Average</p>
                  <p className="font-medium">{selectedResult.average_score ? `${Number(selectedResult.average_score).toFixed(1)}%` : "-"}</p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-center">Test 1</TableHead>
                    <TableHead className="text-center">Test 2</TableHead>
                    <TableHead className="text-center">Exam</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedResult.components.map((comp) => (
                    <TableRow key={comp.id}>
                      <TableCell className="font-medium">{comp.subject.name}</TableCell>
                      <TableCell className="text-center">{comp.test1_score ?? "-"}</TableCell>
                      <TableCell className="text-center">{comp.test2_score ?? "-"}</TableCell>
                      <TableCell className="text-center">{comp.exam_score ?? "-"}</TableCell>
                      <TableCell className="text-center font-medium">{comp.total_score ?? "-"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{comp.grade || "-"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Result</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this result. The teacher will be notified.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter rejection reason..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing || !rejectReason.trim()}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reject Result
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
