import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

interface SubmittedResult {
  id: string;
  student_id: string;
  term_id: string;
  class_arm_id: string;
  status: string;
  total_score: number | null;
  average_score: number | null;
  submitted_at: string | null;
  submitted_by: string | null;
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
  const [submittedResults, setSubmittedResults] = useState<SubmittedResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SubmittedResult | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchSubmittedResults();
  }, []);

  const fetchSubmittedResults = async () => {
    try {
      setLoading(true);
      
      // Fetch submitted results with related data
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
          submitted_by
        `)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false });

      if (error) throw error;

      if (!results || results.length === 0) {
        setSubmittedResults([]);
        return;
      }

      // Fetch related data for each result
      const enrichedResults = await Promise.all(
        results.map(async (result) => {
          // Fetch student
          const { data: student } = await supabase
            .from("students")
            .select("first_name, last_name, admission_number")
            .eq("id", result.student_id)
            .maybeSingle();

          // Fetch term with session
          const { data: term } = await supabase
            .from("terms")
            .select("name, session:academic_sessions(name)")
            .eq("id", result.term_id)
            .maybeSingle();

          // Fetch class arm with class
          const { data: classArm } = await supabase
            .from("class_arms")
            .select("name, class:classes(name)")
            .eq("id", result.class_arm_id)
            .maybeSingle();

          // Fetch submitter profile
          let submitter = null;
          if (result.submitted_by) {
            const { data: submitterData } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", result.submitted_by)
              .maybeSingle();
            submitter = submitterData;
          }

          // Fetch result components
          const { data: components } = await supabase
            .from("result_components")
            .select(`
              id,
              subject_id,
              test1_score,
              test2_score,
              exam_score,
              total_score,
              grade
            `)
            .eq("result_id", result.id);

          // Fetch subjects for components
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

      setSubmittedResults(enrichedResults as SubmittedResult[]);
    } catch (error) {
      console.error("Error fetching submitted results:", error);
      toast({
        title: "Error",
        description: "Failed to fetch submitted results",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (result: SubmittedResult) => {
    try {
      setProcessing(true);

      const { error } = await supabase
        .from("results")
        .update({
          status: "approved",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", result.id);

      if (error) throw error;

      toast({
        title: "Result Approved",
        description: `Result for ${result.student.first_name} ${result.student.last_name} has been approved.`,
      });

      fetchSubmittedResults();
    } catch (error) {
      console.error("Error approving result:", error);
      toast({
        title: "Error",
        description: "Failed to approve result",
        variant: "destructive",
      });
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
        .update({
          status: "draft",
          remarks: rejectReason,
        })
        .eq("id", selectedResult.id);

      if (error) throw error;

      toast({
        title: "Result Rejected",
        description: `Result for ${selectedResult.student.first_name} ${selectedResult.student.last_name} has been rejected and sent back to draft.`,
      });

      setRejectDialogOpen(false);
      setRejectReason("");
      setSelectedResult(null);
      fetchSubmittedResults();
    } catch (error) {
      console.error("Error rejecting result:", error);
      toast({
        title: "Error",
        description: "Failed to reject result",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const openViewDialog = (result: SubmittedResult) => {
    setSelectedResult(result);
    setViewDialogOpen(true);
  };

  const openRejectDialog = (result: SubmittedResult) => {
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Result Approval</h1>
        <p className="text-muted-foreground">
          Review and approve submitted student results
        </p>
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
              <p className="text-2xl font-bold">-</p>
              <p className="text-sm text-muted-foreground">Approved Today</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 rounded-full bg-destructive/10">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">-</p>
              <p className="text-sm text-muted-foreground">Rejected Today</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Submitted Results Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          {submittedResults.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No pending results</h3>
              <p className="text-muted-foreground">
                All submitted results have been reviewed.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
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
                {submittedResults.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {result.student.first_name} {result.student.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {result.student.admission_number}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {result.class_arm.class?.name} - {result.class_arm.name}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{result.term.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {result.term.session?.name}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {result.submitter?.full_name || "Unknown"}
                    </TableCell>
                    <TableCell>
                      {result.submitted_at
                        ? new Date(result.submitted_at).toLocaleDateString()
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {result.average_score?.toFixed(1) || "-"}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openViewDialog(result)}
                          title="View Details"
                        >
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
                      <TableCell className="text-center font-medium">
                        {comp.total_score?.toFixed(1) ?? "-"}
                      </TableCell>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Result</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this result. The teacher will see this
              feedback.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder="Enter reason for rejection..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim() || processing}
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reject Result
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
