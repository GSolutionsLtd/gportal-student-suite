import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import React from "react";

// Auth Provider
import { AuthProvider } from "./hooks/useAuth";
import { ProtectedRoute } from "./components/ProtectedRoute";

// Pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import CheckResult from "./pages/CheckResult";
import PaymentCallback from "./pages/PaymentCallback";
import NotFound from "./pages/NotFound";
import InstallApp from "./pages/InstallApp";

// Dashboard Layouts
import { DashboardLayout } from "./components/layouts/DashboardLayout";

// Dashboards
import SuperAdminDashboard from "./pages/dashboards/SuperAdminDashboard";
import AdminDashboard from "./pages/dashboards/AdminDashboard";
import TeacherDashboard from "./pages/dashboards/TeacherDashboard";
import TeacherResultEntry from "./pages/teacher/ResultEntry";
import TeacherClassesOverview from "./pages/teacher/ClassesOverview";
import TeacherProfile from "./pages/teacher/TeacherProfile";
import StudentDashboard from "./pages/dashboards/StudentDashboard";
import StudentMyResults from "./pages/student/MyResults";
import AdminResultApproval from "./pages/admin/ResultApproval";
import AcademicConfig from "./pages/admin/AcademicConfig";
import TeacherManagement from "./pages/admin/TeacherManagement";
import PinManagement from "./pages/admin/PinManagement";
import StudentManagement from "./pages/admin/StudentManagement";
import SchoolSettings from "./pages/admin/SchoolSettings";
import ClassPromotion from "./pages/admin/ClassPromotion";
import BulkPDFDownload from "./components/admin/BulkPDFDownload";
import ScoreReset from "./pages/admin/ScoreReset";
import Broadsheet from "./pages/admin/Broadsheet";
import ComplianceReporting from "./pages/admin/ComplianceReporting";
import AcademicIntelligence from "./pages/admin/AcademicIntelligence";

// Super Admin pages
import UserManagement from "./pages/super-admin/UserManagement";
import SystemSettings from "./pages/super-admin/SystemSettings";
import AuditLogs from "./pages/super-admin/AuditLogs";
import SchoolManagement from "./pages/super-admin/SchoolManagement";

// Student pages
import PerformanceAnalytics from "./pages/student/PerformanceAnalytics";

// Parent pages
import ParentDashboard from "./pages/dashboards/ParentDashboard";
import ParentStudentResults from "./pages/parent/StudentResults";
import ParentLinkedStudents from "./pages/parent/LinkedStudents";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={0}>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/check-result" element={<CheckResult />} />
              <Route path="/payment/callback" element={<PaymentCallback />} />
              <Route path="/install" element={<InstallApp />} />

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
                <Route path="schools" element={<SchoolManagement />} />
                <Route path="users" element={<UserManagement />} />
                <Route path="settings" element={<SystemSettings />} />
                <Route path="audit" element={<AuditLogs />} />
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
                <Route path="broadsheet" element={<Broadsheet />} />
                <Route path="academic" element={<AcademicConfig />} />
                <Route path="teachers" element={<TeacherManagement />} />
                <Route path="pins" element={<PinManagement />} />
                <Route path="students" element={<StudentManagement />} />
                <Route path="settings" element={<SchoolSettings />} />
                <Route path="promotion" element={<ClassPromotion />} />
                <Route path="bulk-download" element={<BulkPDFDownload />} />
                <Route path="score-reset" element={<ScoreReset />} />
                <Route path="compliance" element={<ComplianceReporting />} />
                <Route path="intelligence" element={<AcademicIntelligence />} />
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
                <Route path="classes" element={<TeacherClassesOverview />} />
                <Route path="results" element={<TeacherResultEntry />} />
                <Route path="profile" element={<TeacherProfile />} />
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
                <Route path="results" element={<StudentMyResults />} />
                <Route path="analytics" element={<PerformanceAnalytics />} />
              </Route>

              {/* Parent Routes */}
              <Route
                path="/parent"
                element={
                  <ProtectedRoute allowedRoles={["parent"]}>
                    <DashboardLayout role="parent" />
                  </ProtectedRoute>
                }
              >
                <Route index element={<ParentDashboard />} />
                <Route path="students" element={<ParentLinkedStudents />} />
                <Route path="results/:studentId" element={<ParentStudentResults />} />
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
