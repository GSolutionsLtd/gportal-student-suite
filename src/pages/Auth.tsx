import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  UserCog, 
  Users, 
  School, 
  GraduationCap,
  Eye,
  EyeOff,
  ArrowLeft,
  Mail,
  Lock,
  User,
  Upload
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserRole, ROLE_LABELS } from "@/types/auth";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolContext } from "@/hooks/useSchoolContext";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const roleIcons: Record<UserRole, typeof UserCog> = {
  super_admin: UserCog,
  admin: Users,
  teacher: School,
  student: GraduationCap,
  parent: Users,
};

const roleColors: Record<UserRole, string> = {
  super_admin: "bg-primary/10 text-primary border-primary/20",
  admin: "bg-accent/10 text-accent border-accent/20",
  teacher: "bg-success/10 text-success border-success/20",
  student: "bg-warning/10 text-warning border-warning/20",
  parent: "bg-secondary text-secondary-foreground border-secondary/20",
};

// Validation schemas
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

interface SchoolOption {
  id: string;
  code: string;
  name: string;
  admin_available?: boolean;
}

export default function Auth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, userRole, signIn, signUp, isLoading: authLoading } = useAuth();
  const { schoolCode, loading: schoolLoading } = useSchoolContext();
  
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(
    (searchParams.get("role") as UserRole) || null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");
  const [adminSignupMode, setAdminSignupMode] = useState<"invite" | "school">("invite");
  
  const [inviteCode, setInviteCode] = useState<string>("");
  const [inviteValidating, setInviteValidating] = useState(false);
  const [validatedInvite, setValidatedInvite] = useState<{ school_id: string; school_code: string; school_name: string; email: string | null } | null>(null);
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    confirmPassword: "",
    staffId: "",
    teacherType: "subject" as "subject" | "class" | "form",
    teacherSignatureUrl: null as string | null,
  });

  // Pre-fill invite code from URL ?invite=XXXX so links can land directly here
  useEffect(() => {
    const code = searchParams.get("invite");
    if (code) {
      setIsLogin(false);
      setSelectedRole("admin");
      setInviteCode(code.toUpperCase());
    }
  }, [searchParams]);

  // Validate the invite code against the backend whenever it changes (debounced via length)
  useEffect(() => {
    if (selectedRole !== "admin" || !inviteCode || inviteCode.length < 6) {
      setValidatedInvite(null);
      return;
    }
    const code = inviteCode.trim().toUpperCase();
    setInviteValidating(true);
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke("school-admin-invites", {
        body: { action: "validate", inviteCode: code },
      });
      if (cancelled) return;
      setInviteValidating(false);
      if (!error && data?.invite) {
        setValidatedInvite(data.invite as typeof validatedInvite extends infer T ? T : never);
      } else {
        setValidatedInvite(null);
      }
    })();
    return () => { cancelled = true; };
  }, [inviteCode, selectedRole]);

  // Fetch available schools for signup dropdown
  useEffect(() => {
    const fetchSchools = async () => {
      const { data, error } = await supabase.functions.invoke("school-admin-invites", {
        body: { action: "list-schools" },
      });
      if (!error && data?.schools) {
        setSchools(data.schools as SchoolOption[]);
      }
    };
    fetchSchools();
  }, []);

  // Redirect if already authenticated - use school-code routes
  useEffect(() => {
    if (!authLoading && !schoolLoading && user && userRole) {
      if (userRole === "super_admin") {
        navigate("/super-admin", { replace: true });
        return;
      }
      if (schoolCode) {
        const roleBase = userRole === "admin" ? "admin" : userRole;
        navigate(`/${schoolCode}/${roleBase}`, { replace: true });
      }
    }
  }, [user, userRole, authLoading, schoolLoading, schoolCode, navigate]);

  const validateForm = () => {
    try {
      if (isLogin) {
        loginSchema.parse(formData);
      } else {
        signupSchema.parse(formData);
      }
      setErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        err.errors.forEach((error) => {
          if (error.path[0]) {
            newErrors[error.path[0] as string] = error.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    if (!isLogin && !selectedRole) {
      toast({
        title: "Role Required",
        description: "Please select your role to create an account.",
        variant: "destructive",
      });
      return;
    }

    // Admin signup can use a validated invite code or an eligible unclaimed school.
    if (!isLogin && selectedRole === "admin") {
      if (adminSignupMode === "school") {
        const selectedSchool = schools.find((school) => school.id === selectedSchoolId);
        if (!selectedSchoolId) {
          toast({
            title: "School Required",
            description: "Please select the school this Admin account will manage.",
            variant: "destructive",
          });
          return;
        }
        if (!selectedSchool?.admin_available) {
          toast({
            title: "School Not Eligible",
            description: "This school is not eligible for primary Admin signup.",
            variant: "destructive",
          });
          return;
        }
      } else {
        if (!inviteCode || inviteCode.length < 6) {
          toast({
            title: "Invite Code Required",
            description: "Enter the invite code provided by the Super Admin.",
            variant: "destructive",
          });
          return;
        }
        if (!validatedInvite) {
          toast({
            title: "Invalid Invite",
            description:
              "This invite code is invalid, expired, already used, or for a school that already has an Admin.",
            variant: "destructive",
          });
          return;
        }
        if (
          validatedInvite.email &&
          validatedInvite.email.toLowerCase() !== formData.email.trim().toLowerCase()
        ) {
          toast({
            title: "Email Mismatch",
            description: `This invite was issued for ${validatedInvite.email}.`,
            variant: "destructive",
          });
          return;
        }
      }
    } else if (!isLogin && selectedRole && !selectedSchoolId) {
      toast({
        title: "School Required",
        description: "Please select the school you belong to.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      if (isLogin) {
        const { error } = await signIn(formData.email, formData.password);
        
        if (error) {
          let message = error.message;
          if (error.message.includes("Invalid login credentials")) {
            message = "Invalid email or password. Please try again.";
          }
          toast({
            title: "Sign In Failed",
            description: message,
            variant: "destructive",
          });
          return;
        }
        
        toast({
          title: "Welcome back!",
          description: "You have successfully signed in.",
        });
      } else {
        const teacherOptions =
          selectedRole === "teacher"
            ? {
                teacher: {
                  staff_id: formData.staffId,
                  is_class_teacher: formData.teacherType === "class",
                  is_form_teacher: formData.teacherType === "form",
                  signature_url: formData.teacherSignatureUrl,
                },
              }
            : undefined;

        const { error } = await signUp(
          formData.email,
          formData.password,
          formData.fullName,
          selectedRole!,
          {
            ...teacherOptions,
            schoolId: selectedRole === "admin" ? (adminSignupMode === "school" ? selectedSchoolId : undefined) : (selectedSchoolId || undefined),
            inviteCode: selectedRole === "admin" && adminSignupMode === "invite" ? inviteCode.trim().toUpperCase() : undefined,
          }
        );
        
        if (error) {
          let message = error.message;
          if (error.message.includes("User already registered")) {
            message = "An account with this email already exists. Please sign in.";
          }
          toast({
            title: "Sign Up Failed",
            description: message,
            variant: "destructive",
          });
          return;
        }
        
        toast({
          title: "Account created!",
          description: `Welcome! Your ${ROLE_LABELS[selectedRole!]} account has been created.`,
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const roles: UserRole[] = ["admin", "teacher", "student", "parent"];

  // All public signup roles are school-scoped in the multi-tenant platform
  const needsSchool = !isLogin && !!selectedRole;
  const eligibleAdminSchools = schools.filter((school) => school.admin_available);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
        
        <div className="relative z-10 flex flex-col justify-center px-12 text-primary-foreground">
          <Logo size="lg" variant="light" />
          <h1 className="text-4xl font-bold mt-8 mb-4">
            Student Result Management System
          </h1>
          <p className="text-lg text-primary-foreground/80 max-w-md">
            Streamline academic result processing with role-based access, 
            automated computations, and secure PIN-based result checking.
          </p>
          
          <div className="mt-12 space-y-4">
            <div className="flex items-center gap-3 text-primary-foreground/80">
              <div className="h-8 w-8 rounded-lg bg-primary-foreground/10 flex items-center justify-center">
                <GraduationCap className="h-4 w-4" />
              </div>
              <span>Manage classes, subjects & academic sessions</span>
            </div>
            <div className="flex items-center gap-3 text-primary-foreground/80">
              <div className="h-8 w-8 rounded-lg bg-primary-foreground/10 flex items-center justify-center">
                <School className="h-4 w-4" />
              </div>
              <span>Teachers can enter and submit results</span>
            </div>
            <div className="flex items-center gap-3 text-primary-foreground/80">
              <div className="h-8 w-8 rounded-lg bg-primary-foreground/10 flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
              <span>Admins approve and publish results</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex flex-col">
        <div className="p-4">
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

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="lg:hidden mb-6">
                <Logo />
              </div>
              <h2 className="text-2xl font-bold text-foreground">
                {isLogin ? "Welcome back" : "Create an account"}
              </h2>
              <p className="text-muted-foreground mt-2">
                {isLogin 
                  ? "Sign in to access your dashboard" 
                  : "Get started with your account"}
              </p>
            </div>

            {/* Role Selection - Only for signup */}
            {!isLogin && (
              <div className="mb-6">
                <Label className="text-sm font-medium mb-3 block">Select your role</Label>
                <div className="grid grid-cols-2 gap-3">
                  {roles.map((role) => {
                    const Icon = roleIcons[role];
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => {
                          setSelectedRole(role);
                          setSelectedSchoolId("");
                        }}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-200",
                          selectedRole === role
                            ? cn(roleColors[role], "border-current")
                            : "border-border hover:border-muted-foreground/30 bg-card"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-sm font-medium">{ROLE_LABELS[role]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Admin signup: choose invite code or eligible school claim */}
            {!isLogin && selectedRole === "admin" && (
              <div className="mb-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 rounded-lg border bg-card p-1">
                  <button type="button" onClick={() => setAdminSignupMode("invite")} className={cn("rounded-md px-3 py-2 text-sm font-medium", adminSignupMode === "invite" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>Invite code</button>
                  <button type="button" onClick={() => setAdminSignupMode("school")} className={cn("rounded-md px-3 py-2 text-sm font-medium", adminSignupMode === "school" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>Select school</button>
                </div>
                {adminSignupMode === "invite" ? (
                  <div>
                    <Label htmlFor="inviteCode" className="text-sm font-medium mb-2 block">Admin Invite Code *</Label>
                    <Input id="inviteCode" placeholder="Paste the 12-character code" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase().replace(/\s/g, ""))} maxLength={32} autoComplete="off" />
                    <div className="text-xs mt-2">
                      {inviteValidating && <span className="text-muted-foreground">Checking invite…</span>}
                      {!inviteValidating && validatedInvite && <span className="text-success">✓ Valid invite for <strong>{validatedInvite.school_name}</strong> ({validatedInvite.school_code}){validatedInvite.email ? ` — must sign up as ${validatedInvite.email}` : ""}</span>}
                      {!inviteValidating && !validatedInvite && inviteCode.length >= 6 && <span className="text-destructive">Invalid, expired, already used, or ineligible.</span>}
                      {!inviteCode && <span className="text-muted-foreground">Ask the Super Admin to issue one for your school.</span>}
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Select eligible school *</Label>
                    <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
                      <SelectTrigger><SelectValue placeholder={eligibleAdminSchools.length === 0 ? "No eligible schools available" : "Choose a school..."} /></SelectTrigger>
                      <SelectContent>{eligibleAdminSchools.map((school) => <SelectItem key={school.id} value={school.id}>{school.name} ({school.code})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* School dropdown for non-admin signup roles */}
            {needsSchool && selectedRole !== "admin" && (
              <div className="mb-4">
                <Label className="text-sm font-medium mb-2 block">Select your school *</Label>
                <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={schools.length === 0 ? "No schools available" : "Choose a school..."}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((school) => (
                      <SelectItem key={school.id} value={school.id}>
                        {school.name} ({school.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Enter your full name"
                      className={cn("pl-10", errors.fullName && "border-destructive")}
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    />
                  </div>
                  {errors.fullName && (
                    <p className="text-sm text-destructive mt-1">{errors.fullName}</p>
                  )}
                </div>
              )}

              {/* Teacher onboarding */}
              {!isLogin && selectedRole === "teacher" && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="staffId">Staff ID *</Label>
                    <Input
                      id="staffId"
                      placeholder="e.g., TCH001"
                      value={formData.staffId}
                      onChange={(e) => setFormData({ ...formData, staffId: e.target.value.toUpperCase() })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">This is required to create your teacher record.</p>
                  </div>

                  <div>
                    <Label>Are you a Class teacher or Form teacher?</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                      <button
                        type="button"
                        className={cn(
                          "border rounded-lg p-3 text-sm text-left transition-colors",
                          formData.teacherType === "subject" ? "bg-secondary" : "hover:bg-secondary/50"
                        )}
                        onClick={() => setFormData({ ...formData, teacherType: "subject" })}
                      >
                        <div className="font-medium">No</div>
                        <div className="text-xs text-muted-foreground">Subject teacher</div>
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "border rounded-lg p-3 text-sm text-left transition-colors",
                          formData.teacherType === "class" ? "bg-secondary" : "hover:bg-secondary/50"
                        )}
                        onClick={() => setFormData({ ...formData, teacherType: "class" })}
                      >
                        <div className="font-medium">Class teacher</div>
                        <div className="text-xs text-muted-foreground">Upload signature</div>
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "border rounded-lg p-3 text-sm text-left transition-colors",
                          formData.teacherType === "form" ? "bg-secondary" : "hover:bg-secondary/50"
                        )}
                        onClick={() => setFormData({ ...formData, teacherType: "form" })}
                      >
                        <div className="font-medium">Form teacher</div>
                        <div className="text-xs text-muted-foreground">Upload signature</div>
                      </button>
                    </div>
                  </div>

                  {(formData.teacherType === "class" || formData.teacherType === "form") && (
                    <div>
                      <Label>Signature (optional now)</Label>
                      <div className="flex items-center gap-3 flex-wrap mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2"
                          onClick={() => document.getElementById("signup-teacher-signature")?.click()}
                        >
                          <Upload className="h-4 w-4" />
                          Upload signature
                        </Button>
                        <input
                          id="signup-teacher-signature"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => setFormData({ ...formData, teacherSignatureUrl: String(reader.result) });
                            reader.readAsDataURL(file);
                          }}
                        />
                        <p className="text-xs text-muted-foreground">PNG/JPG recommended. Keep it small.</p>
                      </div>
                      {formData.teacherSignatureUrl && (
                        <div className="border rounded-lg p-3 mt-2">
                          <img
                            src={formData.teacherSignatureUrl}
                            alt="Teacher signature preview"
                            className="h-14 object-contain"
                            loading="lazy"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    className={cn("pl-10", errors.email && "border-destructive")}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive mt-1">{errors.email}</p>
                )}
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    className={cn("pl-10 pr-10", errors.password && "border-destructive")}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive mt-1">{errors.password}</p>
                )}
              </div>

              {!isLogin && (
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      className={cn("pl-10", errors.confirmPassword && "border-destructive")}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive mt-1">{errors.confirmPassword}</p>
                  )}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    {isLogin ? "Signing in..." : "Creating account..."}
                  </span>
                ) : (
                  isLogin ? "Sign In" : "Create Account"
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                }}
                className="text-primary font-medium hover:underline"
              >
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
