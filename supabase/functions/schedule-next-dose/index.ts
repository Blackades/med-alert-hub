// utils.ts

/**
 * CORS headers for all responses
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

/**
 * Standard success response format
 */
export function successResponse(data: any, status = 200) {
  return new Response(
    JSON.stringify({ 
      success: true,
      data 
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    }
  );
}

/**
 * Standard error response format
 */
export function errorResponse(message: string, status = 500) {
  return new Response(
    JSON.stringify({ 
      success: false,
      error: message 
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    }
  );
}
