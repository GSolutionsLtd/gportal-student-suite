import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cronSecret = Deno.env.get("CRON_SECRET");

    // Restrict to scheduler (shared secret) OR authenticated super_admin
    const providedCron = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("Authorization") || "";
    let authorized = false;
    if (cronSecret && providedCron && providedCron === cronSecret) {
      authorized = true;
    } else if (authHeader.startsWith("Bearer ")) {
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await anonClient.auth.getUser();
      if (userData?.user) {
        const { data: isSuper } = await anonClient.rpc("has_role", {
          _user_id: userData.user.id,
          _role: "super_admin",
        });
        authorized = Boolean(isSuper);
      }
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    // Find all schools with expired subscriptions that are still marked as active
    const { data: expiredSchools, error: fetchError } = await supabase
      .from("schools")
      .select("id, name, subscription_status, subscription_ends_at")
      .lt("subscription_ends_at", now)
      .in("subscription_status", ["active", "trial"]);

    if (fetchError) {
      console.error("Error fetching expired schools:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${expiredSchools?.length || 0} schools with expired subscriptions`);

    if (!expiredSchools || expiredSchools.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No expired subscriptions found",
          processed: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update all expired schools to 'expired' status
    const expiredIds = expiredSchools.map((school) => school.id);
    
    const { error: updateError } = await supabase
      .from("schools")
      .update({ subscription_status: "expired" })
      .in("id", expiredIds);

    if (updateError) {
      console.error("Error updating expired schools:", updateError);
      throw updateError;
    }

    console.log(`Updated ${expiredIds.length} schools to expired status`);

    // Log the action
    for (const school of expiredSchools) {
      console.log(`School "${school.name}" (${school.id}) subscription expired. Previous status: ${school.subscription_status}, Ended at: ${school.subscription_ends_at}`);
    }

    // Also check for schools about to expire (within 7 days) for notifications
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const { data: soonToExpire, error: soonError } = await supabase
      .from("schools")
      .select("id, name, subscription_ends_at")
      .gt("subscription_ends_at", now)
      .lt("subscription_ends_at", sevenDaysFromNow.toISOString())
      .eq("subscription_status", "active");

    if (!soonError && soonToExpire && soonToExpire.length > 0) {
      console.log(`${soonToExpire.length} schools have subscriptions expiring within 7 days`);
      
      // Create notifications for school admins
      for (const school of soonToExpire) {
        // Get school admins
        const { data: admins } = await supabase
          .from("school_admins")
          .select("user_id")
          .eq("school_id", school.id);

        if (admins) {
          for (const admin of admins) {
            const daysRemaining = Math.ceil(
              (new Date(school.subscription_ends_at!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
            );

            // Skip if we already notified this admin about this school recently (unread)
            const { data: existing } = await supabase
              .from("notifications")
              .select("id")
              .eq("user_id", admin.user_id)
              .eq("title", "Subscription Expiring Soon")
              .ilike("message", `%${school.name}%`)
              .eq("is_read", false)
              .limit(1)
              .maybeSingle();
            if (existing) continue;

            await supabase.from("notifications").insert({
              user_id: admin.user_id,
              title: "Subscription Expiring Soon",
              message: `Your school subscription for "${school.name}" will expire in ${daysRemaining} days. Please renew to continue accessing all features.`,
              type: "warning",
              link: "/super-admin/schools",
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${expiredIds.length} expired subscriptions`,
        processed: expiredIds.length,
        expiredSchools: expiredSchools.map((s) => ({ id: s.id, name: s.name })),
        soonToExpire: soonToExpire?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Subscription expiry check error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
