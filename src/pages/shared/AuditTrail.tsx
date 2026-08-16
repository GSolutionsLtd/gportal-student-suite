import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolContext } from "@/hooks/useSchoolContext";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Loader2, RotateCcw, Clock, Download } from "lucide-react";
import { format } from "date-fns";

interface LogRow {
  id: string;
  action: string;
  table_name: string;
  record_id: string | null;
  user_id: string | null;
  created_at: string;
  new_data: any;
}

const ACTIONS = [
  "create", "update", "delete", "approve", "reject",
  "publish", "unpublish", "upload", "download",
];

const ACTION_VARIANT: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-800",
  update: "bg-blue-100 text-blue-800",
  delete: "bg-red-100 text-red-800",
  approve: "bg-emerald-100 text-emerald-800",
  reject: "bg-red-100 text-red-800",
  publish: "bg-violet-100 text-violet-800",
  unpublish: "bg-amber-100 text-amber-800",
  upload: "bg-sky-100 text-sky-800",
  download: "bg-slate-100 text-slate-800",
};

/** Which tables belong to which module tab. */
const MODULE_TABLES: Record<string, string[]> = {
  assignments: [
    "assignments",
    "assignment_submissions",
    "assignment_rubric_scores",
    "assignment_rubric_criteria",
    "assignment_submission_revisions",
    "assignment_files",
  ],
  curriculum: ["lesson_plans"],
};

export default function AuditTrail() {
  const { toast } = useToast();
  const { user, userRole } = useAuth();
  const { schoolId, loading: schoolLoading } = useSchoolContext();

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});

  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");

  const isAdmin = userRole === "admin" || userRole === "super_admin";

  useEffect(() => {
    if (!user || schoolLoading) return;
    if (isAdmin && !schoolId && userRole !== "super_admin") return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("audit_logs")
          .select("id, action, table_name, record_id, user_id, created_at, new_data")
          .order("created_at", { ascending: false })
          .limit(300);

        // RBAC scoping: admins see their school, teachers only their own events.
        if (isAdmin) {
          if (schoolId) query = query.eq("school_id", schoolId);
        } else {
          query = query.eq("user_id", user.id);
        }

        const tables = Object.values(MODULE_TABLES).flat();
        query = query.in("table_name", tables);

        if (actionFilter !== "all") query = query.eq("action", actionFilter as any);
        if (fromDate) query = query.gte("created_at", new Date(`${fromDate}T00:00:00`).toISOString());
        if (toDate) query = query.lte("created_at", new Date(`${toDate}T23:59:59`).toISOString());

        const { data, error } = await query;
        if (error) throw error;
        if (cancelled) return;

        const rows = (data ?? []) as LogRow[];
        setLogs(rows);

        const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
        if (ids.length) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", ids);
          if (!cancelled) {
            setActorNames(Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name])));
          }
        }
      } catch (err: any) {
        if (!cancelled) toast({ title: "Could not load audit trail", description: err.message, variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, userRole, schoolId, schoolLoading, isAdmin, actionFilter, fromDate, toDate, toast]);

  const visible = useMemo(() => {
    const allowed = moduleFilter === "all" ? null : MODULE_TABLES[moduleFilter];
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (allowed && !allowed.includes(l.table_name)) return false;
      if (!q) return true;
      const blob = `${l.table_name} ${l.action} ${l.record_id ?? ""} ${JSON.stringify(l.new_data ?? {})} ${actorNames[l.user_id ?? ""] ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [logs, moduleFilter, search, actorNames]);

  const reset = () => {
    setModuleFilter("all");
    setActionFilter("all");
    setFromDate("");
    setToDate("");
    setSearch("");
  };

  const describe = (l: LogRow) => {
    const d = l.new_data ?? {};
    return d.event || d.title || d.summary || l.table_name.replace(/_/g, " ");
  };

  const exportCsv = () => {
    if (!visible.length) {
      toast({ title: "Nothing to export", description: "No audit events match the current filters." });
      return;
    }
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["When", "Action", "Event", "Area", "Record ID", "By"];
    const lines = [
      header.map(cell).join(","),
      ...visible.map((l) =>
        [
          format(new Date(l.created_at), "yyyy-MM-dd HH:mm:ss"),
          l.action,
          describe(l),
          l.table_name,
          l.record_id ?? "",
          actorNames[l.user_id ?? ""] ?? "",
        ].map(cell).join(","),
      ),
    ];
    const blob = new Blob(["\ufeff", lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const range = [fromDate || "start", toDate || "today"].join("_to_");
    a.href = url;
    a.download = `audit-trail_${moduleFilter}_${actionFilter}_${range}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast({ title: "CSV downloaded", description: `${visible.length} event${visible.length === 1 ? "" : "s"} exported.` });
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> Audit Trail
        </h1>
        <p className="text-muted-foreground">
          {isAdmin
            ? "Every curriculum and assignment event recorded for your school."
            : "Curriculum and assignment events recorded against your account."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Narrow the trail by module, action or date range.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-xs">Module</Label>
            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modules</SelectItem>
                <SelectItem value="assignments">Assignments</SelectItem>
                <SelectItem value="curriculum">Curriculum / Lesson notes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Action</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>{a[0].toUpperCase() + a.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="audit-from">From</Label>
            <Input id="audit-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="audit-to">To</Label>
            <Input id="audit-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="audit-search">Search</Label>
            <Input
              id="audit-search"
              placeholder="Event, record, person…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="md:col-span-5 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-2" /> Reset filters
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading || visible.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Download CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Events</CardTitle>
          <CardDescription>Showing {visible.length} of {logs.length} recent events.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Area</TableHead>
                    {isAdmin && <TableHead>By</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 5 : 4} className="text-center text-muted-foreground py-8">
                        No matching audit events.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visible.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(l.created_at), "PP p")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={ACTION_VARIANT[l.action] ?? "bg-slate-100 text-slate-800"}>
                            {l.action.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{describe(l)}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{l.table_name}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-sm">{actorNames[l.user_id ?? ""] ?? "—"}</TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
