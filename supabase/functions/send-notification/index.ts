
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
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
    const { email, medication, dosage, scheduledTime } = await req.json();

    // Fetch user's phone number from profiles
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('phone_number')
      .eq('email', email)
      .single();

    if (profileError) throw profileError;

    // Send email notification
    const { error: emailError } = await resend.emails.send({
      from: "Med Alert Hub <onboarding@resend.dev>",
      to: email,
      subject: `Time to take ${medication}`,
      html: `
        <h1>Medication Reminder</h1>
        <p>It's time to take your medication:</p>
        <ul>
          <li>Medication: ${medication}</li>
          <li>Dosage: ${dosage}</li>
          <li>Scheduled Time: ${scheduledTime}</li>
        </ul>
        <p>Please take your medication as prescribed.</p>
      `,
    });

    if (emailError) throw emailError;

    // If phone number exists, send SMS notification
    if (profileData?.phone_number) {
      // Note: You'll need to implement SMS sending logic here
      // using a service like Twilio, MessageBird, or similar
      console.log(`Would send SMS to ${profileData.phone_number}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
