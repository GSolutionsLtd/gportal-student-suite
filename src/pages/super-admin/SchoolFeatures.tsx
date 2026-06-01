import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Search, Settings, School, ClipboardList, Monitor, CreditCard, Save, FileText, BookOpen, Compass } from "lucide-react";

interface SchoolFeatureData {
  id: string;
  name: string;
  code: string;
  subscription_status: string;
  enabled_features: {
    results: boolean;
    cbt: boolean;
    finance: boolean;
    assignments: boolean;
    lesson_notes: boolean;
    careeraid: boolean;
  };
}

const FEATURE_INFO = [
  {
    key: "results" as const,
    label: "Student Result Management",
    description: "Result processing, PIN management, result checking portal",
    icon: ClipboardList,
    tier: "core" as const,
  },
  {
    key: "cbt" as const,
    label: "CBT Examination Management",
    description: "Computer-based testing, question banks, auto-grading",
    icon: Monitor,
    tier: "core" as const,
  },
  {
    key: "finance" as const,
    label: "Finance Management",
    description: "Fee structures, online payment processing, receipts",
    icon: CreditCard,
    tier: "core" as const,
  },
  {
    key: "assignments" as const,
    label: "Assignment Management",
    description: "Teacher assignment creation, student submissions, grading workflow",
    icon: FileText,
    tier: "premium" as const,
  },
  {
    key: "lesson_notes" as const,
    label: "AI Lesson Note Planner",
    description: "Curriculum upload, AI-generated lesson notes, engagement tracking",
    icon: BookOpen,
    tier: "premium" as const,
  },
  {
    key: "careeraid" as const,
    label: "CareerAid Clinic",
    description: "Holland Code assessment, AI career recommendations, counseling",
    icon: Compass,
    tier: "premium" as const,
  },
];

export default function SchoolFeatures() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<SchoolFeatureData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editSchool, setEditSchool] = useState<SchoolFeatureData | null>(null);
  const [features, setFeatures] = useState({ results: true, cbt: true, finance: true, assignments: false, lesson_notes: false, careeraid: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("schools")
        .select("id, name, code, subscription_status, enabled_features")
        .order("name");

      if (error) throw error;

      setSchools(
        (data || []).map((s: any) => {
          const ef = s.enabled_features || {};
          return {
            ...s,
            enabled_features: {
              results: ef.results !== false,
              cbt: ef.cbt !== false,
              finance: ef.finance !== false,
              assignments: ef.assignments === true,
              lesson_notes: ef.lesson_notes === true,
              careeraid: ef.careeraid === true,
            },
          };
        })
      );
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (school: SchoolFeatureData) => {
    setEditSchool(school);
    setFeatures({ ...school.enabled_features });
  };

  const saveFeatures = async () => {
    if (!editSchool) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("schools")
        .update({ enabled_features: features })
        .eq("id", editSchool.id);

      if (error) throw error;

      toast({ title: "Saved", description: `Features updated for ${editSchool.name}` });
      setEditSchool(null);
      fetchSchools();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filtered = schools.filter(
    (s) =>
      searchQuery === "" ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const countEnabled = (f: SchoolFeatureData["enabled_features"]) =>
    [f.results, f.cbt, f.finance].filter(Boolean).length;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">School Feature Management</h1>
        <p className="text-muted-foreground">
          Control which infrastructure modules each school can access
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {FEATURE_INFO.map((fi) => {
          const activeCount = schools.filter((s) => s.enabled_features[fi.key]).length;
          return (
            <Card key={fi.key}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{fi.label}</CardTitle>
                <fi.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeCount}/{schools.length}</div>
                <p className="text-xs text-muted-foreground">schools enabled</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search schools..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Results</TableHead>
                <TableHead>CBT</TableHead>
                <TableHead>Finance</TableHead>
                <TableHead>Modules</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((school) => (
                <TableRow key={school.id}>
                  <TableCell className="font-medium">{school.name}</TableCell>
                  <TableCell>{school.code}</TableCell>
                  <TableCell>
                    <Badge variant={school.subscription_status === "active" ? "default" : "secondary"}>
                      {school.subscription_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {school.enabled_features.results ? (
                      <Badge variant="default" className="text-xs">On</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Off</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {school.enabled_features.cbt ? (
                      <Badge variant="default" className="text-xs">On</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Off</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {school.enabled_features.finance ? (
                      <Badge variant="default" className="text-xs">On</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Off</Badge>
                    )}
                  </TableCell>
                  <TableCell>{countEnabled(school.enabled_features)}/3</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => openEdit(school)}>
                      <Settings className="h-4 w-4 mr-1" />Configure
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No schools found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editSchool} onOpenChange={() => setEditSchool(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <School className="h-5 w-5" />
              Configure Features — {editSchool?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {FEATURE_INFO.map((fi) => (
              <div key={fi.key} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <fi.icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{fi.label}</p>
                    <p className="text-xs text-muted-foreground">{fi.description}</p>
                  </div>
                </div>
                <Switch
                  checked={features[fi.key]}
                  onCheckedChange={(v) => setFeatures((prev) => ({ ...prev, [fi.key]: v }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSchool(null)}>Cancel</Button>
            <Button onClick={saveFeatures} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
