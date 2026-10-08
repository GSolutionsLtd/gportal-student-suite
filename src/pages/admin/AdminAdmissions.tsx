import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolContext } from "@/hooks/useSchoolContext";
import { fetchClassArmOptions, ClassArmOption } from "@/lib/classArms";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

const db = supabase as any;
const STATUSES = ["submitted", "under_review", "exam_scheduled", "accepted", "rejected", "enrolled"];

export default function AdminAdmissions() {
  const { user } = useAuth();
  const { schoolId, schoolCode } = useSchoolContext();
  const [settings, setSettings] = useState({ is_open: false, application_fee: 0, session_label: "", instructions: "" });
  const [apps, setApps] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [sel, setSel] = useState<any>(null);
  const [arms, setArms] = useState<ClassArmOption[]>([]);
  const [armId, setArmId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!schoolId) return;
    const { data: s } = await db.from("admission_settings").select("*").eq("school_id", schoolId).maybeSingle();
    if (s) setSettings({ is_open: s.is_open, application_fee: Number(s.application_fee), session_label: s.session_label || "", instructions: s.instructions || "" });
    const { data } = await db.from("admission_applications").select("*").eq("school_id", schoolId).order("created_at", { ascending: false });
    setApps(data || []);
  };
  useEffect(() => { load(); if (schoolId) fetchClassArmOptions(schoolId).then(setArms); }, [schoolId]);

  const saveSettings = async () => {
    const { error } = await db.from("admission_settings").upsert({
      school_id: schoolId, is_open: settings.is_open, application_fee: Math.max(0, Number(settings.application_fee) || 0),
      session_label: settings.session_label.trim() || null, instructions: settings.instructions.trim() || null, updated_at: new Date().toISOString(),
    }, { onConflict: "school_id" });
    if (error) return toast.error(error.message);
    toast.success("Admission settings saved");
  };

  const update = async (patch: any) => {
    setBusy(true);
    const { error } = await db.from("admission_applications").update({ ...patch, reviewed_by: user?.id, reviewed_at: new Date().toISOString() }).eq("id", sel.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Application updated"); setSel({ ...sel, ...patch }); load();
  };

  const enrol = async () => {
    if (!armId) return toast.error("Choose a class arm");
    setBusy(true);
    const { data: st, error } = await db.from("students").insert({
      school_id: schoolId, first_name: sel.first_name, last_name: sel.last_name, middle_name: sel.middle_name,
      date_of_birth: sel.date_of_birth, gender: sel.gender, current_class_arm_id: armId,
      guardian_name: sel.guardian_name, guardian_phone: sel.guardian_phone, guardian_email: sel.guardian_email,
      address: sel.address, admission_date: new Date().toISOString().slice(0, 10), is_active: true,
    }).select("id, admission_number").single();
    if (error) { setBusy(false); return toast.error(error.message); }
    await update({ status: "enrolled", student_id: st.id });
    toast.success(`Enrolled with admission number ${st.admission_number}`);
  };

  const link = `${window.location.origin}/admissions/${schoolCode}`;
  const shown = filter === "all" ? apps : apps.filter((a) => a.status === filter);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Admissions</h1><p className="text-muted-foreground">Online applications, entrance exams and enrolment.</p></div>

      <Card>
        <CardHeader><CardTitle>Admission settings</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">Application link: <code className="text-xs">{link}</code>
            <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copied"); }}><Copy className="h-4 w-4" /></Button></CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3"><Switch checked={settings.is_open} onCheckedChange={(v) => setSettings({ ...settings, is_open: v })} /><Label>Accepting applications</Label></div>
          <div><Label>Application fee (₦, 0 = free)</Label><Input type="number" min={0} value={settings.application_fee} onChange={(e) => setSettings({ ...settings, application_fee: Number(e.target.value) })} /></div>
          <div><Label>Session</Label><Input placeholder="2026/2027" value={settings.session_label} onChange={(e) => setSettings({ ...settings, session_label: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Instructions for applicants</Label><Textarea value={settings.instructions} onChange={(e) => setSettings({ ...settings, instructions: e.target.value })} /></div>
          <Button onClick={saveSettings} className="sm:w-fit">Save settings</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle>Applications ({apps.length})</CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-2">
          {shown.length === 0 && <p className="text-sm text-muted-foreground">No applications.</p>}
          {shown.map((a) => (
            <button key={a.id} onClick={() => { setSel(a); setArmId(""); }} className="w-full text-left rounded-lg border p-3 hover:bg-accent/40 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-0"><p className="font-medium">{a.first_name} {a.last_name} <span className="text-xs text-muted-foreground">{a.application_number}</span></p>
                <p className="text-sm text-muted-foreground">{a.class_applying} • {a.guardian_name} • {new Date(a.created_at).toLocaleDateString()}</p></div>
              <Badge variant="outline">{a.payment_status}</Badge><Badge>{a.status.replace("_", " ")}</Badge>
            </button>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {sel && <>
            <DialogHeader><DialogTitle>{sel.first_name} {sel.last_name}</DialogTitle></DialogHeader>
            <div className="text-sm space-y-1">
              <p>Application: {sel.application_number} • Class: {sel.class_applying}</p>
              <p>Guardian: {sel.guardian_name}, {sel.guardian_phone}, {sel.guardian_email}</p>
              {sel.previous_school && <p>Previous school: {sel.previous_school}</p>}
              <p>Fee: {sel.payment_status}{sel.amount_paid ? ` (₦${Number(sel.amount_paid).toLocaleString()})` : ""}</p>
            </div>
            <div className="space-y-3 border-t pt-3">
              <p className="font-medium">Entrance exam</p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="datetime-local" defaultValue={sel.exam_at ? sel.exam_at.slice(0, 16) : ""} id="exam_at" />
                <Input placeholder="Venue" defaultValue={sel.exam_venue || ""} id="exam_venue" />
              </div>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => {
                const at = (document.getElementById("exam_at") as HTMLInputElement).value;
                const venue = (document.getElementById("exam_venue") as HTMLInputElement).value;
                if (!at) return toast.error("Pick a date and time");
                update({ exam_at: new Date(at).toISOString(), exam_venue: venue.slice(0, 200) || null, status: "exam_scheduled" });
              }}>Schedule exam</Button>
              <div className="flex gap-2"><Input type="number" min={0} max={100} placeholder="Exam score" defaultValue={sel.exam_score ?? ""} id="exam_score" />
                <Button size="sm" variant="outline" disabled={busy} onClick={() => update({ exam_score: Number((document.getElementById("exam_score") as HTMLInputElement).value) })}>Save score</Button></div>
            </div>
            <div className="space-y-2 border-t pt-3">
              <Label>Note to applicant</Label>
              <Textarea defaultValue={sel.review_note || ""} id="review_note" />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => update({ status: "under_review" })}>Mark under review</Button>
                <Button size="sm" disabled={busy || sel.status === "enrolled"} onClick={() => update({ status: "accepted", review_note: (document.getElementById("review_note") as HTMLTextAreaElement).value || null })}>Accept</Button>
                <Button size="sm" variant="destructive" disabled={busy || sel.status === "enrolled"} onClick={() => update({ status: "rejected", review_note: (document.getElementById("review_note") as HTMLTextAreaElement).value || null })}>Reject</Button>
                {sel.payment_status === "unpaid" && <Button size="sm" variant="ghost" onClick={() => update({ payment_status: "waived" })}>Waive fee</Button>}
              </div>
            </div>
            {sel.status === "accepted" && (
              <DialogFooter className="border-t pt-3 flex-col sm:flex-row gap-2">
                <Select value={armId} onValueChange={setArmId}><SelectTrigger><SelectValue placeholder="Class arm" /></SelectTrigger>
                  <SelectContent>{arms.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent></Select>
                <Button onClick={enrol} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enrol as student</Button>
              </DialogFooter>
            )}
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
