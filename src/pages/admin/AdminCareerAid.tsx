import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolFeatures } from "@/hooks/useSchoolFeatures";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, ExternalLink, Briefcase } from "lucide-react";
import { format } from "date-fns";

interface Resource {
  id: string;
  title: string;
  description: string | null;
  category: string;
  url: string | null;
  is_published: boolean;
  created_at: string;
}

export default function AdminCareerAid() {
  const { user } = useAuth();
  const { features, schoolId, loading: featuresLoading } = useSchoolFeatures();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [resources, setResources] = useState<Resource[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "general", url: "" });

  const load = async () => {
    if (!schoolId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("career_resources")
      .select("id, title, description, category, url, is_published, created_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    setResources((data as Resource[]) || []);
    setLoading(false);
  };

  useEffect(() => { if (schoolId) load(); /* eslint-disable-next-line */ }, [schoolId]);

  const save = async () => {
    if (!form.title.trim() || !schoolId || !user) return;
    setSaving(true);
    const { error } = await supabase.from("career_resources").insert({
      school_id: schoolId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || "general",
      url: form.url.trim() || null,
      posted_by: user.id,
    });
    setSaving(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Resource posted" });
    setOpen(false);
    setForm({ title: "", description: "", category: "general", url: "" });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this resource?")) return;
    const { error } = await supabase.from("career_resources").delete().eq("id", id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setResources((r) => r.filter((x) => x.id !== id));
  };

  if (featuresLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!features.careeraid) {
    return (
      <div className="max-w-xl mx-auto mt-12 text-center space-y-3">
        <Briefcase className="h-12 w-12 mx-auto text-muted-foreground" />
        <h2 className="text-xl font-bold">CareerAid is not enabled</h2>
        <p className="text-muted-foreground">Ask your super admin to enable it.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CareerAid Library</h1>
          <p className="text-muted-foreground">Curate career guidance resources for your school.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />New resource</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : resources.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No resources yet.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {resources.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <CardTitle className="text-base">{r.title}</CardTitle>
                    <CardDescription>{format(new Date(r.created_at), "PP")}</CardDescription>
                  </div>
                  <Badge variant="secondary">{r.category}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {r.description && <p className="text-sm text-foreground/80">{r.description}</p>}
                {r.url && (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" /> Open link
                  </a>
                )}
                <Button variant="ghost" size="sm" onClick={() => remove(r.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New career resource</DialogTitle>
            <DialogDescription>Share guidance with students in your school.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. scholarships, STEM" /></div>
            <div><Label>Description</Label><Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Link (optional)</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.title.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
