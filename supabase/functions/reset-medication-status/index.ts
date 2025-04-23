import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Configuration
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const allowedOrigins = Deno.env.get("ALLOWED_ORIGINS")?.split(",") || ["*"];

// Validation
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

// Initialize Supabase client with retry options
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  db: {
    schema: 'public',
  },
  global: {
    fetch: fetch,
    headers: { 'x-medication-reset-service': 'true' },
  },
});

// CORS configuration with origin validation
const getCorsHeaders = (requestOrigin: string | null) => {
  const origin = allowedOrigins.includes("*") || (requestOrigin && allowedOrigins.includes(requestOrigin)) 
    ? requestOrigin || "*" 
    : allowedOrigins[0];
  
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
};

// Custom error class for better error handling
class MedicationResetError extends Error {
  status: number;
  code: string;
  
  constructor(message: string, status = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name = "MedicationResetError";
    this.status = status;
    this.code = code;
  }
}

// Type definitions
interface MedicationSchedule {
  id: string;
  patient_id: string;
  medication_id: string;
  taken: boolean;
  schedule_time: string;
  updated_at: string;
}

interface MedicationResetOptions {
  patientId?: string;
  forceReset?: boolean;
  dryRun?: boolean;
  scheduleDate?: string;
}

/**
 * Reset medication schedules for patients
 * Can be configured to reset for specific patients, dates, or in dry-run mode
 */
async function resetMedicationStatuses(options: MedicationResetOptions = {}) {
  const { patientId, forceReset = false, dryRun = false, scheduleDate } = options;
  
  // Get the current date in server's timezone
  const today = scheduleDate || new Date().toISOString().split('T')[0];
  const startTime = performance.now();
  
  try {
    console.log(`Starting medication status reset for date: ${today}, options:`, {
      patientId: patientId || 'all',
      forceReset,
      dryRun
    });

    let query = supabase
      .from('medication_schedules')
      .update({ 
        taken: false,
        updated_at: new Date().toISOString()
      });
    
    // Only reset medications for today's schedule
    query = query.eq('schedule_date', today);
    
    // Filter by patient if specified
    if (patientId) {
      query = query.eq('patient_id', patientId);
    }
    
    // If not forcing, only reset medications that weren't taken
    if (!forceReset) {
      query = query.eq('taken', true);
    }

    // Execute or just count if dry run
    let result;
    if (dryRun) {
      // In dry run, we get the count of records that would be affected
      const countQuery = supabase
        .from('medication_schedules')
        .select('id', { count: 'exact' })
        .eq('schedule_date', today);
        
      if (patientId) {
        countQuery.eq('patient_id', patientId);
      }
      
      if (!forceReset) {
        countQuery.eq('taken', true);
      }
      
      const { count, error: countError } = await countQuery;
      
      if (countError) {
        throw new MedicationResetError(`Error counting records: ${countError.message}`, 500);
      }
      
      result = { count, records: [] };
    } else {
      // Real execution mode
      const { data, error } = await query;
      
      if (error) {
        throw new MedicationResetError(`Database update error: ${error.message}`, 500, error.code);
      }
      
      // Log updated medication IDs for audit trail
      const { data: updatedData, error: fetchError } = await supabase
        .from('medication_schedules')
        .select('id, medication_id, patient_id')
        .eq('schedule_date', today)
        .eq('taken', false);
        
      if (fetchError) {
        console.warn("Couldn't fetch updated records for logging:", fetchError);
      }
      
      result = { 
        count: updatedData?.length || 0,
        records: updatedData || []
      };
    }

    // Add entry to the audit log
    if (!dryRun) {
      const { error: auditError } = await supabase
        .from('medication_reset_logs')
        .insert({
          reset_date: today,
          reset_by: 'system',
          patient_id: patientId || null,
          affected_count: result.count,
          reset_type: forceReset ? 'force' : 'standard'
        });
        
      if (auditError) {
        console.error("Failed to log reset action:", auditError);
      }
    }

    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`Successfully processed medication reset in ${duration}ms. ${dryRun ? '(DRY RUN)' : ''} Affected records: ${result.count}`);
    
    return {
      success: true,
      mode: dryRun ? 'dry_run' : 'executed',
      date: today,
      affected_count: result.count,
      duration_ms: parseFloat(duration),
      patient_id: patientId || null
    };
  } catch (error) {
    console.error("Failed to reset medication statuses:", error);
    throw error;
  }
}

/**
 * Authentication middleware to validate requests
 */
async function authenticate(req: Request): Promise<boolean> {
  try {
    const authHeader = req.headers.get('authorization');
    
    // If no auth header is present, check for function password
    if (!authHeader) {
      const functionPassword = Deno.env.get("FUNCTION_PASSWORD");
      if (!functionPassword) return true; // If no password set, allow access
      
      const url = new URL(req.url);
      const passwordParam = url.searchParams.get('password');
      return passwordParam === functionPassword;
    }
    
    // Extract JWT token
    const token = authHeader.replace('Bearer ', '');
    
    // Verify the token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.warn("Authentication failed:", error?.message || "No user found");
      return false;
    }
    
    // Check for admin role in user metadata
    const isAdmin = user.app_metadata?.role === 'admin' || user.app_metadata?.is_admin === true;
    return isAdmin;
  } catch (err) {
    console.error("Error during authentication:", err);
    return false;
  }
}

// Main request handler
serve(async (req: Request) => {
  const requestOrigin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(requestOrigin);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      headers: corsHeaders,
      status: 204
    });
  }
  
  try {
    // Validate authentication
    const isAuthenticated = await authenticate(req);
    if (!isAuthenticated) {
      throw new MedicationResetError("Unauthorized access", 401, "UNAUTHORIZED");
    }
    
    // Parse the request URL and body
    const url = new URL(req.url);
    const patientId = url.searchParams.get('patient_id');
    const dryRun = url.searchParams.get('dry_run') === 'true';
    const forceReset = url.searchParams.get('force') === 'true';
    const scheduleDate = url.searchParams.get('date') || undefined;
    
    // Additional validation
    if (scheduleDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(scheduleDate)) {
        throw new MedicationResetError("Invalid date format. Use YYYY-MM-DD", 400, "INVALID_DATE");
      }
    }
    
    // Execute medication reset with options
    const result = await resetMedicationStatuses({
      patientId: patientId || undefined,
      forceReset,
      dryRun,
      scheduleDate
    });
    
    // Send successful response
    return new Response(
      JSON.stringify({
        success: true,
        ...result
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in medication reset endpoint:", error);
    
    // Determine appropriate status code
    const status = error instanceof MedicationResetError ? error.status : 500;
    const errorCode = error instanceof MedicationResetError ? error.code : "INTERNAL_ERROR";
    
    // Return error response
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || "An unknown error occurred",
        code: errorCode,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      }
    );
  }
});
