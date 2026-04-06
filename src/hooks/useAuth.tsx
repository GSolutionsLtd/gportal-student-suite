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

    // After successful signup, assign role
    if (data.user) {
      const [{ error: roleError }, { data: existingTeacher, error: existingTeacherError }] = await Promise.all([
        supabase.from("user_roles").insert({ user_id: data.user.id, role }),
        role === "teacher"
          ? supabase.from("teachers").select("id").eq("user_id", data.user.id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
      ]);

      if (roleError) {
        console.error("Error assigning role:", roleError);
        return { error: new Error("Failed to assign user role. Please contact support.") };
      }

      if (existingTeacherError) {
        console.error("Error checking teacher record:", existingTeacherError);
        // Don't block signup on this; teacher can complete profile later
      }

      // Teacher onboarding (designation + signature)
      if (role === "teacher" && options?.teacher) {
        const teacherPayload = {
          user_id: data.user.id,
          staff_id: options.teacher.staff_id.trim().toUpperCase(),
          date_joined: new Date().toISOString().slice(0, 10),
          is_active: true,
          is_class_teacher: options.teacher.is_class_teacher,
          is_form_teacher: options.teacher.is_form_teacher,
          signature_url: options.teacher.signature_url ?? null,
        };

        const { error: teacherUpsertError } = existingTeacher?.id
          ? await supabase.from("teachers").update(teacherPayload).eq("id", existingTeacher.id)
          : await supabase.from("teachers").insert(teacherPayload);

        if (teacherUpsertError) {
          console.error("Error creating/updating teacher record:", teacherUpsertError);
          // Don't block signup completely; teacher can update later in Profile
        }
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
    setProfile(null);
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
