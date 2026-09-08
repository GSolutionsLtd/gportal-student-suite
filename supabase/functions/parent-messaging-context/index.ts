import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: links, error: linksError } = await adminClient
      .from("parent_students")
      .select("student_id")
      .eq("parent_user_id", user.id)
      .eq("is_active", true);

    if (linksError) throw linksError;

    const studentIds = (links || []).map((link: any) => link.student_id);

    const [studentsResponse, messagesResponse] = await Promise.all([
      studentIds.length > 0
        ? adminClient
            .from("students")
            .select("id, first_name, last_name, current_class_arm_id, school_id")
            .in("id", studentIds)
        : Promise.resolve({ data: [], error: null }),
      adminClient
        .from("parent_teacher_messages")
        .select("id, subject, message, reply, replied_at, is_read, created_at, teacher_id, student_id")
        .eq("parent_user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (studentsResponse.error) throw studentsResponse.error;
    if (messagesResponse.error) throw messagesResponse.error;

    const linkedStudents = studentsResponse.data || [];
    // Only staff from the parent's own children's schools may ever be surfaced
    const allowedSchoolIds = [...new Set(linkedStudents.map((s: any) => s.school_id).filter(Boolean))] as string[];
    const classArmIds = [...new Set(linkedStudents.map((student: any) => student.current_class_arm_id).filter(Boolean))] as string[];


    const [teacherAssignmentsResponse, classArmsResponse] = await Promise.all([
      classArmIds.length > 0
        ? adminClient.from("teacher_subjects").select("teacher_id, class_arm_id").in("class_arm_id", classArmIds)
        : Promise.resolve({ data: [], error: null }),
      classArmIds.length > 0
        ? adminClient
            .from("class_arms")
            .select("id, form_teacher_id")
            .in("id", classArmIds)
            .not("form_teacher_id", "is", null)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (teacherAssignmentsResponse.error) throw teacherAssignmentsResponse.error;
    if (classArmsResponse.error) throw classArmsResponse.error;

    const teacherIdsByStudent = new Map<string, Set<string>>();
    const classTeacherMap = new Map<string, Set<string>>();

    (teacherAssignmentsResponse.data || []).forEach((row: any) => {
      const existing = classTeacherMap.get(row.class_arm_id) || new Set<string>();
      existing.add(row.teacher_id);
      classTeacherMap.set(row.class_arm_id, existing);
    });

    (classArmsResponse.data || []).forEach((classArm: any) => {
      if (!classArm.form_teacher_id) return;
      const existing = classTeacherMap.get(classArm.id) || new Set<string>();
      existing.add(classArm.form_teacher_id);
      classTeacherMap.set(classArm.id, existing);
    });

    linkedStudents.forEach((student: any) => {
      const teacherIds = new Set<string>();
      const classTeachers = student.current_class_arm_id ? classTeacherMap.get(student.current_class_arm_id) : undefined;
      classTeachers?.forEach((teacherId: string) => teacherIds.add(teacherId));
      teacherIdsByStudent.set(student.id, teacherIds);
    });

    let teacherIds = [...new Set(Array.from(teacherIdsByStudent.values()).flatMap((value) => Array.from(value)))];

    if (teacherIds.length === 0 && allowedSchoolIds.length > 0) {
      const { data: fallbackTeachers, error: fallbackError } = await adminClient
        .from("teachers")
        .select("id")
        .eq("is_active", true)
        .in("school_id", allowedSchoolIds);

      if (fallbackError) throw fallbackError;
      teacherIds = (fallbackTeachers || []).map((teacher: any) => teacher.id);
    }

    const { data: teachers, error: teachersError } = await adminClient
      .from("teachers")
      .select("id, user_id, school_id")
      .in("id", teacherIds.length > 0 ? teacherIds : ["00000000-0000-0000-0000-000000000000"])
      .in("school_id", allowedSchoolIds.length > 0 ? allowedSchoolIds : ["00000000-0000-0000-0000-000000000000"])
      .eq("is_active", true);


    if (teachersError) throw teachersError;

    const teacherUserIds = (teachers || []).map((teacher: any) => teacher.user_id);
    const messageTeacherIds = [...new Set((messagesResponse.data || []).map((message: any) => message.teacher_id))];
    const missingTeacherIds = messageTeacherIds.filter((teacherId: string) => !(teachers || []).some((teacher: any) => teacher.id === teacherId));

    if (missingTeacherIds.length > 0) {
      const { data: missingTeachers, error: missingTeachersError } = await adminClient
        .from("teachers")
        .select("id, user_id")
        .in("id", missingTeacherIds);

      if (missingTeachersError) throw missingTeachersError;
      teachers?.push(...(missingTeachers || []));
      teacherUserIds.push(...(missingTeachers || []).map((teacher: any) => teacher.user_id));
    }

    const { data: teacherProfiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("id, full_name")
      .in("id", [...new Set(teacherUserIds)]);

    if (profilesError) throw profilesError;

    const teacherNameByUserId = new Map((teacherProfiles || []).map((profile: any) => [profile.id, profile.full_name]));
    const teacherNameById = new Map((teachers || []).map((teacher: any) => [teacher.id, teacherNameByUserId.get(teacher.user_id) || "Unknown Teacher"]));
    const studentNameById = new Map(
      linkedStudents.map((student: any) => [student.id, `${student.first_name} ${student.last_name}`.trim()]),
    );

    const availableTeachers = (teachers || []).map((teacher: any) => ({
      id: teacher.id,
      name: teacherNameById.get(teacher.id) || "Unknown Teacher",
    }));

    // Add Admin users as contactable entities
    // We use a special prefix "admin_" to distinguish admin entries from teacher entries
    const { data: adminRoles } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (adminRoles && adminRoles.length > 0) {
      const adminUserIds = adminRoles.map((r: any) => r.user_id);
      const { data: adminProfiles } = await adminClient
        .from("profiles")
        .select("id, full_name")
        .in("id", adminUserIds);

      // We need a teacher record for the admin to store messages.
      // Check if admin has a teacher record, if not we'll create a virtual mapping.
      // For messaging, we'll use admin user_id as teacher_id reference via teachers table.
      const { data: adminTeachers } = await adminClient
        .from("teachers")
        .select("id, user_id")
        .in("user_id", adminUserIds);

      const adminTeacherMap = new Map((adminTeachers || []).map((t: any) => [t.user_id, t.id]));

      (adminProfiles || []).forEach((profile: any) => {
        const teacherId = adminTeacherMap.get(profile.id);
        if (teacherId) {
          // Admin has a teacher record, add them as a teacher option
          const alreadyExists = availableTeachers.some((t: any) => t.id === teacherId);
          if (!alreadyExists) {
            availableTeachers.push({
              id: teacherId,
              name: `${profile.full_name} (Admin)`,
            });
          }
        }
      });
    }

    const teacherIdsByStudentRecord = Object.fromEntries(
      [...teacherIdsByStudent.entries()].map(([studentId, ids]) => [studentId, Array.from(ids)]),
    );

    const messages = (messagesResponse.data || []).map((message: any) => ({
      ...message,
      teacher_name: teacherNameById.get(message.teacher_id) || "Admin",
      student_name: studentNameById.get(message.student_id) || "Unknown Student",
    }));

    return new Response(
      JSON.stringify({
        linkedStudents: linkedStudents.map((student: any) => ({
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          current_class_arm_id: student.current_class_arm_id,
        })),
        teachers: availableTeachers,
        teacherIdsByStudent: teacherIdsByStudentRecord,
        messages,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
