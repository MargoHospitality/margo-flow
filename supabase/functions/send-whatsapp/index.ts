import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// WhatsApp template configurations
// Client templates: 4 variables (guestName, propertyName, arrivalDateTime, link)
// Manager urgent template: 3 variables (propertyName, arrivalDateTime, link)
const TEMPLATES = {
  client_confirm_en: {
    sid: "HX7c07f18609900220c4f1fec5328621ba",
    name: "margoflow_client_confirm_en",
    variableCount: 4,
  },
  client_confirm_fr: {
    sid: "HXa8112bc4988b12b4f2f521503035ae27",
    name: "margoflow_client_confirm_fr",
    variableCount: 4,
  },
  manager_urgent_en: {
    sid: "HX7cf36067b50f59beef977219613b1c0e",
    name: "margoflow_manager_urgent_en",
    variableCount: 3, // propertyName, arrivalDateTime, link
  },
};

interface WhatsAppRequest {
  to: string; // Phone number in E.164 format
  templateKey: keyof typeof TEMPLATES;
  variables: {
    guestName: string;
    propertyName: string;
    arrivalDateTime: string; // Formatted string like "March 21, 2026 at 14:30"
    link: string; // URL - different meaning for client vs manager templates
  };
  transportRequestId?: string;
  notificationType: 'client_confirmation' | 'manager_urgent';
  isFallback?: boolean;
}

async function sendTwilioWhatsApp(
  to: string,
  templateSid: string,
  variables: WhatsAppRequest['variables'],
  variableCount: number = 4
): Promise<{ success: boolean; messageSid?: string; error?: string; status?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    console.error("[send-whatsapp] Missing Twilio credentials");
    return { success: false, error: "Missing Twilio credentials" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  
  // Format phone number for WhatsApp
  const whatsappTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const whatsappFrom = TWILIO_WHATSAPP_FROM.startsWith("whatsapp:") 
    ? TWILIO_WHATSAPP_FROM 
    : `whatsapp:${TWILIO_WHATSAPP_FROM}`;

  // Content variables depend on template type
  // Client templates (4 vars): guestName, propertyName, arrivalDateTime, link
  // Manager urgent (3 vars): propertyName, arrivalDateTime, link
  let contentVariables: string;
  if (variableCount === 3) {
    contentVariables = JSON.stringify({
      "1": variables.propertyName,
      "2": variables.arrivalDateTime,
      "3": variables.link,
    });
  } else {
    contentVariables = JSON.stringify({
      "1": variables.guestName,
      "2": variables.propertyName,
      "3": variables.arrivalDateTime,
      "4": variables.link,
    });
  }

  const formData = new URLSearchParams();
  formData.append("To", whatsappTo);
  formData.append("From", whatsappFrom);
  formData.append("ContentSid", templateSid);
  formData.append("ContentVariables", contentVariables);

  console.log(`[send-whatsapp] Sending to ${whatsappTo} with template ${templateSid}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("[send-whatsapp] Twilio API error:", result);
      return { 
        success: false, 
        error: result.message || "Twilio API error",
        status: result.status || 'failed'
      };
    }

    console.log("[send-whatsapp] Message sent successfully:", result.sid, "Status:", result.status);
    
    // Check if message was actually queued/sent
    // Statuses: queued, sending, sent, delivered, undelivered, failed
    const isSuccess = ["queued", "sending", "sent", "delivered"].includes(result.status);
    
    return { 
      success: isSuccess, 
      messageSid: result.sid,
      status: result.status,
      error: isSuccess ? undefined : `Message status: ${result.status}`
    };
  } catch (error: any) {
    console.error("[send-whatsapp] Network error:", error);
    return { success: false, error: error.message };
  }
}

async function logNotificationAttempt(
  supabase: any,
  data: {
    transportRequestId?: string;
    notificationType: string;
    channel: string;
    recipientPhone?: string;
    recipientEmail?: string;
    templateSid?: string;
    status: string;
    errorMessage?: string;
    providerMessageId?: string;
    isFallback: boolean;
    metadata?: Record<string, any>;
  }
) {
  try {
    const { error } = await supabase
      .from("notification_attempts")
      .insert({
        transport_request_id: data.transportRequestId || null,
        notification_type: data.notificationType,
        channel: data.channel,
        recipient_phone: data.recipientPhone,
        recipient_email: data.recipientEmail,
        template_sid: data.templateSid,
        status: data.status,
        error_message: data.errorMessage,
        provider_message_id: data.providerMessageId,
        is_fallback: data.isFallback,
        metadata: data.metadata || {},
      });

    if (error) {
      console.error("[send-whatsapp] Failed to log notification attempt:", error);
    }
  } catch (err) {
    console.error("[send-whatsapp] Error logging notification:", err);
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const data: WhatsAppRequest = await req.json();
    console.log("[send-whatsapp] Request received:", {
      to: data.to,
      templateKey: data.templateKey,
      notificationType: data.notificationType,
    });

    const template = TEMPLATES[data.templateKey];
    if (!template) {
      console.error("[send-whatsapp] Invalid template key:", data.templateKey);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid template key" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send WhatsApp message
    const result = await sendTwilioWhatsApp(data.to, template.sid, data.variables, template.variableCount);

    // Log the attempt
    await logNotificationAttempt(supabase, {
      transportRequestId: data.transportRequestId,
      notificationType: data.notificationType,
      channel: "whatsapp",
      recipientPhone: data.to,
      templateSid: template.sid,
      status: result.success ? "sent" : "failed",
      errorMessage: result.error,
      providerMessageId: result.messageSid,
      isFallback: data.isFallback || false,
      metadata: {
        templateKey: data.templateKey,
        templateName: template.name,
        twilioStatus: result.status,
      },
    });

    if (!result.success) {
      console.log("[send-whatsapp] Message failed, fallback needed");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error, 
          needsFallback: true 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageSid: result.messageSid,
        status: result.status 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[send-whatsapp] Handler error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
