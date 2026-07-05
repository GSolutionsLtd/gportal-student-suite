import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, CheckCircle2, Mail, MapPin, Phone } from "lucide-react";

const contactSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(120),
  school_name: z.string().trim().min(2, "School name is required").max(160),
  city_state: z.string().trim().min(2, "City / State is required").max(160),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().min(6, "Enter a valid phone number").max(40),
  message: z.string().trim().min(5, "Please tell us how we can help").max(2000),
});

export default function Contact() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const params = new URLSearchParams(location.search);
  const source = params.get("source") ?? "contact_page";

  const [form, setForm] = useState({
    full_name: "",
    school_name: "",
    city_state: "",
    email: "",
    phone: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) {
      const newErrors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) newErrors[err.path[0] as string] = err.message;
      });
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const d = parsed.data;
    const { error } = await supabase.from("contact_submissions").insert([
      {
        full_name: d.full_name,
        school_name: d.school_name,
        city_state: d.city_state,
        email: d.email,
        phone: d.phone,
        message: d.message,
        source,
      },
    ]);
    setSubmitting(false);
    if (error) {
      toast({
        title: "Could not send your request",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setSubmitted(true);
    toast({ title: "Request received", description: "Our team will reach out shortly." });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate("/")} aria-label="Home">
            <Logo />
          </button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-2 gap-10 max-w-6xl mx-auto">
          <div>
            <div className="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
              Talk to GPortal Suite
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Book a demo, request a quote, or start a free consultation.
            </h1>
            <p className="text-muted-foreground mb-8">
              Tell us about your school and what you'd like to solve. A GPortal specialist will
              respond within one business day.
            </p>

            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold">Call sales</div>
                  <div className="text-muted-foreground">07039485184 · 07084336702</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold">Email</div>
                  <div className="text-muted-foreground">hello@gportal.app</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold">Head office</div>
                  <div className="text-muted-foreground">Geekie I-Solutions Limited · Nigeria</div>
                </div>
              </div>
            </div>
          </div>

          <Card className="p-6 md:p-8">
            {submitted ? (
              <div className="text-center py-8" role="status" aria-live="polite">
                <div className="mx-auto h-14 w-14 rounded-full bg-success/10 text-success flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Thanks — we've got your request.</h2>
                <p className="text-muted-foreground text-sm mb-2">
                  A GPortal specialist will reach out to <span className="font-medium text-foreground">{form.email}</span> within one business day.
                </p>
                <p className="text-xs text-muted-foreground mb-6">
                  A copy of your enquiry has been logged with reference source: <span className="font-mono">{source}</span>
                </p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Button variant="outline" onClick={() => navigate("/")}>Back to homepage</Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSubmitted(false);
                      setForm({ full_name: "", school_name: "", city_state: "", email: "", phone: "", message: "" });
                    }}
                  >
                    Send another enquiry
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {Object.keys(errors).length > 0 && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm px-3 py-2">
                    Please fix the highlighted fields below.
                  </div>
                )}
                <div>
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    value={form.full_name}
                    onChange={(e) => handleChange("full_name", e.target.value)}
                    maxLength={120}
                    autoComplete="name"
                  />
                  {errors.full_name && <p className="text-xs text-destructive mt-1">{errors.full_name}</p>}
                </div>
                <div>
                  <Label htmlFor="school_name">School Name *</Label>
                  <Input
                    id="school_name"
                    value={form.school_name}
                    onChange={(e) => handleChange("school_name", e.target.value)}
                    maxLength={160}
                  />
                  {errors.school_name && <p className="text-xs text-destructive mt-1">{errors.school_name}</p>}
                </div>
                <div>
                  <Label htmlFor="city_state">City / State *</Label>
                  <Input
                    id="city_state"
                    value={form.city_state}
                    onChange={(e) => handleChange("city_state", e.target.value)}
                    maxLength={160}
                  />
                  {errors.city_state && <p className="text-xs text-destructive mt-1">{errors.city_state}</p>}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      maxLength={255}
                      autoComplete="email"
                    />
                    {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      maxLength={40}
                      autoComplete="tel"
                    />
                    {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
                  </div>
                </div>
                <div>
                  <Label htmlFor="message">Request / Enquiry *</Label>
                  <Textarea
                    id="message"
                    value={form.message}
                    onChange={(e) => handleChange("message", e.target.value)}
                    maxLength={2000}
                    rows={5}
                    placeholder="Tell us about your school, size, and what you'd like GPortal to help with."
                  />
                  {errors.message && <p className="text-xs text-destructive mt-1">{errors.message}</p>}
                </div>
                <input type="hidden" value={source} readOnly />
                <Button type="submit" size="lg" variant="hero" className="w-full" disabled={submitting}>
                  {submitting ? "Sending…" : "Send Request"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  We reply within one business day. Your details stay private.
                </p>
              </form>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
