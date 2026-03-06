import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function StudentResults() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [student, setStudent] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const [components, setComponents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user && studentId) fetchData();
  }, [user, studentId]);

  const fetchData = async () => {
    try {
      const [studentRes, resultsRes, termsRes, subjectsRes] = await Promise.all([
        supabase.from("students").select("*").eq("id", studentId!).single(),
        supabase.from("results").select("*").eq("student_id", studentId!).eq("status", "published").order("created_at", { ascending: false }),
        supabase.from("terms").select("id, name, term_type, session_id"),
        supabase.from("subjects").select("id, name, code"),
      ]);

      setStudent(studentRes.data);
      setResults(resultsRes.data || []);
      setTerms(termsRes.data || []);
      setSubjects(subjectsRes.data || []);

      if (resultsRes.data && resultsRes.data.length > 0) {
        setSelectedResult(resultsRes.data[0].id);
        fetchComponents(resultsRes.data[0].id);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchComponents = async (resultId: string) => {
    const { data } = await supabase
      .from("result_components")
      .select("*")
      .eq("result_id", resultId)
      .order("total_score", { ascending: false });
    setComponents(data || []);
  };

  const handleResultChange = (resultId: string) => {
    setSelectedResult(resultId);
    fetchComponents(resultId);
  };

  const getTermName = (termId: string) => terms.find((t) => t.id === termId)?.name || "Unknown";
  const getSubjectName = (subjectId: string) => subjects.find((s) => s.id === subjectId)?.name || "Unknown";

  // GPA trend data
  const trendData = results
    .slice()
    .reverse()
    .map((r) => ({
      term: getTermName(r.term_id),
      average: r.average_score ? Number(r.average_score.toFixed(1)) : 0,
      position: r.class_position,
    }));

  const currentResult = results.find((r) => r.id === selectedResult);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Student not found or access denied.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/parent")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/parent")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {student.first_name} {student.last_name}
          </h1>
          <p className="text-muted-foreground">{student.admission_number}</p>
        </div>
      </div>

      {/* GPA Trend Chart */}
      {trendData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="term" className="text-xs" />
                  <YAxis domain={[0, 100]} className="text-xs" />
                  <Tooltip />
                  <Line type="monotone" dataKey="average" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Term Selector */}
      {results.length > 0 ? (
        <>
          <div className="flex items-center gap-4">
            <Select value={selectedResult || ""} onValueChange={handleResultChange}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select term" />
              </SelectTrigger>
              <SelectContent>
                {results.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {getTermName(r.term_id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {currentResult && (
              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="text-sm">
                  Average: {currentResult.average_score?.toFixed(1) ?? "N/A"}%
                </Badge>
                <Badge variant="outline" className="text-sm">
                  Position: {currentResult.class_position ?? "N/A"}
                </Badge>
              </div>
            )}
          </div>

          {/* Subject Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Subject Results</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-center">Test 1</TableHead>
                    <TableHead className="text-center">Test 2</TableHead>
                    <TableHead className="text-center">Exam</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Grade</TableHead>
                    <TableHead>Remark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {components.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{getSubjectName(c.subject_id)}</TableCell>
                      <TableCell className="text-center">{c.test1_score ?? "-"}</TableCell>
                      <TableCell className="text-center">{c.test2_score ?? "-"}</TableCell>
                      <TableCell className="text-center">{c.exam_score ?? "-"}</TableCell>
                      <TableCell className="text-center font-semibold">{c.total_score ?? "-"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={c.grade === "A" || c.grade === "A1" ? "default" : c.grade?.startsWith("F") ? "destructive" : "secondary"}>
                          {c.grade ?? "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.remark ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                  {components.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No subject results available.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Remarks */}
          {currentResult && (currentResult.class_teacher_remark || currentResult.principal_remark) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Remarks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {currentResult.class_teacher_remark && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Class Teacher</p>
                    <p className="text-foreground">{currentResult.class_teacher_remark}</p>
                  </div>
                )}
                {currentResult.principal_remark && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Principal</p>
                    <p className="text-foreground">{currentResult.principal_remark}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No published results available for this student.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
