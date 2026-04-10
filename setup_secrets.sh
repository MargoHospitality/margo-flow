#!/bin/bash
# Configuration des secrets Supabase Edge Functions

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/load-env.sh
source "${SCRIPT_DIR}/scripts/load-env.sh"
load_env_files

PROJECT_REF="$(get_supabase_project_id)"

require_env "PROJECT_REF" "Set SUPABASE_PROJECT_ID or VITE_SUPABASE_PROJECT_ID in .env.local/.env."

echo "🔐 Configuration des secrets pour Margo Flow"
echo ""
echo "Entre les valeurs quand demandé (ou Ctrl+C pour annuler)"
echo ""

# 1. Cloudbeds (déjà disponible)
CLOUDBEDS_KEY="${CLOUDBEDS_API_KEY:-$(cat ~/.config/cloudbeds/api_key_write 2>/dev/null || echo "")}"
if [ -n "$CLOUDBEDS_KEY" ]; then
  echo "✅ CLOUDBEDS_API_KEY trouvée automatiquement"
else
  read -p "CLOUDBEDS_API_KEY: " CLOUDBEDS_KEY
fi

# 2. Resend
read -p "RESEND_API_KEY: " RESEND_KEY

# 3. Turnstile
read -p "TURNSTILE_SECRET_KEY: " TURNSTILE_KEY

# 4. Twilio SID
read -p "TWILIO_ACCOUNT_SID: " TWILIO_SID

# 5. Twilio Token
read -s -p "TWILIO_AUTH_TOKEN (masqué): " TWILIO_TOKEN
echo ""

# 6. Twilio WhatsApp
read -p "TWILIO_WHATSAPP_FROM (ex: whatsapp:+14155238886): " TWILIO_FROM

echo ""
echo "🚀 Configuration des secrets sur Supabase..."

npx supabase secrets set \
  CLOUDBEDS_API_KEY="$CLOUDBEDS_KEY" \
  RESEND_API_KEY="$RESEND_KEY" \
  TURNSTILE_SECRET_KEY="$TURNSTILE_KEY" \
  TWILIO_ACCOUNT_SID="$TWILIO_SID" \
  TWILIO_AUTH_TOKEN="$TWILIO_TOKEN" \
  TWILIO_WHATSAPP_FROM="$TWILIO_FROM" \
  --project-ref $PROJECT_REF

echo ""
echo "✅ Secrets configurés!"
