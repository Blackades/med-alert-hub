
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  email: string;
  medication: string;
  dosage: string;
  scheduledTime: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, medication, dosage, scheduledTime }: NotificationRequest = await req.json();

    const { data, error } = await resend.emails.send({
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

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
