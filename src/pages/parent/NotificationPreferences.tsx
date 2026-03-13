import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, Phone, MessageSquare, Bell, TrendingDown, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Preferences {
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  performance_alerts: boolean;
  result_published: boolean;
}

export default function NotificationPreferences() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Preferences>({
    email_enabled: true,
    sms_enabled: true,
    whatsapp_enabled: false,
    performance_alerts: true,
    result_published: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasRecord, setHasRecord] = useState(false);

  useEffect(() => {
    if (user) fetchPrefs();
  }, [user]);

  const fetchPrefs = async () => {
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (data) {
      setPrefs({
        email_enabled: data.email_enabled,
        sms_enabled: data.sms_enabled,
        whatsapp_enabled: data.whatsapp_enabled,
        performance_alerts: data.performance_alerts,
        result_published: data.result_published,
      });
      setHasRecord(true);
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (hasRecord) {
        const { error } = await supabase
          .from("notification_preferences")
          .update({ ...prefs, updated_at: new Date().toISOString() })
          .eq("user_id", user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notification_preferences")
          .insert({ user_id: user!.id, ...prefs });
        if (error) throw error;
        setHasRecord(true);
      }
      toast({ title: "Preferences saved", description: "Your notification preferences have been updated." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: keyof Preferences) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const channels = [
    { key: "email_enabled" as const, label: "Email Notifications", desc: "Receive updates via email", icon: Mail },
    { key: "sms_enabled" as const, label: "SMS Notifications", desc: "Receive updates via SMS", icon: Phone },
    { key: "whatsapp_enabled" as const, label: "WhatsApp Notifications", desc: "Receive updates via WhatsApp", icon: MessageSquare },
  ];

  const alerts = [
    { key: "result_published" as const, label: "Result Published", desc: "Get notified when your child's results are published", icon: CheckCircle },
    { key: "performance_alerts" as const, label: "Performance Alerts", desc: "Get notified when your child's performance drops below threshold", icon: TrendingDown },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Notification Preferences</h1>
        <p className="text-muted-foreground">Choose how you want to receive notifications</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Delivery Channels
          </CardTitle>
          <CardDescription>Select which channels you'd like to receive notifications on</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {channels.map((ch) => (
            <div key={ch.key} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ch.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <Label className="text-sm font-medium">{ch.label}</Label>
                  <p className="text-xs text-muted-foreground">{ch.desc}</p>
                </div>
              </div>
              <Switch checked={prefs[ch.key]} onCheckedChange={() => toggle(ch.key)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alert Types</CardTitle>
          <CardDescription>Choose which types of alerts you want to receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {alerts.map((al) => (
            <div key={al.key} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center">
                  <al.icon className="h-4 w-4 text-accent-foreground" />
                </div>
                <div>
                  <Label className="text-sm font-medium">{al.label}</Label>
                  <p className="text-xs text-muted-foreground">{al.desc}</p>
                </div>
              </div>
              <Switch checked={prefs[al.key]} onCheckedChange={() => toggle(al.key)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Save Preferences
      </Button>
    </div>
  );
}
