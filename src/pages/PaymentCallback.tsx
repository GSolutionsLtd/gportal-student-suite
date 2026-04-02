import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2, ArrowLeft, Home } from "lucide-react";

type PaymentStatus = "loading" | "success" | "failed" | "error";

interface PaymentDetails {
  reference: string;
  amount: number;
  paymentType: "school_subscription" | "school_fee" | "unknown";
  label: string;
  destinationLabel: string;
}

export default function PaymentCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<PaymentStatus>("loading");
  const [message, setMessage] = useState("");
  const [details, setDetails] = useState<PaymentDetails | null>(null);

  useEffect(() => {
    const reference = searchParams.get("reference");
    const trxref = searchParams.get("trxref");
    
    const paymentReference = reference || trxref;
    
    if (paymentReference) {
      verifyPayment(paymentReference);
    } else {
      setStatus("error");
      setMessage("No payment reference found. Please try again.");
    }
  }, [searchParams]);

  const verifyPayment = async (reference: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-payment", {
        body: { reference },
      });

      if (error) throw error;

      if (data.success) {
        const paymentType = data.paymentType || "unknown";
        setStatus("success");
        setMessage(
          paymentType === "school_fee"
            ? "Your payment was successful and your fee record has been updated."
            : "Your payment was successful! Your subscription has been activated.",
        );
        setDetails({
          reference: reference,
          amount: data.amount || 0,
          paymentType,
          label: paymentType === "school_fee" ? data.feeName || "School Fee" : data.plan || "Subscription",
          destinationLabel: paymentType === "school_fee" ? "Back to Fees" : "Back to Schools",
        });
      } else {
        setStatus("failed");
        setMessage(data.message || "Payment verification failed. Please contact support.");
      }
    } catch (error: any) {
      console.error("Payment verification error:", error);
      setStatus("error");
      setMessage("An error occurred while verifying your payment. Please contact support.");
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === "loading" && (
            <>
              <div className="mx-auto mb-4">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
              </div>
              <CardTitle>Verifying Payment</CardTitle>
              <CardDescription>
                Please wait while we confirm your payment...
              </CardDescription>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <CardTitle className="text-green-600">Payment Successful!</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}

          {status === "failed" && (
            <>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-10 w-10 text-red-600" />
              </div>
              <CardTitle className="text-red-600">Payment Failed</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-yellow-100 flex items-center justify-center">
                <XCircle className="h-10 w-10 text-yellow-600" />
              </div>
              <CardTitle className="text-yellow-600">Verification Error</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}
        </CardHeader>

        {status === "success" && details && (
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Reference:</span>
                <span className="font-mono">{details.reference}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-semibold">{formatAmount(details.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Type:</span>
                <span>{details.label}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate(details.paymentType === "school_fee" ? "/student/fees" : "/super-admin/schools")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {details.destinationLabel}
              </Button>
              <Button
                className="flex-1"
                onClick={() => navigate(details.paymentType === "school_fee" ? "/student" : "/super-admin")}
              >
                <Home className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </div>
          </CardContent>
        )}

        {(status === "failed" || status === "error") && (
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-lg p-4 text-sm text-muted-foreground">
              <p>If you believe this is an error, please:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Check your bank statement for the transaction</li>
                <li>Contact our support team with your payment reference</li>
                <li>Try making the payment again if necessary</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button
                className="flex-1"
                onClick={() => navigate("/")}
              >
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
