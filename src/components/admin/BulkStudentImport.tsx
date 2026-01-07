import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Download,
  Loader2,
  X,
} from "lucide-react";

interface ParsedStudent {
  first_name: string;
  middle_name?: string;
  last_name: string;
  admission_number: string;
  gender?: string;
  date_of_birth?: string;
  guardian_name?: string;
  guardian_phone?: string;
  guardian_email?: string;
  address?: string;
  class_arm_id?: string;
  isValid: boolean;
  errors: string[];
  rowNumber: number;
}

interface ClassArm {
  id: string;
  name: string;
  class_name: string;
}

interface BulkStudentImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  classArms: ClassArm[];
}

export function BulkStudentImport({
  open,
  onOpenChange,
  onSuccess,
  classArms,
}: BulkStudentImportProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "complete">("upload");
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([]);
  const [selectedClassArm, setSelectedClassArm] = useState<string>("");
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });
  const [existingAdmNumbers, setExistingAdmNumbers] = useState<Set<string>>(new Set());

  const resetState = () => {
    setStep("upload");
    setParsedStudents([]);
    setSelectedClassArm("");
    setImportProgress(0);
    setImportResults({ success: 0, failed: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const downloadTemplate = () => {
    const template = [
      {
        first_name: "John",
        middle_name: "James",
        last_name: "Doe",
        admission_number: "ADM001",
        gender: "Male",
        date_of_birth: "2010-05-15",
        guardian_name: "Jane Doe",
        guardian_phone: "08012345678",
        guardian_email: "jane@example.com",
        address: "123 Main Street",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students Template");
    
    // Set column widths
    ws["!cols"] = [
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
      { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 30 },
    ];

    XLSX.writeFile(wb, "student_import_template.xlsx");
  };

  const validateStudent = (student: any, rowNumber: number, existingNumbers: Set<string>): ParsedStudent => {
    const errors: string[] = [];
    
    const firstName = String(student.first_name || "").trim();
    const lastName = String(student.last_name || "").trim();
    const admissionNumber = String(student.admission_number || "").trim();

    if (!firstName) errors.push("First name is required");
    if (!lastName) errors.push("Last name is required");
    if (!admissionNumber) errors.push("Admission number is required");
    if (admissionNumber && existingNumbers.has(admissionNumber.toUpperCase())) {
      errors.push("Admission number already exists");
    }

    // Validate date format if provided
    const dob = student.date_of_birth;
    let formattedDob: string | undefined;
    if (dob) {
      if (typeof dob === "number") {
        // Excel date serial number
        const date = XLSX.SSF.parse_date_code(dob);
        formattedDob = `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
      } else if (typeof dob === "string") {
        const parsed = new Date(dob);
        if (!isNaN(parsed.getTime())) {
          formattedDob = parsed.toISOString().split("T")[0];
        }
      }
    }

    // Validate gender
    const gender = String(student.gender || "").toLowerCase();
    const validGender = gender === "male" || gender === "female" || gender === "m" || gender === "f" ? 
      (gender === "m" ? "male" : gender === "f" ? "female" : gender) : undefined;

    return {
      first_name: firstName,
      middle_name: String(student.middle_name || "").trim() || undefined,
      last_name: lastName,
      admission_number: admissionNumber.toUpperCase(),
      gender: validGender,
      date_of_birth: formattedDob,
      guardian_name: String(student.guardian_name || "").trim() || undefined,
      guardian_phone: String(student.guardian_phone || "").trim() || undefined,
      guardian_email: String(student.guardian_email || "").trim() || undefined,
      address: String(student.address || "").trim() || undefined,
      isValid: errors.length === 0,
      errors,
      rowNumber,
    };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Fetch existing admission numbers
      const { data: existingStudents } = await supabase
        .from("students")
        .select("admission_number");
      
      const existingNumbers = new Set(
        (existingStudents || []).map((s) => s.admission_number.toUpperCase())
      );
      setExistingAdmNumbers(existingNumbers);

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (jsonData.length === 0) {
            toast({
              title: "Empty file",
              description: "The uploaded file contains no data",
              variant: "destructive",
            });
            return;
          }

          // Track admission numbers in current import to detect duplicates within file
          const importAdmNumbers = new Set<string>();
          const parsed = jsonData.map((row: any, index) => {
            const student = validateStudent(row, index + 2, existingNumbers);
            
            // Check for duplicates within the same file
            if (student.admission_number && importAdmNumbers.has(student.admission_number)) {
              student.errors.push("Duplicate admission number in file");
              student.isValid = false;
            }
            importAdmNumbers.add(student.admission_number);
            
            return student;
          });

          setParsedStudents(parsed);
          setStep("preview");
        } catch (error) {
          toast({
            title: "Parse error",
            description: "Failed to parse the file. Please check the format.",
            variant: "destructive",
          });
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process the file",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (!selectedClassArm) {
      toast({
        title: "Select a class",
        description: "Please select a class for the students",
        variant: "destructive",
      });
      return;
    }

    const validStudents = parsedStudents.filter((s) => s.isValid);
    if (validStudents.length === 0) {
      toast({
        title: "No valid students",
        description: "There are no valid students to import",
        variant: "destructive",
      });
      return;
    }

    setStep("importing");
    let success = 0;
    let failed = 0;

    for (let i = 0; i < validStudents.length; i++) {
      const student = validStudents[i];
      
      try {
        const { error } = await supabase.from("students").insert({
          first_name: student.first_name,
          middle_name: student.middle_name || null,
          last_name: student.last_name,
          admission_number: student.admission_number,
          gender: student.gender || null,
          date_of_birth: student.date_of_birth || null,
          guardian_name: student.guardian_name || null,
          guardian_phone: student.guardian_phone || null,
          guardian_email: student.guardian_email || null,
          address: student.address || null,
          current_class_arm_id: selectedClassArm,
        });

        if (error) throw error;
        success++;
      } catch {
        failed++;
      }

      setImportProgress(Math.round(((i + 1) / validStudents.length) * 100));
    }

    setImportResults({ success, failed });
    setStep("complete");
  };

  const validCount = parsedStudents.filter((s) => s.isValid).length;
  const invalidCount = parsedStudents.length - validCount;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Bulk Student Import
          </DialogTitle>
          <DialogDescription>
            Import multiple students from a CSV or Excel file
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-6">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium text-foreground mb-2">
                Upload Student Data
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Drag and drop or click to select a CSV or Excel file
              </p>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="max-w-xs mx-auto"
              />
            </div>

            <div className="flex items-center justify-center gap-4">
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium text-sm mb-2">Required Columns:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <code className="bg-muted px-1 rounded">first_name</code> - Student's first name</li>
                <li>• <code className="bg-muted px-1 rounded">last_name</code> - Student's last name</li>
                <li>• <code className="bg-muted px-1 rounded">admission_number</code> - Unique admission number</li>
              </ul>
              <h4 className="font-medium text-sm mt-4 mb-2">Optional Columns:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <code className="bg-muted px-1 rounded">middle_name</code>, <code className="bg-muted px-1 rounded">gender</code>, <code className="bg-muted px-1 rounded">date_of_birth</code></li>
                <li>• <code className="bg-muted px-1 rounded">guardian_name</code>, <code className="bg-muted px-1 rounded">guardian_phone</code>, <code className="bg-muted px-1 rounded">guardian_email</code>, <code className="bg-muted px-1 rounded">address</code></li>
              </ul>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {validCount} Valid
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {invalidCount} Invalid
                  </Badge>
                )}
              </div>
              <Select value={selectedClassArm} onValueChange={setSelectedClassArm}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Select class for import" />
                </SelectTrigger>
                <SelectContent>
                  {classArms.map((arm) => (
                    <SelectItem key={arm.id} value={arm.id}>
                      {arm.class_name} - {arm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Admission No.</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Guardian</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedStudents.map((student, index) => (
                    <TableRow key={index} className={!student.isValid ? "bg-destructive/10" : ""}>
                      <TableCell className="text-muted-foreground">{student.rowNumber}</TableCell>
                      <TableCell>
                        {student.last_name}, {student.first_name} {student.middle_name || ""}
                      </TableCell>
                      <TableCell className="font-mono">{student.admission_number}</TableCell>
                      <TableCell className="capitalize">{student.gender || "-"}</TableCell>
                      <TableCell>{student.guardian_name || "-"}</TableCell>
                      <TableCell>
                        {student.isValid ? (
                          <Badge variant="outline" className="text-success border-success">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Valid
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {student.errors[0]}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <h3 className="font-medium text-lg">Importing Students...</h3>
            <Progress value={importProgress} className="max-w-md mx-auto" />
            <p className="text-sm text-muted-foreground">
              {importProgress}% complete
            </p>
          </div>
        )}

        {step === "complete" && (
          <div className="py-8 text-center space-y-4">
            <CheckCircle className="h-12 w-12 mx-auto text-success" />
            <h3 className="font-medium text-lg">Import Complete!</h3>
            <div className="flex items-center justify-center gap-6">
              <div>
                <p className="text-2xl font-bold text-success">{importResults.success}</p>
                <p className="text-sm text-muted-foreground">Successfully imported</p>
              </div>
              {importResults.failed > 0 && (
                <div>
                  <p className="text-2xl font-bold text-destructive">{importResults.failed}</p>
                  <p className="text-sm text-muted-foreground">Failed</p>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={resetState}>
                <X className="h-4 w-4 mr-2" />
                Start Over
              </Button>
              <Button onClick={handleImport} disabled={validCount === 0 || !selectedClassArm}>
                <Upload className="h-4 w-4 mr-2" />
                Import {validCount} Students
              </Button>
            </>
          )}
          {step === "complete" && (
            <Button onClick={() => { handleClose(); onSuccess(); }}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
