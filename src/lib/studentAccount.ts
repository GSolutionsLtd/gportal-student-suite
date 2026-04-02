import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type LinkedStudentRecord = Pick<
  Tables<"students">,
  | "id"
  | "first_name"
  | "last_name"
  | "admission_number"
  | "current_class_arm_id"
  | "user_id"
>;

export async function getLinkedStudentByUserId(userId: string) {
  const { data, error } = await supabase
    .from("students")
    .select("id, first_name, last_name, admission_number, current_class_arm_id, user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as LinkedStudentRecord | null;
}

export function getStudentFullName(student: Pick<LinkedStudentRecord, "first_name" | "last_name">) {
  return `${student.first_name} ${student.last_name}`.trim();
}