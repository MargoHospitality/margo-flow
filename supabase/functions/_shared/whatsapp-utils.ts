const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");
const TWILIO_PAYMENT_LINK_TEMPLATE_SID = Deno.env.get("TWILIO_PAYMENT_LINK_TEMPLATE_SID");

export function normalizeWhatsappNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("WhatsApp number is required");
  }

  const digitsOnly = trimmed.replace(/[^\d+]/g, "");
  if (digitsOnly.startsWith("+")) {
    return `+${digitsOnly.slice(1).replace(/[^\d]/g, "")}`;
  }

  if (digitsOnly.startsWith("00")) {
    return `+${digitsOnly.slice(2)}`;
  }

  return digitsOnly.replace(/[^\d]/g, "");
}

async function sendTwilioContentTemplate(params: {
  to: string;
  contentSid: string;
  variables: string[];
}) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    throw new Error("Missing Twilio credentials");
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const whatsappTo = params.to.startsWith("whatsapp:") ? params.to : `whatsapp:${params.to}`;
  const whatsappFrom = TWILIO_WHATSAPP_FROM.startsWith("whatsapp:")
    ? TWILIO_WHATSAPP_FROM
    : `whatsapp:${TWILIO_WHATSAPP_FROM}`;

  const contentVariables = JSON.stringify(
    params.variables.reduce<Record<string, string>>((accumulator, value, index) => {
      accumulator[String(index + 1)] = value;
      return accumulator;
    }, {}),
  );

  const formData = new URLSearchParams();
  formData.append("To", whatsappTo);
  formData.append("From", whatsappFrom);
  formData.append("ContentSid", params.contentSid);
  formData.append("ContentVariables", contentVariables);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || "Twilio API error");
  }

  return {
    success: ["queued", "sending", "sent", "delivered"].includes(payload.status),
    messageSid: payload.sid as string | undefined,
    status: payload.status as string | undefined,
    error: payload.status && ["queued", "sending", "sent", "delivered"].includes(payload.status)
      ? null
      : `Message status: ${payload.status}`,
  };
}

export async function sendPaymentLinkWhatsapp(params: {
  to: string;
  guestFirstName: string;
  propertyName: string;
  amountLabel: string;
  paymentLink: string;
}) {
  if (!TWILIO_PAYMENT_LINK_TEMPLATE_SID) {
    throw new Error("TWILIO_PAYMENT_LINK_TEMPLATE_SID is not configured");
  }

  return sendTwilioContentTemplate({
    to: normalizeWhatsappNumber(params.to),
    contentSid: TWILIO_PAYMENT_LINK_TEMPLATE_SID,
    variables: [
      params.guestFirstName,
      params.propertyName,
      params.amountLabel,
      params.paymentLink,
    ],
  });
}
