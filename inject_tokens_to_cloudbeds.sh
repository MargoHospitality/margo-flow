#!/bin/bash
# Inject existing guest tokens into Cloudbeds custom fields
# Uses correct API v1.3 syntax
# Usage: ./inject_tokens_to_cloudbeds.sh

set -e

SUPABASE_URL="https://bndrfqfzrolxfmdfqaqa.supabase.co"
SUPABASE_ANON_KEY="REDACTED_SUPABASE_ANON_KEY"
PROPERTY_ID="9462"
CLOUDBEDS_API_KEY=$(cat ~/.config/cloudbeds/api_key_write 2>/dev/null || cat ~/.config/cloudbeds/api_key 2>/dev/null)

if [ -z "$CLOUDBEDS_API_KEY" ]; then
  echo "❌ Cloudbeds API key not found"
  exit 1
fi

echo "🔗 Inject Tokens into Cloudbeds - Riad Massiba"
echo "=========================================="
echo ""

# Fetch all tokens for property 9462
echo "📋 Fetching tokens from Supabase..."
TOKENS=$(curl -s "${SUPABASE_URL}/rest/v1/guest_tokens?property_id=eq.${PROPERTY_ID}&revoked=eq.false&select=reservation_id,token&order=created_at.desc" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}")

TOTAL=$(echo "$TOKENS" | jq 'length')
echo "✅ Found $TOTAL active tokens"
echo ""

SUCCESS=0
FAILED=0

# Process each token
echo "$TOKENS" | jq -c '.[]' | while read -r token_entry; do
  RESERVATION_ID=$(echo "$token_entry" | jq -r '.reservation_id')
  TOKEN=$(echo "$token_entry" | jq -r '.token')
  
  echo "🔄 [#${RESERVATION_ID}] Injecting token..."
  
  # Inject into Cloudbeds using correct v1.3 API syntax
  INJECT_RESPONSE=$(curl -s -X PUT "https://api.cloudbeds.com/api/v1.3/putReservation?propertyID=${PROPERTY_ID}" \
    -H "Authorization: Bearer ${CLOUDBEDS_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"reservationID\": \"${RESERVATION_ID}\",
      \"customFields\": [
        {
          \"customFieldName\": \"guest_app_token\",
          \"customFieldValue\": \"${TOKEN}\"
        }
      ]
    }")
  
  INJECT_SUCCESS=$(echo "$INJECT_RESPONSE" | jq -r '.success // false')
  
  if [ "$INJECT_SUCCESS" = "true" ]; then
    echo "   ✅ Injected"
    SUCCESS=$((SUCCESS + 1))
  else
    INJECT_MESSAGE=$(echo "$INJECT_RESPONSE" | jq -r '.message // "Unknown error"')
    echo "   ❌ Failed: ${INJECT_MESSAGE}"
    FAILED=$((FAILED + 1))
  fi
  
  # Small delay to avoid rate limiting
  sleep 0.6
done

echo ""
echo "=========================================="
echo "📊 Final Summary:"
echo "   Total tokens:     $TOTAL"
echo "   ✅ Injected:      $SUCCESS"
echo "   ❌ Failed:        $FAILED"
echo ""
