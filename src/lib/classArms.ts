import { supabase } from "@/integrations/supabase/client";

export interface ClassArmOption {
  id: string;
  /** Bare arm name, e.g. "A" */
  name: string;
  /** Parent class name, e.g. "JSS 1" */
  className: string;
  /** Full human label, e.g. "JSS 1 A" */
  label: string;
  level: number;
}

/** Builds "JSS 1 A" from a class_arms row joined with classes. */
export function buildArmLabel(row: any): string {
  const cls = row?.classes?.name ?? row?.class_name ?? "";
  const arm = row?.name ?? "";
  const label = `${cls} ${arm}`.trim();
  return label || arm || "Class";
}

/**
 * Loads class arms for a school with their parent class name, sorted by class
 * level then arm name so pickers read naturally (JSS 1 A, JSS 1 B, JSS 2 A...).
 */
export async function fetchClassArmOptions(
  schoolId: string,
  opts?: { activeOnly?: boolean },
): Promise<ClassArmOption[]> {
  let query = supabase
    .from("class_arms")
    .select("id, name, classes(name, level)")
    .eq("school_id", schoolId);

  if (opts?.activeOnly !== false) query = query.eq("is_active", true);

  const { data } = await query;

  return ((data as any[]) ?? [])
    .map((row) => ({
      id: row.id as string,
      name: (row.name ?? "") as string,
      className: (row.classes?.name ?? "") as string,
      label: buildArmLabel(row),
      level: Number(row.classes?.level ?? 0),
    }))
    .sort((a, b) => a.level - b.level || a.label.localeCompare(b.label));
}
