
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { medicationId, refillQuantity, date, notes } = await req.json();

    // Get current medication inventory
    const { data: inventory, error: inventoryFetchError } = await supabase
      .from('medication_inventory')
      .select('*')
      .eq('medication_id', medicationId)
      .single();

    if (inventoryFetchError && inventoryFetchError.code !== 'PGRST116') { // PGRST116 is not found
      throw inventoryFetchError;
    }

    const now = new Date();
    
    if (inventory) {
      // Update existing inventory
      const newQuantity = inventory.current_quantity + refillQuantity;
      const { error: updateError } = await supabase
        .from('medication_inventory')
        .update({
          current_quantity: newQuantity,
          last_updated: now.toISOString(),
          last_refill_date: now.toISOString(),
          last_refill_quantity: refillQuantity
        })
        .eq('medication_id', medicationId);

      if (updateError) throw updateError;
    } else {
      // Create new inventory record
      const { error: createError } = await supabase
        .from('medication_inventory')
        .insert({
          medication_id: medicationId,
          current_quantity: refillQuantity,
          last_updated: now.toISOString(),
          last_refill_date: now.toISOString(),
          last_refill_quantity: refillQuantity,
          dose_amount: 1, // Default dose amount
          refill_threshold: Math.floor(refillQuantity * 0.2) // Default threshold at 20% of total
        });

      if (createError) throw createError;
    }

    // Log the refill
    const { error: refillLogError } = await supabase
      .from('medication_refill_logs')
      .insert({
        medication_id: medicationId,
        refill_date: date || now.toISOString(),
        quantity: refillQuantity,
        notes: notes || null
      });

    if (refillLogError) {
      console.error("Error logging refill:", refillLogError);
    }

    // Get medication details for the response
    const { data: medication } = await supabase
      .from('medications')
      .select('name, dosage')
      .eq('id', medicationId)
      .single();

    return new Response(
      JSON.stringify({ 
        success: true,
        medication: medication || { id: medicationId },
        refillQuantity: refillQuantity
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in medication-refill:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
