import { Navigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolContext } from "@/hooks/useSchoolContext";
import { UserRole } from "@/types/auth";
import { Loader2 } from "lucide-react";

interface SchoolProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export function SchoolProtectedRoute({ children, allowedRoles }: SchoolProtectedRouteProps) {
  const { user, userRole, isLoading: authLoading } = useAuth();
  const { schoolCode, loading: schoolLoading } = useSchoolContext();
  const { schoolCode: urlSchoolCode } = useParams<{ schoolCode: string }>();
  const location = useLocation();

  if (authLoading || schoolLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // No role assigned
  if (!userRole) {
    return <Navigate to="/auth" replace />;
  }

  // Check role access
  if (!allowedRoles.includes(userRole)) {
    // Redirect to their correct dashboard
    if (userRole === "super_admin") {
      return <Navigate to="/super-admin" replace />;
    }
    if (schoolCode) {
      const roleBase = userRole === "admin" ? "admin" : userRole === "teacher" ? "teacher" : userRole === "student" ? "student" : "parent";
      return <Navigate to={`/${schoolCode}/${roleBase}`} replace />;
    }
    return <Navigate to="/auth" replace />;
  }

  // Validate URL school code matches user's school
  if (urlSchoolCode && schoolCode && urlSchoolCode.toUpperCase() !== schoolCode.toUpperCase()) {
    // User is trying to access a different school - block it
    const roleBase = userRole === "admin" ? "admin" : userRole === "teacher" ? "teacher" : userRole === "student" ? "student" : "parent";
    return <Navigate to={`/${schoolCode}/${roleBase}`} replace />;
  }

  // User has no school assigned yet
  if (!schoolCode && userRole !== "super_admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <h2 className="text-xl font-bold text-foreground">No School Assigned</h2>
          <p className="text-muted-foreground">
            Your account has not been linked to a school yet. Please contact your school administrator.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
