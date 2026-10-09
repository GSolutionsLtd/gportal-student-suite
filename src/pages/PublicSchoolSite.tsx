import { useEffect, useMemo, useState } from "react";
import { useParams, Link, NavLink } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Mail, Phone, MapPin, Globe, Menu as MenuIcon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type Site = {
  id: string;
  school_id: string;
  is_published: boolean;
  tagline: string | null;
  about: string | null;
  admissions_info: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  hero_image_url: string | null;
  social_links: Record<string, string> | null;
};

type Section = {
  id: string;
  section_type: string;
  title: string;
  body: string | null;
  image_url: string | null;
  link_url: string | null;
};

const PAGES = [
  { key: "", label: "Home" },
  { key: "admissions", label: "Admissions" },
  { key: "news", label: "News" },
  { key: "gallery", label: "Gallery" },
  { key: "staff", label: "Staff" },
  { key: "contact", label: "Contact" },
];

export default function PublicSchoolSite() {
  const { schoolCode, page } = useParams();
  const current = page ?? "";
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [school, setSchool] = useState<{ id: string; name: string; logo_url: string | null; motto: string | null } | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!schoolCode) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any).rpc("get_public_school_site", { _code: schoolCode });
      const payload = data as { school: any; site: Site; sections: Section[] } | null;

      if (payload?.school) {
        setSchool({
          id: payload.school.id,
          name: payload.school.name,
          logo_url: payload.school.logo_url,
          motto: payload.school.motto,
        });
        setSite(payload.site as Site);
        setSections((payload.sections as Section[]) || []);
      }
      setLoading(false);
    })();
  }, [schoolCode]);

  const pageLabel = useMemo(() => PAGES.find((p) => p.key === current)?.label ?? "Home", [current]);

  useEffect(() => {
    if (school) {
      document.title = `${pageLabel} — ${school.name}`.slice(0, 60);
      const desc = site?.tagline || school.motto || `Welcome to ${school.name}.`;
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "description");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", desc.slice(0, 155));
    }
  }, [school, site, pageLabel]);

  const submitEnquiry = async () => {
    if (!school) return;
    if (form.name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(form.email) || form.message.trim().length < 5) {
      toast.error("Please enter your name, a valid email and your message.");
      return;
    }
    setSending(true);
    const { error } = await (supabase as any).from("contact_submissions").insert({
      full_name: form.name.trim(),
      school_name: school.name,
      email: form.email.trim(),
      city_state: site?.address ?? "Not provided",
      phone: form.phone.trim() || "Not provided",
      message: form.message.trim(),
      source: `school-website:${schoolCode}`,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setSent(true);
    setForm({ name: "", email: "", phone: "", message: "" });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!school || !site) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <Globe className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Website not available</h1>
        <p className="text-muted-foreground">This school has not published a public website yet.</p>
        <Button asChild variant="outline"><Link to="/">Back to GPortal Suite</Link></Button>
      </div>
    );
  }

  const group = (type: string) => sections.filter((s) => s.section_type === type);
  const base = `/site/${schoolCode}`;

  const SectionGrid = ({ type, empty }: { type: string; empty: string }) =>
    group(type).length === 0 ? (
      <p className="text-muted-foreground">{empty}</p>
    ) : (
      <div className="grid gap-4 md:grid-cols-3">
        {group(type).map((s) => (
          <Card key={s.id}>
            {s.image_url && (
              <img src={s.image_url} alt={s.title} loading="lazy" className="h-40 w-full rounded-t-lg object-cover" />
            )}
            <CardHeader><CardTitle className="text-lg">{s.title}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {s.body && <p className="whitespace-pre-line text-sm text-muted-foreground">{s.body}</p>}
              {s.link_url && (
                <Button asChild size="sm" variant="outline">
                  <a href={s.link_url} target="_blank" rel="noreferrer">Read more</a>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 py-4">
          <Link to={base} className="flex items-center gap-3">
            {school.logo_url && (
              <img src={school.logo_url} alt={`${school.name} logo`} loading="lazy" className="h-10 w-10 rounded object-contain" />
            )}
            <span className="font-bold">{school.name}</span>
          </Link>
          <nav className="hidden md:flex flex-wrap items-center gap-1">
            {PAGES.map((p) => (
              <NavLink
                key={p.key}
                to={p.key ? `${base}/${p.key}` : base}
                end
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm ${isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`
                }
              >
                {p.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild size="sm"><Link to="/auth">Portal login</Link></Button>
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                  <MenuIcon className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[80vw] max-w-xs">
                <SheetHeader><SheetTitle className="text-left">{school.name}</SheetTitle></SheetHeader>
                <nav className="mt-6 flex flex-col gap-1">
                  {PAGES.map((p) => (
                    <NavLink
                      key={p.key}
                      to={p.key ? `${base}/${p.key}` : base}
                      end
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        `rounded-md px-3 py-2.5 text-sm ${isActive ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent"}`
                      }
                    >
                      {p.label}
                    </NavLink>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {current === "" && (
        <>
          <section className="border-b bg-gradient-to-br from-primary/10 to-background">
            <div className="container mx-auto grid gap-8 py-16 md:grid-cols-2 md:items-center">
              <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tight">{school.name}</h1>
                {(site.tagline || school.motto) && (
                  <p className="text-lg text-muted-foreground">{site.tagline || school.motto}</p>
                )}
                <div className="flex flex-wrap gap-3">
                  <Button asChild><Link to={`/admissions/${schoolCode}`}>Apply for Admission</Link></Button>
                  <Button asChild variant="outline"><Link to={`${base}/contact`}>Contact us</Link></Button>
                </div>
              </div>
              {site.hero_image_url && (
                <img src={site.hero_image_url} alt={`${school.name} campus`} loading="lazy"
                  className="w-full rounded-xl object-cover shadow-lg" />
              )}
            </div>
          </section>

          <main className="container mx-auto space-y-14 py-14">
            {site.about && (
              <section className="space-y-3">
                <h2 className="text-2xl font-semibold">About us</h2>
                <p className="whitespace-pre-line text-muted-foreground">{site.about}</p>
              </section>
            )}
            {group("announcement").length > 0 && (
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Announcements</h2>
                <SectionGrid type="announcement" empty="" />
              </section>
            )}
            {group("page").length > 0 && (
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold">More about us</h2>
                <SectionGrid type="page" empty="" />
              </section>
            )}
          </main>
        </>
      )}

      {current !== "" && (
        <main className="container mx-auto space-y-8 py-12">
          <h1 className="text-3xl font-bold">{pageLabel}</h1>

          {current === "admissions" && (
            <div className="space-y-6">
              <p className="whitespace-pre-line text-muted-foreground">
                {site.admissions_info || `Contact ${school.name} for current admission requirements and application dates.`}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild><Link to={`/admissions/${schoolCode}`}>Parent Portal: Apply, track &amp; pay</Link></Button>
                <Button asChild variant="outline"><Link to={`${base}/contact`}>Ask a question</Link></Button>
              </div>
            </div>
          )}

          {current === "news" && <SectionGrid type="news" empty="No news or events have been posted yet." />}
          {current === "staff" && <SectionGrid type="staff" empty="Staff profiles are coming soon." />}

          {current === "gallery" && (
            group("gallery").length === 0 ? (
              <p className="text-muted-foreground">No photos have been published yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                {group("gallery").map((g) =>
                  g.image_url ? (
                    <img key={g.id} src={g.image_url} alt={g.title} loading="lazy" className="h-40 w-full rounded-lg object-cover" />
                  ) : (
                    <Badge key={g.id} variant="secondary">{g.title}</Badge>
                  )
                )}
              </div>
            )
          )}

          {current === "contact" && (
            <div className="grid gap-8 md:grid-cols-2">
              <div className="space-y-3 text-sm text-muted-foreground">
                {site.contact_email && <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {site.contact_email}</p>}
                {site.contact_phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {site.contact_phone}</p>}
                {site.address && <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {site.address}</p>}
              </div>
              <Card>
                <CardHeader><CardTitle className="text-lg">Send an enquiry</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {sent && (
                    <p className="rounded-md bg-primary/10 p-3 text-sm text-primary">
                      Thank you — your message has been sent to {school.name}.
                    </p>
                  )}
                  <div className="space-y-1">
                    <Label htmlFor="cname">Full name</Label>
                    <Input id="cname" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cemail">Email</Label>
                    <Input id="cemail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cphone">Phone (optional)</Label>
                    <Input id="cphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cmsg">Message</Label>
                    <Textarea id="cmsg" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
                  </div>
                  <Button onClick={submitEnquiry} disabled={sending}>
                    {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Send enquiry
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      )}

      <footer className="border-t bg-muted/30">
        <div className="container mx-auto grid gap-6 py-10 md:grid-cols-2">
          <div className="space-y-2 text-sm text-muted-foreground">
            {site.contact_email && <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {site.contact_email}</p>}
            {site.contact_phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {site.contact_phone}</p>}
            {site.address && <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {site.address}</p>}
          </div>
          <div className="flex flex-wrap items-start gap-4 md:justify-end">
            {Object.entries(site.social_links || {})
              .filter(([, v]) => !!v)
              .map(([k, v]) => (
                <a key={k} href={v} target="_blank" rel="noreferrer" className="text-sm capitalize underline">{k}</a>
              ))}
          </div>
        </div>
        <div className="border-t py-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {school.name}. Powered by GPortal Suite.
        </div>
      </footer>
    </div>
  );
}
