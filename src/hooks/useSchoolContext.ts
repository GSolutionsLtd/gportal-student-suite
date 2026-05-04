import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface SchoolContext {
  schoolId: string | null;
  schoolCode: string | null;
  schoolName: string | null;
  loading: boolean;
}

export function useSchoolContext(): SchoolContext {
  const { user, userRole } = useAuth();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [schoolCode, setSchoolCode] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !userRole) {
      setSchoolId(null);
      setSchoolCode(null);
      setSchoolName(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    if (userRole === "super_admin") {
      setSchoolCode(null);
      setSchoolId(null);
      setSchoolName(null);
      setLoading(false);
      return;
    }

    const fetchSchool = async () => {
      try {
        let sidData: string | null = null;

        if (userRole === "admin") {
          const { data } = await supabase
            .from("school_admins")
            .select("school_id")
            .eq("user_id", user.id)
            .eq("is_primary", true)
            .maybeSingle();
          sidData = data?.school_id ?? null;
        } else if (userRole === "teacher") {
          const { data } = await supabase
            .from("teachers")
            .select("school_id")
            .eq("user_id", user.id)
            .maybeSingle();
          sidData = data?.school_id ?? null;
        } else if (userRole === "student") {
          const { data } = await supabase
            .from("students")
            .select("school_id")
            .eq("user_id", user.id)
            .maybeSingle();
          sidData = data?.school_id ?? null;
        } else if (userRole === "parent") {
          const { data } = await supabase
            .from("parent_school_memberships")
            .select("school_id")
            .eq("parent_user_id", user.id)
            .eq("is_primary", true)
            .maybeSingle();
          sidData = data?.school_id ?? null;
        }

        if (sidData) {
          setSchoolId(sidData);
          const { data: school } = await supabase
            .from("schools")
            .select("code, name")
            .eq("id", sidData)
            .maybeSingle();

          if (school) {
            setSchoolCode(school.code);
            setSchoolName(school.name);
          }
        }
      } catch (err) {
        console.error("Error fetching school context:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSchool();
  }, [user, userRole]);

  return { schoolId, schoolCode, schoolName, loading };
}
