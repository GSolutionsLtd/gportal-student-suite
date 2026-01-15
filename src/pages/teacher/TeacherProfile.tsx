import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, Upload } from "lucide-react";

type TeacherType = "subject" | "class" | "form";

interface TeacherRecord {
  id: string;
  user_id: string;
  staff_id: string;
  is_class_teacher: boolean;
  is_form_teacher: boolean;
  signature_url: string | null;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export default function TeacherProfile() {
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState<TeacherRecord | null>(null);

  const [staffId, setStaffId] = useState("");
  const [teacherType, setTeacherType] = useState<TeacherType>("subject");
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);

  const derivedFlags = useMemo(() => {
    return {
      is_class_teacher: teacherType === "class",
      is_form_teacher: teacherType === "form",
    };
  }, [teacherType]);

  useEffect(() => {
    async function fetchTeacher() {
      if (!user) return;

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("teachers")
          .select("id, user_id, staff_id, is_class_teacher, is_form_teacher, signature_url")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setRecord(data as TeacherRecord);
          setStaffId(data.staff_id);
          setTeacherType(data.is_class_teacher ? "class" : data.is_form_teacher ? "form" : "subject");
          setSignatureUrl(data.signature_url);
        } else {
          setRecord(null);
          setStaffId("");
          setTeacherType("subject");
          setSignatureUrl(null);
        }
      } catch (e: any) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }

    fetchTeacher();
  }, [user, toast]);

  const handlePickSignature = async (file: File | null) => {
    if (!file) return;

    // Note: stored as a data URL to avoid requiring external file storage setup.
    // Keep signatures small (e.g. PNG, ~150-250KB).
    try {
      const dataUrl = await fileToDataUrl(file);
      setSignatureUrl(dataUrl);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!user) return;

    if (!staffId.trim()) {
      toast({ title: "Staff ID required", description: "Please enter your staff ID.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Upsert-like behavior (without relying on unique constraint)
      const { data: existing, error: existingError } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingError) throw existingError;

      const payload = {
        user_id: user.id,
        staff_id: staffId.trim().toUpperCase(),
        is_class_teacher: derivedFlags.is_class_teacher,
        is_form_teacher: derivedFlags.is_form_teacher,
        signature_url: signatureUrl,
      };

      const query = existing?.id
        ? supabase.from("teachers").update(payload).eq("id", existing.id)
        : supabase.from("teachers").insert({
            ...payload,
            date_joined: new Date().toISOString().slice(0, 10),
            is_active: true,
          });

      const { error } = await query;
      if (error) throw error;

      toast({ title: "Saved", description: "Your teacher profile has been updated." });

      // refresh
      const { data } = await supabase
        .from("teachers")
        .select("id, user_id, staff_id, is_class_teacher, is_form_teacher, signature_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) setRecord(data as TeacherRecord);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Teacher Profile</h1>
        <p className="text-muted-foreground">Update your designation and upload your signature for result sheets.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Details</CardTitle>
          <CardDescription>These details are used on printed results and approvals.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={profile?.full_name || ""} readOnly />
              <p className="text-xs text-muted-foreground">This comes from your account profile.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff_id">Staff ID *</Label>
              <Input
                id="staff_id"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                placeholder="e.g., TCH001"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Designation</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  className={`border rounded-lg p-3 text-sm text-left transition-colors ${
                    teacherType === "subject" ? "bg-secondary" : "hover:bg-secondary/50"
                  }`}
                  onClick={() => setTeacherType("subject")}
                >
                  <div className="font-medium">Subject Teacher</div>
                  <div className="text-xs text-muted-foreground">Teaches assigned subjects</div>
                </button>
                <button
                  type="button"
                  className={`border rounded-lg p-3 text-sm text-left transition-colors ${
                    teacherType === "class" ? "bg-secondary" : "hover:bg-secondary/50"
                  }`}
                  onClick={() => setTeacherType("class")}
                >
                  <div className="font-medium">Class Teacher</div>
                  <div className="text-xs text-muted-foreground">Adds class teacher remark/signature</div>
                </button>
                <button
                  type="button"
                  className={`border rounded-lg p-3 text-sm text-left transition-colors ${
                    teacherType === "form" ? "bg-secondary" : "hover:bg-secondary/50"
                  }`}
                  onClick={() => setTeacherType("form")}
                >
                  <div className="font-medium">Form Teacher</div>
                  <div className="text-xs text-muted-foreground">Supports class administration</div>
                </button>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Signature (for result sheet)</Label>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <Button type="button" variant="outline" className="gap-2" onClick={() => document.getElementById("teacher-signature-input")?.click()}>
                    <Upload className="h-4 w-4" />
                    Upload signature
                  </Button>
                  <input
                    id="teacher-signature-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePickSignature(e.target.files?.[0] || null)}
                  />
                  <p className="text-xs text-muted-foreground">PNG/JPG recommended. Keep it small for faster loading.</p>
                </div>

                <div className="border rounded-lg p-3 bg-card">
                  {signatureUrl ? (
                    <img
                      src={signatureUrl}
                      alt="Teacher signature"
                      className="h-16 object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="text-sm text-muted-foreground">No signature uploaded yet.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
