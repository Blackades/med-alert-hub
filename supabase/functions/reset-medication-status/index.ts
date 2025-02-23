
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting daily medication status reset");

    // Reset all medication schedules 'taken' status to false
    const { error } = await supabase
      .from('medication_schedules')
      .update({ taken: false })
      .neq('id', '0'); // This will update all records

    if (error) {
      throw error;
    }

    console.log("Successfully reset medication statuses");

    return new Response(
      JSON.stringify({ success: true, message: "Medication statuses reset successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error resetting medication statuses:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to reset medication statuses" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
