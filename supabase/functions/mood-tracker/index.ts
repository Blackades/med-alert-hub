import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Environment configuration with validation
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseKey) {
  console.error("Required environment variables missing: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

// Create Supabase client with error handling
const supabase = createClient(supabaseUrl, supabaseKey);

// Constants
const TABLE_NAME = 'mood_entries';
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const ALLOWED_ORIGINS = [
  '*', // Replace with specific origins in production
];

// CORS configuration
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400", // 24 hours
};

// Input validation schemas
const UuidSchema = z.string().uuid("Invalid UUID format");

const DateSchema = z.string()
  .refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format. Please use ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ)"
  });

const MoodSchema = z.number()
  .int()
  .min(1, "Mood must be at least 1")
  .max(10, "Mood must be at most 10");

const NotesSchema = z.string()
  .max(1000, "Notes cannot exceed 1000 characters")
  .optional();

const CreateEntrySchema = z.object({
  userId: UuidSchema,
  date: DateSchema.optional(),
  mood: MoodSchema,
  notes: NotesSchema,
});

const UpdateEntrySchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  date: DateSchema.optional(),
  mood: MoodSchema.optional(),
  notes: NotesSchema,
});

const GetEntriesSchema = z.object({
  userId: UuidSchema,
  limit: z.number().int().min(1).max(MAX_LIMIT).optional(),
  offset: z.number().int().min(0).optional(),
  startDate: DateSchema.optional(),
  endDate: DateSchema.optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const DeleteEntrySchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
});

// Authentication middleware
async function authenticateRequest(req: Request): Promise<{ user: any, error: string | null }> {
  try {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null, error: 'Missing or invalid authorization header' };
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return { user: null, error: error?.message || 'Authentication failed' };
    }
    
    return { user, error: null };
  } catch (error) {
    return { user: null, error: `Authentication error: ${error.message}` };
  }
}

// Helper functions
function createErrorResponse(message: string, status: number, details?: any): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      details: details || null,
      timestamp: new Date().toISOString(),
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    }
  );
}

function createSuccessResponse(data: any, status: number = 200): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    }
  );
}

// Request handlers
async function handleGetEntries(userId: string, queryParams: URLSearchParams): Promise<Response> {
  try {
    const limit = Math.min(
      parseInt(queryParams.get('limit') || String(DEFAULT_LIMIT)),
      MAX_LIMIT
    );
    const offset = parseInt(queryParams.get('offset') || '0');
    const startDate = queryParams.get('startDate');
    const endDate = queryParams.get('endDate');
    const sortOrder = queryParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
    
    // Validate inputs
    const validation = GetEntriesSchema.safeParse({
      userId,
      limit,
      offset,
      startDate,
      endDate,
      sortOrder,
    });
    
    if (!validation.success) {
      return createErrorResponse(
        'Invalid query parameters', 
        400, 
        validation.error.errors
      );
    }
    
    // Build query
    let query = supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: sortOrder === 'asc' })
      .limit(limit)
      .range(offset, offset + limit - 1);
    
    if (startDate) {
      query = query.gte('date', startDate);
    }
    
    if (endDate) {
      query = query.lte('date', endDate);
    }
    
    const { data, error, count } = await query.order('date', { ascending: sortOrder === 'asc' });
    
    if (error) throw error;
    
    // Calculate pagination metadata
    const totalCount = await supabase
      .from(TABLE_NAME)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .then(res => res.count || 0);
    
    return createSuccessResponse({
      entries: data,
      pagination: {
        offset,
        limit,
        total: totalCount,
        hasMore: offset + data.length < totalCount,
      }
    });
  } catch (error) {
    console.error("Error retrieving mood entries:", error);
    return createErrorResponse('Failed to retrieve mood entries', 500);
  }
}

async function handleCreateEntry(payload: any): Promise<Response> {
  try {
    // Validate input
    const validation = CreateEntrySchema.safeParse(payload);
    
    if (!validation.success) {
      return createErrorResponse(
        'Invalid input data', 
        400, 
        validation.error.errors
      );
    }
    
    const { userId, mood, notes } = validation.data;
    const date = validation.data.date || new Date().toISOString();
    
    // Check for duplicate entries on the same date (optional)
    const { data: existingEntries } = await supabase
      .from(TABLE_NAME)
      .select('id')
      .eq('user_id', userId)
      .eq('date', date.split('T')[0]); // Compare only the date part
    
    // Insert the entry
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({
        user_id: userId,
        date,
        mood,
        notes,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return createErrorResponse('A mood entry already exists for this date', 409);
      }
      throw error;
    }
    
    return createSuccessResponse(data, 201);
  } catch (error) {
    console.error("Error creating mood entry:", error);
    return createErrorResponse('Failed to create mood entry', 500);
  }
}

async function handleUpdateEntry(payload: any): Promise<Response> {
  try {
    // Validate input
    const validation = UpdateEntrySchema.safeParse(payload);
    
    if (!validation.success) {
      return createErrorResponse(
        'Invalid input data', 
        400, 
        validation.error.errors
      );
    }
    
    const { id, userId, mood, notes, date } = validation.data;
    
    // Check if the entry exists and belongs to the user
    const { data: existingEntry, error: fetchError } = await supabase
      .from(TABLE_NAME)
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !existingEntry) {
      return createErrorResponse('Entry not found or access denied', 404);
    }
    
    // Prepare update data
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    
    if (mood !== undefined) updateData.mood = mood;
    if (notes !== undefined) updateData.notes = notes;
    if (date !== undefined) updateData.date = date;
    
    // Update the entry
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) throw error;
    
    return createSuccessResponse(data);
  } catch (error) {
    console.error("Error updating mood entry:", error);
    return createErrorResponse('Failed to update mood entry', 500);
  }
}

async function handleDeleteEntry(payload: any): Promise<Response> {
  try {
    // Validate input
    const validation = DeleteEntrySchema.safeParse(payload);
    
    if (!validation.success) {
      return createErrorResponse(
        'Invalid input data', 
        400, 
        validation.error.errors
      );
    }
    
    const { id, userId } = validation.data;
    
    // Check if the entry exists and belongs to the user
    const { data: existingEntry, error: fetchError } = await supabase
      .from(TABLE_NAME)
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !existingEntry) {
      return createErrorResponse('Entry not found or access denied', 404);
    }
    
    // Delete the entry
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    
    if (error) throw error;
    
    return createSuccessResponse({ id, deleted: true });
  } catch (error) {
    console.error("Error deleting mood entry:", error);
    return createErrorResponse('Failed to delete mood entry', 500);
  }
}

async function handleGetStats(userId: string, queryParams: URLSearchParams): Promise<Response> {
  try {
    const startDate = queryParams.get('startDate') || undefined;
    const endDate = queryParams.get('endDate') || undefined;
    
    // Build query with date range if provided
    let query = supabase
      .from(TABLE_NAME)
      .select('mood, date')
      .eq('user_id', userId);
    
    if (startDate) {
      query = query.gte('date', startDate);
    }
    
    if (endDate) {
      query = query.lte('date', endDate);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return createSuccessResponse({
        averageMood: null,
        moodCounts: {},
        entriesCount: 0,
        timeRange: { startDate, endDate }
      });
    }
    
    // Calculate statistics
    const moodSum = data.reduce((sum, entry) => sum + entry.mood, 0);
    const averageMood = moodSum / data.length;
    
    // Count occurrences of each mood
    const moodCounts = data.reduce((counts, entry) => {
      counts[entry.mood] = (counts[entry.mood] || 0) + 1;
      return counts;
    }, {});
    
    // Find actual date range
    const dates = data.map(entry => new Date(entry.date).getTime());
    const minDate = new Date(Math.min(...dates)).toISOString();
    const maxDate = new Date(Math.max(...dates)).toISOString();
    
    return createSuccessResponse({
      averageMood: parseFloat(averageMood.toFixed(2)),
      moodCounts,
      entriesCount: data.length,
      timeRange: {
        startDate: startDate || minDate,
        endDate: endDate || maxDate,
        actualStartDate: minDate,
        actualEndDate: maxDate
      }
    });
  } catch (error) {
    console.error("Error retrieving mood statistics:", error);
    return createErrorResponse('Failed to retrieve mood statistics', 500);
  }
}

// Main handler function
serve(async (req: Request) => {
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Extract request URL details
    const url = new URL(req.url);
    const path = url.pathname.split('/').filter(Boolean);
    const endpoint = path[path.length - 1]; // Last part of the path
    
    // Basic rate limiting (can be enhanced with Redis or similar)
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    
    // Simple authorization check
    const { user, error: authError } = await authenticateRequest(req);
    
    if (authError && endpoint !== 'public-stats') {
      return createErrorResponse('Unauthorized', 401, { message: authError });
    }
    
    // Route handling
    switch (req.method) {
      case "GET": {
        if (endpoint === 'entries') {
          const queryParams = url.searchParams;
          const userId = queryParams.get('userId');
          
          if (!userId) {
            return createErrorResponse('userId is required', 400);
          }
          
          // Verify user is requesting their own data
          if (user.id !== userId) {
            return createErrorResponse('Access denied', 403);
          }
          
          return await handleGetEntries(userId, queryParams);
        } else if (endpoint === 'stats') {
          const queryParams = url.searchParams;
          const userId = queryParams.get('userId');
          
          if (!userId) {
            return createErrorResponse('userId is required', 400);
          }
          
          // Verify user is requesting their own data
          if (user.id !== userId) {
            return createErrorResponse('Access denied', 403);
          }
          
          return await handleGetStats(userId, queryParams);
        } else if (endpoint === 'public-stats') {
          // Example of a public endpoint that doesn't require authentication
          // This could provide anonymous, aggregated statistics
          return createSuccessResponse({
            usersCount: await supabase
              .from(TABLE_NAME)
              .select('user_id', { count: 'exact', head: true })
              .then(res => res.count || 0),
            entriesCount: await supabase
              .from(TABLE_NAME)
              .select('id', { count: 'exact', head: true })
              .then(res => res.count || 0),
            averageMoodOverall: 7.2, // Would be calculated from actual data
          });
        }
        
        return createErrorResponse('Invalid endpoint', 404);
      }
      
      case "POST": {
        const payload = await req.json();
        
        if (endpoint === 'entries') {
          return await handleCreateEntry(payload);
        }
        
        return createErrorResponse('Invalid endpoint', 404);
      }
      
      case "PUT": {
        const payload = await req.json();
        
        if (endpoint === 'entries') {
          return await handleUpdateEntry(payload);
        }
        
        return createErrorResponse('Invalid endpoint', 404);
      }
      
      case "DELETE": {
        const payload = await req.json();
        
        if (endpoint === 'entries') {
          return await handleDeleteEntry(payload);
        }
        
        return createErrorResponse('Invalid endpoint', 404);
      }
      
      default:
        return createErrorResponse(`Method ${req.method} not allowed`, 405);
    }
  } catch (error) {
    console.error("Error in mood-tracker function:", error);
    return createErrorResponse(
      'Internal server error', 
      500, 
      Deno.env.get('ENVIRONMENT') === 'development' ? { message: error.message, stack: error.stack } : null
    );
  }
});
