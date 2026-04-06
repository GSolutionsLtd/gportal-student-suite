import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { UserRole } from '@/types/auth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, userRole, isLoading } = useAuth();
  const { schoolCode, loading: schoolLoading } = useSchoolContext();
  const location = useLocation();

  if (isLoading || schoolLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to auth page
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // No role assigned yet - redirect to auth
  if (!userRole) {
    return <Navigate to="/auth" replace />;
  }

  // Check if user has allowed role
  if (!allowedRoles.includes(userRole)) {
    // Redirect to their appropriate dashboard based on role + school
    if (userRole === 'super_admin') {
      return <Navigate to="/super-admin" replace />;
    }
    if (schoolCode) {
      const roleBase = userRole === 'admin' ? 'admin' : userRole;
      return <Navigate to={`/${schoolCode}/${roleBase}`} replace />;
    }
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
