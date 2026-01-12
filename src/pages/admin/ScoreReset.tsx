import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, RotateCcw, Search, AlertTriangle, Eye, Edit } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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

interface ResultItem {
  id: string;
  status: string;
  total_score: number | null;
  average_score: number | null;
  student: {
    id: string;
    first_name: string;
    last_name: string;
    admission_number: string;
  };
  components: {
    id: string;
    subject: { name: string; code: string };
    test1_score: number | null;
    test2_score: number | null;
    other_assessment_score: number | null;
    exam_score: number | null;
    total_score: number | null;
    grade: string | null;
  }[];
}

interface EditableScore {
  id: string;
  test1_score: number | null;
  test2_score: number | null;
  other_assessment_score: number | null;
  exam_score: number | null;
}

export default function ScoreReset() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [classArms, setClassArms] = useState<ClassArm[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedClassArm, setSelectedClassArm] = useState<string>("");
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  
  // Dialog states
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<ResultItem | null>(null);
  const [editableScores, setEditableScores] = useState<EditableScore[]>([]);
  const [resetReason, setResetReason] = useState("");

  useEffect(() => {
    fetchFiltersData();
  }, []);

  useEffect(() => {
    if (selectedClassArm && selectedTerm) {
      fetchResults();
    }
  }, [selectedClassArm, selectedTerm]);

  const fetchFiltersData = async () => {
    try {
      const [{ data: classArmsData }, { data: termsData }] = await Promise.all([
        supabase
          .from("class_arms")
          .select("id, name, class:classes(name)")
          .eq("is_active", true),
        supabase
          .from("terms")
          .select("id, name, session:academic_sessions(name)")
          .order("created_at", { ascending: false }),
      ]);

      setClassArms((classArmsData as ClassArm[]) || []);
      setTerms((termsData as Term[]) || []);

      // Set current term as default
      const currentTerm = termsData?.find((t: any) => t.is_current);
      if (currentTerm) {
        setSelectedTerm(currentTerm.id);
      }
    } catch (error) {
      console.error("Error fetching filter data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchResults = async () => {
    if (!selectedClassArm || !selectedTerm) return;

    setLoading(true);
    try {
      const { data: resultsData, error } = await supabase
        .from("results")
        .select("id, status, total_score, average_score, student_id")
        .eq("class_arm_id", selectedClassArm)
        .eq("term_id", selectedTerm)
        .in("status", ["submitted", "approved", "published"]);

      if (error) throw error;

      if (!resultsData || resultsData.length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      // Enrich with student and component data
      const enrichedResults = await Promise.all(
        resultsData.map(async (result) => {
          const [{ data: student }, { data: components }] = await Promise.all([
            supabase
              .from("students")
              .select("id, first_name, last_name, admission_number")
              .eq("id", result.student_id)
              .single(),
            supabase
              .from("result_components")
              .select("id, test1_score, test2_score, other_assessment_score, exam_score, total_score, grade, subject_id")
              .eq("result_id", result.id),
          ]);

          const enrichedComponents = await Promise.all(
            (components || []).map(async (comp) => {
              const { data: subject } = await supabase
                .from("subjects")
                .select("name, code")
                .eq("id", comp.subject_id)
                .single();
              return { ...comp, subject: subject || { name: "Unknown", code: "N/A" } };
            })
          );

          return {
            ...result,
            student: student || { id: "", first_name: "Unknown", last_name: "Student", admission_number: "N/A" },
            components: enrichedComponents,
          };
        })
      );

      setResults(enrichedResults as ResultItem[]);
    } catch (error) {
      console.error("Error fetching results:", error);
      toast({ title: "Error", description: "Failed to fetch results", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredResults = results.filter((result) => {
    const matchesSearch =
      searchQuery === "" ||
      result.student.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      result.student.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      result.student.admission_number.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleViewResult = (result: ResultItem) => {
    setSelectedResult(result);
    setViewDialogOpen(true);
  };

  const handleEditResult = (result: ResultItem) => {
    setSelectedResult(result);
    setEditableScores(
      result.components.map((c) => ({
        id: c.id,
        test1_score: c.test1_score,
        test2_score: c.test2_score,
        other_assessment_score: c.other_assessment_score,
        exam_score: c.exam_score,
      }))
    );
    setEditDialogOpen(true);
  };

  const handleScoreChange = (componentId: string, field: keyof EditableScore, value: string) => {
    setEditableScores((prev) =>
      prev.map((s) =>
        s.id === componentId
          ? { ...s, [field]: value === "" ? null : parseFloat(value) }
          : s
      )
    );
  };

  const handleSaveScores = async () => {
    if (!selectedResult) return;

    setProcessing(true);
    try {
      // Update each component
      for (const score of editableScores) {
        const total =
          (score.test1_score || 0) +
          (score.test2_score || 0) +
          (score.other_assessment_score || 0) +
          (score.exam_score || 0);

        const { error } = await supabase
          .from("result_components")
          .update({
            test1_score: score.test1_score,
            test2_score: score.test2_score,
            other_assessment_score: score.other_assessment_score,
            exam_score: score.exam_score,
            total_score: total,
          })
          .eq("id", score.id);

        if (error) throw error;
      }

      // Recalculate result totals
      const totalScore = editableScores.reduce(
        (sum, s) =>
          sum +
          (s.test1_score || 0) +
          (s.test2_score || 0) +
          (s.other_assessment_score || 0) +
          (s.exam_score || 0),
        0
      );
      const avgScore = editableScores.length > 0 ? totalScore / editableScores.length : 0;

      await supabase
        .from("results")
        .update({
          total_score: totalScore,
          average_score: avgScore,
          status: "draft", // Reset to draft after editing
        })
        .eq("id", selectedResult.id);

      toast({ title: "Scores Updated", description: "Scores have been updated and result reset to draft status." });
      setEditDialogOpen(false);
      fetchResults();
    } catch (error) {
      console.error("Error saving scores:", error);
      toast({ title: "Error", description: "Failed to save scores", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleResetToDraft = async () => {
    if (selectedIds.size === 0) return;

    setResetDialogOpen(true);
  };

  const confirmReset = async () => {
    setProcessing(true);
    try {
      const ids = Array.from(selectedIds);

      const { error } = await supabase
        .from("results")
        .update({
          status: "draft",
          submitted_at: null,
          submitted_by: null,
          approved_at: null,
          approved_by: null,
          published_at: null,
          remarks: resetReason ? `Reset reason: ${resetReason}` : null,
        })
        .in("id", ids);

      if (error) throw error;

      toast({
        title: "Results Reset",
        description: `${ids.length} result(s) have been reset to draft status.`,
      });
      setSelectedIds(new Set());
      setResetDialogOpen(false);
      setResetReason("");
      fetchResults();
    } catch (error) {
      console.error("Error resetting results:", error);
      toast({ title: "Error", description: "Failed to reset results", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredResults.map((r) => r.id)));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "submitted":
        return <Badge variant="secondary">Submitted</Badge>;
      case "approved":
        return <Badge className="bg-blue-500">Approved</Badge>;
      case "published":
        return <Badge className="bg-green-500">Published</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading && classArms.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Score Reset & Editing</h1>
        <p className="text-muted-foreground">
          Reset or edit student scores that have been submitted, approved, or published
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Manage Scores
          </CardTitle>
          <CardDescription>
            Select a class and term to view and manage student scores
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Class</label>
              <Select value={selectedClassArm} onValueChange={setSelectedClassArm}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class..." />
                </SelectTrigger>
                <SelectContent>
                  {classArms.map((arm) => (
                    <SelectItem key={arm.id} value={arm.id}>
                      {arm.class.name} {arm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Term</label>
              <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                <SelectTrigger>
                  <SelectValue placeholder="Select term..." />
                </SelectTrigger>
                <SelectContent>
                  {terms.map((term) => (
                    <SelectItem key={term.id} value={term.id}>
                      {term.name} ({term.session.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or admission no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {/* Actions Bar */}
          {filteredResults.length > 0 && (
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.size === filteredResults.length && filteredResults.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size} of {filteredResults.length} selected
                </span>
              </div>
              {selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleResetToDraft}
                  disabled={processing}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Draft ({selectedIds.size})
                </Button>
              )}
            </div>
          )}

          {/* Results Table */}
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {selectedClassArm && selectedTerm
                ? "No submitted/approved/published results found for the selected criteria."
                : "Select a class and term to view results."}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Admission No.</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total Score</TableHead>
                    <TableHead className="text-right">Average</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.map((result) => (
                    <TableRow key={result.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(result.id)}
                          onCheckedChange={() => toggleSelect(result.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono">
                        {result.student.admission_number}
                      </TableCell>
                      <TableCell>
                        {result.student.last_name}, {result.student.first_name}
                      </TableCell>
                      <TableCell>{getStatusBadge(result.status)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {result.total_score?.toFixed(1) || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {result.average_score?.toFixed(1) || "-"}%
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewResult(result)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditResult(result)}
                            title="Edit Scores"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Result Details - {selectedResult?.student.first_name}{" "}
              {selectedResult?.student.last_name}
            </DialogTitle>
            <DialogDescription>
              Admission No: {selectedResult?.student.admission_number}
            </DialogDescription>
          </DialogHeader>
          {selectedResult && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-center">T1</TableHead>
                  <TableHead className="text-center">T2</TableHead>
                  <TableHead className="text-center">Other</TableHead>
                  <TableHead className="text-center">Exam</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Grade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedResult.components.map((comp) => (
                  <TableRow key={comp.id}>
                    <TableCell>{comp.subject.name}</TableCell>
                    <TableCell className="text-center">{comp.test1_score ?? "-"}</TableCell>
                    <TableCell className="text-center">{comp.test2_score ?? "-"}</TableCell>
                    <TableCell className="text-center">{comp.other_assessment_score ?? "-"}</TableCell>
                    <TableCell className="text-center">{comp.exam_score ?? "-"}</TableCell>
                    <TableCell className="text-center font-bold">{comp.total_score?.toFixed(1) ?? "-"}</TableCell>
                    <TableCell className="text-center">{comp.grade ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit Scores - {selectedResult?.student.first_name}{" "}
              {selectedResult?.student.last_name}
            </DialogTitle>
            <DialogDescription>
              Modify individual scores. The result will be reset to draft status after saving.
            </DialogDescription>
          </DialogHeader>
          {selectedResult && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-center w-20">T1 (10)</TableHead>
                  <TableHead className="text-center w-20">T2 (10)</TableHead>
                  <TableHead className="text-center w-20">Other (10)</TableHead>
                  <TableHead className="text-center w-20">Exam (70)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedResult.components.map((comp, index) => {
                  const editScore = editableScores.find((s) => s.id === comp.id);
                  return (
                    <TableRow key={comp.id}>
                      <TableCell>{comp.subject.name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="10"
                          step="0.5"
                          value={editScore?.test1_score ?? ""}
                          onChange={(e) => handleScoreChange(comp.id, "test1_score", e.target.value)}
                          className="w-16 text-center"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="10"
                          step="0.5"
                          value={editScore?.test2_score ?? ""}
                          onChange={(e) => handleScoreChange(comp.id, "test2_score", e.target.value)}
                          className="w-16 text-center"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="10"
                          step="0.5"
                          value={editScore?.other_assessment_score ?? ""}
                          onChange={(e) => handleScoreChange(comp.id, "other_assessment_score", e.target.value)}
                          className="w-16 text-center"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="70"
                          step="0.5"
                          value={editScore?.exam_score ?? ""}
                          onChange={(e) => handleScoreChange(comp.id, "exam_score", e.target.value)}
                          className="w-16 text-center"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveScores} disabled={processing}>
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm Reset
            </DialogTitle>
            <DialogDescription>
              You are about to reset {selectedIds.size} result(s) to draft status. This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Clear submission and approval timestamps</li>
                <li>Unpublish the results (students won't see them)</li>
                <li>Allow teachers to re-submit the results</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason for reset (optional)</Label>
            <Textarea
              placeholder="Enter reason for resetting these results..."
              value={resetReason}
              onChange={(e) => setResetReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReset} disabled={processing}>
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reset to Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
