import { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: string;
  videoUrl?: string;
}

const DEFAULT_VIDEO =
  "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&modestbranding=1";

export function ProductTourModal({
  open,
  onOpenChange,
  source = "homepage_hero",
  videoUrl = DEFAULT_VIDEO,
}: Props) {
  useEffect(() => {
    if (!open) return;
    // Fire-and-forget click tracking
    supabase
      .from("product_tour_clicks")
      .insert([{ source, user_agent: navigator.userAgent }])
      .then(() => undefined);
  }, [open, source]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black border-0">
        <DialogHeader className="sr-only">
          <DialogTitle>GPortal Suite Product Tour</DialogTitle>
        </DialogHeader>
        <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
          {open && (
            <iframe
              className="absolute inset-0 h-full w-full"
              src={videoUrl}
              title="GPortal Suite Product Tour"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
