import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolContext } from "@/hooks/useSchoolContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CalendarCheck, Save } from "lucide-react";
import { format } from "date-fns";

type Status = "present" | "absent" | "late" | "excused";

interface Student { id: string; first_name: string; last_name: string; admission_number: string; current_class_arm_id: string | null; user_id: string | null; }
interface AttendanceRow { id?: string; student_id: string; status: Status; remark?: string | null; }

const STATUSES: { value: Status; label: string; className: string }[] = [
  { value: "present", label: "Present", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  { value: "absent", label: "Absent", className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30" },
  { value: "late", label: "Late", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  { value: "excused", label: "Excused", className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30" },
];

export default function AttendancePage() {
  const { user, userRole } = useAuth();
  const { schoolId } = useSchoolContext();
  const { toast } = useToast();
  const canManage = userRole === "admin" || userRole === "teacher" || userRole === "super_admin";
  const isStudent = userRole === "student";

  const [loading, setLoading] = useState(true);
  const [classArms, setClassArms] = useState<{ id: string; name: string }[]>([]);
  const [selectedArm, setSelectedArm] = useState<string>("");
  const [attendanceDate, setAttendanceDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [students, setStudents] = useState<Student[]>([]);
  const [rows, setRows] = useState<Record<string, AttendanceRow>>({});
  const [saving, setSaving] = useState(false);

  // Student view state
  const [selfHistory, setSelfHistory] = useState<any[]>([]);
  const [selfSummary, setSelfSummary] = useState<{ total: number; present: number; absent: number; late: number; excused: number } | null>(null);

  // Summary state (teacher/admin)
  const [summary, setSummary] = useState<{ student: Student; counts: Record<Status, number>; total: number }[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    if (isStudent) loadStudentSelf();
    else loadArms();
  }, [schoolId, user, userRole]);

  const loadArms = async () => {
    setLoading(true);
    const { data } = await supabase.from("class_arms").select("id, name").eq("school_id", schoolId!).order("name");
    setClassArms((data as any[]) ?? []);
    if (data && data.length && !selectedArm) setSelectedArm((data[0] as any).id);
    setLoading(false);
  };

  useEffect(() => {
    if (!selectedArm || !attendanceDate) return;
    loadStudentsAndAttendance();
  }, [selectedArm, attendanceDate]);

  const loadStudentsAndAttendance = async () => {
    setLoading(true);
    const [{ data: st }, { data: att }] = await Promise.all([
      supabase.from("students").select("id, first_name, last_name, admission_number, current_class_arm_id, user_id")
        .eq("school_id", schoolId!).eq("current_class_arm_id", selectedArm).eq("is_active", true)
        .order("last_name"),
      supabase.from("attendance_records").select("id, student_id, status, remark")
        .eq("school_id", schoolId!).eq("class_arm_id", selectedArm).eq("attendance_date", attendanceDate),
    ]);
    setStudents((st as Student[]) ?? []);
    const map: Record<string, AttendanceRow> = {};
    (st as Student[] | null)?.forEach((s) => {
      const existing = (att as any[] | null)?.find((a) => a.student_id === s.id);
      map[s.id] = existing
        ? { id: existing.id, student_id: s.id, status: existing.status, remark: existing.remark }
        : { student_id: s.id, status: "present", remark: "" };
    });
    setRows(map);
    setLoading(false);
  };

  const setAll = (status: Status) => {
    setRows((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => (next[k] = { ...next[k], status }));
      return next;
    });
  };

  const saveAttendance = async () => {
    if (!schoolId || !user || !selectedArm) return;
    setSaving(true);
    const payload = Object.values(rows).map((r) => ({
      ...(r.id ? { id: r.id } : {}),
      school_id: schoolId,
      class_arm_id: selectedArm,
      student_id: r.student_id,
      attendance_date: attendanceDate,
      status: r.status,
      remark: r.remark || null,
      recorded_by: user.id,
    }));
    const { error } = await supabase.from("attendance_records").upsert(payload, { onConflict: "student_id,attendance_date" });
    setSaving(false);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: "Attendance saved", description: `${payload.length} record(s) updated for ${format(new Date(attendanceDate), "PP")}.` });
    loadStudentsAndAttendance();
  };

  const loadSummary = async () => {
    if (!selectedArm) return;
    setSummaryLoading(true);
    const startOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");
    const { data: st } = await supabase.from("students").select("id, first_name, last_name, admission_number, current_class_arm_id, user_id")
      .eq("school_id", schoolId!).eq("current_class_arm_id", selectedArm).eq("is_active", true).order("last_name");
    const { data: att } = await supabase.from("attendance_records")
      .select("student_id, status, attendance_date")
      .eq("school_id", schoolId!).eq("class_arm_id", selectedArm).gte("attendance_date", startOfMonth);
    const rows = (st as Student[] | null)?.map((s) => {
      const mine = (att as any[] | null)?.filter((a) => a.student_id === s.id) ?? [];
      const counts: Record<Status, number> = { present: 0, absent: 0, late: 0, excused: 0 };
      mine.forEach((a) => { counts[a.status as Status] = (counts[a.status as Status] || 0) + 1; });
      return { student: s, counts, total: mine.length };
    }) ?? [];
    setSummary(rows);
    setSummaryLoading(false);
  };

  const loadStudentSelf = async () => {
    setLoading(true);
    const { data: s } = await supabase.from("students").select("id").eq("user_id", user!.id).maybeSingle();
    if (!s) { setLoading(false); return; }
    const { data: att } = await supabase.from("attendance_records")
      .select("attendance_date, status, remark")
      .eq("student_id", (s as any).id)
      .order("attendance_date", { ascending: false })
      .limit(60);
    const list = (att as any[]) ?? [];
    setSelfHistory(list);
    const counts = { total: list.length, present: 0, absent: 0, late: 0, excused: 0 };
    list.forEach((r) => { (counts as any)[r.status] = ((counts as any)[r.status] || 0) + 1; });
    setSelfSummary(counts);
    setLoading(false);
  };

  const stats = useMemo(() => {
    const c: Record<Status, number> = { present: 0, absent: 0, late: 0, excused: 0 };
    Object.values(rows).forEach((r) => { c[r.status]++; });
    return c;
  }, [rows]);

  if (loading && !isStudent) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  // Student self view
  if (isStudent) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarCheck className="h-6 w-6 text-primary" /> My Attendance</h1>
          <p className="text-muted-foreground">Your daily attendance record.</p>
        </div>
        {selfSummary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total days</p><p className="text-2xl font-bold">{selfSummary.total}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Present</p><p className="text-2xl font-bold text-emerald-600">{selfSummary.present}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Absent</p><p className="text-2xl font-bold text-red-600">{selfSummary.absent}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Late</p><p className="text-2xl font-bold text-amber-600">{selfSummary.late}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Excused</p><p className="text-2xl font-bold text-blue-600">{selfSummary.excused}</p></CardContent></Card>
          </div>
        )}
        <Card>
          <CardHeader><CardTitle>Recent (last 60 days)</CardTitle></CardHeader>
          <CardContent>
            {selfHistory.length === 0 ? <p className="text-sm text-muted-foreground">No records yet.</p> : (
              <div className="divide-y">
                {selfHistory.map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <span className="text-sm">{format(new Date(r.attendance_date), "EEE, PP")}</span>
                    <Badge variant="outline" className={STATUSES.find((s) => s.value === r.status)?.className}>{r.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canManage) return <p>Not authorized.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarCheck className="h-6 w-6 text-primary" /> Attendance Management</h1>
        <p className="text-muted-foreground">Mark daily attendance by class arm and view summaries.</p>
      </div>

      <Tabs defaultValue="mark" className="space-y-4">
        <TabsList>
          <TabsTrigger value="mark">Mark Attendance</TabsTrigger>
          <TabsTrigger value="summary" onClick={loadSummary}>Monthly Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="mark">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <Label>Class arm</Label>
                  <Select value={selectedArm} onValueChange={setSelectedArm}>
                    <SelectTrigger><SelectValue placeholder="Select class arm" /></SelectTrigger>
                    <SelectContent>
                      {classArms.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[160px]">
                  <Label>Date</Label>
                  <Input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAll("present")}>Mark all present</Button>
                  <Button variant="outline" size="sm" onClick={() => setAll("absent")}>Mark all absent</Button>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap mt-3 text-sm">
                <Badge variant="outline" className={STATUSES[0].className}>Present: {stats.present}</Badge>
                <Badge variant="outline" className={STATUSES[1].className}>Absent: {stats.absent}</Badge>
                <Badge variant="outline" className={STATUSES[2].className}>Late: {stats.late}</Badge>
                <Badge variant="outline" className={STATUSES[3].className}>Excused: {stats.excused}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No students in this class arm.</p>
              ) : (
                <div className="space-y-2">
                  {students.map((s) => (
                    <div key={s.id} className="flex flex-wrap gap-3 items-center border rounded-lg p-3">
                      <div className="flex-1 min-w-[180px]">
                        <p className="font-medium">{s.last_name} {s.first_name}</p>
                        <p className="text-xs text-muted-foreground">{s.admission_number}</p>
                      </div>
                      <Select
                        value={rows[s.id]?.status ?? "present"}
                        onValueChange={(v) => setRows({ ...rows, [s.id]: { ...rows[s.id], status: v as Status } })}
                      >
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input
                        className="w-56"
                        placeholder="Remark (optional)"
                        value={rows[s.id]?.remark ?? ""}
                        onChange={(e) => setRows({ ...rows, [s.id]: { ...rows[s.id], remark: e.target.value } })}
                      />
                    </div>
                  ))}
                </div>
              )}
              {students.length > 0 && (
                <div className="mt-4 flex justify-end">
                  <Button onClick={saveAttendance} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}<Save className="h-4 w-4 mr-2" />Save Attendance
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle>This month's summary</CardTitle>
              <CardDescription>Per-student totals for the selected class arm (from the 1st of this month).</CardDescription>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : summary.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data. Choose a class arm and click the tab.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 pr-4">Student</th>
                        <th className="py-2 px-2">Total</th>
                        <th className="py-2 px-2 text-emerald-600">Present</th>
                        <th className="py-2 px-2 text-red-600">Absent</th>
                        <th className="py-2 px-2 text-amber-600">Late</th>
                        <th className="py-2 px-2 text-blue-600">Excused</th>
                        <th className="py-2 px-2">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.map(({ student, counts, total }) => {
                        const rate = total > 0 ? Math.round(((counts.present + counts.late) / total) * 100) : 0;
                        return (
                          <tr key={student.id} className="border-b">
                            <td className="py-2 pr-4">{student.last_name} {student.first_name} <span className="text-xs text-muted-foreground">({student.admission_number})</span></td>
                            <td className="py-2 px-2">{total}</td>
                            <td className="py-2 px-2">{counts.present}</td>
                            <td className="py-2 px-2">{counts.absent}</td>
                            <td className="py-2 px-2">{counts.late}</td>
                            <td className="py-2 px-2">{counts.excused}</td>
                            <td className="py-2 px-2 font-medium">{rate}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
