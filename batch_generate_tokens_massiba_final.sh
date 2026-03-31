#!/bin/bash
# Batch generate guest tokens for all future Riad Massiba reservations
# Uses Supabase RPC function generate_guest_token + injects into Cloudbeds
# Usage: ./batch_generate_tokens_massiba_final.sh

set -e

SUPABASE_URL="https://bndrfqfzrolxfmdfqaqa.supabase.co"
SUPABASE_ANON_KEY="REDACTED_SUPABASE_ANON_KEY"
RIAD_UUID="a1111111-1111-1111-1111-111111111111"
PROPERTY_ID="9462"
CLOUDBEDS_API_KEY=$(cat ~/.config/cloudbeds/api_key_write 2>/dev/null || cat ~/.config/cloudbeds/api_key 2>/dev/null)

if [ -z "$CLOUDBEDS_API_KEY" ]; then
  echo "❌ Cloudbeds API key not found"
  exit 1
fi

echo "🏨 Batch Token Generation - Riad Massiba"
echo "=========================================="
echo ""

# Fetch all future reservations
echo "📋 Fetching reservations from Supabase..."
RESERVATIONS=$(curl -s "${SUPABASE_URL}/rest/v1/reservations?riad_id=eq.${RIAD_UUID}&check_in_date=gte.2026-02-06&status=neq.canceled&select=id,reservation_id,guest_first_name,guest_last_name,check_in_date,check_out_date,property_id&order=check_in_date.asc" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}")

TOTAL=$(echo "$RESERVATIONS" | jq 'length')
echo "✅ Found $TOTAL future reservations"
echo ""

SUCCESS=0
ALREADY_EXISTS=0
FAILED=0
CLOUDBEDS_INJECTED=0

# Process each reservation
echo "$RESERVATIONS" | jq -c '.[]' | while read -r reservation; do
  RESERVATION_ID=$(echo "$reservation" | jq -r '.reservation_id')
  GUEST_FIRST=$(echo "$reservation" | jq -r '.guest_first_name // ""')
  GUEST_LAST=$(echo "$reservation" | jq -r '.guest_last_name // ""')
  GUEST_NAME="${GUEST_FIRST} ${GUEST_LAST}"
  CHECK_IN=$(echo "$reservation" | jq -r '.check_in_date')
  CHECK_OUT=$(echo "$reservation" | jq -r '.check_out_date')
  
  echo "🔄 [#${RESERVATION_ID}] ${GUEST_NAME} (${CHECK_IN})..."
  
  # Call Supabase RPC function
  RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/generate_guest_token" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"p_reservation_id\": \"${RESERVATION_ID}\",
      \"p_property_id\": \"${PROPERTY_ID}\",
      \"p_guest_name\": \"${GUEST_NAME}\",
      \"p_check_in_date\": \"${CHECK_IN}\",
      \"p_check_out_date\": \"${CHECK_OUT}\",
      \"p_expires_days\": 90
    }")
  
  SUCCESS_STATUS=$(echo "$RESPONSE" | jq -r '.success // false')
  TOKEN=$(echo "$RESPONSE" | jq -r '.token // "N/A"')
  ERROR=$(echo "$RESPONSE" | jq -r '.error // ""')
  
  if [ "$SUCCESS_STATUS" = "true" ]; then
    echo "   ✅ Token: ${TOKEN:0:24}..."
    
    # Inject token into Cloudbeds custom field
    INJECT_RESPONSE=$(curl -s -X PUT "https://api.cloudbeds.com/api/v1.2/putReservation" \
      -H "Authorization: Bearer ${CLOUDBEDS_API_KEY}" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "propertyID=${PROPERTY_ID}" \
      -d "reservationID=${RESERVATION_ID}" \
      -d "customFields[guest_app_token]=${TOKEN}")
    
    INJECT_SUCCESS=$(echo "$INJECT_RESPONSE" | jq -r '.success // false')
    
    if [ "$INJECT_SUCCESS" = "true" ]; then
      echo "   ↪ Cloudbeds: ✅ Injected"
      CLOUDBEDS_INJECTED=$((CLOUDBEDS_INJECTED + 1))
    else
      INJECT_ERROR=$(echo "$INJECT_RESPONSE" | jq -r '.message // "Unknown error"')
      echo "   ↪ Cloudbeds: ⚠️  ${INJECT_ERROR}"
    fi
    
    SUCCESS=$((SUCCESS + 1))
    
  elif echo "$ERROR" | grep -qi "duplicate\|already exists\|violates unique"; then
    echo "   ⏭️  Token already exists"
    ALREADY_EXISTS=$((ALREADY_EXISTS + 1))
  else
    echo "   ❌ Error: ${ERROR}"
    FAILED=$((FAILED + 1))
  fi
  
  # Small delay to avoid rate limiting
  sleep 0.8
done

echo ""
echo "=========================================="
echo "📊 Final Summary:"
echo "   Total reservations:     $TOTAL"
echo "   ✅ Tokens generated:    $SUCCESS"
echo "   ↪ Cloudbeds injected:   $CLOUDBEDS_INJECTED"
echo "   ⏭️  Already existed:     $ALREADY_EXISTS"
echo "   ❌ Failed:              $FAILED"
echo ""
echo "🔗 Guest access: https://flow.margo-hospitality.com/token/{TOKEN}"
echo ""
