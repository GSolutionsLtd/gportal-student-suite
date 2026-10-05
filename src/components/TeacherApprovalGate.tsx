import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Clock, Loader2, XCircle } from "lucide-react";

export function TeacherApprovalGate({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const [status, setStatus] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from("teachers")
      .select("approval_status")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }: any) => setStatus(data?.approval_status ?? "approved"));
  }, [user]);

  if (status === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "approved") return <>{children}</>;

  const rejected = status === "rejected";
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-4">
        {rejected ? <XCircle className="mx-auto h-12 w-12 text-destructive" /> : <Clock className="mx-auto h-12 w-12 text-primary" />}
        <h2 className="text-xl font-bold">{rejected ? "Account not approved" : "Waiting for approval"}</h2>
        <p className="text-muted-foreground">
          {rejected
            ? "Your school administrator did not approve this teacher account. Please contact the school."
            : "Your teacher account has been created. Your school administrator needs to approve it before you can use the portal."}
        </p>
        <Button variant="outline" onClick={async () => { await signOut(); window.location.replace("/auth"); }}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
