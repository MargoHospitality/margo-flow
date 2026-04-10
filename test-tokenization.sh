#!/bin/bash
# Test script: Guest Tokenization System
# Usage: ./test-tokenization.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/load-env.sh
source "${SCRIPT_DIR}/scripts/load-env.sh"
load_env_files

echo "=== Test Guest Tokenization System ==="
echo ""

SUPABASE_URL="$(get_supabase_url)"
SUPABASE_SERVICE_ROLE_KEY="$(get_supabase_service_role_key)"
SUPABASE_PROJECT_ID="$(get_supabase_project_id)"

require_env "SUPABASE_URL" "Set SUPABASE_URL or VITE_SUPABASE_URL in .env.local/.env."
require_env "SUPABASE_SERVICE_ROLE_KEY" "Set SUPABASE_SERVICE_ROLE_KEY in an untracked env file before running this script."
require_env "SUPABASE_PROJECT_ID" "Set SUPABASE_PROJECT_ID or VITE_SUPABASE_PROJECT_ID in .env.local/.env."

echo "📋 Étape 1: Appliquer la migration SQL"
echo "   Action: Copier le contenu de supabase/migrations/20260206001600_guest_tokens.sql"
echo "   Et l'exécuter dans Supabase SQL Editor"
echo "   URL: https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/sql"
echo ""
read -p "Migration appliquée? (y/n): " migration_done

if [ "$migration_done" != "y" ]; then
  echo "❌ Migration non appliquée. Abandon."
  exit 1
fi

echo ""
echo "✅ Migration SQL OK"
echo ""

echo "📋 Étape 2: Tester génération de token"
echo "   Test avec réservation fictive..."
echo ""

# Test: Generate token
RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/generate_guest_token" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "p_reservation_id": "TEST-123456",
    "p_property_id": "319843",
    "p_guest_email": "test@example.com",
    "p_guest_name": "John Doe",
    "p_check_in_date": "2026-03-01",
    "p_check_out_date": "2026-03-03",
    "p_expires_days": 90
  }')

echo "Response:"
echo "$RESPONSE" | jq '.'
echo ""

# Extract token
TOKEN=$(echo "$RESPONSE" | jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Erreur: Token non généré"
  echo "Response: $RESPONSE"
  exit 1
fi

echo "✅ Token généré: $TOKEN"
echo "   URL: https://margo-flow.vercel.app/guest?token=$TOKEN"
echo ""

echo "📋 Étape 3: Vérifier le token"
echo ""

# Test: Verify token
VERIFY_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/verify_guest_token" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"p_token\": \"$TOKEN\"}")

echo "Response:"
echo "$VERIFY_RESPONSE" | jq '.'
echo ""

VALID=$(echo "$VERIFY_RESPONSE" | jq -r '.valid')

if [ "$VALID" = "true" ]; then
  echo "✅ Token valide!"
  echo "   Reservation ID: $(echo "$VERIFY_RESPONSE" | jq -r '.reservation_id')"
  echo "   Property ID: $(echo "$VERIFY_RESPONSE" | jq -r '.property_id')"
  echo "   Guest: $(echo "$VERIFY_RESPONSE" | jq -r '.guest_name')"
  echo "   Check-in: $(echo "$VERIFY_RESPONSE" | jq -r '.check_in_date')"
else
  echo "❌ Token invalide"
  exit 1
fi

echo ""
echo "📋 Étape 4: Tester webhook Cloudbeds (simulé)"
echo ""

# Test: Webhook simulation
WEBHOOK_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/cloudbeds-webhook" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "new_reservation",
    "reservationID": "WEBHOOK-TEST-789",
    "propertyID": "319843",
    "guestName": "Jane Smith",
    "guestEmail": "jane@example.com",
    "checkIn": "2026-03-10",
    "checkOut": "2026-03-12"
  }')

echo "Webhook Response:"
echo "$WEBHOOK_RESPONSE" | jq '.'
echo ""

WEBHOOK_SUCCESS=$(echo "$WEBHOOK_RESPONSE" | jq -r '.success')

if [ "$WEBHOOK_SUCCESS" = "true" ]; then
  echo "✅ Webhook traité avec succès!"
  WEBHOOK_URL=$(echo "$WEBHOOK_RESPONSE" | jq -r '.data.url')
  echo "   URL générée: $WEBHOOK_URL"
else
  echo "⚠️  Webhook response: $(echo "$WEBHOOK_RESPONSE" | jq -r '.message // .error')"
fi

echo ""
echo "=== Tests terminés ==="
echo ""
echo "📌 Next steps:"
echo "   1. Configurer webhook Cloudbeds → ${SUPABASE_URL}/functions/v1/cloudbeds-webhook"
echo "   2. Créer page /guest avec vérification token"
echo "   3. Implémenter envoi email/SMS avec lien tokenisé"
