import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Key, Users, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface ClassPinStats {
  className: string;
  classArmName: string;
  totalStudents: number;
  assignedPins: number;
  unassignedStudents: number;
  percentage: number;
}

interface OverallStats {
  totalPins: number;
  assignedPins: number;
  unassignedPins: number;
  activePins: number;
  usedPins: number;
}

export function PinStatisticsWidget() {
  const [loading, setLoading] = useState(true);
  const [classStats, setClassStats] = useState<ClassPinStats[]>([]);
  const [overallStats, setOverallStats] = useState<OverallStats>({
    totalPins: 0,
    assignedPins: 0,
    unassignedPins: 0,
    activePins: 0,
    usedPins: 0,
  });
  const [currentTerm, setCurrentTerm] = useState<string>("");

  useEffect(() => {
    fetchPinStatistics();
  }, []);

  const fetchPinStatistics = async () => {
    try {
      // Get current term
      const { data: termData } = await supabase
        .from("terms")
        .select("id, name")
        .eq("is_current", true)
        .maybeSingle();

      if (termData) {
        setCurrentTerm(termData.name);
      }

      // Fetch all PINs for current term
      const { data: pins } = await supabase
        .from("pins")
        .select("id, student_id, status, term_id")
        .eq("term_id", termData?.id || "");

      const allPins = pins || [];
      const assigned = allPins.filter(p => p.student_id !== null);
      const unassigned = allPins.filter(p => p.student_id === null);
      const active = allPins.filter(p => p.status === "active");
      const used = allPins.filter(p => p.status === "used");

      setOverallStats({
        totalPins: allPins.length,
        assignedPins: assigned.length,
        unassignedPins: unassigned.length,
        activePins: active.length,
        usedPins: used.length,
      });

      // Fetch class arms and their students
      const { data: classArms } = await supabase
        .from("class_arms")
        .select(`
          id, 
          name, 
          class:classes(name)
        `)
        .eq("is_active", true);

      if (!classArms) return;

      const statsPromises = classArms.map(async (arm) => {
        // Count students in this class arm
        const { count: studentCount } = await supabase
          .from("students")
          .select("id", { count: "exact", head: true })
          .eq("current_class_arm_id", arm.id)
          .eq("is_active", true);

        // Count assigned PINs for students in this class arm
        const { data: studentsInClass } = await supabase
          .from("students")
          .select("id")
          .eq("current_class_arm_id", arm.id)
          .eq("is_active", true);

        const studentIds = (studentsInClass || []).map(s => s.id);
        
        let assignedCount = 0;
        if (studentIds.length > 0 && termData) {
          const { count } = await supabase
            .from("pins")
            .select("id", { count: "exact", head: true })
            .in("student_id", studentIds)
            .eq("term_id", termData.id);
          assignedCount = count || 0;
        }

        const total = studentCount || 0;
        const assigned = assignedCount;
        const percentage = total > 0 ? Math.round((assigned / total) * 100) : 0;

        return {
          className: (arm.class as any)?.name || "",
          classArmName: arm.name,
          totalStudents: total,
          assignedPins: assigned,
          unassignedStudents: total - assigned,
          percentage,
        };
      });

      const stats = await Promise.all(statsPromises);
      // Filter out classes with no students and sort by percentage (lowest first to show priority)
      const filteredStats = stats
        .filter(s => s.totalStudents > 0)
        .sort((a, b) => a.percentage - b.percentage);
      
      setClassStats(filteredStats);
    } catch (error) {
      console.error("Error fetching PIN statistics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const assignmentPercentage = overallStats.totalPins > 0 
    ? Math.round((overallStats.assignedPins / overallStats.totalPins) * 100) 
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5 text-primary" />
          PIN Assignment Statistics
        </CardTitle>
        {currentTerm && (
          <Badge variant="outline" className="w-fit">{currentTerm}</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-secondary/50">
            <div className="text-2xl font-bold text-foreground">{overallStats.totalPins}</div>
            <div className="text-xs text-muted-foreground">Total PINs</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-500/10">
            <div className="text-2xl font-bold text-green-600">{overallStats.assignedPins}</div>
            <div className="text-xs text-muted-foreground">Assigned</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-yellow-500/10">
            <div className="text-2xl font-bold text-yellow-600">{overallStats.unassignedPins}</div>
            <div className="text-xs text-muted-foreground">Unassigned</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-blue-500/10">
            <div className="text-2xl font-bold text-blue-600">{overallStats.usedPins}</div>
            <div className="text-xs text-muted-foreground">Used</div>
          </div>
        </div>

        {/* Overall Progress */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Overall Assignment Progress</span>
            <span className="font-medium">{assignmentPercentage}%</span>
          </div>
          <Progress value={assignmentPercentage} className="h-2" />
        </div>

        {/* Per-Class Stats */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Assignment by Class</h4>
          {classStats.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              No class data available
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {classStats.map((stat, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{stat.className} {stat.classArmName}</span>
                      {stat.percentage === 100 ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : stat.percentage < 50 ? (
                        <AlertCircle className="h-3 w-3 text-yellow-500" />
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>{stat.assignedPins}/{stat.totalStudents}</span>
                      <span className="font-medium text-foreground">{stat.percentage}%</span>
                    </div>
                  </div>
                  <Progress 
                    value={stat.percentage} 
                    className={`h-1.5 ${
                      stat.percentage === 100 
                        ? "[&>div]:bg-green-500" 
                        : stat.percentage < 50 
                          ? "[&>div]:bg-yellow-500" 
                          : ""
                    }`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>100% Assigned</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-primary"></div>
            <span>50-99% Assigned</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
            <span>&lt;50% Assigned</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}