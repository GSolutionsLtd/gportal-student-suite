import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Printer, Loader2 } from "lucide-react";
import * as XLSX from 'xlsx';

interface Term {
  id: string;
  name: string;
}

interface Pin {
  serial_number: string;
  pin_code: string;
  status: string;
  max_usage: number;
  usage_count: number;
  expires_at: string | null;
  generated_at: string;
  student?: {
    first_name: string;
    last_name: string;
    admission_number: string;
  } | null;
  term?: {
    name: string;
  } | null;
}

export const PinExportTab = () => {
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [pins, setPins] = useState<Pin[]>([]);

  useEffect(() => {
    fetchTerms();
  }, []);

  const fetchTerms = async () => {
    const { data } = await supabase
      .from("terms")
      .select("id, name")
      .order("start_date", { ascending: false });
    setTerms(data || []);
  };

  const fetchPins = async () => {
    setLoading(true);
    let query = supabase
      .from("pins")
      .select(`
        serial_number,
        pin_code,
        status,
        max_usage,
        usage_count,
        expires_at,
        generated_at,
        student:students(first_name, last_name, admission_number),
        term:terms(name)
      `)
      .order("generated_at", { ascending: false });

    if (selectedTerm !== "all") {
      query = query.eq("term_id", selectedTerm);
    }

    const { data, error } = await query;
    if (error) {
      toast.error("Failed to fetch PINs");
      setLoading(false);
      return [];
    }
    setPins(data || []);
    setLoading(false);
    return data || [];
  };

  const exportToExcel = async () => {
    const data = await fetchPins();
    if (data.length === 0) {
      toast.error("No PINs to export");
      return;
    }

    const exportData = data.map((pin: Pin) => ({
      "Serial Number": pin.serial_number,
      "PIN Code": pin.pin_code,
      "Status": pin.status,
      "Assigned Student": pin.student 
        ? `${pin.student.first_name} ${pin.student.last_name}` 
        : "Unassigned",
      "Admission Number": pin.student?.admission_number || "-",
      "Term": pin.term?.name || "-",
      "Usage": `${pin.usage_count}/${pin.max_usage}`,
      "Expires": pin.expires_at 
        ? new Date(pin.expires_at).toLocaleDateString() 
        : "Never",
      "Generated": new Date(pin.generated_at).toLocaleDateString(),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PINs");
    
    const termName = selectedTerm === "all" 
      ? "All-Terms" 
      : terms.find(t => t.id === selectedTerm)?.name || "Unknown";
    XLSX.writeFile(wb, `PINs-${termName}-${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast.success("PINs exported to Excel successfully");
  };

  const exportToCSV = async () => {
    const data = await fetchPins();
    if (data.length === 0) {
      toast.error("No PINs to export");
      return;
    }

    const exportData = data.map((pin: Pin) => ({
      "Serial Number": pin.serial_number,
      "PIN Code": pin.pin_code,
      "Status": pin.status,
      "Assigned Student": pin.student 
        ? `${pin.student.first_name} ${pin.student.last_name}` 
        : "Unassigned",
      "Admission Number": pin.student?.admission_number || "-",
      "Term": pin.term?.name || "-",
      "Usage": `${pin.usage_count}/${pin.max_usage}`,
      "Expires": pin.expires_at 
        ? new Date(pin.expires_at).toLocaleDateString() 
        : "Never",
      "Generated": new Date(pin.generated_at).toLocaleDateString(),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const csv = XLSX.utils.sheet_to_csv(ws);
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const termName = selectedTerm === "all" 
      ? "All-Terms" 
      : terms.find(t => t.id === selectedTerm)?.name || "Unknown";
    link.href = URL.createObjectURL(blob);
    link.download = `PINs-${termName}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast.success("PINs exported to CSV successfully");
  };

  const printPinSlips = async () => {
    const data = await fetchPins();
    if (data.length === 0) {
      toast.error("No PINs to print");
      return;
    }

    // Open print window with PIN slips
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Please allow popups to print PIN slips");
      return;
    }

    const { data: schoolSettings } = await supabase
      .from("school_settings")
      .select("school_name, logo_url, motto")
      .limit(1)
      .single();

    const schoolName = schoolSettings?.school_name || "School";
    const logoUrl = schoolSettings?.logo_url || "";
    const motto = schoolSettings?.motto || "";

    const slipsHtml = data.map((pin: Pin) => `
      <div class="pin-slip">
        <div class="header">
          ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="logo">` : ''}
          <div class="school-info">
            <h2>${schoolName}</h2>
            ${motto ? `<p class="motto">"${motto}"</p>` : ''}
          </div>
        </div>
        <div class="content">
          <h3>RESULT CHECKING PIN</h3>
          <div class="pin-info">
            <div class="row">
              <span class="label">Serial Number:</span>
              <span class="value">${pin.serial_number}</span>
            </div>
            <div class="row">
              <span class="label">PIN Code:</span>
              <span class="value pin-code">${pin.pin_code}</span>
            </div>
            ${pin.student ? `
              <div class="row">
                <span class="label">Student:</span>
                <span class="value">${pin.student.first_name} ${pin.student.last_name}</span>
              </div>
              <div class="row">
                <span class="label">Admission No:</span>
                <span class="value">${pin.student.admission_number}</span>
              </div>
            ` : ''}
            <div class="row">
              <span class="label">Term:</span>
              <span class="value">${pin.term?.name || '-'}</span>
            </div>
            <div class="row">
              <span class="label">Max Uses:</span>
              <span class="value">${pin.max_usage}</span>
            </div>
          </div>
          <div class="instructions">
            <h4>How to Check Your Result:</h4>
            <ol>
              <li>Visit the school result portal</li>
              <li>Enter your Admission Number</li>
              <li>Enter the PIN Code above</li>
              <li>Click "Check Result"</li>
            </ol>
          </div>
          <p class="note">Keep this PIN safe. It can only be used ${pin.max_usage} time(s).</p>
        </div>
      </div>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>PIN Slips - ${schoolName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; background: #f0f0f0; padding: 10px; }
          .pin-slip {
            width: 300px;
            background: white;
            border: 2px solid #333;
            border-radius: 8px;
            padding: 15px;
            margin: 10px;
            display: inline-block;
            vertical-align: top;
            page-break-inside: avoid;
          }
          .header { text-align: center; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 10px; }
          .logo { height: 40px; margin-bottom: 5px; }
          .school-info h2 { font-size: 14px; color: #333; }
          .motto { font-size: 10px; font-style: italic; color: #666; }
          .content h3 { text-align: center; font-size: 12px; background: #333; color: white; padding: 5px; margin-bottom: 10px; }
          .pin-info { margin-bottom: 10px; }
          .row { display: flex; justify-content: space-between; font-size: 11px; padding: 3px 0; border-bottom: 1px dotted #ddd; }
          .label { color: #666; }
          .value { font-weight: bold; }
          .pin-code { font-family: monospace; font-size: 14px; color: #007bff; letter-spacing: 2px; }
          .instructions { background: #f9f9f9; padding: 8px; border-radius: 4px; margin-bottom: 10px; }
          .instructions h4 { font-size: 10px; margin-bottom: 5px; }
          .instructions ol { font-size: 9px; padding-left: 15px; }
          .instructions li { margin-bottom: 2px; }
          .note { font-size: 9px; text-align: center; color: #d9534f; font-weight: bold; }
          @media print {
            body { background: white; padding: 0; }
            .pin-slip { border: 1px solid #333; margin: 5px; }
          }
        </style>
      </head>
      <body>
        ${slipsHtml}
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
    
    toast.success("PIN slips ready for printing");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Export & Print PINs
        </CardTitle>
        <CardDescription>
          Export PIN data to Excel/CSV or print PIN slips for distribution
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Filter by Term</label>
            <Select value={selectedTerm} onValueChange={setSelectedTerm}>
              <SelectTrigger>
                <SelectValue placeholder="Select term" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Terms</SelectItem>
                {terms.map((term) => (
                  <SelectItem key={term.id} value={term.id}>
                    {term.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <Button 
            onClick={exportToExcel} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 mr-2" />
            )}
            Export to Excel
          </Button>
          
          <Button 
            onClick={exportToCSV} 
            disabled={loading}
            variant="outline"
            className="w-full"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export to CSV
          </Button>
          
          <Button 
            onClick={printPinSlips} 
            disabled={loading}
            variant="secondary"
            className="w-full"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Printer className="h-4 w-4 mr-2" />
            )}
            Print PIN Slips
          </Button>
        </div>

        <div className="bg-muted/50 rounded-lg p-4">
          <h4 className="font-medium mb-2">PIN Slip Contents</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• School name and logo</li>
            <li>• Serial number and PIN code</li>
            <li>• Student name (if assigned)</li>
            <li>• Term information</li>
            <li>• Usage instructions</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};