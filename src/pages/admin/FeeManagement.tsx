import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Edit, Trash2, DollarSign, FileText, Users, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function FeeManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("structures");

  // Reference data
  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);

  // Fee Structures
  const [structures, setStructures] = useState<any[]>([]);
  const [structureDialog, setStructureDialog] = useState(false);
  const [editingStructure, setEditingStructure] = useState<any>(null);
  const [sForm, setSForm] = useState({
    name: "", class_id: "", term_id: "", session_id: "",
    amount: 0, description: "", is_compulsory: true,
  });

  // Payments
  const [payments, setPayments] = useState<any[]>([]);
  const [filterSession, setFilterSession] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Analytics
  const [analytics, setAnalytics] = useState({ total: 0, paid: 0, pending: 0, revenue: 0 });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [clsRes, termRes, sessRes] = await Promise.all([
      supabase.from("classes").select("id, name").eq("is_active", true).order("level"),
      supabase.from("terms").select("id, name, session_id").order("created_at", { ascending: false }),
      supabase.from("academic_sessions").select("id, name").order("start_date", { ascending: false }),
    ]);
    setClasses(clsRes.data || []);
    setTerms(termRes.data || []);
    setSessions(sessRes.data || []);
    if (sessRes.data && sessRes.data.length > 0) setFilterSession(sessRes.data[0].id);
    await Promise.all([loadStructures(), loadPayments()]);
    setLoading(false);
  };

  const loadStructures = async () => {
    const { data } = await supabase.from("fee_structures").select("*").order("created_at", { ascending: false });
    setStructures(data || []);
  };

  const loadPayments = async () => {
    const { data } = await supabase.from("fee_payments").select("*").order("created_at", { ascending: false });
    if (data) {
      const studentIds = [...new Set(data.map((p) => p.student_id))];
      const { data: students } = await supabase.from("students").select("id, first_name, last_name, admission_number").in("id", studentIds.length > 0 ? studentIds : ["none"]);
      const studentMap = new Map((students || []).map((s) => [s.id, s]));
      setPayments(data.map((p) => ({ ...p, student: studentMap.get(p.student_id) })));

      // Analytics
      const paid = data.filter((p) => p.status === "paid");
      const pending = data.filter((p) => p.status === "pending");
      setAnalytics({
        total: data.length,
        paid: paid.length,
        pending: pending.length,
        revenue: paid.reduce((sum, p) => sum + Number(p.amount_paid), 0),
      });
    } else {
      setPayments([]);
    }
  };

  const saveStructure = async () => {
    if (!sForm.name || !sForm.session_id || !sForm.amount) {
      toast({ title: "Fill required fields", variant: "destructive" }); return;
    }
    const payload = {
      ...sForm,
      class_id: sForm.class_id || null,
      term_id: sForm.term_id || null,
      created_by: user!.id,
    };
    const { error } = editingStructure
      ? await supabase.from("fee_structures").update(payload).eq("id", editingStructure.id)
      : await supabase.from("fee_structures").insert(payload);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: editingStructure ? "Updated" : "Created" });
    setStructureDialog(false);
    setEditingStructure(null);
    setSForm({ name: "", class_id: "", term_id: "", session_id: "", amount: 0, description: "", is_compulsory: true });
    loadStructures();
  };

  const deleteStructure = async (id: string) => {
    await supabase.from("fee_structures").delete().eq("id", id);
    loadStructures();
    toast({ title: "Deleted" });
  };

  const verifyPayment = async (paymentId: string) => {
    const receipt = `RCT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999 + 1)).padStart(6, "0")}`;
    await supabase.from("fee_payments").update({
      status: "paid", verified_at: new Date().toISOString(), receipt_number: receipt,
    }).eq("id", paymentId);
    toast({ title: "Payment verified", description: `Receipt: ${receipt}` });
    loadPayments();
  };

  const className = (id: string) => classes.find((c) => c.id === id)?.name || "All Classes";
  const sessionName = (id: string) => sessions.find((s) => s.id === id)?.name || "—";

  const filteredPayments = payments.filter((p) => {
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    return true;
  });

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">School Fee Management</h1>
        <p className="text-muted-foreground">Manage fee structures, track payments, and generate receipts</p>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-primary" /></div>
              <div><p className="text-2xl font-bold">₦{analytics.revenue.toLocaleString()}</p><p className="text-sm text-muted-foreground">Total Revenue</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-green-500" /></div>
              <div><p className="text-2xl font-bold">{analytics.paid}</p><p className="text-sm text-muted-foreground">Paid</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center"><Users className="h-5 w-5 text-yellow-500" /></div>
              <div><p className="text-2xl font-bold">{analytics.pending}</p><p className="text-sm text-muted-foreground">Pending</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center"><FileText className="h-5 w-5 text-muted-foreground" /></div>
              <div><p className="text-2xl font-bold">{structures.length}</p><p className="text-sm text-muted-foreground">Fee Types</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="structures"><FileText className="h-4 w-4 mr-1" />Fee Structures</TabsTrigger>
          <TabsTrigger value="payments"><DollarSign className="h-4 w-4 mr-1" />Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="structures">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Fee Structures</CardTitle>
                <Button onClick={() => { setEditingStructure(null); setSForm({ name: "", class_id: "", term_id: "", session_id: sessions[0]?.id || "", amount: 0, description: "", is_compulsory: true }); setStructureDialog(true); }}>
                  <Plus className="h-4 w-4 mr-2" />New Fee
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Session</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {structures.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{className(s.class_id)}</TableCell>
                      <TableCell>{sessionName(s.session_id)}</TableCell>
                      <TableCell>₦{Number(s.amount).toLocaleString()}</TableCell>
                      <TableCell><Badge variant={s.is_compulsory ? "default" : "secondary"}>{s.is_compulsory ? "Compulsory" : "Optional"}</Badge></TableCell>
                      <TableCell className="space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditingStructure(s);
                          setSForm({ name: s.name, class_id: s.class_id || "", term_id: s.term_id || "", session_id: s.session_id, amount: Number(s.amount), description: s.description || "", is_compulsory: s.is_compulsory });
                          setStructureDialog(true);
                        }}><Edit className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteStructure(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {structures.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No fee structures yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Payment Records</CardTitle>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Adm No.</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.student ? `${p.student.first_name} ${p.student.last_name}` : "Unknown"}</TableCell>
                      <TableCell>{p.student?.admission_number || "—"}</TableCell>
                      <TableCell>₦{Number(p.amount_paid).toLocaleString()}</TableCell>
                      <TableCell className="capitalize">{p.payment_method}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "paid" ? "default" : p.status === "pending" ? "secondary" : "destructive"}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{p.receipt_number || "—"}</TableCell>
                      <TableCell>{format(new Date(p.created_at), "dd MMM yyyy")}</TableCell>
                      <TableCell>
                        {p.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => verifyPayment(p.id)}>Verify</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredPayments.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No payment records</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Structure Dialog */}
      <Dialog open={structureDialog} onOpenChange={setStructureDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingStructure ? "Edit" : "New"} Fee Structure</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Fee Name</Label><Input value={sForm.name} onChange={(e) => setSForm({ ...sForm, name: e.target.value })} placeholder="e.g. Tuition Fee" /></div>
            <div><Label>Session</Label>
              <Select value={sForm.session_id} onValueChange={(v) => setSForm({ ...sForm, session_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
                <SelectContent>{sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Class (optional)</Label>
                <Select value={sForm.class_id} onValueChange={(v) => setSForm({ ...sForm, class_id: v })}>
                  <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Term (optional)</Label>
                <Select value={sForm.term_id} onValueChange={(v) => setSForm({ ...sForm, term_id: v })}>
                  <SelectTrigger><SelectValue placeholder="All terms" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Terms</SelectItem>
                    {terms.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Amount (₦)</Label><Input type="number" value={sForm.amount} onChange={(e) => setSForm({ ...sForm, amount: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Description</Label><Input value={sForm.description} onChange={(e) => setSForm({ ...sForm, description: e.target.value })} /></div>
            <div className="flex items-center justify-between"><Label>Compulsory</Label><Switch checked={sForm.is_compulsory} onCheckedChange={(v) => setSForm({ ...sForm, is_compulsory: v })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStructureDialog(false)}>Cancel</Button>
            <Button onClick={saveStructure}>{editingStructure ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
