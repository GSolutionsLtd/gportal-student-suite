import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface SchoolFeatures {
  results: boolean;
  cbt: boolean;
  finance: boolean;
  assignments: boolean;
  lesson_notes: boolean;
  careeraid: boolean;
  school_website: boolean;
  curriculum: boolean;
  admissions: boolean;
  attendance: boolean;
}

const DEFAULT_FEATURES: SchoolFeatures = {
  results: true,
  cbt: true,
  finance: true,
  assignments: false,
  lesson_notes: false,
  careeraid: false,
  school_website: false,
  curriculum: false,
  admissions: false,
  attendance: true,
};

export function useSchoolFeatures() {
  const { user, userRole } = useAuth();
  const [features, setFeatures] = useState<SchoolFeatures>(DEFAULT_FEATURES);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !userRole) {
      setLoading(false);
      return;
    }

    // Super admin sees everything
    if (userRole === "super_admin") {
      setFeatures(DEFAULT_FEATURES);
      setLoading(false);
      return;
    }

    const fetchFeatures = async () => {
      try {
        let resolvedSchoolId: string | null = null;

        if (userRole === "admin") {
          const { data } = await supabase
            .from("school_admins")
            .select("school_id")
            .eq("user_id", user.id)
            .maybeSingle();
          resolvedSchoolId = data?.school_id || null;
        } else if (userRole === "teacher") {
          const { data: teacher } = await supabase
            .from("teachers")
            .select("school_id")
            .eq("user_id", user.id)
            .maybeSingle();
          resolvedSchoolId = (teacher as any)?.school_id || null;
        } else if (userRole === "student") {
          const { data: student } = await supabase
            .from("students")
            .select("school_id")
            .eq("user_id", user.id)
            .maybeSingle();
          resolvedSchoolId = (student as any)?.school_id || null;
        } else if (userRole === "parent") {
          // Get school from linked student
          const { data: links } = await supabase
            .from("parent_students")
            .select("student_id")
            .eq("parent_user_id", user.id)
            .eq("is_active", true)
            .limit(1);
          if (links && links.length > 0) {
            const { data: student } = await supabase
              .from("students")
              .select("school_id")
              .eq("id", links[0].student_id)
              .maybeSingle();
            resolvedSchoolId = (student as any)?.school_id || null;
          }
        }

        setSchoolId(resolvedSchoolId);

        if (resolvedSchoolId) {
          const { data: school } = await supabase
            .from("schools")
            .select("enabled_features")
            .eq("id", resolvedSchoolId)
            .maybeSingle();

          if (school?.enabled_features) {
            const ef = school.enabled_features as any;
            setFeatures({
              results: ef.results !== false,
              cbt: ef.cbt !== false,
              finance: ef.finance !== false,
              assignments: ef.assignments === true,
              lesson_notes: ef.lesson_notes === true,
              careeraid: ef.careeraid === true,
              school_website: ef.school_website === true,
              curriculum: ef.curriculum === true,
              admissions: ef.admissions === true,
              attendance: ef.attendance !== false,
            });
          }
        }
        // If no school found, show all features (backward compatible)
      } catch (err) {
        console.error("Error fetching school features:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFeatures();
  }, [user, userRole]);

  return { features, schoolId, loading };
}
