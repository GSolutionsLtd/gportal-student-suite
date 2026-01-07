import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Key, Loader2, Users, CheckCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ClassArm {
  id: string;
  name: string;
  class: {
    id: string;
    name: string;
  };
}

interface Student {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  has_pin: boolean;
}

interface UnassignedPin {
  id: string;
  serial_number: string;
  pin_code: string;
}

export function AssignPinsTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [classArms, setClassArms] = useState<ClassArm[]>([]);
  const [selectedClassArm, setSelectedClassArm] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [availablePins, setAvailablePins] = useState<UnassignedPin[]>([]);
  const [currentTerm, setCurrentTerm] = useState<{ id: string; name: string } | null>(null);
  const [assignmentComplete, setAssignmentComplete] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedClassArm && currentTerm) {
      fetchStudents();
    }
  }, [selectedClassArm, currentTerm]);

  const fetchInitialData = async () => {
    try {
      const [classArmsRes, termRes, pinsRes] = await Promise.all([
        supabase
          .from("class_arms")
          .select(`id, name, class:classes(id, name)`)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("terms")
          .select("id, name")
          .eq("is_current", true)
          .maybeSingle(),
        supabase
          .from("pins")
          .select("id, serial_number, pin_code")
          .is("student_id", null)
          .eq("status", "active")
          .order("serial_number")
      ]);

      if (classArmsRes.error) throw classArmsRes.error;
      
      const typedClassArms = (classArmsRes.data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        class: item.class
      })) as ClassArm[];
      
      setClassArms(typedClassArms);
      setCurrentTerm(termRes.data);
      setAvailablePins(pinsRes.data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    if (!selectedClassArm || !currentTerm) return;

    setLoading(true);
    try {
      // Fetch students in selected class
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select("id, admission_number, first_name, last_name")
        .eq("current_class_arm_id", selectedClassArm)
        .eq("is_active", true)
        .order("last_name");

      if (studentsError) throw studentsError;

      // Fetch pins assigned to these students for current term
      const studentIds = (studentsData || []).map(s => s.id);
      const { data: assignedPins, error: pinsError } = await supabase
        .from("pins")
        .select("student_id")
        .in("student_id", studentIds.length > 0 ? studentIds : [''])
        .eq("term_id", currentTerm.id);

      if (pinsError) throw pinsError;

      const assignedStudentIds = new Set((assignedPins || []).map(p => p.student_id));

      const studentsWithPinStatus = (studentsData || []).map(s => ({
        ...s,
        has_pin: assignedStudentIds.has(s.id)
      }));

      setStudents(studentsWithPinStatus);
      // Pre-select students without pins
      setSelectedStudents(studentsWithPinStatus.filter(s => !s.has_pin).map(s => s.id));
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const toggleAll = () => {
    const studentsWithoutPins = students.filter(s => !s.has_pin);
    if (selectedStudents.length === studentsWithoutPins.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(studentsWithoutPins.map(s => s.id));
    }
  };

  const handleAssignPins = async () => {
    if (selectedStudents.length === 0 || !currentTerm) {
      toast({ 
        title: "Error", 
        description: "Please select at least one student", 
        variant: "destructive" 
      });
      return;
    }

    if (availablePins.length < selectedStudents.length) {
      toast({ 
        title: "Error", 
        description: `Not enough PINs available. Need ${selectedStudents.length}, have ${availablePins.length}`, 
        variant: "destructive" 
      });
      return;
    }

    setAssigning(true);
    try {
      // Assign pins to students
      for (let i = 0; i < selectedStudents.length; i++) {
        const studentId = selectedStudents[i];
        const pin = availablePins[i];

        const { error } = await supabase
          .from("pins")
          .update({ 
            student_id: studentId,
            term_id: currentTerm.id
          })
          .eq("id", pin.id);

        if (error) throw error;
      }

      setAssignmentComplete(true);
      toast({ 
        title: "Success", 
        description: `${selectedStudents.length} PINs assigned successfully` 
      });

      // Refresh data
      fetchInitialData();
      fetchStudents();
      setSelectedStudents([]);

      setTimeout(() => setAssignmentComplete(false), 5000);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  const getClassLabel = (classArm: ClassArm) => {
    return `${classArm.class.name} - ${classArm.name}`;
  };

  const studentsWithoutPins = students.filter(s => !s.has_pin);

  if (loading && classArms.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {assignmentComplete && (
        <Alert className="border-green-500 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Assignment Complete</AlertTitle>
          <AlertDescription className="text-green-700">
            PINs have been successfully assigned to the selected students.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Assign PINs to Students
          </CardTitle>
          <CardDescription>
            Assign generated PINs to students on a class-by-class basis for the current term
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="space-y-2 flex-1 min-w-[200px]">
              <label className="text-sm font-medium">Select Class</label>
              <Select value={selectedClassArm} onValueChange={setSelectedClassArm}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a class" />
                </SelectTrigger>
                <SelectContent>
                  {classArms.map(classArm => (
                    <SelectItem key={classArm.id} value={classArm.id}>
                      {getClassLabel(classArm)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Badge variant="outline" className="py-2">
                <Key className="h-3 w-3 mr-1" />
                {availablePins.length} PINs Available
              </Badge>
              {currentTerm && (
                <Badge variant="secondary" className="py-2">
                  {currentTerm.name}
                </Badge>
              )}
            </div>
          </div>

          {!currentTerm && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No Current Term</AlertTitle>
              <AlertDescription>
                Please set a current term in Academic Setup before assigning PINs.
              </AlertDescription>
            </Alert>
          )}

          {students.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedStudents.length === studentsWithoutPins.length && studentsWithoutPins.length > 0}
                    onCheckedChange={toggleAll}
                    disabled={studentsWithoutPins.length === 0}
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedStudents.length} of {studentsWithoutPins.length} eligible students selected
                  </span>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">
                    <Users className="h-3 w-3 mr-1" />
                    {students.length} students in class
                  </Badge>
                  <Badge variant="outline" className="text-green-600">
                    {students.filter(s => s.has_pin).length} already have PINs
                  </Badge>
                </div>
              </div>

              <div className="border rounded-lg max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Admission No.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>PIN Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map(student => (
                      <TableRow key={student.id} className={student.has_pin ? "opacity-60" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedStudents.includes(student.id)}
                            onCheckedChange={() => toggleStudent(student.id)}
                            disabled={student.has_pin}
                          />
                        </TableCell>
                        <TableCell className="font-mono">{student.admission_number}</TableCell>
                        <TableCell>
                          {student.last_name}, {student.first_name}
                        </TableCell>
                        <TableCell>
                          {student.has_pin ? (
                            <Badge variant="outline" className="text-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Assigned
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {selectedStudents.length > availablePins.length && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Insufficient PINs</AlertTitle>
                  <AlertDescription>
                    You've selected {selectedStudents.length} students but only {availablePins.length} PINs are available.
                    Please generate more PINs first.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end">
                <Button 
                  onClick={handleAssignPins} 
                  disabled={
                    assigning || 
                    selectedStudents.length === 0 || 
                    selectedStudents.length > availablePins.length ||
                    !currentTerm
                  }
                  size="lg"
                >
                  {assigning ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Key className="h-4 w-4 mr-2" />
                  )}
                  Assign PINs to {selectedStudents.length} Students
                </Button>
              </div>
            </>
          )}

          {selectedClassArm && students.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              No active students found in the selected class
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
