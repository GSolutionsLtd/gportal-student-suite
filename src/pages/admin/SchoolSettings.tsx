import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save, Loader2, Building2, Upload } from "lucide-react";

interface SchoolSettings {
  id: string;
  school_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  motto: string | null;
  logo_url: string | null;
  principal_name?: string | null;
  principal_signature_url?: string | null;
}

export default function SchoolSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SchoolSettings | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("school_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setSettings(data);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("school_settings")
        .update({
          school_name: settings.school_name,
          address: settings.address,
          phone: settings.phone,
          email: settings.email,
          motto: settings.motto,
          logo_url: settings.logo_url,
          principal_name: settings.principal_name ?? null,
          principal_signature_url: settings.principal_signature_url ?? null,
        })
        .eq("id", settings.id);

      if (error) throw error;

      toast({ title: "Success", description: "School settings saved successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
        <h1 className="text-3xl font-bold">School Settings</h1>
        <p className="text-muted-foreground">
          Configure school information for PDF reports and branding
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            School Information
          </CardTitle>
          <CardDescription>
            This information will appear on student result reports and official documents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="school_name">School Name *</Label>
              <Input
                id="school_name"
                value={settings?.school_name || ""}
                onChange={(e) => setSettings(prev => prev ? { ...prev, school_name: e.target.value } : null)}
                placeholder="Enter school name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="motto">School Motto</Label>
              <Input
                id="motto"
                value={settings?.motto || ""}
                onChange={(e) => setSettings(prev => prev ? { ...prev, motto: e.target.value } : null)}
                placeholder="e.g., Excellence in Education"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={settings?.phone || ""}
                onChange={(e) => setSettings(prev => prev ? { ...prev, phone: e.target.value } : null)}
                placeholder="e.g., +234 123 456 7890"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={settings?.email || ""}
                onChange={(e) => setSettings(prev => prev ? { ...prev, email: e.target.value } : null)}
                placeholder="e.g., info@school.edu"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">School Address</Label>
              <Textarea
                id="address"
                value={settings?.address || ""}
                onChange={(e) => setSettings(prev => prev ? { ...prev, address: e.target.value } : null)}
                placeholder="Enter full school address"
                rows={3}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="logo_url">Logo URL</Label>
              <Input
                id="logo_url"
                value={settings?.logo_url || ""}
                onChange={(e) => setSettings(prev => prev ? { ...prev, logo_url: e.target.value } : null)}
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-muted-foreground">
                Enter a URL to your school logo. Recommended size: 200x200 pixels
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="principal_name">Principal Name</Label>
              <Input
                id="principal_name"
                value={(settings as any)?.principal_name || ""}
                onChange={(e) => setSettings(prev => prev ? { ...(prev as any), principal_name: e.target.value } : null)}
                placeholder="e.g., Mrs. A. Okafor"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Principal Signature</Label>
              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => document.getElementById("principal-signature-input")?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Upload signature
                </Button>
                <input
                  id="principal-signature-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const dataUrl = String(reader.result);
                      setSettings(prev => prev ? { ...(prev as any), principal_signature_url: dataUrl } : null);
                    };
                    reader.readAsDataURL(file);
                  }}
                />
                <p className="text-xs text-muted-foreground">PNG/JPG recommended. Keep it small.</p>
              </div>
              <div className="border rounded-lg p-3 mt-2">
                {(settings as any)?.principal_signature_url ? (
                  <img
                    src={(settings as any).principal_signature_url}
                    alt="Principal signature"
                    className="h-16 object-contain"
                    loading="lazy"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No signature uploaded yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
