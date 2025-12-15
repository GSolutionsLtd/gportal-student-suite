import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { FeatureCard } from "@/components/FeatureCard";
import { RoleCard } from "@/components/RoleCard";
import { 
  GraduationCap, 
  Users, 
  BookOpen, 
  BarChart3, 
  Shield, 
  FileCheck,
  UserCog,
  School,
  ClipboardList,
  Key,
  ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const features = [
  {
    icon: BookOpen,
    title: "Academic Management",
    description: "Configure sessions, terms, classes, subjects, and grading scales with ease.",
  },
  {
    icon: ClipboardList,
    title: "Result Processing",
    description: "Automated score computation with configurable weights for tests and exams.",
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    description: "Comprehensive performance insights with exportable reports.",
  },
  {
    icon: Shield,
    title: "Secure Access",
    description: "PIN-based result checking with role-based access control.",
  },
];

const roles = [
  {
    icon: UserCog,
    title: "Super Admin",
    description: "Full system control and configuration",
    color: "primary" as const,
    route: "/auth?role=super_admin",
  },
  {
    icon: Users,
    title: "Admin",
    description: "Academic setup and result management",
    color: "accent" as const,
    route: "/auth?role=admin",
  },
  {
    icon: School,
    title: "Teacher",
    description: "Score entry and class management",
    color: "success" as const,
    route: "/auth?role=teacher",
  },
  {
    icon: GraduationCap,
    title: "Student",
    description: "View results and academic records",
    color: "warning" as const,
    route: "/auth?role=student",
  },
];

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/check-result")}>
              Check Result
            </Button>
            <Button variant="outline" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 gradient-hero opacity-5" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-fade-in">
              <FileCheck className="h-4 w-4" />
              Student Result Management System
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 animate-slide-up leading-tight">
              Manage Academic Results{" "}
              <span className="text-primary">Effortlessly</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 animate-slide-up" style={{ animationDelay: "100ms" }}>
              A comprehensive platform for schools to manage academic sessions, 
              process results, and provide secure access to students and parents.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: "200ms" }}>
              <Button size="xl" variant="hero" onClick={() => navigate("/auth")}>
                Get Started
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button size="xl" variant="outline" onClick={() => navigate("/check-result")}>
                <Key className="h-5 w-5" />
                Check Result with PIN
              </Button>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                delay={300 + index * 100}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Roles Section */}
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Choose Your Portal
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Access the system based on your role. Each portal is tailored to 
              provide the features and functionality you need.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {roles.map((role, index) => (
              <RoleCard
                key={role.title}
                icon={role.icon}
                title={role.title}
                description={role.description}
                color={role.color}
                onClick={() => navigate(role.route)}
                delay={index * 100}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Logo size="sm" />
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} GPortal Suite. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
