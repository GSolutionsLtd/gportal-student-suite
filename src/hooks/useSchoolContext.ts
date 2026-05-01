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
        // Use the DB function to resolve school_id
        const { data: sidData } = await supabase.rpc("get_user_school_id", {
          _user_id: user.id,
        });

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
