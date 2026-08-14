import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fileNameFromPath, isExternalUrl, openAssignmentFile } from "@/lib/assignmentFiles";

interface Props {
  value: string;
  label?: string;
  className?: string;
}

export default function AttachmentLink({ value, label, className }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setBusy(true);
    try {
      await openAssignmentFile(value);
    } catch (err: any) {
      toast({ title: "Cannot open file", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={open}
      className={
        className ??
        "inline-flex items-center gap-1 text-xs text-primary hover:underline max-w-full"
      }
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
      <span className="truncate">
        {label ?? (isExternalUrl(value) ? "Attachment link" : fileNameFromPath(value) || "Attachment")}
      </span>
    </button>
  );
}
