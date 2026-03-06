import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ShieldCheck, QrCode, Key, Copy, Loader2, Search, ExternalLink, CheckCircle, AlertTriangle } from "lucide-react";

export default function ResultSecurity() {
  const [loading, setLoading] = useState(false);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedTerm, setSelectedTerm] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({ total: 0, withCode: 0, withoutCode: 0 });
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchTerms();
  }, []);

  useEffect(() => {
    if (selectedTerm) fetchResults();
  }, [selectedTerm]);

  const fetchTerms = async () => {
    const { data } = await supabase.from("terms").select("id, name, is_current").order("start_date", { ascending: false });
    setTerms(data || []);
    const current = data?.find(t => t.is_current);
    if (current) setSelectedTerm(current.id);
  };

  const fetchResults = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("results")
      .select(`
        id, status, verification_code, published_at,
        student:students(first_name, last_name, admission_number),
        class_arm:class_arms(name, class:classes(name))
      `)
      .eq("term_id", selectedTerm)
      .eq("status", "published")
      .order("published_at", { ascending: false });

    const all = data || [];
    setResults(all);
    setStats({
      total: all.length,
      withCode: all.filter(r => r.verification_code).length,
      withoutCode: all.filter(r => !r.verification_code).length,
    });
    setLoading(false);
  };

  const generateMissingCodes = async () => {
    const missing = results.filter(r => !r.verification_code);
    if (missing.length === 0) {
      toast.info("All published results already have verification codes");
      return;
    }

    setGenerating(true);
    let count = 0;

    for (const result of missing) {
      const code = generateCode();
      const { error } = await supabase
        .from("results")
        .update({ verification_code: code })
        .eq("id", result.id);
      if (!error) count++;
    }

    toast.success(`Generated ${count} verification codes`);
    fetchResults();
    setGenerating(false);
  };

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 12; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied");
  };

  const getVerifyUrl = (code: string) => {
    return `${window.location.origin}/verify-result?code=${code}`;
  };

  const filteredResults = results.filter(r => {
    if (!searchQuery) return true;
    const student = r.student as any;
    const q = searchQuery.toLowerCase();
    return (
      student?.admission_number?.toLowerCase().includes(q) ||
      student?.first_name?.toLowerCase().includes(q) ||
      student?.last_name?.toLowerCase().includes(q) ||
      r.verification_code?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Result Security & Verification</h1>
        <p className="text-muted-foreground">Manage digital verification codes and anti-fraud measures</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <ShieldCheck className="h-8 w-8 mx-auto text-primary mb-2" />
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Published Results</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-8 w-8 mx-auto text-green-600 mb-2" />
            <div className="text-2xl font-bold text-green-600">{stats.withCode}</div>
            <p className="text-sm text-muted-foreground">With Verification Code</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-yellow-600 mb-2" />
            <div className="text-2xl font-bold text-yellow-600">{stats.withoutCode}</div>
            <p className="text-sm text-muted-foreground">Missing Code</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Verification Code Management
          </CardTitle>
          <CardDescription>Each published result gets a unique 12-character verification code for authenticity checks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <label className="text-sm font-medium">Term</label>
              <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  {terms.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name} {t.is_current && "(Current)"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, admission no, or code..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Button onClick={generateMissingCodes} disabled={generating || stats.withoutCode === 0}>
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
              Generate Missing Codes ({stats.withoutCode})
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Admission No</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Verification Code</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No published results found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredResults.map(r => {
                      const student = r.student as any;
                      const classArm = r.class_arm as any;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">
                            {student?.last_name} {student?.first_name}
                          </TableCell>
                          <TableCell>{student?.admission_number}</TableCell>
                          <TableCell>{classArm?.class?.name} {classArm?.name}</TableCell>
                          <TableCell>
                            {r.verification_code ? (
                              <Badge variant="outline" className="font-mono tracking-wider">
                                {r.verification_code}
                              </Badge>
                            ) : (
                              <Badge variant="destructive">Missing</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {r.verification_code && (
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => copyCode(r.verification_code)}>
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => window.open(getVerifyUrl(r.verification_code), "_blank")}>
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Public verification link */}
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">
              <ShieldCheck className="inline h-4 w-4 mr-1" />
              Public verification portal:
            </p>
            <code className="text-sm bg-secondary px-3 py-2 rounded-lg block">
              {window.location.origin}/verify-result
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
