import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Auth Provider
import { AuthProvider } from "./hooks/useAuth";
import { ProtectedRoute } from "./components/ProtectedRoute";

// Pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import CheckResult from "./pages/CheckResult";
import NotFound from "./pages/NotFound";

// Dashboard Layouts
import { DashboardLayout } from "./components/layouts/DashboardLayout";

// Dashboards
import SuperAdminDashboard from "./pages/dashboards/SuperAdminDashboard";
import AdminDashboard from "./pages/dashboards/AdminDashboard";
import TeacherDashboard from "./pages/dashboards/TeacherDashboard";
import TeacherResultEntry from "./pages/teacher/ResultEntry";
import StudentDashboard from "./pages/dashboards/StudentDashboard";
import AdminResultApproval from "./pages/admin/ResultApproval";
import AcademicConfig from "./pages/admin/AcademicConfig";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/check-result" element={<CheckResult />} />

            {/* Super Admin Routes */}
            <Route 
              path="/super-admin" 
              element={
                <ProtectedRoute allowedRoles={["super_admin"]}>
                  <DashboardLayout role="super_admin" />
                </ProtectedRoute>
              }
            >
              <Route index element={<SuperAdminDashboard />} />
            </Route>

            {/* Admin Routes */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <DashboardLayout role="admin" />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="results" element={<AdminResultApproval />} />
              <Route path="academic" element={<AcademicConfig />} />
            </Route>

            {/* Teacher Routes */}
            <Route 
              path="/teacher" 
              element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <DashboardLayout role="teacher" />
                </ProtectedRoute>
              }
            >
              <Route index element={<TeacherDashboard />} />
              <Route path="results" element={<TeacherResultEntry />} />
            </Route>

            {/* Student Routes */}
            <Route 
              path="/student" 
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <DashboardLayout role="student" />
                </ProtectedRoute>
              }
            >
              <Route index element={<StudentDashboard />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
