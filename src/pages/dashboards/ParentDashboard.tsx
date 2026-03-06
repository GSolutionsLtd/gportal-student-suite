import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Users, GraduationCap, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LinkedStudent {
  id: string;
  student_id: string;
  relationship: string;
  student: {
    id: string;
    first_name: string;
    last_name: string;
    admission_number: string;
    current_class_arm_id: string | null;
    is_active: boolean;
  };
  latestResult?: {
    average_score: number | null;
    class_position: number | null;
    status: string;
    term_name: string;
  };
}

export default function ParentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [linkedStudents, setLinkedStudents] = useState<LinkedStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) fetchLinkedStudents();
  }, [user]);

  const fetchLinkedStudents = async () => {
    try {
      const { data: links, error } = await supabase
        .from("parent_students")
        .select("id, student_id, relationship")
        .eq("parent_user_id", user!.id)
        .eq("is_active", true);

      if (error) throw error;
      if (!links || links.length === 0) {
        setLinkedStudents([]);
        setIsLoading(false);
        return;
      }

      const studentIds = links.map((l) => l.student_id);
      const { data: students } = await supabase
        .from("students")
        .select("id, first_name, last_name, admission_number, current_class_arm_id, is_active")
        .in("id", studentIds);

      // Get latest published results for each student
      const { data: results } = await supabase
        .from("results")
        .select("student_id, average_score, class_position, status, term_id")
        .in("student_id", studentIds)
        .eq("status", "published")
        .order("created_at", { ascending: false });

      const { data: terms } = await supabase.from("terms").select("id, name");
      const termMap = new Map(terms?.map((t) => [t.id, t.name]) || []);

      const enriched: LinkedStudent[] = links.map((link) => {
        const student = students?.find((s) => s.id === link.student_id);
        const latestResult = results?.find((r) => r.student_id === link.student_id);

        return {
          ...link,
          student: student || {
            id: link.student_id,
            first_name: "Unknown",
            last_name: "",
            admission_number: "",
            current_class_arm_id: null,
            is_active: false,
          },
          latestResult: latestResult
            ? {
                average_score: latestResult.average_score,
                class_position: latestResult.class_position,
                status: latestResult.status,
                term_name: termMap.get(latestResult.term_id) || "Unknown Term",
              }
            : undefined,
        };
      });

      setLinkedStudents(enriched);
    } catch (err) {
      console.error("Error fetching linked students:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Parent Dashboard</h1>
        <p className="text-muted-foreground">Monitor your children's academic progress</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{linkedStudents.length}</p>
                <p className="text-sm text-muted-foreground">Linked Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {linkedStudents.filter((s) => s.latestResult).length}
                </p>
                <p className="text-sm text-muted-foreground">Results Available</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {linkedStudents
                    .filter((s) => s.latestResult?.average_score && s.latestResult.average_score >= 50)
                    .length}
                </p>
                <p className="text-sm text-muted-foreground">Passing</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Student Cards */}
      {linkedStudents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground">No Students Linked</h3>
            <p className="text-muted-foreground mt-2">
              Contact your school administrator to link your child's account.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {linkedStudents.map((ls) => (
            <Card key={ls.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {ls.student.first_name} {ls.student.last_name}
                  </CardTitle>
                  <Badge variant={ls.student.is_active ? "default" : "secondary"}>
                    {ls.student.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {ls.student.admission_number} • {ls.relationship}
                </p>
              </CardHeader>
              <CardContent>
                {ls.latestResult ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      Latest: {ls.latestResult.term_name}
                    </p>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-2xl font-bold text-foreground">
                          {ls.latestResult.average_score?.toFixed(1) ?? "N/A"}%
                        </p>
                        <p className="text-xs text-muted-foreground">Average</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">
                          {ls.latestResult.class_position ?? "N/A"}
                        </p>
                        <p className="text-xs text-muted-foreground">Position</p>
                      </div>
                      <div className="ml-auto">
                        {ls.latestResult.average_score && ls.latestResult.average_score >= 60 ? (
                          <TrendingUp className="h-6 w-6 text-success" />
                        ) : ls.latestResult.average_score && ls.latestResult.average_score >= 40 ? (
                          <Minus className="h-6 w-6 text-warning" />
                        ) : (
                          <TrendingDown className="h-6 w-6 text-destructive" />
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate(`/parent/results/${ls.student_id}`)}
                    >
                      View Full Results
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No published results yet.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
