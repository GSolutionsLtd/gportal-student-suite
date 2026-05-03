import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types/auth';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: UserRole | null;
  profile: {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: UserRole,
    options?: {
      teacher?: {
        staff_id: string;
        is_class_teacher: boolean;
        is_form_teacher: boolean;
        signature_url?: string | null;
      };
      schoolId?: string;
      inviteCode?: string;
    }
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [profile, setProfile] = useState<AuthContextType['profile']>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user role:', error);
      return null;
    }
    return data?.role as UserRole | null;
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer fetching additional data
        if (session?.user) {
          setTimeout(async () => {
            const [role, profileData] = await Promise.all([
              fetchUserRole(session.user.id),
              fetchProfile(session.user.id)
            ]);
            setUserRole(role);
            setProfile(profileData);
            setIsLoading(false);
          }, 0);
        } else {
          setUserRole(null);
          setProfile(null);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const [role, profileData] = await Promise.all([
          fetchUserRole(session.user.id),
          fetchProfile(session.user.id)
        ]);
        setUserRole(role);
        setProfile(profileData);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: UserRole,
    options?: {
      teacher?: {
        staff_id: string;
        is_class_teacher: boolean;
        is_form_teacher: boolean;
        signature_url?: string | null;
      };
      schoolId?: string;
      inviteCode?: string;
    }
  ) => {
    const redirectUrl = `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      return { error };
    }

    // After successful signup, complete role + school linking through trusted backend logic
    if (data.user) {
      const { data: completionData, error: completionError } =
        await supabase.functions.invoke("complete-signup", {
          body: {
            userId: data.user.id,
            email,
            fullName,
            role,
            schoolId: options?.schoolId,
            inviteCode: options?.inviteCode,
            teacher: options?.teacher,
          },
        });

      // supabase-js exposes the response body in `completionData` even on
      // 4xx/5xx so we can surface the precise backend error message.
      const ctx = (completionError as unknown as { context?: Response | { error?: string } })?.context;
      let contextError: string | undefined;
      if (ctx && typeof (ctx as Response).json === "function") {
        try {
          const body = await (ctx as Response).clone().json();
          contextError = (body as { error?: string })?.error;
        } catch {
          // ignore
        }
      } else if (ctx && typeof (ctx as { error?: string }).error === "string") {
        contextError = (ctx as { error?: string }).error;
      }

      const backendError =
        (completionData as { error?: string } | null)?.error ||
        contextError ||
        completionError?.message;

      if (backendError) {
        console.error("Error completing signup:", backendError);
        return { error: new Error(backendError) };
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    // Clear local state first so any in-flight subscribers stop using stale data
    setUser(null);
    setSession(null);
    setUserRole(null);
    setProfile(null);
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch (err) {
      console.error("Sign-out error:", err);
    }
    // Best-effort: wipe any cached supabase auth tokens from storage
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sb-") || k.includes("supabase"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      userRole,
      profile,
      isLoading,
      signIn,
      signUp,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
