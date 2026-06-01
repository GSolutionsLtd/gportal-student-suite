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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, FileText, Clock, CheckCircle2, Upload, ExternalLink } from "lucide-react";
import { format, formatDistanceToNow, isAfter } from "date-fns";

interface AssignmentRow {
  id: string;
  title: string;
  instructions: string | null;
  attachment_url: string | null;
  max_score: number;
  due_at: string | null;
  subject_id: string;
  subjects?: { name: string };
  submission?: {
    id: string;
    response_text: string | null;
    attachment_url: string | null;
    submitted_at: string | null;
    score: number | null;
    feedback: string | null;
    score_released: boolean;
    graded_at: string | null;
  } | null;
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

      const { data: list } = await supabase
        .from("assignments")
        .select("id, title, instructions, attachment_url, max_score, due_at, subject_id, subjects(name)")
        .eq("status", "published")
        .eq("class_arm_id", student.current_class_arm_id)
        .order("due_at", { ascending: true, nullsFirst: false });

      const { data: subs } = await supabase
        .from("assignment_submissions")
        .select("id, assignment_id, response_text, attachment_url, submitted_at, score, feedback, score_released, graded_at")
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

  const openWork = (a: AssignmentRow) => {
    setWorking(a);
    setResponse(a.submission?.response_text || "");
    setAttachmentUrl(a.submission?.attachment_url || "");
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
      const payload = {
        ...(working.submission?.id ? { id: working.submission.id } : {}),
        assignment_id: working.id,
        student_id: studentId,
        school_id: schoolId,
        response_text: response.trim() || null,
        attachment_url: attachmentUrl.trim() || null,
        submitted_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("assignment_submissions")
        .upsert(payload, { onConflict: "assignment_id,student_id" });
      if (error) throw error;
      toast({ title: "Submitted", description: "Your work has been recorded." });
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
    if (a.submission?.submitted_at) return <Badge variant="secondary">Submitted</Badge>;
    if (a.due_at && isAfter(new Date(), new Date(a.due_at))) return <Badge variant="destructive">Overdue</Badge>;
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
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {a.due_at
                      ? `Due ${formatDistanceToNow(new Date(a.due_at), { addSuffix: true })}`
                      : "No deadline"}
                  </span>
                  {a.submission?.score_released && a.submission.feedback && (
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Feedback available
                    </span>
                  )}
                </div>
                {a.attachment_url && (
                  <a
                    href={a.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Resource link
                  </a>
                )}
                <Button size="sm" className="w-full" onClick={() => openWork(a)}>
                  <Upload className="h-4 w-4 mr-2" />
                  {a.submission?.submitted_at ? "View / Update Submission" : "Attempt"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!working} onOpenChange={(v) => !v && setWorking(null)}>
        <DialogContent className="max-w-2xl">
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

          <div className="space-y-2">
            <Label>Your response</Label>
            <Textarea
              rows={6}
              value={response}
              maxLength={10000}
              disabled={!!working?.submission?.graded_at}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Type your answer here..."
            />
          </div>

          <div className="space-y-2">
            <Label>Attachment URL (optional)</Label>
            <Input
              placeholder="Paste a link to your work (Google Drive, etc.)"
              value={attachmentUrl}
              disabled={!!working?.submission?.graded_at}
              onChange={(e) => setAttachmentUrl(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWorking(null)}>Close</Button>
            <Button onClick={submit} disabled={submitting || !!working?.submission?.graded_at}>
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
