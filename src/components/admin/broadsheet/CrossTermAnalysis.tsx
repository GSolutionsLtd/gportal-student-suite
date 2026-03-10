import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, FileText, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "./TablePagination";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { BroadsheetRow } from "./BroadsheetTable";

interface CrossTermAnalysisProps {
  rows: BroadsheetRow[];
  loading: boolean;
  exporting: boolean;
  selectedSubject: string;
  onExportExcel: () => void;
  onExportPdf: () => void;
}

interface CrossTermStudent {
  student: string;
  admission_number: string;
  class: string;
  termScores: Record<string, number>;
  trend: "up" | "down" | "stable";
  improvement: number;
}

export function CrossTermAnalysis({ rows, loading, exporting, selectedSubject, onExportExcel, onExportPdf }: CrossTermAnalysisProps) {
  const { students, terms, chartData } = useMemo(() => {
    const termSet = new Set<string>();
    const studentMap = new Map<string, { student: string; admission: string; cls: string; termScores: Map<string, number[]> }>();

    for (const row of rows) {
      const key = row.admission_number;
      const termLabel = `${row.term} (${row.session})`;
      const score = selectedSubject === "all" ? row.average_score : row.subject_score;
      if (score === null || score === undefined) continue;

      termSet.add(termLabel);

      const existing = studentMap.get(key) || {
        student: row.student,
        admission: row.admission_number,
        cls: `${row.class} - ${row.class_arm}`,
        termScores: new Map<string, number[]>(),
      };

      const scores = existing.termScores.get(termLabel) || [];
      scores.push(Number(score));
      existing.termScores.set(termLabel, scores);
      studentMap.set(key, existing);
    }

    const termsList = Array.from(termSet);

    const crossTermStudents: CrossTermStudent[] = Array.from(studentMap.values())
      .filter(s => s.termScores.size > 1)
      .map(s => {
        const termScores: Record<string, number> = {};
        const orderedScores: number[] = [];
        for (const term of termsList) {
          const scores = s.termScores.get(term);
          if (scores) {
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            termScores[term] = Number(avg.toFixed(2));
            orderedScores.push(avg);
          }
        }

        const first = orderedScores[0] || 0;
        const last = orderedScores[orderedScores.length - 1] || 0;
        const improvement = Number((last - first).toFixed(2));
        const trend: "up" | "down" | "stable" = improvement > 2 ? "up" : improvement < -2 ? "down" : "stable";

        return {
          student: s.student,
          admission_number: s.admission,
          class: s.cls,
          termScores,
          trend,
          improvement,
        };
      })
      .sort((a, b) => b.improvement - a.improvement);

    // Chart data: average per term
    const chart = termsList.map(term => {
      const scores = crossTermStudents.map(s => s.termScores[term]).filter(Boolean);
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return { term: term.split(" (")[0], average: Number(avg.toFixed(1)) };
    });

    return { students: crossTermStudents, terms: termsList, chartData: chart };
  }, [rows, selectedSubject]);

  const { paginatedItems, currentPage, totalPages, totalItems, pageSize, startIndex, goToPage } = usePagination(students);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onExportExcel} disabled={exporting || loading}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />Download Excel
        </Button>
        <Button variant="outline" onClick={onExportPdf} disabled={exporting || loading}>
          <FileText className="h-4 w-4 mr-2" />Download PDF
        </Button>
      </div>

      {chartData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Class Average Trend Across Terms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="term" className="text-xs" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="average" name="Class Average" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="h-48 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : students.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              Select filters with multiple terms to see cross-term analysis.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>S/N</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Adm No</TableHead>
                    <TableHead>Class</TableHead>
                    {terms.map(t => <TableHead key={t} className="text-center min-w-[80px]">{t.split(" (")[0]}</TableHead>)}
                    <TableHead>Change</TableHead>
                    <TableHead>Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((s, i) => (
                    <TableRow key={s.admission_number}>
                      <TableCell className="text-muted-foreground">{startIndex + i + 1}</TableCell>
                      <TableCell className="font-medium">{s.student}</TableCell>
                      <TableCell>{s.admission_number}</TableCell>
                      <TableCell>{s.class}</TableCell>
                      {terms.map(t => (
                        <TableCell key={t} className="text-center font-semibold">
                          {s.termScores[t] ?? "-"}
                        </TableCell>
                      ))}
                      <TableCell>
                        <Badge variant={s.improvement > 0 ? "default" : s.improvement < 0 ? "destructive" : "secondary"}>
                          {s.improvement > 0 ? "+" : ""}{s.improvement}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {s.trend === "up" ? <TrendingUp className="h-4 w-4 text-emerald-500" /> :
                          s.trend === "down" ? <TrendingDown className="h-4 w-4 text-red-500" /> :
                            <Minus className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} startIndex={startIndex} onPageChange={goToPage} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
