#!/bin/bash
# Batch generate guest tokens for all future Riad Massiba reservations
# Usage: ./batch_generate_tokens_massiba.sh

set -e

SUPABASE_URL="https://bndrfqfzrolxfmdfqaqa.supabase.co"
SUPABASE_SERVICE_KEY=$(cat ~/.config/supabase/access_token 2>/dev/null || echo "")
RIAD_UUID="a1111111-1111-1111-1111-111111111111"
PROPERTY_ID="9462"

if [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "❌ Supabase access token not found in ~/.config/supabase/access_token"
  exit 1
fi

echo "🏨 Batch Token Generation - Riad Massiba"
echo "=========================================="
echo ""

# Fetch all future reservations
echo "📋 Fetching reservations from Supabase..."
RESERVATIONS=$(curl -s "${SUPABASE_URL}/rest/v1/reservations?riad_id=eq.${RIAD_UUID}&check_in_date=gte.2026-02-06&status=neq.canceled&select=id,reservation_id,guest_first_name,guest_last_name,check_in_date,property_id&order=check_in_date.asc" \
  -H "apikey: REDACTED_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer REDACTED_SUPABASE_ANON_KEY")

TOTAL=$(echo "$RESERVATIONS" | jq 'length')
echo "✅ Found $TOTAL future reservations"
echo ""

SUCCESS=0
ALREADY_EXISTS=0
FAILED=0

# Process each reservation
echo "$RESERVATIONS" | jq -c '.[]' | while read -r reservation; do
  RESERVATION_ID=$(echo "$reservation" | jq -r '.reservation_id')
  GUEST_NAME=$(echo "$reservation" | jq -r '"\(.guest_first_name) \(.guest_last_name)"')
  CHECK_IN=$(echo "$reservation" | jq -r '.check_in_date')
  
  echo "🔄 Processing #${RESERVATION_ID} - ${GUEST_NAME} (${CHECK_IN})..."
  
  # Call generate-guest-token Edge Function
  RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/generate-guest-token" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"reservationId\": \"${RESERVATION_ID}\",
      \"propertyId\": \"${PROPERTY_ID}\"
    }")
  
  SUCCESS_STATUS=$(echo "$RESPONSE" | jq -r '.success // false')
  TOKEN=$(echo "$RESPONSE" | jq -r '.token // "N/A"')
  ERROR=$(echo "$RESPONSE" | jq -r '.error // ""')
  
  if [ "$SUCCESS_STATUS" = "true" ]; then
    echo "   ✅ Token generated: ${TOKEN:0:16}..."
    SUCCESS=$((SUCCESS + 1))
  elif echo "$ERROR" | grep -q "already exists"; then
    echo "   ⏭️  Token already exists (skipped)"
    ALREADY_EXISTS=$((ALREADY_EXISTS + 1))
  else
    echo "   ❌ Failed: ${ERROR}"
    FAILED=$((FAILED + 1))
  fi
  
  # Small delay to avoid rate limiting
  sleep 0.5
done

echo ""
echo "=========================================="
echo "📊 Summary:"
echo "   Total reservations: $TOTAL"
echo "   ✅ Tokens generated: $SUCCESS"
echo "   ⏭️  Already existed: $ALREADY_EXISTS"
echo "   ❌ Failed: $FAILED"
echo ""
echo "🔗 Tokens can be accessed at: https://flow.margo-hospitality.com/token/{TOKEN}"
echo ""
