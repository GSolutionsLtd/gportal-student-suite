import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";

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

export default function ResultApproval() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submittedResults, setSubmittedResults] = useState<ResultItem[]>([]);
  const [approvedResults, setApprovedResults] = useState<ResultItem[]>([]);
  const [selectedResult, setSelectedResult] = useState<ResultItem | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedApprovedIds, setSelectedApprovedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("pending");

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchSubmittedResults(), fetchApprovedResults()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchResultsByStatus = async (status: "submitted" | "approved" | "published" | "draft" | "rejected"): Promise<ResultItem[]> => {
    const { data: results, error } = await supabase
      .from("results")
      .select(`
        id,
        student_id,
        term_id,
        class_arm_id,
        status,
        total_score,
        average_score,
        submitted_at,
        submitted_by,
        approved_at
      `)
      .eq("status", status)
      .order("submitted_at", { ascending: false });

    if (error) throw error;
    if (!results || results.length === 0) return [];

    const enrichedResults = await Promise.all(
      results.map(async (result) => {
        const { data: student } = await supabase
          .from("students")
          .select("first_name, last_name, admission_number")
          .eq("id", result.student_id)
          .maybeSingle();

        const { data: term } = await supabase
          .from("terms")
          .select("name, session:academic_sessions(name)")
          .eq("id", result.term_id)
          .maybeSingle();

        const { data: classArm } = await supabase
          .from("class_arms")
          .select("name, class:classes(name)")
          .eq("id", result.class_arm_id)
          .maybeSingle();

        let submitter = null;
        if (result.submitted_by) {
          const { data: submitterData } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", result.submitted_by)
            .maybeSingle();
          submitter = submitterData;
        }

        const { data: components } = await supabase
          .from("result_components")
          .select(`id, subject_id, test1_score, test2_score, exam_score, total_score, grade`)
          .eq("result_id", result.id);

        const enrichedComponents = await Promise.all(
          (components || []).map(async (comp) => {
            const { data: subject } = await supabase
              .from("subjects")
              .select("name, code")
              .eq("id", comp.subject_id)
              .maybeSingle();
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

  const handleApprove = async (result: ResultItem) => {
    try {
      setProcessing(true);
      const { error } = await supabase
        .from("results")
        .update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() })
        .eq("id", result.id);

      if (error) throw error;

      toast({
        title: "Result Approved",
        description: `Result for ${result.student.first_name} ${result.student.last_name} has been approved.`,
      });
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

      const { error } = await supabase
        .from("results")
        .update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() })
        .in("id", ids);

      if (error) throw error;

      toast({
        title: "Results Approved",
        description: `${ids.length} result(s) have been approved.`,
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

      toast({
        title: "Result Published",
        description: `Result for ${result.student.first_name} ${result.student.last_name} is now visible to the student.`,
      });
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

      toast({
        title: "Results Published",
        description: `${ids.length} result(s) are now visible to students.`,
      });

      setSelectedApprovedIds(new Set());
      fetchResults();
    } catch (error) {
      console.error("Error bulk publishing results:", error);
      toast({ title: "Error", description: "Failed to publish results", variant: "destructive" });
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
        .update({ status: "draft", remarks: rejectReason })
        .eq("id", selectedResult.id);

      if (error) throw error;

      toast({
        title: "Result Rejected",
        description: `Result for ${selectedResult.student.first_name} ${selectedResult.student.last_name} has been rejected.`,
      });

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

  const toggleSelect = (id: string, isApproved: boolean) => {
    const setter = isApproved ? setSelectedApprovedIds : setSelectedIds;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (results: ResultItem[], isApproved: boolean) => {
    const setter = isApproved ? setSelectedApprovedIds : setSelectedIds;
    const selected = isApproved ? selectedApprovedIds : selectedIds;
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <p className="text-sm text-muted-foreground">Approved (Unpublished)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 rounded-full bg-primary/10">
              <Send className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">-</p>
              <p className="text-sm text-muted-foreground">Published Today</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pending ({submittedResults.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Approved ({approvedResults.length})
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
              {submittedResults.length === 0 ? (
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
                          checked={selectedIds.size === submittedResults.length && submittedResults.length > 0}
                          onCheckedChange={() => toggleSelectAll(submittedResults, false)}
                        />
                      </TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Submitted By</TableHead>
                      <TableHead>Average</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submittedResults.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(result.id)}
                            onCheckedChange={() => toggleSelect(result.id, false)}
                          />
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
                        <TableCell>{result.submitter?.full_name || "Unknown"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{result.average_score?.toFixed(1) || "-"}%</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openViewDialog(result)} title="View">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-success hover:text-success hover:bg-success/10"
                              onClick={() => handleApprove(result)}
                              disabled={processing}
                              title="Approve"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => openRejectDialog(result)}
                              disabled={processing}
                              title="Reject"
                            >
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
              {approvedResults.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">No approved results</h3>
                  <p className="text-muted-foreground">Approve results from the pending tab to publish them.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedApprovedIds.size === approvedResults.length && approvedResults.length > 0}
                          onCheckedChange={() => toggleSelectAll(approvedResults, true)}
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
                    {approvedResults.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedApprovedIds.has(result.id)}
                            onCheckedChange={() => toggleSelect(result.id, true)}
                          />
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
                          {result.approved_at ? new Date(result.approved_at).toLocaleDateString() : "N/A"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{result.average_score?.toFixed(1) || "-"}%</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openViewDialog(result)} title="View">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-primary hover:text-primary hover:bg-primary/10"
                              onClick={() => handlePublish(result)}
                              disabled={processing}
                              title="Publish"
                            >
                              <Send className="h-4 w-4" />
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

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Result Details</DialogTitle>
            <DialogDescription>
              {selectedResult && (
                <>
                  {selectedResult.student.first_name} {selectedResult.student.last_name} -{" "}
                  {selectedResult.class_arm.class?.name} ({selectedResult.class_arm.name})
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Admission No:</span>{" "}
                  <span className="font-medium">{selectedResult.student.admission_number}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Term:</span>{" "}
                  <span className="font-medium">
                    {selectedResult.term.name} ({selectedResult.term.session?.name})
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Score:</span>{" "}
                  <span className="font-medium">{selectedResult.total_score || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Average:</span>{" "}
                  <span className="font-medium">{selectedResult.average_score?.toFixed(2) || "-"}%</span>
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
                      <TableCell>
                        <div>
                          <p className="font-medium">{comp.subject.name}</p>
                          <p className="text-xs text-muted-foreground">{comp.subject.code}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{comp.test1_score ?? "-"}</TableCell>
                      <TableCell className="text-center">{comp.test2_score ?? "-"}</TableCell>
                      <TableCell className="text-center">{comp.exam_score ?? "-"}</TableCell>
                      <TableCell className="text-center font-medium">{comp.total_score?.toFixed(1) ?? "-"}</TableCell>
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
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
            {selectedResult?.status === "submitted" && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setViewDialogOpen(false);
                    if (selectedResult) openRejectDialog(selectedResult);
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => {
                    if (selectedResult) handleApprove(selectedResult);
                    setViewDialogOpen(false);
                  }}
                  disabled={processing}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </>
            )}
            {selectedResult?.status === "approved" && (
              <Button
                onClick={() => {
                  if (selectedResult) handlePublish(selectedResult);
                  setViewDialogOpen(false);
                }}
                disabled={processing}
              >
                <Send className="h-4 w-4 mr-2" />
                Publish
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Result</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this result. The teacher will see this feedback.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder="Enter reason for rejection..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialogOpen(false); setRejectReason(""); }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim() || processing}>
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reject Result
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
