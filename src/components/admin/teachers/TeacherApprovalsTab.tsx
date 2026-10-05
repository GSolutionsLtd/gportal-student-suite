import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolContext } from "@/hooks/useSchoolContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";

type Row = {
  id: string;
  user_id: string;
  staff_id: string;
  approval_status: string;
  created_at: string;
  qualification: string | null;
  name?: string;
  email?: string;
};

export function TeacherApprovalsTab() {
  const { user } = useAuth();
  const { schoolId } = useSchoolContext() as any;
  const [filter, setFilter] = useState("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    if (!schoolId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("teachers")
      .select("id, user_id, staff_id, approval_status, created_at, qualification")
      .eq("school_id", schoolId)
      .eq("approval_status", filter)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const list = (data || []) as Row[];
    const ids = list.map((r) => r.user_id);
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      const map = new Map((profs || []).map((p: any) => [p.id, p]));
      list.forEach((r) => {
        const p: any = map.get(r.user_id);
        r.name = p?.full_name;
        r.email = p?.email;
      });
    }
    setRows(list);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, filter]);

  const decide = async (id: string, status: "approved" | "rejected") => {
    setBusy(id);
    const { error } = await (supabase as any)
      .from("teachers")
      .update({
        approval_status: status,
        is_active: status === "approved",
        approved_at: new Date().toISOString(),
        approved_by: user?.id,
      })
      .eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Teacher approved" : "Teacher rejected");
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Teacher approvals</CardTitle>
        <CardDescription>Teachers who sign up for your school must be approved before they can use the portal.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No {filter} teachers.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.name || "Unnamed teacher"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {r.email} · Staff ID {r.staff_id} · Signed up {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={r.approval_status === "approved" ? "default" : r.approval_status === "rejected" ? "destructive" : "secondary"}>
                    {r.approval_status}
                  </Badge>
                  {r.approval_status !== "approved" && (
                    <Button size="sm" disabled={busy === r.id} onClick={() => decide(r.id, "approved")}>
                      <Check className="mr-1 h-4 w-4" />Approve
                    </Button>
                  )}
                  {r.approval_status !== "rejected" && (
                    <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => decide(r.id, "rejected")}>
                      <X className="mr-1 h-4 w-4" />Reject
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
