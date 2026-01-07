import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Loader2, Users, AlertTriangle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ClassArm {
  id: string;
  name: string;
  class: {
    id: string;
    name: string;
    level: number;
  };
}

interface Student {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  current_class_arm_id: string | null;
}

export default function ClassPromotion() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);
  const [classArms, setClassArms] = useState<ClassArm[]>([]);
  const [sourceClassArm, setSourceClassArm] = useState<string>("");
  const [targetClassArm, setTargetClassArm] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [promotionComplete, setPromotionComplete] = useState(false);

  useEffect(() => {
    fetchClassArms();
  }, []);

  useEffect(() => {
    if (sourceClassArm) {
      fetchStudents();
    }
  }, [sourceClassArm]);

  const fetchClassArms = async () => {
    try {
      const { data, error } = await supabase
        .from("class_arms")
        .select(`
          id,
          name,
          class:classes(id, name, level)
        `)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      
      const typedData = (data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        class: item.class
      })) as ClassArm[];
      
      setClassArms(typedData);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    if (!sourceClassArm) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("students")
        .select("id, admission_number, first_name, last_name, current_class_arm_id")
        .eq("current_class_arm_id", sourceClassArm)
        .eq("is_active", true)
        .order("last_name");

      if (error) throw error;
      setStudents(data || []);
      setSelectedStudents((data || []).map(s => s.id));
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
    if (selectedStudents.length === students.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(students.map(s => s.id));
    }
  };

  const handlePromote = async () => {
    if (!targetClassArm || selectedStudents.length === 0) {
      toast({ 
        title: "Error", 
        description: "Please select target class and at least one student", 
        variant: "destructive" 
      });
      return;
    }

    if (sourceClassArm === targetClassArm) {
      toast({ 
        title: "Error", 
        description: "Source and target class cannot be the same", 
        variant: "destructive" 
      });
      return;
    }

    setPromoting(true);
    try {
      const { error } = await supabase
        .from("students")
        .update({ current_class_arm_id: targetClassArm })
        .in("id", selectedStudents);

      if (error) throw error;

      setPromotionComplete(true);
      toast({ 
        title: "Success", 
        description: `${selectedStudents.length} students promoted successfully` 
      });

      // Reset form
      setSourceClassArm("");
      setTargetClassArm("");
      setStudents([]);
      setSelectedStudents([]);

      setTimeout(() => setPromotionComplete(false), 5000);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setPromoting(false);
    }
  };

  const getClassLabel = (classArm: ClassArm) => {
    return `${classArm.class.name} - ${classArm.name}`;
  };

  const getTargetOptions = () => {
    if (!sourceClassArm) return classArms;
    const sourceArm = classArms.find(c => c.id === sourceClassArm);
    if (!sourceArm) return classArms;
    
    // Suggest classes at same or higher level
    return classArms.filter(c => c.class.level >= sourceArm.class.level && c.id !== sourceClassArm);
  };

  if (loading && classArms.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Class Promotion</h1>
        <p className="text-muted-foreground">
          Move students to the next class at the end of academic session
        </p>
      </div>

      {promotionComplete && (
        <Alert className="border-green-500 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Promotion Complete</AlertTitle>
          <AlertDescription className="text-green-700">
            Students have been successfully promoted to their new class.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Promote Students
          </CardTitle>
          <CardDescription>
            Select source class, choose students to promote, and select target class
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">From Class</label>
              <Select value={sourceClassArm} onValueChange={setSourceClassArm}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source class" />
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

            <div className="flex justify-center">
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">To Class</label>
              <Select value={targetClassArm} onValueChange={setTargetClassArm} disabled={!sourceClassArm}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target class" />
                </SelectTrigger>
                <SelectContent>
                  {getTargetOptions().map(classArm => (
                    <SelectItem key={classArm.id} value={classArm.id}>
                      {getClassLabel(classArm)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {students.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedStudents.length === students.length}
                    onCheckedChange={toggleAll}
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedStudents.length} of {students.length} students selected
                  </span>
                </div>
                <Badge variant="secondary">
                  {students.length} students in class
                </Badge>
              </div>

              <div className="border rounded-lg max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Admission No.</TableHead>
                      <TableHead>Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map(student => (
                      <TableRow key={student.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedStudents.includes(student.id)}
                            onCheckedChange={() => toggleStudent(student.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono">{student.admission_number}</TableCell>
                        <TableCell>
                          {student.last_name}, {student.first_name}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {selectedStudents.length > 0 && targetClassArm && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Confirm Promotion</AlertTitle>
                  <AlertDescription>
                    You are about to promote {selectedStudents.length} students. This action will update their current class assignment.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end">
                <Button 
                  onClick={handlePromote} 
                  disabled={promoting || !targetClassArm || selectedStudents.length === 0}
                  size="lg"
                >
                  {promoting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  Promote {selectedStudents.length} Students
                </Button>
              </div>
            </>
          )}

          {sourceClassArm && students.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              No active students found in the selected class
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
