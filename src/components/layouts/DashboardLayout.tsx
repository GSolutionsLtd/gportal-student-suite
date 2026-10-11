import { useEffect, useState } from "react";
import { useNavigate, useLocation, useParams, Outlet } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UserRole, ROLE_LABELS } from "@/types/auth";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolFeatures } from "@/hooks/useSchoolFeatures";
import { useSchoolContext } from "@/hooks/useSchoolContext";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Search,
  School,
  FileCheck,
  Key,
  Shield,
  Calendar,
  Layers,
  Loader2,
  MessageSquare,
  Bell,
  Monitor,
  FileText,
  Briefcase,
  Globe,
} from "lucide-react";

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  path: string;
  feature?: "results" | "cbt" | "finance" | "assignments" | "lesson_notes" | "careeraid" | "school_website" | "curriculum" | "admissions" | "attendance";
  children?: { label: string; path: string }[];
}

const roleNavItems: Record<UserRole, NavItem[]> = {
  counselor: [],
  super_admin: [
    { label: "Dashboard", icon: LayoutDashboard, path: "" },
    { label: "Schools Overview", icon: Globe, path: "schools-overview" },
    { label: "School Management", icon: School, path: "schools" },
    { label: "School Features", icon: Settings, path: "features" },
    { label: "User Management", icon: Users, path: "users" },
    { label: "System Settings", icon: Settings, path: "settings" },
    { label: "Audit Logs", icon: Shield, path: "audit" },
    { label: "Contact Submissions", icon: FileCheck, path: "contact-submissions" },
    { label: "Career Counselors", icon: Users, path: "counselors" },
  ],
  admin: [
    { label: "Dashboard", icon: LayoutDashboard, path: "" },
    { label: "Academic Setup", icon: Calendar, path: "academic" },
    { label: "School Settings", icon: Settings, path: "settings" },
    { label: "Students", icon: GraduationCap, path: "students" },
    { label: "Teachers", icon: School, path: "teachers" },
    { label: "Class Promotion", icon: Layers, path: "promotion" },
    { label: "Dashboard Linking", icon: Users, path: "", children: [
      { label: "Parent Linking", path: "parent-linking" },
      { label: "Student Linking", path: "student-linking" },
    ] },
    { label: "Result Management", icon: FileCheck, path: "", feature: "results", children: [
      { label: "Result Approval", path: "results" },
      { label: "Broadsheet & Cumulative", path: "broadsheet" },
      { label: "Score Reset", path: "score-reset" },
      { label: "Bulk PDF Download", path: "bulk-download" },
      { label: "PIN Management", path: "pins" },
      { label: "PIN Monetization", path: "monetisation" },
      { label: "Academic Intelligence", path: "intelligence" },
      { label: "Compliance & Reporting", path: "compliance" },
      { label: "Result Security", path: "security" },
    ] },
    { label: "CBT Management", icon: Monitor, path: "", feature: "cbt", children: [
      { label: "Exams and Test Setup", path: "cbt" },
      { label: "CBT Score Sync", path: "cbt-sync" },
    ] },
    { label: "Fee Management", icon: Key, path: "fees", feature: "finance" },
    { label: "Assignment", icon: FileText, path: "assignments", feature: "assignments" },
    { label: "CareerAid", icon: Briefcase, path: "", feature: "careeraid", children: [
      { label: "CareerAid", path: "careeraid" },
      { label: "Counselor Onboarding", path: "counselors" },
    ] },
    { label: "AI Lesson Planner", icon: BookOpen, path: "lesson-planner", feature: "lesson_notes" },
    { label: "Attendance", icon: Calendar, path: "attendance", feature: "attendance" },
    { label: "Admission", icon: GraduationCap, path: "admissions", feature: "admissions" },
    { label: "Curriculum", icon: BookOpen, path: "curriculum", feature: "curriculum" },
    { label: "School Website", icon: Globe, path: "school-website" },
    { label: "Communication", icon: MessageSquare, path: "", children: [
      { label: "Communication", path: "communications" },
      { label: "Message Monitoring", path: "messages" },
    ] },
    { label: "Audit Trail", icon: Shield, path: "audit" },
  ],
  teacher: [
    { label: "Dashboard", icon: LayoutDashboard, path: "" },
    { label: "My Classes", icon: Layers, path: "classes" },
    { label: "Result Entry", icon: ClipboardList, path: "results", feature: "results" },
    { label: "CBT Management", icon: Monitor, path: "cbt", feature: "cbt" },
    { label: "Assignments", icon: FileText, path: "assignments", feature: "assignments" },
    { label: "CareerAid", icon: Briefcase, path: "careeraid", feature: "careeraid" },
    { label: "Audit Trail", icon: Shield, path: "audit" },
    { label: "AI Lesson Planner ✨", icon: BookOpen, path: "lesson-planner", feature: "lesson_notes" },
    { label: "Attendance ✨", icon: Calendar, path: "attendance", feature: "attendance" },
    { label: "Curriculum", icon: BookOpen, path: "curriculum", feature: "curriculum" },
    { label: "Parent Messages", icon: MessageSquare, path: "messages" },
    { label: "My Profile", icon: Users, path: "profile" },
  ],
  student: [
    { label: "Dashboard", icon: LayoutDashboard, path: "" },
    { label: "My Results", icon: ClipboardList, path: "results", feature: "results" },
    { label: "Experience Intelligence", icon: BarChart3, path: "analytics", feature: "results" },
    { label: "CBT Exams", icon: Monitor, path: "cbt", feature: "cbt" },
    { label: "School Fees", icon: Key, path: "fees", feature: "finance" },
    { label: "Assignments", icon: FileText, path: "assignments", feature: "assignments" },
    { label: "CareerAid", icon: Briefcase, path: "careeraid", feature: "careeraid" },
    { label: "Lesson Notes ✨", icon: BookOpen, path: "lesson-notes", feature: "lesson_notes" },
    { label: "Attendance ✨", icon: Calendar, path: "attendance", feature: "attendance" },
  ],
  parent: [
    { label: "Dashboard", icon: LayoutDashboard, path: "" },
    { label: "My Students", icon: Users, path: "students" },
    { label: "Messages", icon: MessageSquare, path: "messages" },
    { label: "Notifications", icon: Bell, path: "preferences" },
  ],
};

interface DashboardLayoutProps {
  role: UserRole;
}

export function DashboardLayout({ role }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { schoolCode: urlSchoolCode } = useParams<{ schoolCode: string }>();
  const { profile, signOut, isLoading } = useAuth();
  const { features } = useSchoolFeatures();
  const { schoolCode, schoolName } = useSchoolContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Build base path for navigation
  const basePath = role === "super_admin" 
    ? "/super-admin" 
    : `/${urlSchoolCode || schoolCode || ""}/${role}`;

  // Build full href from relative path
  const buildHref = (relativePath: string) => {
    return relativePath ? `${basePath}/${relativePath}` : basePath;
  };

  // Filter nav items based on school's enabled features
  const navItems = roleNavItems[role].filter((item) => {
    if (!item.feature) return true;
    return features[item.feature];
  });

  const toggleExpanded = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  };

  useEffect(() => {
    const open = navItems.find((i) => isParentActive(i));
    if (open) setExpandedItems((prev) => (prev.includes(open.label) ? prev : [...prev, open.label]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const isActive = (relativePath: string) => {
    const href = buildHref(relativePath);
    return location.pathname === href;
  };

  const isParentActive = (item: NavItem) =>
    item.children?.some((child) => location.pathname === buildHref(child.path));

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      // Hard replace to /auth so the browser back button cannot restore
      // a cached protected page from a different school/role session.
      window.history.replaceState(null, "", "/auth");
      window.location.replace("/auth");
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo & School Name */}
          <div className="p-4 border-b border-sidebar-border">
            <Logo variant="light" />
            {schoolName && role !== "super_admin" && (
              <p className="text-xs text-sidebar-foreground/60 mt-1 truncate">
                {schoolName}
              </p>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navItems.map((item) => {
              const href = buildHref(item.path);
              return (
                <div key={item.label}>
                  <button
                    onClick={() => {
                      if (item.children) {
                        toggleExpanded(item.label);
                      } else {
                        navigate(href);
                        setSidebarOpen(false);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      (!item.children && isActive(item.path)) || isParentActive(item)
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.children && (
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          expandedItems.includes(item.label) && "rotate-180"
                        )}
                      />
                    )}
                  </button>
                  {item.children && expandedItems.includes(item.label) && (
                    <div className="ml-8 mt-1 space-y-1">
                      {item.children.map((child) => {
                        const childHref = buildHref(child.path);
                        return (
                          <button
                            key={child.path}
                            onClick={() => {
                              navigate(childHref);
                              setSidebarOpen(false);
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                              isActive(child.path)
                                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                            )}
                          >
                            {child.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-medium">
                {profile ? getInitials(profile.full_name) : <Users className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {profile?.full_name || "Loading..."}
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {ROLE_LABELS[role]}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={handleSignOut}
              disabled={isSigningOut}
            >
              {isSigningOut ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-30 glass border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="hidden md:flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="bg-transparent border-none outline-none text-sm w-48"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
