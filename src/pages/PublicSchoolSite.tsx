import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Phone, MapPin, Globe } from "lucide-react";

type Site = {
  id: string;
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

export default function PublicSchoolSite() {
  const { schoolCode } = useParams();
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState<{ name: string; logo_url: string | null; motto: string | null } | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    if (!schoolCode) return;
    (async () => {
      setLoading(true);
      const { data: schoolRow } = await supabase
        .from("schools")
        .select("id, name, logo_url, motto, code")
        .ilike("code", schoolCode)
        .maybeSingle();

      if (!schoolRow) {
        setLoading(false);
        return;
      }
      setSchool({ name: schoolRow.name, logo_url: schoolRow.logo_url, motto: schoolRow.motto });

      const { data: siteRow } = await (supabase as any)
        .from("school_websites")
        .select("*")
        .eq("school_id", schoolRow.id)
        .eq("is_published", true)
        .maybeSingle();

      if (siteRow) {
        setSite(siteRow as Site);
        const { data: secs } = await (supabase as any)
          .from("school_website_sections")
          .select("id, section_type, title, body, image_url, link_url, sort_order")
          .eq("website_id", (siteRow as Site).id)
          .eq("is_published", true)
          .order("sort_order");
        setSections((secs as Section[]) || []);
      }
      setLoading(false);
    })();
  }, [schoolCode]);

  useEffect(() => {
    if (school) {
      document.title = `${school.name} — Official School Website`;
      const desc = site?.tagline || school.motto || `Welcome to ${school.name}.`;
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "description");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", desc.slice(0, 155));
    }
  }, [school, site]);

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            {school.logo_url && (
              <img src={school.logo_url} alt={`${school.name} logo`} loading="lazy" className="h-10 w-10 rounded object-contain" />
            )}
            <span className="font-bold">{school.name}</span>
          </div>
          <Button asChild size="sm"><Link to="/auth">Portal login</Link></Button>
        </div>
      </header>

      <section className="border-b bg-gradient-to-br from-primary/10 to-background">
        <div className="container mx-auto grid gap-8 py-16 md:grid-cols-2 md:items-center">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">{school.name}</h1>
            {(site.tagline || school.motto) && (
              <p className="text-lg text-muted-foreground">{site.tagline || school.motto}</p>
            )}
            {site.admissions_info && (
              <Button asChild><a href="#admissions">Admissions</a></Button>
            )}
          </div>
          {site.hero_image_url && (
            <img
              src={site.hero_image_url}
              alt={`${school.name} campus`}
              loading="lazy"
              className="w-full rounded-xl object-cover shadow-lg"
            />
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

        {site.admissions_info && (
          <section id="admissions" className="space-y-3">
            <h2 className="text-2xl font-semibold">Admissions</h2>
            <p className="whitespace-pre-line text-muted-foreground">{site.admissions_info}</p>
          </section>
        )}

        {["news", "announcement", "page", "staff"].map((type) =>
          group(type).length ? (
            <section key={type} className="space-y-4">
              <h2 className="text-2xl font-semibold capitalize">
                {type === "news" ? "News & events" : type === "page" ? "More about us" : type === "staff" ? "Our staff" : "Announcements"}
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                {group(type).map((s) => (
                  <Card key={s.id}>
                    {s.image_url && (
                      <img src={s.image_url} alt={s.title} loading="lazy" className="h-40 w-full rounded-t-lg object-cover" />
                    )}
                    <CardHeader>
                      <CardTitle className="text-lg">{s.title}</CardTitle>
                    </CardHeader>
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
            </section>
          ) : null
        )}

        {group("gallery").length > 0 && (
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Gallery</h2>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              {group("gallery").map((g) =>
                g.image_url ? (
                  <img key={g.id} src={g.image_url} alt={g.title} loading="lazy" className="h-40 w-full rounded-lg object-cover" />
                ) : (
                  <Badge key={g.id} variant="secondary">{g.title}</Badge>
                )
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t bg-muted/30">
        <div className="container mx-auto grid gap-6 py-10 md:grid-cols-2">
          <div className="space-y-2 text-sm text-muted-foreground">
            {site.contact_email && (
              <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {site.contact_email}</p>
            )}
            {site.contact_phone && (
              <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {site.contact_phone}</p>
            )}
            {site.address && (
              <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {site.address}</p>
            )}
          </div>
          <div className="flex flex-wrap items-start gap-4 md:justify-end">
            {Object.entries(site.social_links || {})
              .filter(([, v]) => !!v)
              .map(([k, v]) => (
                <a key={k} href={v} target="_blank" rel="noreferrer" className="text-sm capitalize underline">
                  {k}
                </a>
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
