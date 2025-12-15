import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft,
  Key,
  Hash,
  Search,
  ShieldCheck
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CheckResult() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    registrationNumber: "",
    pin: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.registrationNumber || !formData.pin) {
      toast({
        title: "Missing Information",
        description: "Please enter both registration number and PIN.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    // TODO: Implement actual result checking
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Result Not Found",
        description: "Invalid credentials or no result available.",
        variant: "destructive",
      });
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="glass border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl gradient-primary mb-6">
              <Search className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Check Your Result
            </h1>
            <p className="text-muted-foreground">
              Enter your registration number and result PIN to view your academic results.
            </p>
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 shadow-lg">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="registrationNumber">Registration Number</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="registrationNumber"
                    type="text"
                    placeholder="e.g., STU/2024/001"
                    className="pl-10"
                    value={formData.registrationNumber}
                    onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="pin">Result PIN</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="pin"
                    type="text"
                    placeholder="Enter your 12-digit PIN"
                    className="pl-10 tracking-widest"
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value.toUpperCase() })}
                    maxLength={12}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Your PIN was provided by your school. Contact admin if lost.
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                variant="hero"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Checking...
                  </span>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Check Result
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-border">
              <div className="flex items-start gap-3 text-sm text-muted-foreground">
                <ShieldCheck className="h-5 w-5 text-success flex-shrink-0" />
                <p>
                  Your result information is secure. Each PIN can only be used a 
                  limited number of times as set by your school.
                </p>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Need help?{" "}
            <button
              type="button"
              className="text-primary font-medium hover:underline"
            >
              Contact your school administrator
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
