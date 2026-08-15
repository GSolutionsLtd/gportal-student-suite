import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Download, X, Paperclip } from "lucide-react";
import {
  ALLOWED_ASSIGNMENT_EXTENSIONS,
  MAX_ASSIGNMENT_FILES,
  assignmentWindowError,
  fileNameFromPath,
  isExternalUrl,
  openAssignmentFile,
  removeAssignmentFile,
  uploadAssignmentFile,
  validateAssignmentFile,
} from "@/lib/assignmentFiles";

interface Props {
  /** Storage folder, e.g. `${schoolId}/assignments/${assignmentId}` */
  folder: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  allowExternalUrl?: boolean;
  /** When set, uploads are blocked once the due date has passed. */
  dueAt?: string | Date | null;
  /** Maximum number of files that may be uploaded through this field. */
  maxFiles?: number;
}

export default function AssignmentFileField({
  folder,
  value,
  onChange,
  label = "Attachment",
  disabled,
  allowExternalUrl = true,
  dueAt = null,
  maxFiles = MAX_ASSIGNMENT_FILES,
}: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadCount, setUploadCount] = useState(0);

  const windowClosed = assignmentWindowError(dueAt);
  const limitReached = uploadCount >= maxFiles;
  const blockedReason = windowClosed
    ?? (limitReached ? `Upload limit reached (${maxFiles} file${maxFiles === 1 ? "" : "s"}).` : null);

  const fail = (message: string) => {
    setError(message);
    toast({ title: "File rejected", description: message, variant: "destructive" });
  };

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    setError(null);
    if (blockedReason) return fail(blockedReason);

    const invalid = validateAssignmentFile(file);
    if (invalid) return fail(invalid);

    setBusy(true);
    try {
      const path = await uploadAssignmentFile(file, folder, {
        dueAt,
        existingCount: uploadCount,
        maxFiles,
      });
      if (value && !isExternalUrl(value)) await removeAssignmentFile(value);
      onChange(path);
      setUploadCount((c) => c + 1);
      toast({ title: "File uploaded", description: file.name });
    } catch (err: any) {
      fail(err.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };


  const download = async () => {
    try {
      await openAssignmentFile(value);
    } catch (err: any) {
      toast({ title: "Cannot open file", description: err.message, variant: "destructive" });
    }
  };

  const clear = async () => {
    const old = value;
    onChange("");
    if (old && !isExternalUrl(old)) {
      try { await removeAssignmentFile(old); } catch { /* ignore */ }
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {value ? (
        <div className="flex items-center gap-2 rounded-md border p-2">
          <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm truncate flex-1">
            {isExternalUrl(value) ? value : fileNameFromPath(value)}
          </span>
          <Button type="button" size="sm" variant="outline" onClick={download}>
            <Download className="h-4 w-4" />
          </Button>
          {!disabled && (
            <Button type="button" size="sm" variant="ghost" onClick={clear}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={ALLOWED_ASSIGNMENT_EXTENSIONS.map((e) => `.${e}`).join(",")}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Upload file
          </Button>
          {allowExternalUrl && (
            <Input
              placeholder="…or paste a link (https://)"
              disabled={disabled}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && isExternalUrl(v)) onChange(v);
              }}
            />
          )}
          <p className="text-xs text-muted-foreground">
            Max 10 MB • {ALLOWED_ASSIGNMENT_EXTENSIONS.slice(0, 8).join(", ")}…
          </p>
        </div>
      )}
    </div>
  );
}
