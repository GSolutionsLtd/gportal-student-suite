import { supabase } from "@/integrations/supabase/client";

type AuditAction =
  | "create" | "update" | "delete" | "approve" | "reject"
  | "publish" | "unpublish" | "upload" | "download";

interface AuditEvent {
  action: AuditAction;
  table_name: string;
  record_id?: string | null;
  school_id?: string | null;
  data?: Record<string, unknown>;
}

/**
 * Best-effort client audit event. RLS only allows rows where user_id = auth.uid(),
 * and visibility is limited to super admins and the school's own admins.
 */
export async function logAuditEvent({ action, table_name, record_id, school_id, data }: AuditEvent) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return;
    await supabase.from("audit_logs").insert({
      user_id: uid,
      school_id: school_id ?? null,
      action: action as any,
      table_name,
      record_id: record_id ?? null,
      new_data: (data ?? {}) as any,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    } as any);
  } catch {
    // auditing must never block the user action
  }
}
