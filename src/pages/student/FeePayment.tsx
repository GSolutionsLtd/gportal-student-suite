import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, DollarSign, CheckCircle, Clock, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function FeePayment() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [fees, setFees] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [paying, setPaying] = useState<string | null>(null);

  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    setLoading(true);
    const { data: student } = await supabase.from("students").select("id, current_class_arm_id").eq("user_id", user!.id).maybeSingle();
    if (!student) { setLoading(false); return; }
    setStudentId(student.id);

    // Get class for this student
    let classId: string | null = null;
    if (student.current_class_arm_id) {
      const { data: arm } = await supabase.from("class_arms").select("class_id").eq("id", student.current_class_arm_id).maybeSingle();
      classId = arm?.class_id || null;
    }

    // Load applicable fee structures
    const { data: allFees } = await supabase.from("fee_structures").select("*").eq("is_active", true);
    const applicable = (allFees || []).filter((f) => !f.class_id || f.class_id === classId);
    setFees(applicable);

    // Load my payments
    const { data: myPayments } = await supabase.from("fee_payments").select("*").eq("student_id", student.id).order("created_at", { ascending: false });
    setPayments(myPayments || []);
    setLoading(false);
  };

  const isPaid = (feeId: string) => payments.some((p) => p.fee_structure_id === feeId && p.status === "paid");
  const isPending = (feeId: string) => payments.some((p) => p.fee_structure_id === feeId && p.status === "pending");

  const initPayment = async (fee: any) => {
    if (!studentId) return;
    setPaying(fee.id);
    try {
      // Create payment record
      const { data: payment, error } = await supabase.from("fee_payments").insert({
        student_id: studentId,
        fee_structure_id: fee.id,
        amount_paid: fee.amount,
        payment_method: "online",
        status: "pending",
      }).select("id").single();

      if (error) throw error;

      // Initialize Paystack payment
      const { data: initData, error: initError } = await supabase.functions.invoke("initialize-payment", {
        body: {
          email: user!.email,
          amount: Math.round(Number(fee.amount) * 100),
          reference: `FEE-${payment.id}`,
          callback_url: `${window.location.origin}/payment/callback`,
          metadata: { payment_id: payment.id, fee_name: fee.name, type: "school_fee" },
        },
      });

      if (initError) throw initError;
      if (initData?.authorization_url) {
        window.location.href = initData.authorization_url;
      } else {
        toast({ title: "Payment initialized", description: "Please complete the payment." });
        loadData();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setPaying(null);
    }
  };

  const totalDue = fees.reduce((sum, f) => sum + (isPaid(f.id) ? 0 : Number(f.amount)), 0);
  const totalPaid = payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + Number(p.amount_paid), 0);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">School Fees</h1>
        <p className="text-muted-foreground">View and pay your school fees online</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-destructive" /></div>
              <div><p className="text-2xl font-bold">₦{totalDue.toLocaleString()}</p><p className="text-sm text-muted-foreground">Outstanding</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center"><CheckCircle className="h-5 w-5 text-green-500" /></div>
              <div><p className="text-2xl font-bold">₦{totalPaid.toLocaleString()}</p><p className="text-sm text-muted-foreground">Total Paid</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><CreditCard className="h-5 w-5 text-primary" /></div>
              <div><p className="text-2xl font-bold">{fees.length}</p><p className="text-sm text-muted-foreground">Fee Items</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fee Items */}
      <Card>
        <CardHeader><CardTitle>Fee Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {fees.map((fee) => {
              const paid = isPaid(fee.id);
              const pending = isPending(fee.id);

              return (
                <div key={fee.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{fee.name}</p>
                    {fee.description && <p className="text-sm text-muted-foreground">{fee.description}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={fee.is_compulsory ? "default" : "secondary"} className="text-xs">
                        {fee.is_compulsory ? "Compulsory" : "Optional"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-lg">₦{Number(fee.amount).toLocaleString()}</p>
                    {paid ? (
                      <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Paid</Badge>
                    ) : pending ? (
                      <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
                    ) : (
                      <Button size="sm" onClick={() => initPayment(fee)} disabled={paying === fee.id}>
                        {paying === fee.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CreditCard className="h-4 w-4 mr-1" />}
                        Pay Now
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {fees.length === 0 && <p className="text-center text-muted-foreground py-8">No fees applicable at this time</p>}
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      {payments.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{format(new Date(p.created_at), "dd MMM yyyy")}</TableCell>
                    <TableCell>₦{Number(p.amount_paid).toLocaleString()}</TableCell>
                    <TableCell className="capitalize">{p.payment_method}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "paid" ? "default" : "secondary"}>{p.status}</Badge>
                    </TableCell>
                    <TableCell>{p.receipt_number || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
