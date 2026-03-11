import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, FileText, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "./TablePagination";

export interface CumulativeRow {
  student: string;
  admission_number: string;
  class: string;
  terms_count: number;
  sessions_count: number;
  average_score: number;
  best_score: number;
  lowest_score: number;
}

interface CumulativeTableProps {
  rows: CumulativeRow[];
  loading: boolean;
  exporting: boolean;
  onExportExcel: () => void;
  onExportPdf: () => void;
}

function getPerformanceBadge(avg: number) {
  if (avg >= 70) return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Excellent</Badge>;
  if (avg >= 55) return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Good</Badge>;
  if (avg >= 45) return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Average</Badge>;
  return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Below Avg</Badge>;
}

function getTrendIcon(best: number, lowest: number, avg: number) {
  const range = best - lowest;
  if (range <= 5) return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (avg >= (best + lowest) / 2) return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  return <TrendingDown className="h-4 w-4 text-red-500" />;
}

export function CumulativeTable({ rows, loading, exporting, onExportExcel, onExportPdf }: CumulativeTableProps) {
  const { paginatedItems, currentPage, totalPages, totalItems, pageSize, startIndex, goToPage, changePageSize } = usePagination(rows);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onExportExcel} disabled={exporting || loading}>
          <Download className="h-4 w-4 mr-2" />Download Excel
        </Button>
        <Button variant="outline" onClick={onExportPdf} disabled={exporting || loading}>
          <FileText className="h-4 w-4 mr-2" />Download PDF
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="h-48 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : rows.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground">No cumulative data found.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>S/N</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Adm No</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Terms</TableHead>
                    <TableHead>Sessions</TableHead>
                    <TableHead>Cumulative Avg</TableHead>
                    <TableHead>Best</TableHead>
                    <TableHead>Lowest</TableHead>
                    <TableHead>Trend</TableHead>
                    <TableHead>Rating</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((row, i) => (
                    <TableRow key={`${row.admission_number}-${i}`}>
                      <TableCell className="text-muted-foreground">{startIndex + i + 1}</TableCell>
                      <TableCell className="font-medium">{row.student}</TableCell>
                      <TableCell>{row.admission_number}</TableCell>
                      <TableCell>{row.class}</TableCell>
                      <TableCell>{row.terms_count}</TableCell>
                      <TableCell>{row.sessions_count}</TableCell>
                      <TableCell className="font-semibold">{row.average_score}</TableCell>
                      <TableCell className="text-emerald-600">{row.best_score}</TableCell>
                      <TableCell className="text-red-500">{row.lowest_score}</TableCell>
                      <TableCell>{getTrendIcon(row.best_score, row.lowest_score, row.average_score)}</TableCell>
                      <TableCell>{getPerformanceBadge(row.average_score)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} startIndex={startIndex} onPageChange={goToPage} onPageSizeChange={changePageSize} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
