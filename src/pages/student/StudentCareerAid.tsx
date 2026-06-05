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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Bookmark, BookmarkCheck, ExternalLink, Briefcase, Save } from "lucide-react";

interface Resource {
  id: string;
  title: string;
  description: string | null;
  category: string;
  url: string | null;
}

export default function StudentCareerAid() {
  const { user } = useAuth();
  const { features, loading: featuresLoading } = useSchoolFeatures();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [saves, setSaves] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState({ interests: "", strengths: "", goals: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: s } = await supabase
        .from("students")
        .select("id, school_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!s) { setLoading(false); return; }
      setStudentId(s.id);
      setSchoolId(s.school_id);

      const [{ data: res }, { data: sv }, { data: pr }] = await Promise.all([
        supabase.from("career_resources").select("id, title, description, category, url")
          .eq("school_id", s.school_id).eq("is_published", true).order("created_at", { ascending: false }),
        supabase.from("student_career_saves").select("resource_id").eq("student_id", s.id),
        supabase.from("student_career_profiles").select("interests, strengths, goals").eq("student_id", s.id).maybeSingle(),
      ]);
      setResources((res as Resource[]) || []);
      setSaves(new Set(((sv as any[]) || []).map((x) => x.resource_id)));
      if (pr) setProfile({
        interests: ((pr as any).interests || []).join(", "),
        strengths: ((pr as any).strengths || []).join(", "),
        goals: (pr as any).goals || "",
      });
      setLoading(false);
    })();
  }, [user]);

  const toggleSave = async (resourceId: string) => {
    if (!studentId) return;
    if (saves.has(resourceId)) {
      await supabase.from("student_career_saves").delete().eq("student_id", studentId).eq("resource_id", resourceId);
      const n = new Set(saves); n.delete(resourceId); setSaves(n);
    } else {
      const { error } = await supabase.from("student_career_saves").insert({ student_id: studentId, resource_id: resourceId });
      if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
      setSaves(new Set(saves).add(resourceId));
    }
  };

  const saveProfile = async () => {
    if (!studentId || !schoolId) return;
    setSavingProfile(true);
    const payload = {
      student_id: studentId,
      school_id: schoolId,
      interests: profile.interests.split(",").map((s) => s.trim()).filter(Boolean),
      strengths: profile.strengths.split(",").map((s) => s.trim()).filter(Boolean),
      goals: profile.goals.trim() || null,
    };
    const { error } = await supabase.from("student_career_profiles").upsert(payload, { onConflict: "student_id" });
    setSavingProfile(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Profile saved" });
  };

  if (featuresLoading || loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!features.careeraid) {
    return (
      <div className="max-w-xl mx-auto mt-12 text-center space-y-3">
        <Briefcase className="h-12 w-12 mx-auto text-muted-foreground" />
        <h2 className="text-xl font-bold">CareerAid is not enabled</h2>
        <p className="text-muted-foreground">Ask your school admin to enable it.</p>
      </div>
    );
  }

  const savedList = resources.filter((r) => saves.has(r.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">CareerAid</h1>
        <p className="text-muted-foreground">Explore careers and plan your future.</p>
      </div>

      <Tabs defaultValue="explore" className="space-y-4">
        <TabsList>
          <TabsTrigger value="explore">Explore</TabsTrigger>
          <TabsTrigger value="saved">Saved ({savedList.length})</TabsTrigger>
          <TabsTrigger value="profile">My Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="explore">
          {resources.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">No resources shared yet.</CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {resources.map((r) => <ResourceCard key={r.id} r={r} saved={saves.has(r.id)} onToggle={() => toggleSave(r.id)} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="saved">
          {savedList.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">Nothing saved yet.</CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {savedList.map((r) => <ResourceCard key={r.id} r={r} saved onToggle={() => toggleSave(r.id)} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>My career profile</CardTitle>
              <CardDescription>Help teachers guide you with personalised recommendations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Interests (comma-separated)</Label>
                <Input value={profile.interests} onChange={(e) => setProfile({ ...profile, interests: e.target.value })} placeholder="science, music, design" /></div>
              <div><Label>Strengths (comma-separated)</Label>
                <Input value={profile.strengths} onChange={(e) => setProfile({ ...profile, strengths: e.target.value })} placeholder="problem solving, public speaking" /></div>
              <div><Label>Goals</Label>
                <Textarea rows={4} value={profile.goals} onChange={(e) => setProfile({ ...profile, goals: e.target.value })} placeholder="What do you want to become?" /></div>
              <Button onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Save profile
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ResourceCard({ r, saved, onToggle }: { r: Resource; saved: boolean; onToggle: () => void }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-base">{r.title}</CardTitle>
          <Badge variant="secondary">{r.category}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {r.description && <p className="text-sm text-foreground/80">{r.description}</p>}
        <div className="flex items-center justify-between">
          {r.url ? (
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <ExternalLink className="h-3 w-3" /> Open
            </a>
          ) : <span />}
          <Button size="sm" variant={saved ? "default" : "outline"} onClick={onToggle}>
            {saved ? <BookmarkCheck className="h-4 w-4 mr-1" /> : <Bookmark className="h-4 w-4 mr-1" />}
            {saved ? "Saved" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
