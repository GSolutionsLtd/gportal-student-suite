import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";
import { Loader2, Video, Wallet, Users } from "lucide-react";

export default function CounselorAuth() {
  const navigate = useNavigate();
  const { user, userRole, isLoading } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [signUpForm, setSignUpForm] = useState({ full_name: "", email: "", password: "" });
  const [signInForm, setSignInForm] = useState({ email: "", password: "" });

  useEffect(() => {
    if (!isLoading && user && userRole === "counselor") navigate("/counselor", { replace: true });
  }, [user, userRole, isLoading, navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signUpForm.full_name.trim().length < 2) {
      return toast({ title: "Enter your full name", variant: "destructive" });
    }
    if (signUpForm.password.length < 6) {
      return toast({ title: "Password must be at least 6 characters", variant: "destructive" });
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: signUpForm.email.trim(),
      password: signUpForm.password,
      options: {
        emailRedirectTo: `${window.location.origin}/counselor`,
        data: { full_name: signUpForm.full_name.trim() },
      },
    });
    if (error || !data.user) {
      setBusy(false);
      return toast({ title: "Sign up failed", description: error?.message, variant: "destructive" });
    }
    const { data: fn, error: fnErr } = await supabase.functions.invoke("public-signup", {
      body: {
        userId: data.user.id,
        email: signUpForm.email.trim(),
        fullName: signUpForm.full_name.trim(),
        kind: "counselor",
      },
    });
    setBusy(false);
    if (fnErr || (fn as any)?.error) {
      return toast({
        title: "Could not finish sign up",
        description: (fn as any)?.error || fnErr?.message,
        variant: "destructive",
      });
    }
    toast({ title: "Counselor account created", description: "Signing you into your dashboard." });
    window.location.assign("/counselor");
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: signInForm.email.trim(),
      password: signInForm.password,
    });
    setBusy(false);
    if (error) return toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
    window.location.assign("/counselor");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/"><Logo /></Link>
          <Link to="/careeraid"><Button variant="ghost" size="sm">CareerAid Clinic</Button></Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 grid gap-10 lg:grid-cols-2 max-w-5xl">
        <section className="space-y-4">
          <div className="inline-flex items-center gap-2 text-primary text-sm font-medium">
            <Video className="h-4 w-4" /> Career Counselors
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Counsel students across Nigeria and get paid monthly</h1>
          <p className="text-muted-foreground">
            Career Counselors join independently — no school code needed. Accept live video guidance
            requests from students of subscribed schools and independent CareerAid subscribers.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Manage your own session queue and schedule.</li>
            <li className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> Earn ₦2,000 per student counseled each month.</li>
            <li className="flex items-center gap-2"><Video className="h-4 w-4 text-primary" /> Withdrawals unlock on the 28th of every month.</li>
          </ul>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Career Counselor account</CardTitle>
            <CardDescription>Public sign-up and sign-in for counselors.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signup">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="signup">Sign up</TabsTrigger>
                <TabsTrigger value="signin">Sign in</TabsTrigger>
              </TabsList>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-3 pt-4">
                  <div className="space-y-1">
                    <Label htmlFor="co-name">Full name</Label>
                    <Input id="co-name" value={signUpForm.full_name}
                      onChange={(e) => setSignUpForm({ ...signUpForm, full_name: e.target.value })} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="co-email">Email</Label>
                    <Input id="co-email" type="email" value={signUpForm.email}
                      onChange={(e) => setSignUpForm({ ...signUpForm, email: e.target.value })} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="co-pass">Password</Label>
                    <Input id="co-pass" type="password" value={signUpForm.password}
                      onChange={(e) => setSignUpForm({ ...signUpForm, password: e.target.value })} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Create counselor account
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-3 pt-4">
                  <div className="space-y-1">
                    <Label htmlFor="co-si-email">Email</Label>
                    <Input id="co-si-email" type="email" value={signInForm.email}
                      onChange={(e) => setSignInForm({ ...signInForm, email: e.target.value })} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="co-si-pass">Password</Label>
                    <Input id="co-si-pass" type="password" value={signInForm.password}
                      onChange={(e) => setSignInForm({ ...signInForm, password: e.target.value })} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Sign in
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
