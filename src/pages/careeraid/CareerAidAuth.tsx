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
import { Compass, Loader2, ArrowRight } from "lucide-react";

export default function CareerAidAuth() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [signUpForm, setSignUpForm] = useState({ full_name: "", email: "", password: "" });
  const [signInForm, setSignInForm] = useState({ email: "", password: "" });

  useEffect(() => {
    if (!isLoading && user) navigate("/careeraid", { replace: true });
  }, [user, isLoading, navigate]);

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
        emailRedirectTo: `${window.location.origin}/careeraid`,
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
        kind: "careeraid",
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
    toast({ title: "Account created", description: "Continue to subscribe to CareerAid Clinic." });
    navigate("/careeraid", { replace: true });
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
    navigate("/careeraid", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/"><Logo /></Link>
          <Link to="/auth"><Button variant="ghost" size="sm">School portal sign in</Button></Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 grid gap-10 lg:grid-cols-2 max-w-5xl">
        <section className="space-y-4">
          <div className="inline-flex items-center gap-2 text-primary text-sm font-medium">
            <Compass className="h-4 w-4" /> CareerAid Clinic
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Career guidance for every student — no school required</h1>
          <p className="text-muted-foreground">
            Create a personal CareerAid account in seconds. You do not need a school code or a school
            affiliation. Take the Personality Assessment, get AI-generated Nigerian career pathways and book
            a live video session with a career counselor for ₦5,000 per year.
          </p>
          <p className="text-sm text-muted-foreground">
            Already a student of a subscribed school?{" "}
            <Link to="/auth" className="text-primary underline">Use the school portal instead</Link> — CareerAid is included.
          </p>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>CareerAid Clinic account</CardTitle>
            <CardDescription>Independent learners sign up and sign in here.</CardDescription>
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
                    <Label htmlFor="ca-name">Full name</Label>
                    <Input id="ca-name" value={signUpForm.full_name}
                      onChange={(e) => setSignUpForm({ ...signUpForm, full_name: e.target.value })} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ca-email">Email</Label>
                    <Input id="ca-email" type="email" value={signUpForm.email}
                      onChange={(e) => setSignUpForm({ ...signUpForm, email: e.target.value })} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ca-pass">Password</Label>
                    <Input id="ca-pass" type="password" value={signUpForm.password}
                      onChange={(e) => setSignUpForm({ ...signUpForm, password: e.target.value })} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Create CareerAid account <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-3 pt-4">
                  <div className="space-y-1">
                    <Label htmlFor="ca-si-email">Email</Label>
                    <Input id="ca-si-email" type="email" value={signInForm.email}
                      onChange={(e) => setSignInForm({ ...signInForm, email: e.target.value })} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ca-si-pass">Password</Label>
                    <Input id="ca-si-pass" type="password" value={signInForm.password}
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
