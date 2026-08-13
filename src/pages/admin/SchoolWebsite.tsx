import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolFeatures } from "@/hooks/useSchoolFeatures";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Globe, Loader2, Plus, Trash2, Pencil, ExternalLink } from "lucide-react";

type Website = {
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
  theme_color: string | null;
  social_links: Record<string, string>;
};

type Section = {
  id: string;
  school_id: string;
  website_id: string;
  section_type: string;
  title: string;
  slug: string | null;
  body: string | null;
  image_url: string | null;
  link_url: string | null;
  sort_order: number;
  is_published: boolean;
};

const SECTION_TYPES = ["page", "news", "announcement", "gallery", "staff"] as const;

const emptySection = (): Partial<Section> => ({
  section_type: "news",
  title: "",
  slug: "",
  body: "",
  image_url: "",
  link_url: "",
  sort_order: 0,
  is_published: false,
});

const isUrl = (v: string) => /^https?:\/\/\S+$/i.test(v);

export default function SchoolWebsite() {
  const { user } = useAuth();
  const { schoolId, loading: featuresLoading } = useSchoolFeatures();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [site, setSite] = useState<Website | null>(null);
  const [schoolCode, setSchoolCode] = useState<string>("");
  const [schoolName, setSchoolName] = useState<string>("");
  const [sections, setSections] = useState<Section[]>([]);
  const [editing, setEditing] = useState<Partial<Section> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (featuresLoading) return;
    if (!schoolId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const [{ data: school }, { data: existing }] = await Promise.all([
        supabase.from("schools").select("code, name").eq("id", schoolId).maybeSingle(),
        (supabase as any).from("school_websites").select("*").eq("school_id", schoolId).maybeSingle(),
      ]);
      setSchoolCode(school?.code || "");
      setSchoolName(school?.name || "");

      let record = existing as Website | null;
      if (!record) {
        const { data: created, error } = await (supabase as any)
          .from("school_websites")
          .insert({ school_id: schoolId })
          .select("*")
          .single();
        if (error) toast.error("Could not initialise your website: " + error.message);
        record = (created as Website) || null;
      }
      setSite(record ? { ...record, social_links: (record.social_links || {}) as Record<string, string> } : null);

      if (record) {
        const { data: secs } = await (supabase as any)
          .from("school_website_sections")
          .select("*")
          .eq("school_id", schoolId)
          .order("section_type")
          .order("sort_order");
        setSections((secs as Section[]) || []);
      }
      setLoading(false);
    })();
  }, [schoolId, featuresLoading]);

  const publicUrl = useMemo(
    () => (schoolCode ? `${window.location.origin}/site/${schoolCode.toLowerCase()}` : ""),
    [schoolCode]
  );

  const validateSite = (s: Website) => {
    const e: Record<string, string> = {};
    if (s.contact_email && !/^\S+@\S+\.\S+$/.test(s.contact_email)) e.contact_email = "Enter a valid email address";
    if (s.contact_phone && !/^[0-9+\-\s()]{7,20}$/.test(s.contact_phone)) e.contact_phone = "Enter a valid phone number";
    if (s.hero_image_url && !isUrl(s.hero_image_url)) e.hero_image_url = "Must start with http:// or https://";
    Object.entries(s.social_links || {}).forEach(([k, v]) => {
      if (v && !isUrl(v)) e[`social_${k}`] = "Must be a valid link";
    });
    return e;
  };

  const saveSite = async () => {
    if (!site) return;
    const e = validateSite(site);
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any)
      .from("school_websites")
      .update({
        is_published: site.is_published,
        tagline: site.tagline || null,
        about: site.about || null,
        admissions_info: site.admissions_info || null,
        contact_email: site.contact_email || null,
        contact_phone: site.contact_phone || null,
        address: site.address || null,
        hero_image_url: site.hero_image_url || null,
        theme_color: site.theme_color || null,
        social_links: site.social_links || {},
      })
      .eq("id", site.id)
      .eq("school_id", site.school_id);
    setSaving(false);
    if (error) toast.error("Save failed: " + error.message);
    else toast.success("Website content saved");
  };

  const saveSection = async () => {
    if (!editing || !site || !schoolId) return;
    const e: Record<string, string> = {};
    if (!editing.title || editing.title.trim().length < 3) e.title = "Title must be at least 3 characters";
    if (editing.image_url && !isUrl(editing.image_url)) e.image_url = "Must be a valid link";
    if (editing.link_url && !isUrl(editing.link_url)) e.link_url = "Must be a valid link";
    setErrors(e);
    if (Object.keys(e).length) return;

    const payload = {
      school_id: schoolId,
      website_id: site.id,
      section_type: editing.section_type || "news",
      title: editing.title!.trim(),
      slug: editing.slug?.trim() ? editing.slug.trim().toLowerCase().replace(/\s+/g, "-") : null,
      body: editing.body || null,
      image_url: editing.image_url || null,
      link_url: editing.link_url || null,
      sort_order: Number(editing.sort_order) || 0,
      is_published: !!editing.is_published,
      created_by: user?.id ?? null,
    };

    if (editing.id) {
      const { error } = await (supabase as any)
        .from("school_website_sections")
        .update(payload)
        .eq("id", editing.id)
        .eq("school_id", schoolId);
      if (error) return toast.error("Update failed: " + error.message);
      setSections((prev) => prev.map((s) => (s.id === editing.id ? ({ ...s, ...payload } as Section) : s)));
    } else {
      const { data, error } = await (supabase as any)
        .from("school_website_sections")
        .insert(payload)
        .select("*")
        .single();
      if (error) return toast.error("Create failed: " + error.message);
      setSections((prev) => [...prev, data as Section]);
    }
    toast.success("Content item saved");
    setEditing(null);
  };

  const deleteSection = async (s: Section) => {
    if (!confirm(`Delete "${s.title}"?`)) return;
    const { error } = await (supabase as any)
      .from("school_website_sections")
      .delete()
      .eq("id", s.id)
      .eq("school_id", s.school_id);
    if (error) return toast.error("Delete failed: " + error.message);
    setSections((prev) => prev.filter((x) => x.id !== s.id));
    toast.success("Deleted");
  };

  const togglePublished = async (s: Section) => {
    const { error } = await (supabase as any)
      .from("school_website_sections")
      .update({ is_published: !s.is_published })
      .eq("id", s.id)
      .eq("school_id", s.school_id);
    if (error) return toast.error(error.message);
    setSections((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_published: !x.is_published } : x)));
  };

  if (loading || featuresLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!schoolId || !site) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Your account is not linked to a school, so the website module is unavailable.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" /> School Website
            <Badge variant={site.is_published ? "default" : "secondary"}>
              {site.is_published ? "Live" : "Draft"}
            </Badge>
          </h1>
          <p className="text-muted-foreground">
            Manage {schoolName || "your school"}'s public website. Only your school's information appears here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {publicUrl && (
            <Button variant="outline" asChild>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" /> Preview site
              </a>
            </Button>
          )}
          <Button onClick={saveSite} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">Site content</TabsTrigger>
          <TabsTrigger value="items">News &amp; pages ({sections.length})</TabsTrigger>
          <TabsTrigger value="settings">Publishing</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Homepage</CardTitle>
              <CardDescription>Headline content shown to visitors.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Tagline</Label>
                <Input
                  value={site.tagline || ""}
                  maxLength={160}
                  onChange={(e) => setSite({ ...site, tagline: e.target.value })}
                  placeholder="Nurturing excellence, character and leadership"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>About the school</Label>
                <Textarea
                  rows={5}
                  value={site.about || ""}
                  onChange={(e) => setSite({ ...site, about: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Admissions information</Label>
                <Textarea
                  rows={4}
                  value={site.admissions_info || ""}
                  onChange={(e) => setSite({ ...site, admissions_info: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Hero image URL</Label>
                <Input
                  value={site.hero_image_url || ""}
                  onChange={(e) => setSite({ ...site, hero_image_url: e.target.value })}
                  placeholder="https://..."
                />
                {errors.hero_image_url && <p className="text-sm text-destructive">{errors.hero_image_url}</p>}
              </div>
              <div className="space-y-2">
                <Label>Theme colour</Label>
                <Input
                  value={site.theme_color || ""}
                  onChange={(e) => setSite({ ...site, theme_color: e.target.value })}
                  placeholder="#4f46e5"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact &amp; social</CardTitle>
              <CardDescription>Displayed in the website footer.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Contact email</Label>
                <Input
                  value={site.contact_email || ""}
                  onChange={(e) => setSite({ ...site, contact_email: e.target.value })}
                />
                {errors.contact_email && <p className="text-sm text-destructive">{errors.contact_email}</p>}
              </div>
              <div className="space-y-2">
                <Label>Contact phone</Label>
                <Input
                  value={site.contact_phone || ""}
                  onChange={(e) => setSite({ ...site, contact_phone: e.target.value })}
                />
                {errors.contact_phone && <p className="text-sm text-destructive">{errors.contact_phone}</p>}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Address</Label>
                <Input value={site.address || ""} onChange={(e) => setSite({ ...site, address: e.target.value })} />
              </div>
              {["facebook", "instagram", "x", "linkedin"].map((k) => (
                <div key={k} className="space-y-2">
                  <Label className="capitalize">{k}</Label>
                  <Input
                    value={site.social_links?.[k] || ""}
                    onChange={(e) =>
                      setSite({ ...site, social_links: { ...(site.social_links || {}), [k]: e.target.value } })
                    }
                    placeholder="https://..."
                  />
                  {errors[`social_${k}`] && <p className="text-sm text-destructive">{errors[`social_${k}`]}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>News, pages, gallery &amp; staff</CardTitle>
                <CardDescription>Only published items appear on your public site.</CardDescription>
              </div>
              <Button onClick={() => { setErrors({}); setEditing(emptySection()); }}>
                <Plus className="h-4 w-4 mr-2" /> Add item
              </Button>
            </CardHeader>
            <CardContent>
              {sections.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No content yet. Add your first item.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Published</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sections.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.title}</TableCell>
                        <TableCell className="capitalize">{s.section_type}</TableCell>
                        <TableCell>{s.sort_order}</TableCell>
                        <TableCell>
                          <Switch checked={s.is_published} onCheckedChange={() => togglePublished(s)} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => { setErrors({}); setEditing(s); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteSection(s)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Publishing</CardTitle>
              <CardDescription>Control public visibility of your school website.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Publish website</p>
                  <p className="text-sm text-muted-foreground">
                    When off, visitors cannot see any of your website content.
                  </p>
                </div>
                <Switch
                  checked={site.is_published}
                  onCheckedChange={(v) => setSite({ ...site, is_published: v })}
                />
              </div>
              {publicUrl && (
                <div className="rounded-lg border p-4 text-sm">
                  Public address: <span className="font-mono">{publicUrl}</span>
                </div>
              )}
              <Button onClick={saveSite} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit content item" : "Add content item"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={editing.section_type || "news"}
                    onValueChange={(v) => setEditing({ ...editing, section_type: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SECTION_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Display order</Label>
                  <Input
                    type="number"
                    value={editing.sort_order ?? 0}
                    onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={editing.title || ""}
                  maxLength={200}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
                {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
              </div>
              <div className="space-y-2">
                <Label>Body</Label>
                <Textarea
                  rows={6}
                  value={editing.body || ""}
                  onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Image URL</Label>
                  <Input
                    value={editing.image_url || ""}
                    onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                  />
                  {errors.image_url && <p className="text-sm text-destructive">{errors.image_url}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Link URL</Label>
                  <Input
                    value={editing.link_url || ""}
                    onChange={(e) => setEditing({ ...editing, link_url: e.target.value })}
                  />
                  {errors.link_url && <p className="text-sm text-destructive">{errors.link_url}</p>}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>Published</Label>
                <Switch
                  checked={!!editing.is_published}
                  onCheckedChange={(v) => setEditing({ ...editing, is_published: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveSection}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
