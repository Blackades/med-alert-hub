import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "./utils/cors.ts";

// Type definitions
interface Medication {
  id: string;
  name: string;
  frequency: string; // daily, weekly, etc.
  doses_per_day?: number;
  user_id: string;
}

interface MedicationLog {
  id: string;
  medication_id: string;
  scheduled_time: string;
  taken_time?: string;
  status: 'taken' | 'missed' | 'scheduled';
  notes?: string;
}

interface MedicationStats {
  medicationId: string;
  medicationName: string;
  currentStreak: number;
  longestStreak: number;
  adherenceRate: number;
  missedDoses: number;
  totalDoses: number;
  lastTaken: string | null;
  daysWithPerfectAdherence: number;
  averageTimeDifference: number | null; // in minutes
  consistencyScore: number;
  recentAdherence: number;
}

interface RequestBody {
  userId: string;
  days?: number;
  timezone?: string;
}

interface ResponseData {
  success: boolean;
  data?: MedicationStats[];
  error?: string;
  timestamp: string;
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Environment validation
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables");
  throw new Error("Server misconfiguration: environment variables not set");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Cache TTL in seconds
const CACHE_TTL = 300; // 5 minutes
const cache = new Map<string, { data: any; timestamp: number }>();

/**
 * Calculate medication adherence statistics
 */
async function calculateMedicationStats(
  userId: string, 
  days: number = 30,
  timezone: string = 'UTC',
  supabaseClient: SupabaseClient
): Promise<MedicationStats[]> {
  // Generate cache key
  const cacheKey = `${userId}-${days}-${timezone}`;
  
  // Check cache first
  const cachedData = cache.get(cacheKey);
  if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_TTL * 1000) {
    console.log("Cache hit for", cacheKey);
    return cachedData.data;
  }

  // Calculate start date in user's timezone
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Get all medications for the user
  const { data: medications, error: medError } = await supabaseClient
    .from('medications')
    .select('id, name, frequency, doses_per_day')
    .eq('user_id', userId);
  
  if (medError) throw new Error(`Failed to fetch medications: ${medError.message}`);
  if (!medications || medications.length === 0) return [];
  
  // Create a map of medication IDs for batch querying
  const medicationIds = medications.map(med => med.id);
  
  // Get logs for all medications in one query
  const { data: allLogs, error: logError } = await supabaseClient
    .from('medication_logs')
    .select('*')
    .in('medication_id', medicationIds)
    .gte('scheduled_time', startDate.toISOString())
    .order('scheduled_time', { ascending: false });
  
  if (logError) throw new Error(`Failed to fetch medication logs: ${logError.message}`);
  
  // Group logs by medication ID
  const logsByMedication = allLogs.reduce((acc, log) => {
    if (!acc[log.medication_id]) {
      acc[log.medication_id] = [];
    }
    acc[log.medication_id].push(log);
    return acc;
  }, {} as Record<string, MedicationLog[]>);
  
  const results: MedicationStats[] = [];
  
  // Calculate stats for each medication
  for (const med of medications) {
    const logs = logsByMedication[med.id] || [];
    
    // Group logs by day
    const logsByDate: Record<string, MedicationLog[]> = {};
    for (const log of logs) {
      // Convert to user's timezone for accurate day calculation
      const logDate = new Date(log.scheduled_time);
      const dateKey = logDate.toISOString().split('T')[0];
      
      if (!logsByDate[dateKey]) {
        logsByDate[dateKey] = [];
      }
      logsByDate[dateKey].push(log);
    }
    
    // Sort dates in descending order (most recent first)
    const sortedDates = Object.keys(logsByDate).sort().reverse();
    
    // Calculate streaks and other statistics
    let currentStreak = 0;
    let longestStreak = 0;
    let takenCount = 0;
    let missedCount = 0;
    let daysWithPerfectAdherence = 0;
    let lastTakenDate: string | null = null;
    let timeDifferences: number[] = [];
    
    // Process each day's logs
    for (const date of sortedDates) {
      const dayLogs = logsByDate[date];
      const allTaken = dayLogs.every(log => log.status === 'taken');
      const anyTaken = dayLogs.some(log => log.status === 'taken');
      
      // Update taken/missed counts
      takenCount += dayLogs.filter(log => log.status === 'taken').length;
      missedCount += dayLogs.filter(log => log.status === 'missed').length;
      
      // Find last taken date
      if (!lastTakenDate && anyTaken) {
        const takenLogs = dayLogs.filter(log => log.status === 'taken');
        if (takenLogs.length > 0) {
          lastTakenDate = takenLogs[0].taken_time || takenLogs[0].scheduled_time;
        }
      }
      
      // Calculate time differences for consistency score
      for (const log of dayLogs) {
        if (log.status === 'taken' && log.taken_time && log.scheduled_time) {
          const scheduled = new Date(log.scheduled_time).getTime();
          const taken = new Date(log.taken_time).getTime();
          // Time difference in minutes
          timeDifferences.push(Math.abs(taken - scheduled) / (1000 * 60));
        }
      }
      
      // Update streak counters
      if (allTaken) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
        daysWithPerfectAdherence++;
      } else {
        currentStreak = 0;
      }
    }
    
    // Calculate additional statistics
    const totalDoses = takenCount + missedCount;
    const adherenceRate = totalDoses > 0 ? (takenCount / totalDoses) * 100 : 0;
    
    // Recent adherence (last 7 days)
    let recentTaken = 0;
    let recentTotal = 0;
    
    for (let i = 0; i < Math.min(7, sortedDates.length); i++) {
      const date = sortedDates[i];
      const dayLogs = logsByDate[date];
      recentTaken += dayLogs.filter(log => log.status === 'taken').length;
      recentTotal += dayLogs.length;
    }
    
    const recentAdherence = recentTotal > 0 ? (recentTaken / recentTotal) * 100 : 0;
    
    // Calculate consistency score (lower time differences = higher score)
    const avgTimeDifference = timeDifferences.length > 0 
      ? timeDifferences.reduce((sum, diff) => sum + diff, 0) / timeDifferences.length 
      : null;
    
    // Consistency score: 100 if perfect timing, decreasing as average time difference increases
    // Max score is 100, min is 0 (if average time difference is >= 120 minutes)
    const consistencyScore = avgTimeDifference !== null 
      ? Math.max(0, 100 - (avgTimeDifference / 120) * 100) 
      : 0;
    
    results.push({
      medicationId: med.id,
      medicationName: med.name,
      currentStreak,
      longestStreak,
      adherenceRate,
      missedDoses: missedCount,
      totalDoses,
      lastTaken: lastTakenDate,
      daysWithPerfectAdherence,
      averageTimeDifference: avgTimeDifference,
      consistencyScore,
      recentAdherence
    });
  }
  
  // Store in cache
  cache.set(cacheKey, { data: results, timestamp: Date.now() });
  
  return results;
}

/**
 * Handle rate limiting
 */
class RateLimiter {
  private requestCounts: Map<string, number> = new Map();
  private lastResetTime: number = Date.now();
  private readonly resetInterval: number = 60000; // 1 minute
  private readonly maxRequests: number = 60; // 60 requests per minute
  
  constructor() {
    // Clean up old entries periodically
    setInterval(() => this.resetCounts(), this.resetInterval);
  }
  
  isAllowed(clientId: string): boolean {
    // Reset counts if interval has passed
    if (Date.now() - this.lastResetTime > this.resetInterval) {
      this.resetCounts();
    }
    
    const currentCount = this.requestCounts.get(clientId) || 0;
    
    if (currentCount >= this.maxRequests) {
      return false;
    }
    
    this.requestCounts.set(clientId, currentCount + 1);
    return true;
  }
  
  private resetCounts(): void {
    this.requestCounts.clear();
    this.lastResetTime = Date.now();
  }
}

const rateLimiter = new RateLimiter();

/**
 * Main request handler
 */
serve(async (req: Request): Promise<Response> => {
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Extract client IP for rate limiting
  const clientId = req.headers.get("x-forwarded-for") || "unknown";
  
  // Apply rate limiting
  if (!rateLimiter.isAllowed(clientId)) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Too many requests. Please try again later.",
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429
      }
    );
  }
  
  try {
    // Parse request
    const contentType = req.headers.get("content-type") || "";
    
    // Handle different content types
    let requestData: RequestBody;
    
    if (contentType.includes("application/json")) {
      requestData = await req.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      requestData = {
        userId: formData.get("userId") as string,
        days: parseInt(formData.get("days") as string) || 30,
        timezone: formData.get("timezone") as string || "UTC"
      };
    } else {
      throw new Error("Unsupported content type");
    }

    // Validate request data
    if (!requestData.userId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "User ID is required",
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400
        }
      );
    }
    
    // Validate days parameter
    const days = requestData.days || 30;
    if (days < 1 || days > 365) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Days parameter must be between 1 and 365",
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400
        }
      );
    }
    
    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', requestData.userId)
      .single();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "User not found",
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404
        }
      );
    }
    
    // Calculate statistics
    const results = await calculateMedicationStats(
      requestData.userId, 
      days,
      requestData.timezone || "UTC",
      supabase
    );
    
    // Return response
    return new Response(
      JSON.stringify({ 
        success: true, 
        data: results,
        timestamp: new Date().toISOString()
      } as ResponseData),
      {
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${CACHE_TTL}`
        },
        status: 200
      }
    );
  } catch (error) {
    console.error("Error calculating medication stats:", error);
    
    // Determine appropriate status code
    let status = 500;
    let message = "Internal server error";
    
    if (error instanceof Error) {
      message = error.message;
      if (message.includes("not found") || message.includes("No such table")) {
        status = 404;
      } else if (message.includes("permission") || message.includes("authorized")) {
        status = 403;
      } else if (message.includes("invalid") || message.includes("required")) {
        status = 400;
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: message,
        timestamp: new Date().toISOString()
      } as ResponseData),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status
      }
    );
  }
});

/**
 * Utils for CORS handling (utils/cors.ts)
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-forwarded-for",
  "Access-Control-Max-Age": "86400"
};
