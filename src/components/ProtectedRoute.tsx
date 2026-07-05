import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
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
  const warned = useRef(false);

  const denied =
    !isLoading && !schoolLoading && user && userRole && !allowedRoles.includes(userRole);

  useEffect(() => {
    if (denied && !warned.current) {
      warned.current = true;
      toast.error("Access denied", {
        description: "You don't have permission to view that page.",
      });
    }
  }, [denied]);

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

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!userRole) {
    return <Navigate to="/auth" replace />;
  }

  if (!allowedRoles.includes(userRole)) {
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
