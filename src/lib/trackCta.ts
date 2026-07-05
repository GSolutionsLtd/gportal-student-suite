import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget click tracker for homepage CTAs and marketing surfaces.
 * Reuses the product_tour_clicks table (source is a free-form string).
 */
export function trackCta(source: string) {
  try {
    supabase
      .from("product_tour_clicks")
      .insert([{ source, user_agent: navigator.userAgent }])
      .then(() => undefined);
  } catch {
    // never block navigation on analytics
  }
}
