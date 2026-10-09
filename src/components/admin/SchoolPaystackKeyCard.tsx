import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSchoolFeatures } from "@/hooks/useSchoolFeatures";

export default function SchoolPaystackKeyCard() {
  const { schoolId } = useSchoolFeatures();
  const [status, setStatus] = useState<{ key_last4: string; is_live: boolean } | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!schoolId) return;
    const { data } = await (supabase as any).rpc("get_school_paystack_status", { _school_id: schoolId });
    setStatus(data?.[0] ?? null);
  };
  useEffect(() => { load(); }, [schoolId]);

  const save = async () => {
    if (!schoolId) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc("set_school_paystack_key", { _school_id: schoolId, _key: key.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    setKey(""); toast.success("Paystack key saved"); load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />School Paystack Account</CardTitle>
        <CardDescription>
          Fee and admission payments from parents go straight into your school's own Paystack account. Paste your Paystack secret key below. It is stored securely and never shown again.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm">
          {status ? (
            <span>Connected: key ending <strong>…{status.key_last4}</strong> <Badge variant={status.is_live ? "default" : "outline"}>{status.is_live ? "Live" : "Test"}</Badge></span>
          ) : <Badge variant="destructive">Not connected — online fee payment is off</Badge>}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input type="password" autoComplete="off" placeholder="sk_live_..." value={key} onChange={(e) => setKey(e.target.value)} />
          <Button onClick={save} disabled={busy || !key.trim()}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{status ? "Replace key" : "Save key"}</Button>
        </div>
        <p className="text-xs text-muted-foreground">In your Paystack dashboard, also set the Webhook URL to: https://zjmxrcjlfdyasftmwdqd.supabase.co/functions/v1/paystack-webhook</p>
      </CardContent>
    </Card>
  );
}
