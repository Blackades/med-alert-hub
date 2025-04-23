import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { z } from "https://deno.land/x/zod@v3.21.4/mod.ts";

// Environment validation
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const envVar of requiredEnvVars) {
  if (!Deno.env.get(envVar)) {
    console.error(`Missing required environment variable: ${envVar}`);
    // Continue execution but log the error - you may want to throw an error instead
  }
}

// CORS Headers
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json"
};

// Request body validation schema
const RequestSchema = z.object({
  medicationId: z.string().uuid({ message: "Valid medication ID is required" }),
  refillQuantity: z.number().positive({ message: "Refill quantity must be positive" }),
  date: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(500).optional(),
  // Add optional prescription details
  prescriptionId: z.string().uuid().optional(),
  refillSource: z.enum(["pharmacy", "doctor", "mail", "other"]).optional(),
  // For tracking partial refills
  isPartialRefill: z.boolean().optional(),
  totalPrescribedQuantity: z.number().positive().optional(),
});

// Response builders
function buildSuccessResponse(data: any) {
  return new Response(JSON.stringify({ success: true, data }), {
    headers: CORS_HEADERS,
    status: 200,
  });
}

function buildErrorResponse(message: string, status = 400, details?: any) {
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: message,
      details: details || null,
      timestamp: new Date().toISOString()
    }),
    {
      headers: CORS_HEADERS,
      status,
    }
  );
}

// Database interaction functions
async function getMedicationInventory(supabase, medicationId) {
  const { data, error } = await supabase
    .from('medication_inventory')
    .select('*')
    .eq('medication_id', medicationId)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 is not found
    throw new Error(`Failed to fetch inventory: ${error.message}`);
  }
  
  return { data, error };
}

async function getMedicationDetails(supabase, medicationId) {
  const { data, error } = await supabase
    .from('medications')
    .select('id, name, dosage, instructions, type, unit, prescriber, max_daily_dose')
    .eq('id', medicationId)
    .single();
  
  if (error) {
    throw new Error(`Failed to fetch medication details: ${error.message}`);
  }
  
  if (!data) {
    throw new Error(`Medication with ID ${medicationId} not found`);
  }
  
  return data;
}

// Main handler function
serve(async (req) => {
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  
  // Only allow POST requests
  if (req.method !== "POST") {
    return buildErrorResponse("Method not allowed. Use POST.", 405);
  }

  try {
    // Parse and validate request body
    const requestBody = await req.json().catch(() => ({}));
    const validationResult = RequestSchema.safeParse(requestBody);
    
    if (!validationResult.success) {
      return buildErrorResponse("Invalid request data", 400, validationResult.error.format());
    }
    
    const { 
      medicationId, 
      refillQuantity, 
      date, 
      notes,
      prescriptionId,
      refillSource,
      isPartialRefill,
      totalPrescribedQuantity
    } = validationResult.data;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      return buildErrorResponse("Server configuration error", 500);
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // First verify the medication exists
    const medication = await getMedicationDetails(supabase, medicationId);
    
    // Start a transaction for data consistency
    const now = new Date();
    const refillDate = date ? new Date(date) : now;
    
    // Get current inventory state
    const { data: inventory } = await getMedicationInventory(supabase, medicationId);
    
    // Calculate default refill threshold if needed
    const defaultRefillThreshold = Math.max(
      Math.floor(refillQuantity * 0.2), 
      medication.max_daily_dose ? medication.max_daily_dose * 7 : 5 // At least a week's supply or 5 units
    );
    
    // Update or create inventory record
    if (inventory) {
      // Update existing inventory
      const newQuantity = inventory.current_quantity + refillQuantity;
      const { error: updateError } = await supabase
        .from('medication_inventory')
        .update({
          current_quantity: newQuantity,
          last_updated: now.toISOString(),
          last_refill_date: refillDate.toISOString(),
          last_refill_quantity: refillQuantity,
          // Only update refill threshold if not already set
          refill_threshold: inventory.refill_threshold || defaultRefillThreshold,
          total_refilled: (inventory.total_refilled || 0) + refillQuantity
        })
        .eq('medication_id', medicationId);
        
      if (updateError) {
        throw new Error(`Failed to update inventory: ${updateError.message}`);
      }
    } else {
      // Create new inventory record
      const { error: createError } = await supabase
        .from('medication_inventory')
        .insert({
          medication_id: medicationId,
          current_quantity: refillQuantity,
          last_updated: now.toISOString(),
          last_refill_date: refillDate.toISOString(),
          last_refill_quantity: refillQuantity,
          dose_amount: medication.dosage ? parseFloat(medication.dosage) : 1,
          refill_threshold: defaultRefillThreshold,
          total_refilled: refillQuantity,
          created_at: now.toISOString()
        });
        
      if (createError) {
        throw new Error(`Failed to create inventory: ${createError.message}`);
      }
    }
    
    // Enhanced refill log with more information
    const refillLogData = {
      medication_id: medicationId,
      refill_date: refillDate.toISOString(),
      quantity: refillQuantity,
      notes: notes || null,
      prescription_id: prescriptionId || null,
      refill_source: refillSource || "other",
      is_partial_refill: isPartialRefill || false,
      total_prescribed_quantity: totalPrescribedQuantity || null,
      created_at: now.toISOString()
    };
    
    const { error: refillLogError } = await supabase
      .from('medication_refill_logs')
      .insert(refillLogData);
      
    if (refillLogError) {
      console.error("Error logging refill:", refillLogError);
      // Continue processing but log the error
    }
    
    // Check if medication is now above threshold
    const wasBelowThreshold = inventory && 
      inventory.current_quantity < (inventory.refill_threshold || defaultRefillThreshold);
    const isNowAboveThreshold = (inventory?.current_quantity || 0) + refillQuantity >= 
      (inventory?.refill_threshold || defaultRefillThreshold);
    
    // If medication was below threshold but is now above, log this event
    if (wasBelowThreshold && isNowAboveThreshold) {
      await supabase
        .from('medication_events')
        .insert({
          medication_id: medicationId,
          event_type: 'threshold_restored',
          event_date: now.toISOString(),
          details: {
            previous_quantity: inventory?.current_quantity || 0,
            new_quantity: (inventory?.current_quantity || 0) + refillQuantity,
            threshold: inventory?.refill_threshold || defaultRefillThreshold
          }
        })
        .catch(err => console.error("Failed to log threshold restoration event:", err));
    }
    
    // Calculate days supply based on dosage and refill quantity (if dosage info available)
    let daysSupply = null;
    if (medication.max_daily_dose && refillQuantity) {
      daysSupply = Math.floor(refillQuantity / medication.max_daily_dose);
    }
    
    // Return enhanced response with useful information
    return buildSuccessResponse({ 
      medication,
      refill: {
        quantity: refillQuantity,
        date: refillDate.toISOString(),
        source: refillSource || "other"
      },
      inventory: {
        current_quantity: (inventory?.current_quantity || 0) + refillQuantity,
        refill_threshold: inventory?.refill_threshold || defaultRefillThreshold,
        days_supply: daysSupply
      }
    });
    
  } catch (error) {
    console.error("Error in medication-refill:", error);
    
    // Determine appropriate error status
    let status = 500;
    if (error.message.includes("not found")) status = 404;
    if (error.message.includes("validation")) status = 400;
    
    return buildErrorResponse(
      `Failed to process medication refill: ${error.message}`, 
      status
    );
  }
});
