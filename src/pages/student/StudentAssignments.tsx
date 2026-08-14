import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolFeatures } from "@/hooks/useSchoolFeatures";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  FileText,
  Clock,
  CheckCircle2,
  Upload,
  ExternalLink,
  History,
  RefreshCcw,
  Lock,
} from "lucide-react";
import { format, formatDistanceToNow, isAfter } from "date-fns";

interface RevisionRow {
  id: string;
  revision_number: number;
  response_text: string | null;
  attachment_url: string | null;
  submitted_at: string | null;
  created_at: string;
}

interface SubmissionRow {
  id: string;
  response_text: string | null;
  attachment_url: string | null;
  submitted_at: string | null;
  score: number | null;
  feedback: string | null;
  score_released: boolean;
  graded_at: string | null;
  revision_number: number;
  resubmission_count: number;
}

interface AssignmentRow {
  id: string;
  title: string;
  instructions: string | null;
  attachment_url: string | null;
  max_score: number;
  due_at: string | null;
  subject_id: string;
  allow_resubmissions: boolean;
  subjects?: { name: string };
  submission?: SubmissionRow | null;
}

export default function StudentAssignments() {
  const { user } = useAuth();
  const { features, loading: featuresLoading } = useSchoolFeatures();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);

  const [working, setWorking] = useState<AssignmentRow | null>(null);
  const [response, setResponse] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [revisions, setRevisions] = useState<RevisionRow[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const bootstrap = async () => {
    setLoading(true);
    try {
      const { data: student } = await supabase
        .from("students")
        .select("id, school_id, current_class_arm_id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!student) {
        setLoading(false);
        return;
      }
      setStudentId(student.id);
      setSchoolId(student.school_id);

      if (!student.current_class_arm_id) {
        setAssignments([]);
        setLoading(false);
        return;
      }

      const { data: list } = await supabase
        .from("assignments")
        .select(
          "id, title, instructions, attachment_url, max_score, due_at, subject_id, allow_resubmissions, subjects(name)"
        )
        .eq("status", "published")
        .eq("school_id", student.school_id)
        .eq("class_arm_id", student.current_class_arm_id)
        .order("due_at", { ascending: true, nullsFirst: false });

      const { data: subs } = await supabase
        .from("assignment_submissions")
        .select(
          "id, assignment_id, response_text, attachment_url, submitted_at, score, feedback, score_released, graded_at, revision_number, resubmission_count"
        )
        .eq("student_id", student.id);

      const subMap = new Map((subs || []).map((s: any) => [s.assignment_id, s]));
      setAssignments(
        ((list as any) || []).map((a: any) => ({
          ...a,
          submission: subMap.get(a.id) ?? null,
        }))
      );
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadRevisions = async (submissionId: string | null | undefined) => {
    if (!submissionId) {
      setRevisions([]);
      return;
    }
    setRevisionsLoading(true);
    try {
      const { data, error } = await supabase
        .from("assignment_submission_revisions")
        .select("id, revision_number, response_text, attachment_url, submitted_at, created_at")
        .eq("submission_id", submissionId)
        .order("revision_number", { ascending: false });
      if (error) throw error;
      setRevisions((data as RevisionRow[]) || []);
    } catch (err: any) {
      toast({ title: "Couldn't load history", description: err.message, variant: "destructive" });
      setRevisions([]);
    } finally {
      setRevisionsLoading(false);
    }
  };

  const openWork = (a: AssignmentRow) => {
    setWorking(a);
    setResponse(a.submission?.response_text || "");
    setAttachmentUrl(a.submission?.attachment_url || "");
    loadRevisions(a.submission?.id);
  };

  const isOverdue = (a: AssignmentRow) =>
    !!a.due_at && isAfter(new Date(), new Date(a.due_at));

  const canResubmit = (a: AssignmentRow) =>
    !!a.submission?.submitted_at &&
    a.allow_resubmissions &&
    !isOverdue(a);

  const canSubmit = (a: AssignmentRow) => {
    if (!a.submission?.submitted_at) return !isOverdue(a);
    return canResubmit(a);
  };

  const submit = async () => {
    if (!working || !studentId || !schoolId) return;
    if (!response.trim() && !attachmentUrl.trim()) {
      toast({
        title: "Empty submission",
        description: "Type a response or include an attachment URL.",
        variant: "destructive",
      });
      return;
    }
    if (response.length > 10000) {
      toast({ title: "Too long", description: "Response must be 10 000 chars or less.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      let error;
      if (working.submission?.id) {
        // Update existing submission → trigger logs a revision
        ({ error } = await supabase
          .from("assignment_submissions")
          .update({
            response_text: response.trim() || null,
            attachment_url: attachmentUrl.trim() || null,
          })
          .eq("id", working.submission.id));
      } else {
        ({ error } = await supabase
          .from("assignment_submissions")
          .insert({
            assignment_id: working.id,
            student_id: studentId,
            school_id: schoolId,
            response_text: response.trim() || null,
            attachment_url: attachmentUrl.trim() || null,
          }));
      }
      if (error) throw error;
      toast({
        title: working.submission?.id ? "Resubmitted" : "Submitted",
        description: "Your work has been recorded.",
      });
      setWorking(null);
      bootstrap();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const statusFor = (a: AssignmentRow) => {
    if (a.submission?.score_released && a.submission.score !== null) {
      return <Badge>Scored: {a.submission.score}/{a.max_score}</Badge>;
    }
    if (a.submission?.submitted_at) {
      const n = a.submission.resubmission_count;
      return (
        <Badge variant="secondary">
          {n > 0 ? `Submitted (rev ${a.submission.revision_number})` : "Submitted"}
        </Badge>
      );
    }
    if (isOverdue(a)) return <Badge variant="destructive">Overdue</Badge>;
    return <Badge variant="outline">Pending</Badge>;
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
        <h2 className="text-xl font-bold">Assignments are not available</h2>
        <p className="text-muted-foreground">This module is currently disabled by your school.</p>
      </div>
    );
  }

  const lockedReason = working
    ? !working.submission?.submitted_at
      ? isOverdue(working)
        ? "This assignment is past the due date."
        : null
      : !working.allow_resubmissions
        ? "Your teacher disabled resubmissions for this assignment."
        : isOverdue(working)
          ? "The due date has passed — resubmissions are closed."
          : null
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Assignments</h1>
        <p className="text-muted-foreground">View, attempt and track your assignments.</p>
      </div>

      {assignments.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No assignments yet. Check back later.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {assignments.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{a.title}</CardTitle>
                    <CardDescription>{a.subjects?.name || "Subject"}</CardDescription>
                  </div>
                  {statusFor(a)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {a.instructions && (
                  <p className="text-sm text-foreground/80 line-clamp-3">{a.instructions}</p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {a.due_at
                      ? `Due ${formatDistanceToNow(new Date(a.due_at), { addSuffix: true })}`
                      : "No deadline"}
                  </span>
                  {a.allow_resubmissions ? (
                    <span className="inline-flex items-center gap-1">
                      <RefreshCcw className="h-3 w-3" /> Resubmissions allowed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Single submission
                    </span>
                  )}
                  {a.submission?.score_released && a.submission.feedback && (
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Feedback available
                    </span>
                  )}
                </div>
                {a.attachment_url && (
                  <AttachmentLink value={a.attachment_url} label="Resource file" />
                )}
                <Button size="sm" className="w-full" onClick={() => openWork(a)}>
                  <Upload className="h-4 w-4 mr-2" />
                  {a.submission?.submitted_at ? "View / Resubmit" : "Attempt"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!working} onOpenChange={(v) => !v && setWorking(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{working?.title}</DialogTitle>
            <DialogDescription>
              {working?.due_at && (
                <span>Due {format(new Date(working.due_at), "PPP p")}. </span>
              )}
              Max score: {working?.max_score}
            </DialogDescription>
          </DialogHeader>

          {working?.instructions && (
            <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">
              {working.instructions}
            </div>
          )}

          {working?.submission?.score_released && working.submission.score !== null && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-1">
              <div className="text-sm font-medium">
                Score: {working.submission.score} / {working.max_score}
              </div>
              {working.submission.feedback && (
                <div className="text-xs text-muted-foreground">
                  Feedback: {working.submission.feedback}
                </div>
              )}
            </div>
          )}

          {lockedReason && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm flex items-start gap-2">
              <Lock className="h-4 w-4 mt-0.5 text-destructive" />
              <span>{lockedReason}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label>Your response</Label>
            <Textarea
              rows={6}
              value={response}
              maxLength={10000}
              disabled={!!lockedReason}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Type your answer here..."
            />
          </div>

          {working && schoolId && user && (
            <AssignmentFileField
              label="Attach your work (optional)"
              folder={`${schoolId}/submissions/${working.id}/${user.id}`}
              value={attachmentUrl}
              onChange={setAttachmentUrl}
              disabled={!!lockedReason}
            />
          )}

          {/* Revision history timeline */}
          {working?.submission?.id && (
            <div className="space-y-2">
              <Separator />
              <div className="flex items-center gap-2 text-sm font-medium">
                <History className="h-4 w-4" />
                Revision history
                {working.submission.resubmission_count > 0 && (
                  <Badge variant="outline">
                    {working.submission.resubmission_count} resubmission
                    {working.submission.resubmission_count === 1 ? "" : "s"}
                  </Badge>
                )}
              </div>
              {revisionsLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                </div>
              ) : (
                <ol className="relative border-l border-border ml-2 space-y-3 pl-4">
                  {/* Current submission */}
                  <li className="relative">
                    <span className="absolute -left-[19px] top-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                    <div className="text-xs">
                      <div className="font-medium">
                        Current — revision {working.submission.revision_number}
                      </div>
                      <div className="text-muted-foreground">
                        {working.submission.submitted_at
                          ? format(new Date(working.submission.submitted_at), "PPP p")
                          : "Not yet submitted"}
                      </div>
                      {working.submission.response_text && (
                        <p className="mt-1 whitespace-pre-wrap text-foreground/80 line-clamp-3">
                          {working.submission.response_text}
                        </p>
                      )}
                      {working.submission.attachment_url && (
                        <div className="mt-1">
                          <AttachmentLink value={working.submission.attachment_url} />
                        </div>
                      )}
                    </div>
                  </li>

                  {revisions.map((r) => (
                    <li key={r.id} className="relative">
                      <span className="absolute -left-[19px] top-1 h-3 w-3 rounded-full bg-muted-foreground/50 border-2 border-background" />
                      <div className="text-xs">
                        <div className="font-medium">Revision {r.revision_number}</div>
                        <div className="text-muted-foreground">
                          {r.submitted_at
                            ? format(new Date(r.submitted_at), "PPP p")
                            : format(new Date(r.created_at), "PPP p")}
                        </div>
                        {r.response_text && (
                          <p className="mt-1 whitespace-pre-wrap text-foreground/70 line-clamp-3">
                            {r.response_text}
                          </p>
                        )}
                        {r.attachment_url && (
                          <div className="mt-1">
                            <AttachmentLink value={r.attachment_url} />
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                  {revisions.length === 0 && (
                    <li className="text-xs text-muted-foreground">No prior revisions.</li>
                  )}
                </ol>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setWorking(null)}>Close</Button>
            <Button
              onClick={submit}
              disabled={submitting || !working || !canSubmit(working)}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {working?.submission?.submitted_at ? "Resubmit" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
