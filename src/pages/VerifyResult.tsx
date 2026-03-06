import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Search, Loader2, CheckCircle, XCircle, User, BookOpen, Calendar, Award } from "lucide-react";
import { toast } from "sonner";

interface VerifiedResult {
  studentName: string;
  admissionNumber: string;
  className: string;
  termName: string;
  sessionName: string;
  averageScore: number | null;
  classPosition: number | null;
  status: string;
  publishedAt: string | null;
  subjectCount: number;
  schoolName: string;
}

export default function VerifyResult() {
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get("code") || "";
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState<VerifiedResult | null>(null);
  const [notFound, setNotFound] = useState(false);

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setVerified(null);
    setNotFound(false);

    try {
      const { data: result, error } = await supabase
        .from("results")
        .select(`
          id, average_score, class_position, status, published_at, verification_code,
          student:students(first_name, last_name, admission_number, current_class_arm_id,
            class_arm:class_arms(name, class:classes(name))
          ),
          term:terms(name, session:academic_sessions(name)),
          result_components(id)
        `)
        .eq("verification_code", code.trim().toUpperCase())
        .eq("status", "published")
        .maybeSingle();

      if (error || !result) {
        setNotFound(true);
        return;
      }

      const student = result.student as any;
      const term = result.term as any;

      const { data: schoolSettings } = await supabase
        .from("school_settings")
        .select("school_name")
        .limit(1)
        .maybeSingle();

      setVerified({
        studentName: `${student?.last_name || ""} ${student?.first_name || ""}`.trim(),
        admissionNumber: student?.admission_number || "",
        className: `${student?.class_arm?.class?.name || ""} ${student?.class_arm?.name || ""}`.trim(),
        termName: term?.name || "",
        sessionName: term?.session?.name || "",
        averageScore: result.average_score ? Number(result.average_score) : null,
        classPosition: result.class_position,
        status: result.status,
        publishedAt: result.published_at,
        subjectCount: (result.result_components as any[])?.length || 0,
        schoolName: schoolSettings?.school_name || "School",
      });

      toast.success("Result verified successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            Result Verification Portal
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Verify Result Authenticity</h1>
          <p className="text-muted-foreground">
            Enter the verification code printed on the result slip to confirm its authenticity.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Enter Verification Code</CardTitle>
            <CardDescription>The 12-character code found on the result document</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  placeholder="e.g. AB3C-D4EF-GH5J"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="text-center font-mono text-lg tracking-widest"
                  maxLength={14}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !code.trim()}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Verify Result
              </Button>
            </form>
          </CardContent>
        </Card>

        {verified && (
          <Card className="mt-6 border-green-500/50 bg-green-50/50 dark:bg-green-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-6">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <h3 className="text-lg font-bold text-green-700 dark:text-green-400">Result Verified ✓</h3>
                  <p className="text-sm text-green-600 dark:text-green-500">
                    This result is authentic and was issued by {verified.schoolName}.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Student</p>
                    <p className="font-medium text-foreground">{verified.studentName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Class</p>
                    <p className="font-medium text-foreground">{verified.className}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Term / Session</p>
                    <p className="font-medium text-foreground">{verified.termName} — {verified.sessionName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Average Score</p>
                    <p className="font-medium text-foreground">
                      {verified.averageScore?.toFixed(1) || "N/A"}%
                      {verified.classPosition && ` (Position: ${verified.classPosition})`}
                    </p>
                  </div>
                </div>
              </div>

              {verified.publishedAt && (
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  Published on {new Date(verified.publishedAt).toLocaleDateString("en-NG", {
                    year: "numeric", month: "long", day: "numeric"
                  })}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {notFound && (
          <Card className="mt-6 border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <XCircle className="h-8 w-8 text-destructive" />
                <div>
                  <h3 className="text-lg font-bold text-destructive">Verification Failed</h3>
                  <p className="text-sm text-muted-foreground">
                    No published result matches this verification code. The result may be forged or the code entered incorrectly.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
