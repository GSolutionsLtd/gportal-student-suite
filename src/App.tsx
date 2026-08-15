import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import React from "react";

// Auth Provider
import { AuthProvider } from "./hooks/useAuth";
import { useAuth } from "./hooks/useAuth";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SchoolProtectedRoute } from "./components/SchoolProtectedRoute";
import { useSchoolContext } from "./hooks/useSchoolContext";

// Pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import CheckResult from "./pages/CheckResult";
import PaymentCallback from "./pages/PaymentCallback";
import NotFound from "./pages/NotFound";
import InstallApp from "./pages/InstallApp";
import Contact from "./pages/Contact";

// Dashboard Layouts
import { DashboardLayout } from "./components/layouts/DashboardLayout";

// Dashboards
import SuperAdminDashboard from "./pages/dashboards/SuperAdminDashboard";
import AdminDashboard from "./pages/dashboards/AdminDashboard";
import TeacherDashboard from "./pages/dashboards/TeacherDashboard";
import TeacherResultEntry from "./pages/teacher/ResultEntry";
import TeacherClassesOverview from "./pages/teacher/ClassesOverview";
import TeacherProfile from "./pages/teacher/TeacherProfile";
import TeacherParentMessages from "./pages/teacher/ParentMessages";
import TeacherCBTManagement from "./pages/teacher/TeacherCBTManagement";

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
import CommunicationEngine from "./pages/admin/CommunicationEngine";
import ParentLinking from "./pages/admin/ParentLinking";
import CBTManagement from "./pages/admin/CBTManagement";
import FeeManagement from "./pages/admin/FeeManagement";
import MessageMonitoring from "./pages/admin/MessageMonitoring";
import CBTScoreSync from "./pages/admin/CBTScoreSync";
import AdminAssignments from "./pages/admin/AdminAssignments";
import TeacherAssignments from "./pages/teacher/TeacherAssignments";
import StudentAssignments from "./pages/student/StudentAssignments";
import AdminCareerAid from "./pages/admin/AdminCareerAid";
import TeacherCareerAid from "./pages/teacher/TeacherCareerAid";
import StudentCareerAid from "./pages/student/StudentCareerAid";
import LessonPlannerFeature from "./pages/features/LessonPlanner";
import AttendanceFeature from "./pages/features/Attendance";

// Super Admin pages
import UserManagement from "./pages/super-admin/UserManagement";
import SystemSettings from "./pages/super-admin/SystemSettings";
import AuditLogs from "./pages/super-admin/AuditLogs";
import AuditTrail from "./pages/shared/AuditTrail";
import SchoolManagement from "./pages/super-admin/SchoolManagement";
import SchoolFeatures from "./pages/super-admin/SchoolFeatures";
import ContactSubmissions from "./pages/super-admin/ContactSubmissions";

// Student pages
import PerformanceAnalytics from "./pages/student/PerformanceAnalytics";
import StudentCBTExam from "./pages/student/CBTExam";
import StudentFeePayment from "./pages/student/FeePayment";
import StudentLessonNotes from "./pages/student/LessonNotes";
import SchoolWebsiteManager from "./pages/admin/SchoolWebsiteManager";
import PublicSchoolSite from "./pages/PublicSchoolSite";

// Parent pages
import ParentDashboard from "./pages/dashboards/ParentDashboard";
import ParentStudentResults from "./pages/parent/StudentResults";
import ParentLinkedStudents from "./pages/parent/LinkedStudents";
import ParentMessageTeacher from "./pages/parent/MessageTeacher";
import ParentNotificationPreferences from "./pages/parent/NotificationPreferences";
import StudentLinking from "./pages/admin/StudentLinking";

// Security & Monetisation
import VerifyResult from "./pages/VerifyResult";
import ResultSecurity from "./pages/admin/ResultSecurity";
import PinMonetisation from "./pages/admin/PinMonetisation";

import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

// Legacy route redirect component
function LegacyRedirect({ role }: { role: string }) {
  const { schoolCode, loading } = useSchoolContext();
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!schoolCode) return <Navigate to="/auth" replace />;

  const subpath = location.pathname.replace(new RegExp(`^/${role}`), "");
  return <Navigate to={`/${schoolCode}/${role}${subpath}`} replace />;
}

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
              <Route path="/verify-result" element={<VerifyResult />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/site/:schoolCode" element={<PublicSchoolSite />} />

              {/* Super Admin Routes (no school code) */}
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
                <Route path="features" element={<SchoolFeatures />} />
                <Route path="contact-submissions" element={<ContactSubmissions />} />
              </Route>

              {/* School-scoped Admin Routes */}
              <Route 
                path="/:schoolCode/admin" 
                element={
                  <SchoolProtectedRoute allowedRoles={["admin", "super_admin"]}>
                    <DashboardLayout role="admin" />
                  </SchoolProtectedRoute>
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
                <Route path="security" element={<ResultSecurity />} />
                <Route path="monetisation" element={<PinMonetisation />} />
                <Route path="communications" element={<CommunicationEngine />} />
                <Route path="parent-linking" element={<ParentLinking />} />
                <Route path="student-linking" element={<StudentLinking />} />
                <Route path="cbt" element={<CBTManagement />} />
                <Route path="fees" element={<FeeManagement />} />
                <Route path="messages" element={<MessageMonitoring />} />
                <Route path="cbt-sync" element={<CBTScoreSync />} />
                <Route path="assignments" element={<AdminAssignments />} />
                <Route path="careeraid" element={<AdminCareerAid />} />
                <Route path="lesson-planner" element={<LessonPlannerFeature />} />
                <Route path="attendance" element={<AttendanceFeature />} />
                <Route path="school-website" element={<SchoolWebsiteManager />} />
                <Route path="audit" element={<AuditTrail />} />
              </Route>

              {/* School-scoped Teacher Routes */}
              <Route 
                path="/:schoolCode/teacher" 
                element={
                  <SchoolProtectedRoute allowedRoles={["teacher"]}>
                    <DashboardLayout role="teacher" />
                  </SchoolProtectedRoute>
                }
              >
                <Route index element={<TeacherDashboard />} />
                <Route path="classes" element={<TeacherClassesOverview />} />
                <Route path="results" element={<TeacherResultEntry />} />
                <Route path="profile" element={<TeacherProfile />} />
                <Route path="messages" element={<TeacherParentMessages />} />
                <Route path="cbt" element={<TeacherCBTManagement />} />
                <Route path="assignments" element={<TeacherAssignments />} />
                <Route path="careeraid" element={<TeacherCareerAid />} />
                <Route path="lesson-planner" element={<LessonPlannerFeature />} />
                <Route path="attendance" element={<AttendanceFeature />} />
              </Route>

              {/* School-scoped Student Routes */}
              <Route 
                path="/:schoolCode/student" 
                element={
                  <SchoolProtectedRoute allowedRoles={["student"]}>
                    <DashboardLayout role="student" />
                  </SchoolProtectedRoute>
                }
              >
                <Route index element={<StudentDashboard />} />
                <Route path="results" element={<StudentMyResults />} />
                <Route path="analytics" element={<PerformanceAnalytics />} />
                <Route path="cbt" element={<StudentCBTExam />} />
                <Route path="fees" element={<StudentFeePayment />} />
                <Route path="assignments" element={<StudentAssignments />} />
                <Route path="careeraid" element={<StudentCareerAid />} />
                <Route path="lesson-notes" element={<StudentLessonNotes />} />
                <Route path="attendance" element={<AttendanceFeature />} />
              </Route>

              {/* School-scoped Parent Routes */}
              <Route
                path="/:schoolCode/parent"
                element={
                  <SchoolProtectedRoute allowedRoles={["parent"]}>
                    <DashboardLayout role="parent" />
                  </SchoolProtectedRoute>
                }
              >
                <Route index element={<ParentDashboard />} />
                <Route path="students" element={<ParentLinkedStudents />} />
                <Route path="results/:studentId" element={<ParentStudentResults />} />
                <Route path="messages" element={<ParentMessageTeacher />} />
                <Route path="preferences" element={<ParentNotificationPreferences />} />
              </Route>

              {/* Legacy routes redirect to school-code routes */}
              <Route path="/admin/*" element={<LegacyRedirect role="admin" />} />
              <Route path="/teacher/*" element={<LegacyRedirect role="teacher" />} />
              <Route path="/student/*" element={<LegacyRedirect role="student" />} />
              <Route path="/parent/*" element={<LegacyRedirect role="parent" />} />

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
