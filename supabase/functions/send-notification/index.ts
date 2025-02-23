
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, medication, dosage, scheduledTime } = await req.json();

    if (!email || !medication || !dosage || !scheduledTime) {
      throw new Error("Missing required parameters");
    }

    console.log(`Sending notification to ${email} for medication: ${medication}`);

    const emailResponse = await resend.emails.send({
      from: "MedAlert <onboarding@resend.dev>",
      to: [email],
      subject: `Time to take your medication: ${medication}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1 style="color: #0f172a;">Medication Reminder</h1>
          <p>It's time to take your medication:</p>
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Medication:</strong> ${medication}</p>
            <p><strong>Dosage:</strong> ${dosage}</p>
            <p><strong>Scheduled Time:</strong> ${scheduledTime}</p>
          </div>
          <p>Please make sure to take your medication as prescribed.</p>
          <p style="color: #64748b; font-size: 14px;">This is an automated reminder from MedAlert.</p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, message: "Notification sent successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error sending notification:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send notification" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
