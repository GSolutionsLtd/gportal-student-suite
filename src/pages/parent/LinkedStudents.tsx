import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Users, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function LinkedStudents() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [links, setLinks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) fetchLinks();
  }, [user]);

  const fetchLinks = async () => {
    try {
      const { data: parentLinks } = await supabase
        .from("parent_students")
        .select("id, student_id, relationship, linked_at, is_active")
        .eq("parent_user_id", user!.id);

      if (!parentLinks || parentLinks.length === 0) {
        setLinks([]);
        setIsLoading(false);
        return;
      }

      const studentIds = parentLinks.map((l) => l.student_id);
      const { data: students } = await supabase
        .from("students")
        .select("id, first_name, last_name, admission_number, is_active")
        .in("id", studentIds);

      const enriched = parentLinks.map((link) => ({
        ...link,
        student: students?.find((s) => s.id === link.student_id),
      }));

      setLinks(enriched);
    } catch (err) {
      console.error("Error:", err);
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
        <h1 className="text-2xl font-bold text-foreground">My Students</h1>
        <p className="text-muted-foreground">Students linked to your parent account</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {links.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No students linked. Contact your school admin to link students to your account.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Admission No.</TableHead>
                  <TableHead>Relationship</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Linked</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="font-medium">
                      {link.student?.first_name} {link.student?.last_name}
                    </TableCell>
                    <TableCell>{link.student?.admission_number}</TableCell>
                    <TableCell className="capitalize">{link.relationship}</TableCell>
                    <TableCell>
                      <Badge variant={link.is_active ? "default" : "secondary"}>
                        {link.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(link.linked_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/parent/results/${link.student_id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Results
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
