import { useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UserRole, ROLE_LABELS } from "@/types/auth";
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
  Bell,
  Search,
  School,
  FileCheck,
  Key,
  Shield,
  Calendar,
  Layers,
} from "lucide-react";

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  href: string;
  children?: { label: string; href: string }[];
}

const roleNavItems: Record<UserRole, NavItem[]> = {
  super_admin: [
    { label: "Dashboard", icon: LayoutDashboard, href: "/super-admin" },
    { label: "User Management", icon: Users, href: "/super-admin/users" },
    { label: "System Settings", icon: Settings, href: "/super-admin/settings" },
    { label: "Audit Logs", icon: Shield, href: "/super-admin/audit" },
  ],
  admin: [
    { label: "Dashboard", icon: LayoutDashboard, href: "/admin" },
    { 
      label: "Academic Setup", 
      icon: Calendar, 
      href: "/admin/academic",
      children: [
        { label: "Sessions", href: "/admin/academic/sessions" },
        { label: "Terms", href: "/admin/academic/terms" },
        { label: "Classes", href: "/admin/academic/classes" },
        { label: "Subjects", href: "/admin/academic/subjects" },
        { label: "Grading", href: "/admin/academic/grading" },
      ]
    },
    { label: "Students", icon: GraduationCap, href: "/admin/students" },
    { label: "Teachers", icon: School, href: "/admin/teachers" },
    { label: "Result Approval", icon: FileCheck, href: "/admin/results" },
    { label: "PIN Management", icon: Key, href: "/admin/pins" },
    { label: "Reports", icon: BarChart3, href: "/admin/reports" },
  ],
  teacher: [
    { label: "Dashboard", icon: LayoutDashboard, href: "/teacher" },
    { label: "My Classes", icon: Layers, href: "/teacher/classes" },
    { label: "Result Entry", icon: ClipboardList, href: "/teacher/results" },
    { label: "Submissions", icon: FileCheck, href: "/teacher/submissions" },
  ],
  student: [
    { label: "Dashboard", icon: LayoutDashboard, href: "/student" },
    { label: "My Results", icon: ClipboardList, href: "/student/results" },
    { label: "Profile", icon: Users, href: "/student/profile" },
  ],
};

interface DashboardLayoutProps {
  role: UserRole;
}

export function DashboardLayout({ role }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const navItems = roleNavItems[role];

  const toggleExpanded = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  };

  const isActive = (href: string) => location.pathname === href;
  const isParentActive = (item: NavItem) =>
    item.children?.some((child) => location.pathname === child.href);

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
          {/* Logo */}
          <div className="p-4 border-b border-sidebar-border">
            <Logo variant="light" />
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navItems.map((item) => (
              <div key={item.label}>
                <button
                  onClick={() => {
                    if (item.children) {
                      toggleExpanded(item.label);
                    } else {
                      navigate(item.href);
                      setSidebarOpen(false);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive(item.href) || isParentActive(item)
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
                    {item.children.map((child) => (
                      <button
                        key={child.href}
                        onClick={() => {
                          navigate(child.href);
                          setSidebarOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                          isActive(child.href)
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                        )}
                      >
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-sidebar-accent flex items-center justify-center">
                <Users className="h-5 w-5 text-sidebar-accent-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  John Doe
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
              onClick={() => navigate("/")}
            >
              <LogOut className="h-4 w-4 mr-2" />
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
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full" />
              </Button>
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
