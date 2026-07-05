import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  GraduationCap,
  Users,
  BookOpen,
  BarChart3,
  Shield,
  FileCheck,
  School,
  ClipboardList,
  Wallet,
  MessagesSquare,
  Sparkles,
  Brain,
  CalendarCheck,
  Compass,
  Cloud,
  Smartphone,
  Zap,
  Building2,
  Layers,
  Lock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  PlayCircle,
  Phone,
  Star,
  Quote,
  TrendingUp,
  Cpu,
  Rocket,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { ProductTourModal } from "@/components/ProductTourModal";
import { trackCta } from "@/lib/trackCta";

// Animated counter
function Counter({ end, suffix = "", label }: { end: number; suffix?: string; label: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !started.current) {
            started.current = true;
            const duration = 1600;
            const start = performance.now();
            const step = (now: number) => {
              const p = Math.min(1, (now - start) / duration);
              const eased = 1 - Math.pow(1 - p, 3);
              setVal(Math.floor(eased * end));
              if (p < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
          }
        });
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [end]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-4xl md:text-5xl font-bold text-primary tracking-tight">
        {val.toLocaleString()}
        {suffix}
      </div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

const modules = [
  {
    icon: ClipboardList,
    title: "Student Result Management",
    desc: "Compute results, PIN-based checker, broadsheets, cumulative reports, automated report cards & positioning.",
  },
  {
    icon: FileCheck,
    title: "CBT Examination",
    desc: "Timed exams, question banks, auto-marking, practice tests and detailed performance analytics.",
  },
  {
    icon: Wallet,
    title: "Fees & Finance",
    desc: "Online payments, invoicing, tracking, outstanding balances and a real-time revenue dashboard.",
  },
  {
    icon: BookOpen,
    title: "Assignments",
    desc: "Create, submit, grade and analyse assignments in one streamlined teacher-student workflow.",
  },
  {
    icon: Sparkles,
    title: "AI Lesson Planner",
    desc: "Upload curriculum and auto-generate editable lesson plans and lesson notes in seconds.",
  },
  {
    icon: CalendarCheck,
    title: "Attendance",
    desc: "Student & teacher attendance, daily reports, analytics and instant parent notifications.",
  },
  {
    icon: MessagesSquare,
    title: "Parent Engagement",
    desc: "Parent portal for progress, fees, announcements and secure messaging with teachers.",
  },
  {
    icon: Compass,
    title: "CareerAid Clinic",
    desc: "Personality test, career recommendations, JAMB combinations, mock interviews & video counselling.",
  },
  {
    icon: Brain,
    title: "AI Academic Analytics",
    desc: "Predict outcomes, detect at-risk students, spot trends and get actionable AI recommendations.",
  },
];

const traditional = [
  "Fragmented software for each task",
  "Manual, paper-based reporting",
  "No AI or predictive insight",
  "Limited analytics",
  "Weak parent engagement",
  "Hard to scale across campuses",
];

const gportal = [
  "One unified platform",
  "AI-powered decision support",
  "Bank-grade security",
  "Automated end-to-end workflows",
  "Mobile & PWA ready",
  "Multi-campus, enterprise-scalable",
];

const benefits = [
  { icon: Zap, title: "Save admin time", desc: "Automate results, fees, attendance and reports." },
  { icon: TrendingUp, title: "Improve outcomes", desc: "AI flags at-risk learners early." },
  { icon: Wallet, title: "Grow revenue", desc: "Online fees & clear collection tracking." },
  { icon: Layers, title: "Cut paperwork", desc: "Digital records, archives and audit trails." },
  { icon: MessagesSquare, title: "Engage parents", desc: "Real-time progress & school updates." },
  { icon: BarChart3, title: "Decide with data", desc: "Dashboards for every stakeholder." },
];

const audience = [
  { icon: School, title: "Nursery Schools" },
  { icon: BookOpen, title: "Primary Schools" },
  { icon: GraduationCap, title: "Secondary Schools" },
  { icon: Building2, title: "Colleges" },
  { icon: Layers, title: "Educational Groups" },
  { icon: Rocket, title: "Multi-Campus Schools" },
];

const platformFeatures = [
  { icon: Cloud, label: "Cloud-based" },
  { icon: Shield, label: "Secure" },
  { icon: Users, label: "Multi-user" },
  { icon: Smartphone, label: "Mobile responsive" },
  { icon: Zap, label: "Progressive Web App" },
  { icon: Cpu, label: "AI-powered" },
  { icon: Building2, label: "Multi-campus" },
  { icon: Sparkles, label: "White-label ready" },
  { icon: Lock, label: "Enterprise security" },
];

const testimonials = [
  {
    quote:
      "GPortal Suite replaced three separate tools we were juggling. Results, fees and parent messaging now live in one place.",
    name: "Mrs. A. Okonkwo",
    role: "Principal, Bright Future Academy",
  },
  {
    quote:
      "The AI analytics flagged struggling students before their mid-term. That single feature justified the whole platform.",
    name: "Mr. K. Balogun",
    role: "Head Teacher, Crestfield College",
  },
  {
    quote:
      "As a parent, I finally see my child's results, attendance and fee status without calling the school office.",
    name: "Dr. E. Adeyemi",
    role: "Parent",
  },
];

const faqs = [
  {
    q: "Can we use only selected modules?",
    a: "Yes. Modules are enabled per school. Start with what you need and switch on more as you grow.",
  },
  {
    q: "Is training provided for staff?",
    a: "Every onboarded school receives structured training for admins, teachers and support staff, plus ongoing documentation.",
  },
  {
    q: "Can parents access results securely?",
    a: "Yes. Parents use secure logins or PIN-based result checkers with full audit trails.",
  },
  {
    q: "Can schools customise branding?",
    a: "Absolutely. Logos, colours, letterheads, signatures and report card templates are all configurable.",
  },
  {
    q: "Is the platform cloud-based?",
    a: "Yes. Fully cloud-hosted, PWA-enabled, and accessible on any device with a browser.",
  },
  {
    q: "Can multiple campuses share one account?",
    a: "Yes. Multi-tenant architecture supports groups of schools with per-campus isolation and central oversight.",
  },
];

export default function Index() {
  const navigate = useNavigate();
  const [tourOpen, setTourOpen] = useState(false);
  const goContact = (source: string) => {
    trackCta(source);
    navigate(`/contact?source=${encodeURIComponent(source)}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#modules" className="hover:text-primary transition-colors">Modules</a>
            <a href="#why" className="hover:text-primary transition-colors">Why GPortal</a>
            <a href="#ai" className="hover:text-primary transition-colors">AI</a>
            <a href="#faq" className="hover:text-primary transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/check-result")}>
              Check Result
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
            <Button variant="hero" size="sm" className="hidden sm:inline-flex" onClick={() => goContact("header_request_demo")}>
              Request Demo
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 gradient-hero opacity-[0.04]" />
        <div className="absolute -top-20 -left-20 w-[28rem] h-[28rem] bg-primary/20 rounded-full blur-3xl animate-pulse-soft" />
        <div className="absolute bottom-0 -right-20 w-[28rem] h-[28rem] bg-primary-glow/20 rounded-full blur-3xl animate-pulse-soft" />

        <div className="container mx-auto px-4 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6 animate-fade-in">
                <Sparkles className="h-3.5 w-3.5" />
                AI-Powered School Digital Operating System
              </div>
              <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-[1.1] animate-slide-up">
                Run Your Entire School on One{" "}
                <span className="bg-clip-text text-transparent gradient-primary">Intelligent Platform</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl animate-slide-up" style={{ animationDelay: "100ms" }}>
                GPortal Suite empowers schools to manage academics, examinations, finance, assignments,
                communication, attendance, career guidance and AI-powered analytics — all from one secure cloud platform.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 animate-slide-up" style={{ animationDelay: "200ms" }}>
                <Button size="xl" variant="hero" onClick={() => goContact("hero_request_demo")}>
                  Request Demo <ArrowRight className="h-5 w-5" />
                </Button>
                <Button size="xl" variant="outline" onClick={() => setTourOpen(true)}>
                  <PlayCircle className="h-5 w-5" /> Watch Product Tour
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-6 italic">
                "Where Smart Schools Go Digital."
              </p>
            </div>

            {/* Mockup */}
            <div className="relative animate-scale-in">
              <div className="relative rounded-2xl overflow-hidden shadow-glow border border-border/50 bg-card">
                <div className="h-8 bg-secondary flex items-center gap-1.5 px-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-success/60" />
                </div>
                <div className="p-5 gradient-hero">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { l: "Students", v: "1,284" },
                      { l: "Results", v: "98%" },
                      { l: "Revenue", v: "₦4.2M" },
                    ].map((s) => (
                      <div key={s.l} className="glass rounded-lg p-3">
                        <div className="text-xs text-primary-foreground/70">{s.l}</div>
                        <div className="text-lg font-bold text-primary-foreground">{s.v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="glass rounded-lg p-4 h-40 flex items-end gap-2">
                    {[40, 65, 50, 80, 60, 90, 75].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-gradient-to-t from-primary to-primary-glow"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              {/* Floating phone */}
              <div className="hidden md:block absolute -bottom-8 -left-8 w-40 rounded-2xl overflow-hidden shadow-lg border-4 border-card bg-card">
                <div className="p-3 gradient-primary text-primary-foreground text-xs font-semibold">GPortal Mobile</div>
                <div className="p-3 space-y-2">
                  {["Attendance", "New result", "Fee due"].map((t) => (
                    <div key={t} className="text-xs p-2 rounded bg-secondary text-foreground">{t}</div>
                  ))}
                </div>
              </div>
              {/* Floating icons */}
              <div className="absolute -top-6 -right-4 h-14 w-14 rounded-2xl gradient-primary shadow-lg flex items-center justify-center animate-pulse-soft">
                <Brain className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="py-16 border-y border-border bg-secondary/30">
        <div className="container mx-auto px-4">
          <p className="text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Trusted by schools for
          </p>
          <p className="text-center text-foreground font-medium mb-10">
            Academic Excellence · Digital Transformation · Operational Efficiency · Secure Data Management
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            <Counter end={120} suffix="+" label="Schools Onboarded" />
            <Counter end={3400} suffix="+" label="Teachers" />
            <Counter end={58000} suffix="+" label="Students" />
            <Counter end={215000} suffix="+" label="Results Processed" />
            <Counter end={12400} suffix="+" label="CBT Exams" />
          </div>
        </div>
      </section>

      {/* MODULES */}
      <section id="modules" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
              Complete Product Ecosystem
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">One platform. Every school workflow.</h2>
            <p className="text-muted-foreground">
              Nine deeply-integrated modules replace the patchwork of tools schools use today.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {modules.map((m, i) => (
              <Card
                key={m.title}
                className="group p-6 hover:shadow-glow hover:border-primary/40 transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center shadow-md mb-4 group-hover:scale-110 transition-transform">
                  <m.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{m.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{m.desc}</p>
                <Button variant="link" size="sm" className="px-0 h-auto text-primary" onClick={() => goContact(`module_${m.title}`)}>
                  Learn more <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* WHY */}
      <section id="why" className="py-24 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why GPortal Suite?</h2>
            <p className="text-muted-foreground">See how we compare to traditional school systems.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            <Card className="p-8 border-destructive/20">
              <h3 className="font-semibold text-xl mb-6 text-muted-foreground">Traditional School Systems</h3>
              <ul className="space-y-3">
                {traditional.map((t) => (
                  <li key={t} className="flex items-start gap-3 text-sm">
                    <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{t}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-8 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent shadow-glow">
              <h3 className="font-semibold text-xl mb-6 text-primary">GPortal Suite</h3>
              <ul className="space-y-3">
                {gportal.map((t) => (
                  <li key={t} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-foreground font-medium">{t}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Platform Benefits</h2>
            <p className="text-muted-foreground">Real outcomes for administrators, teachers, students and parents.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {benefits.map((b) => (
              <div key={b.title} className="p-6 rounded-2xl border border-border/60 hover:border-primary/40 hover:bg-primary/[0.03] transition-all">
                <b.icon className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1">{b.title}</h3>
                <p className="text-sm text-muted-foreground">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI */}
      <section id="ai" className="py-24 gradient-hero text-primary-foreground relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-glow/20 rounded-full blur-3xl" />
        <div className="container mx-auto px-4 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-foreground/10 text-primary-foreground text-xs font-semibold mb-6">
                <Brain className="h-3.5 w-3.5" /> AI Advantage
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
                Meet Your School's AI Assistant
              </h2>
              <p className="text-primary-foreground/80 mb-8 text-lg">
                GPortal Suite uses Artificial Intelligence to give schools superpowers — from teaching support to
                strategic decision-making.
              </p>
              <ul className="space-y-3">
                {[
                  "Identify struggling learners early",
                  "Predict academic outcomes",
                  "Generate lesson notes instantly",
                  "Analyse school-wide performance",
                  "Recommend career paths for students",
                  "Support data-driven educational decisions",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-primary-glow shrink-0 mt-0.5" />
                    <span className="text-primary-foreground/90">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="glass rounded-3xl p-8 border-primary-foreground/10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-12 w-12 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
                    <Cpu className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <div className="font-semibold text-primary-foreground">GPortal AI</div>
                    <div className="text-xs text-primary-foreground/60">Analysing school data…</div>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { l: "5 students at academic risk in JSS2", t: "Insight" },
                    { l: "Suggest tutoring group for Mathematics", t: "Action" },
                    { l: "Fee collection trending +18% this term", t: "Trend" },
                  ].map((c) => (
                    <div key={c.l} className="rounded-xl p-4 bg-primary-foreground/5 border border-primary-foreground/10">
                      <div className="text-[10px] uppercase tracking-wider text-primary-glow font-semibold">{c.t}</div>
                      <div className="text-sm text-primary-foreground mt-1">{c.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHO WE SERVE */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Who We Serve</h2>
            <p className="text-muted-foreground">Purpose-built for every stage of Nigerian and African education.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {audience.map((a) => (
              <div key={a.title} className="p-6 rounded-2xl border border-border/60 text-center hover:border-primary/40 hover:shadow-md transition-all">
                <a.icon className="h-8 w-8 text-primary mx-auto mb-3" />
                <div className="text-sm font-medium">{a.title}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLATFORM FEATURES */}
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Platform Features</h2>
            <p className="text-muted-foreground">Built to enterprise standards from day one.</p>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-4 max-w-6xl mx-auto">
            {platformFeatures.map((p) => (
              <div key={p.label} className="flex flex-col items-center text-center gap-2 p-3">
                <div className="h-12 w-12 rounded-xl bg-card border border-border shadow-sm flex items-center justify-center">
                  <p.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="text-xs font-medium text-muted-foreground">{p.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Loved by Schools & Families</h2>
            <p className="text-muted-foreground">Real feedback from principals, teachers and parents.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <Card key={t.name} className="p-6 hover:shadow-lg transition-all">
                <Quote className="h-8 w-8 text-primary/30 mb-3" />
                <p className="text-sm text-foreground leading-relaxed mb-6">{t.quote}</p>
                <div className="flex items-center gap-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-warning text-warning" />
                  ))}
                </div>
                <div className="font-semibold text-sm">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.role}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 bg-secondary/30">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Frequently Asked Questions</h2>
            <p className="text-muted-foreground">Everything you need to know before onboarding.</p>
          </div>
          <Accordion type="single" collapsible className="bg-card rounded-2xl border border-border px-6">
            {faqs.map((f, i) => (
              <AccordionItem key={f.q} value={`item-${i}`} className="border-b last:border-0">
                <AccordionTrigger className="text-left font-semibold">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="relative rounded-3xl overflow-hidden gradient-primary p-12 md:p-16 text-center shadow-glow">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 left-1/4 w-64 h-64 bg-primary-foreground/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-primary-foreground/20 rounded-full blur-3xl" />
            </div>
            <div className="relative">
              <h2 className="text-3xl md:text-5xl font-bold text-primary-foreground mb-4">
                Ready to Transform Your School?
              </h2>
              <p className="text-primary-foreground/80 max-w-xl mx-auto mb-8">
                Join the schools already going digital with GPortal Suite. Book a live demo or talk to our sales team today.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button size="xl" variant="secondary" onClick={() => goContact("cta_book_live_demo")}>
                  Book a Live Demo <ArrowRight className="h-5 w-5" />
                </Button>
                <Button size="xl" variant="outline" onClick={() => goContact("cta_contact_sales")} className="bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                  <Phone className="h-5 w-5" /> Contact Sales
                </Button>
                <Button size="xl" variant="ghost" onClick={() => goContact("cta_free_consultation")} className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                  Start Free Consultation
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-sidebar text-sidebar-foreground pt-16 pb-8">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div>
              <Logo variant="light" />
              <p className="text-sm text-sidebar-foreground/70 mt-4 max-w-xs">
                Where Smart Schools Go Digital. The complete AI-powered School Digital Operating System.
              </p>
              <div className="mt-5 text-sm space-y-1">
                <div className="flex items-center gap-2 text-sidebar-foreground/80">
                  <Phone className="h-4 w-4" /> 07039485184
                </div>
                <div className="flex items-center gap-2 text-sidebar-foreground/80">
                  <Phone className="h-4 w-4" /> 07084336702
                </div>
              </div>
            </div>
            <div>
              <div className="font-semibold mb-4 text-sidebar-foreground">Product Modules</div>
              <ul className="space-y-2 text-sm text-sidebar-foreground/70">
                {[
                  "Result Management",
                  "CBT Examinations",
                  "Fees & Finance",
                  "Assignments",
                  "AI Lesson Planner",
                  "CareerAid Clinic",
                ].map((m) => (
                  <li key={m}>
                    <button
                      type="button"
                      onClick={() => goContact(`footer_module_${m}`)}
                      className="hover:text-sidebar-foreground text-left"
                    >
                      {m}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="font-semibold mb-4 text-sidebar-foreground">Quick Links</div>
              <ul className="space-y-2 text-sm text-sidebar-foreground/70">
                <li><a href="#modules" className="hover:text-sidebar-foreground">Modules</a></li>
                <li><a href="#why" className="hover:text-sidebar-foreground">Why GPortal</a></li>
                <li><a href="#ai" className="hover:text-sidebar-foreground">AI Advantage</a></li>
                <li><a href="#faq" className="hover:text-sidebar-foreground">FAQ</a></li>
                <li><a href="/contact" className="hover:text-sidebar-foreground">Contact Sales</a></li>
                <li><a href="/auth" className="hover:text-sidebar-foreground">Sign In</a></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold mb-4 text-sidebar-foreground">Company</div>
              <ul className="space-y-2 text-sm text-sidebar-foreground/70">
                <li>Geekie I-Solutions Limited</li>
                <li>Privacy Policy</li>
                <li>Terms of Service</li>
                <li>Support</li>
                <li>Social Media</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-sidebar-border pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-sidebar-foreground/60">
            <div>© {new Date().getFullYear()} Geekie I-Solutions Limited. All rights reserved.</div>
            <div>GPortal Suite — Where Smart Schools Go Digital.</div>
          </div>
        </div>
      </footer>
      <ProductTourModal open={tourOpen} onOpenChange={setTourOpen} source="homepage_hero" />
    </div>
  );
}
