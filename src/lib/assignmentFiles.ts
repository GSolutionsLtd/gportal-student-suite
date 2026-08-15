import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/auditLog";

export const ASSIGNMENT_BUCKET = "assignment-files";

/** Storage paths look like `<school_id>/<assignments|submissions>/<id>/...` */
const schoolIdFromPath = (path: string) => {
  const seg = path.split("/")[0];
  return /^[0-9a-f-]{36}$/i.test(seg) ? seg : null;
};

const contextFromPath = (path: string) => {
  const [, kind, id] = path.split("/");
  return { kind: kind ?? null, context_id: id ?? null };
};


export const MAX_ASSIGNMENT_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_ASSIGNMENT_EXTENSIONS = [
  "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx",
  "txt", "csv", "png", "jpg", "jpeg", "webp", "zip",
];

export const isExternalUrl = (value?: string | null) =>
  !!value && /^https?:\/\//i.test(value);

export const fileNameFromPath = (value?: string | null) => {
  if (!value) return "";
  const clean = value.split("?")[0];
  return decodeURIComponent(clean.substring(clean.lastIndexOf("/") + 1));
};

export function validateAssignmentFile(file: File): string | null {
  if (file.size > MAX_ASSIGNMENT_FILE_BYTES) {
    return `File is too large (max ${MAX_ASSIGNMENT_FILE_BYTES / (1024 * 1024)} MB).`;
  }
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_ASSIGNMENT_EXTENSIONS.includes(ext)) {
    return `Unsupported file type ".${ext}". Allowed: ${ALLOWED_ASSIGNMENT_EXTENSIONS.join(", ")}.`;
  }
  return null;
}

const slug = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-80);

/** Uploads a file to the private assignment bucket and returns its storage path. */
export async function uploadAssignmentFile(
  file: File,
  folder: string,
): Promise<string> {
  const invalid = validateAssignmentFile(file);
  if (invalid) throw new Error(invalid);

  const path = `${folder.replace(/\/+$/, "")}/${Date.now()}-${slug(file.name)}`;
  const { error } = await supabase.storage
    .from(ASSIGNMENT_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw error;

  void logAuditEvent({
    action: "upload",
    table_name: "assignment_files",
    school_id: schoolIdFromPath(path),
    data: { event: "attachment_uploaded", path, size: file.size, ...contextFromPath(path) },
  });
  return path;
}

/**
 * Returns a signed, time-limited (10 min) download URL for a stored path.
 * Access is enforced by storage RLS: students only receive a URL for files
 * belonging to assignments published to their class arm, or their own submissions.
 */
export async function getAssignmentFileUrl(value: string): Promise<string> {
  if (isExternalUrl(value)) return value;
  const { data, error } = await supabase.storage
    .from(ASSIGNMENT_BUCKET)
    .createSignedUrl(value, 60 * 10);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "You don't have access to this file.");
  }
  return data.signedUrl;
}

export async function openAssignmentFile(value: string) {
  const url = await getAssignmentFileUrl(value);
  if (!isExternalUrl(value)) {
    void logAuditEvent({
      action: "download",
      table_name: "assignment_files",
      school_id: schoolIdFromPath(value),
      data: { event: "attachment_downloaded", path: value, ...contextFromPath(value) },
    });
  }
  window.open(url, "_blank", "noopener,noreferrer");
}


export async function removeAssignmentFile(value: string) {
  if (isExternalUrl(value)) return;
  await supabase.storage.from(ASSIGNMENT_BUCKET).remove([value]);
}
