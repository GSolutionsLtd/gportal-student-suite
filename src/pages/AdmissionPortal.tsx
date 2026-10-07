import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, GraduationCap, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  middle_name: z.string().trim().max(80).optional(),
  date_of_birth: z.string().optional(),
  gender: z.string().max(20).optional(),
  class_applying: z.string().trim().min(1, "Class is required").max(60),
  previous_school: z.string().trim().max(200).optional(),
  guardian_name: z.string().trim().min(1, "Guardian name is required").max(120),
  guardian_phone: z.string().trim().min(7, "Valid phone required").max(20),
  guardian_email: z.string().trim().email("Valid email required").max(255),
  address: z.string().trim().max(300).optional(),
});

type Portal = { school_id: string; name: string; logo_url: string | null; code: string; is_open: boolean;
  application_fee: number; session_label: string | null; instructions: string | null; enabled: boolean };

const empty = { first_name: "", last_name: "", middle_name: "", date_of_birth: "", gender: "", class_applying: "",
  previous_school: "", guardian_name: "", guardian_phone: "", guardian_email: "", address: "" };

export default function AdmissionPortal() {
  const { schoolCode = "" } = useParams();
  const [params] = useSearchParams();
  const [portal, setPortal] = useState<Portal | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState<{ number: string; email: string } | null>(null);
  const [lookup, setLookup] = useState({ number: "", email: "" });
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    (supabase as any).rpc("get_admission_portal", { _code: schoolCode }).then(({ data }: any) => {
      setPortal(data); setLoading(false);
    });
  }, [schoolCode]);

  useEffect(() => {
    const ref = params.get("reference") || params.get("trxref");
    if (!ref) return;
    supabase.functions.invoke("admission-payment", { body: { action: "verify", reference: ref } }).then(({ data }) => {
      if (data?.paid) toast.success("Application fee paid. Thank you!");
      else toast.error("Payment could not be confirmed yet.");
    });
  }, [params]);

  const pay = async (number: string, email: string) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admission-payment", {
      body: { action: "init", application_number: number, email, callback_url: window.location.origin + window.location.pathname },
    });
    setBusy(false);
    if (error || !data?.authorization_url) return toast.error(data?.error || "Could not start payment");
    window.location.href = data.authorization_url;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("submit_admission_application", { _code: schoolCode, _data: parsed.data });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSubmitted({ number: data.application_number, email: parsed.data.guardian_email.toLowerCase() });
    setForm(empty);
  };

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data } = await (supabase as any).rpc("check_admission_status", { _application_number: lookup.number, _email: lookup.email });
    if (!data) toast.error("No application matches those details");
    setStatus(data);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!portal || !portal.enabled) return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div><h1 className="text-2xl font-bold">Admissions unavailable</h1><p className="text-muted-foreground mt-2">This school isn't accepting online applications.</p><Link to="/" className="text-primary underline mt-4 inline-block">Home</Link></div>
    </div>
  );

  const f = (k: keyof typeof empty, label: string, props: any = {}) => (
    <div className="space-y-1.5"><Label>{label}</Label><Input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} {...props} /></div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto p-4 flex items-center gap-3">
          {portal.logo_url ? <img src={portal.logo_url} alt="" className="h-10 w-10 rounded object-cover" /> : <GraduationCap className="h-8 w-8 text-primary" />}
          <div><h1 className="font-bold text-lg">{portal.name}</h1><p className="text-sm text-muted-foreground">Admissions {portal.session_label ? `• ${portal.session_label}` : ""}</p></div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto p-4 md:p-6">
        <Tabs defaultValue="apply">
          <TabsList className="grid grid-cols-2 w-full"><TabsTrigger value="apply">Apply</TabsTrigger><TabsTrigger value="status">Check status</TabsTrigger></TabsList>
          <TabsContent value="apply">
            {submitted ? (
              <Card><CardContent className="p-6 text-center space-y-3">
                <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
                <h2 className="text-xl font-semibold">Application received</h2>
                <p>Your application number is <strong>{submitted.number}</strong>. Keep it safe to check your status.</p>
                {portal.application_fee > 0 && (
                  <Button onClick={() => pay(submitted.number, submitted.email)} disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Pay application fee ₦{Number(portal.application_fee).toLocaleString()}
                  </Button>
                )}
              </CardContent></Card>
            ) : !portal.is_open ? (
              <Card><CardContent className="p-6 text-center text-muted-foreground">Applications are currently closed.</CardContent></Card>
            ) : (
              <Card>
                <CardHeader><CardTitle>Application form</CardTitle>
                  <CardDescription>{portal.instructions || "Fill in the learner's and guardian's details."}{portal.application_fee > 0 && ` Application fee: ₦${Number(portal.application_fee).toLocaleString()}.`}</CardDescription></CardHeader>
                <CardContent>
                  <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
                    {f("first_name", "First name *")}{f("last_name", "Last name *")}{f("middle_name", "Middle name")}
                    {f("date_of_birth", "Date of birth", { type: "date" })}{f("gender", "Gender")}{f("class_applying", "Class applying for *")}
                    {f("previous_school", "Previous school")}{f("guardian_name", "Parent/guardian name *")}
                    {f("guardian_phone", "Guardian phone *", { type: "tel" })}{f("guardian_email", "Guardian email *", { type: "email" })}
                    <div className="sm:col-span-2 space-y-1.5"><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                    <Button type="submit" className="sm:col-span-2" disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit application</Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          <TabsContent value="status">
            <Card><CardContent className="p-6 space-y-4">
              <form onSubmit={check} className="grid gap-3 sm:grid-cols-3">
                <Input placeholder="ADM-2026-XXXXXX" value={lookup.number} onChange={(e) => setLookup({ ...lookup, number: e.target.value })} />
                <Input type="email" placeholder="Guardian email" value={lookup.email} onChange={(e) => setLookup({ ...lookup, email: e.target.value })} />
                <Button type="submit">Check</Button>
              </form>
              {status && (
                <div className="rounded-lg border p-4 space-y-2 text-sm">
                  <p><strong>{status.name}</strong> — {status.class_applying}</p>
                  <p>Status: <Badge>{String(status.status).replace("_", " ")}</Badge> &nbsp; Fee: <Badge variant="outline">{status.payment_status}</Badge></p>
                  {status.exam_at && <p>Entrance exam: {new Date(status.exam_at).toLocaleString()} {status.exam_venue && `at ${status.exam_venue}`}</p>}
                  {status.review_note && <p>Note: {status.review_note}</p>}
                  {status.payment_status === "unpaid" && portal.application_fee > 0 && (
                    <Button size="sm" onClick={() => pay(status.application_number, lookup.email.trim().toLowerCase())} disabled={busy}>Pay application fee</Button>
                  )}
                </div>
              )}
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
