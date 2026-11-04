import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save, Loader2, Building2, Upload, ImageIcon, X } from "lucide-react";

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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
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

  // Images are resized in the browser and stored with the school's settings,
  // so they display everywhere (public website, PDFs, result sheets) without file storage access.
  const uploadFile = async (file: File, _folder: string): Promise<string | null> => {
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          const max = 512;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Could not process image"));
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(objectUrl);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Could not read image")); };
        img.src = objectUrl;
      });
      return dataUrl;
    } catch (error: any) {
      toast({ title: "Upload Error", description: error.message, variant: "destructive" });
      return null;
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid File", description: "Please upload an image file", variant: "destructive" });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Logo must be less than 2MB", variant: "destructive" });
      return;
    }

    setUploadingLogo(true);
    const url = await uploadFile(file, 'logos');
    if (url) {
      setSettings(prev => prev ? { ...prev, logo_url: url } : null);
      toast({ title: "Success", description: "Logo uploaded successfully" });
    }
    setUploadingLogo(false);
    e.target.value = ''; // Reset input
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid File", description: "Please upload an image file", variant: "destructive" });
      return;
    }

    // Validate file size (max 1MB)
    if (file.size > 1 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Signature must be less than 1MB", variant: "destructive" });
      return;
    }

    setUploadingSignature(true);
    const url = await uploadFile(file, 'signatures');
    if (url) {
      setSettings(prev => prev ? { ...prev, principal_signature_url: url } : null);
      toast({ title: "Success", description: "Signature uploaded successfully" });
    }
    setUploadingSignature(false);
    e.target.value = ''; // Reset input
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

            {/* School Logo Upload */}
            <div className="space-y-2 md:col-span-2">
              <Label>School Logo</Label>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center min-h-[120px] w-full sm:w-[200px] bg-muted/30">
                  {settings?.logo_url ? (
                    <div className="relative">
                      <img
                        src={settings.logo_url}
                        alt="School logo"
                        className="max-h-24 max-w-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={() => setSettings(prev => prev ? { ...prev, logo_url: null } : null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No logo uploaded</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={uploadingLogo}
                    onClick={() => document.getElementById("logo-input")?.click()}
                  >
                    {uploadingLogo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {uploadingLogo ? "Uploading..." : "Upload Logo"}
                  </Button>
                  <input
                    id="logo-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <p className="text-xs text-muted-foreground">
                    PNG or JPG, max 2MB<br/>
                    Recommended: 200x200px
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="principal_name">Principal Name</Label>
              <Input
                id="principal_name"
                value={settings?.principal_name || ""}
                onChange={(e) => setSettings(prev => prev ? { ...prev, principal_name: e.target.value } : null)}
                placeholder="e.g., Mrs. A. Okafor"
              />
            </div>

            {/* Principal Signature Upload */}
            <div className="space-y-2 md:col-span-2">
              <Label>Principal Signature</Label>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center min-h-[80px] w-full sm:w-[200px] bg-muted/30">
                  {settings?.principal_signature_url ? (
                    <div className="relative">
                      <img
                        src={settings.principal_signature_url}
                        alt="Principal signature"
                        className="max-h-16 max-w-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={() => setSettings(prev => prev ? { ...prev, principal_signature_url: null } : null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <ImageIcon className="h-8 w-8 mx-auto mb-1 opacity-50" />
                      <p className="text-xs">No signature uploaded</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={uploadingSignature}
                    onClick={() => document.getElementById("signature-input")?.click()}
                  >
                    {uploadingSignature ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {uploadingSignature ? "Uploading..." : "Upload Signature"}
                  </Button>
                  <input
                    id="signature-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleSignatureUpload}
                  />
                  <p className="text-xs text-muted-foreground">
                    PNG with transparent background recommended<br/>
                    Max 1MB, keep it small
                  </p>
                </div>
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
