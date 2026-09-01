import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { Loader2, ArrowLeft, ShieldCheck, Clock, XCircle } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CounselorOnboarding() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [form, setForm] = useState({
    headline: "",
    bio: "",
    qualifications: "",
    certifications: "",
    specializations: "",
    years_experience: "0",
    phone: "",
    location: "",
    days: [] as string[],
    hours: "",
  });

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate("/counselor/auth", { replace: true }); return; }
    (async () => {
      const { data } = await supabase
        .from("counselor_profiles" as any).select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        const p = data as any;
        setProfile(p);
        setForm({
          headline: p.headline ?? "",
          bio: p.bio ?? "",
          qualifications: p.qualifications ?? "",
          certifications: p.certifications ?? "",
          specializations: (p.specializations ?? []).join(", "),
          years_experience: String(p.years_experience ?? 0),
          phone: p.phone ?? "",
          location: p.location ?? "",
          days: p.availability?.days ?? [],
          hours: p.availability?.hours ?? "",
        });
      }
      setLoading(false);
    })();
  }, [user, isLoading, navigate]);

  const save = async () => {
    if (!user) return;
    if (form.headline.trim().length < 4) return toast({ title: "Add a short professional headline", variant: "destructive" });
    if (form.qualifications.trim().length < 10) return toast({ title: "Describe your qualifications", variant: "destructive" });
    if (form.days.length === 0) return toast({ title: "Select at least one available day", variant: "destructive" });

    setSaving(true);
    const payload = {
      user_id: user.id,
      headline: form.headline.trim(),
      bio: form.bio.trim() || null,
      qualifications: form.qualifications.trim(),
      certifications: form.certifications.trim() || null,
      specializations: form.specializations.split(",").map((s) => s.trim()).filter(Boolean),
      years_experience: Number(form.years_experience) || 0,
      phone: form.phone.trim() || null,
      location: form.location.trim() || null,
      availability: { days: form.days, hours: form.hours.trim() },
    };

    const { error } = profile
      ? await supabase.from("counselor_profiles" as any).update(payload as any).eq("id", profile.id)
      : await supabase.from("counselor_profiles" as any).insert(payload as any);
    setSaving(false);
    if (error) return toast({ title: "Could not save profile", description: error.message, variant: "destructive" });

    toast({ title: "Profile submitted", description: "An administrator will review and approve your profile." });
    const { data } = await supabase
      .from("counselor_profiles" as any).select("*").eq("user_id", user.id).maybeSingle();
    setProfile(data);
  };

  const status = profile?.status as string | undefined;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2"><Logo /></Link>
          <Link to="/counselor">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Dashboard</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Counselor onboarding</h1>
          <p className="text-sm text-muted-foreground">
            Submit your professional profile, qualifications and availability. Your profile only appears in
            the CareerAid counselor directory after an administrator approves it.
          </p>
        </div>

        {status && (
          <Card>
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              {status === "approved" ? <ShieldCheck className="h-6 w-6 text-primary" />
                : status === "rejected" ? <XCircle className="h-6 w-6 text-destructive" />
                : <Clock className="h-6 w-6 text-muted-foreground" />}
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Review status <Badge variant={status === "approved" ? "default" : "outline"}>{status}</Badge>
                </CardTitle>
                <CardDescription>
                  {status === "approved"
                    ? "You are listed in the counselor directory. Editing your profile sends it back for review."
                    : status === "rejected"
                      ? profile?.review_note || "Your profile was not approved. Update it and resubmit."
                      : "Awaiting administrator review."}
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <Card>
            <CardHeader><CardTitle className="text-base">Professional profile</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="headline">Headline</Label>
                <Input id="headline" placeholder="Certified career guidance counselor · STEM pathways"
                  value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bio">About you</Label>
                <Textarea id="bio" rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="quals">Qualifications</Label>
                <Textarea id="quals" rows={3} placeholder="Degrees, institutions and years"
                  value={form.qualifications} onChange={(e) => setForm({ ...form, qualifications: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="certs">Certifications / licences</Label>
                <Textarea id="certs" rows={2} value={form.certifications}
                  onChange={(e) => setForm({ ...form, certifications: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="specs">Specializations (comma separated)</Label>
                  <Input id="specs" placeholder="JAMB choices, Study abroad, Tech careers"
                    value={form.specializations} onChange={(e) => setForm({ ...form, specializations: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="years">Years of experience</Label>
                  <Input id="years" type="number" min={0} value={form.years_experience}
                    onChange={(e) => setForm({ ...form, years_experience: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="loc">Location</Label>
                  <Input id="loc" placeholder="Lagos, Nigeria" value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Weekly availability</Label>
                <div className="flex flex-wrap gap-3">
                  {DAYS.map((d) => (
                    <label key={d} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.days.includes(d)}
                        onCheckedChange={(c) =>
                          setForm((f) => ({
                            ...f,
                            days: c ? [...f.days, d] : f.days.filter((x) => x !== d),
                          }))
                        }
                      />
                      {d}
                    </label>
                  ))}
                </div>
                <Input placeholder="Preferred hours, e.g. 4pm – 8pm WAT"
                  value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
              </div>

              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {profile ? "Update and resubmit for review" : "Submit for approval"}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
