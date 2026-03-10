import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "./TablePagination";

export interface BroadsheetRow {
  student: string;
  admission_number: string;
  class: string;
  class_arm: string;
  term: string;
  session: string;
  status: string;
  subject_score: number | null;
  total_score: number | null;
  average_score: number | null;
  class_position: number | null;
}

interface BroadsheetTableProps {
  rows: BroadsheetRow[];
  loading: boolean;
  exporting: boolean;
  selectedSubject: string;
  onExportExcel: () => void;
  onExportPdf: () => void;
}

export function BroadsheetTable({ rows, loading, exporting, selectedSubject, onExportExcel, onExportPdf }: BroadsheetTableProps) {
  const { paginatedItems, currentPage, totalPages, totalItems, pageSize, startIndex, goToPage } = usePagination(rows);

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

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="h-48 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : rows.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground">No results found for the selected filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>S/N</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Adm No</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Arm</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Session</TableHead>
                    <TableHead>{selectedSubject === "all" ? "Average" : "Subject Score"}</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((row, i) => (
                    <TableRow key={`${row.admission_number}-${i}`}>
                      <TableCell className="text-muted-foreground">{startIndex + i + 1}</TableCell>
                      <TableCell className="font-medium">{row.student}</TableCell>
                      <TableCell>{row.admission_number}</TableCell>
                      <TableCell>{row.class}</TableCell>
                      <TableCell>{row.class_arm}</TableCell>
                      <TableCell>{row.term}</TableCell>
                      <TableCell>{row.session}</TableCell>
                      <TableCell className="font-semibold">{selectedSubject === "all" ? (row.average_score ?? "-") : (row.subject_score ?? "-")}</TableCell>
                      <TableCell>{row.total_score ?? "-"}</TableCell>
                      <TableCell>{row.class_position ?? "-"}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{row.status}</Badge></TableCell>
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
