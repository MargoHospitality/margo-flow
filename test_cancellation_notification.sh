#!/bin/bash
# Test script for notify-client-cancellation Edge Function
# Usage: ./test_cancellation_notification.sh [test_scenario]
#   test_scenario: dates_changed | reservation_cancelled | manual_cancellation

set -e

SUPABASE_URL="https://bndrfqfzrolxfmdfqaqa.supabase.co"
SUPABASE_SERVICE_KEY=$(cat ~/.config/supabase/access_token 2>/dev/null || echo "")

if [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "❌ Supabase access token not found in ~/.config/supabase/access_token"
  exit 1
fi

TEST_SCENARIO="${1:-manual_cancellation}"

echo "🧪 Testing notify-client-cancellation Edge Function"
echo "📋 Scenario: $TEST_SCENARIO"
echo ""

# Test payload
PAYLOAD=$(cat <<EOF
{
  "transportRequestId": "test-$(date +%s)",
  "reservationId": "TEST123456",
  "propertyId": "9462",
  "propertyName": "Riad Massiba",
  "guestName": "Test Guest",
  "guestEmail": "baptiste@margo-hospitality.com",
  "guestPhone": "+212600000000",
  "transportType": "Airport Transfer",
  "originalDate": "2026-02-15",
  "cancelReason": "$TEST_SCENARIO",
  "language": "en"
EOF
)

# Add optional fields for dates_changed scenario
if [ "$TEST_SCENARIO" = "reservation_dates_changed" ]; then
  PAYLOAD=$(echo "$PAYLOAD" | sed 's/}$/,/')
  PAYLOAD="$PAYLOAD
  \"newCheckIn\": \"2026-02-20\",
  \"newCheckOut\": \"2026-02-25\",
  \"tokenUrl\": \"https://flow.margo-hospitality.com/token/test-token-123\"
}"
else
  PAYLOAD="$PAYLOAD}"
fi

echo "📤 Sending request..."
echo ""

RESPONSE=$(curl -s -X POST \
  "$SUPABASE_URL/functions/v1/notify-client-cancellation" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo "📥 Response:"
echo "$RESPONSE" | jq '.'
echo ""

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
  echo "✅ Test passed! Email sent successfully."
  echo ""
  echo "🔍 Check notification_attempts table:"
  echo "   SELECT * FROM notification_attempts WHERE transport_request_id LIKE 'test-%' ORDER BY created_at DESC LIMIT 1;"
else
  echo "❌ Test failed!"
  ERROR=$(echo "$RESPONSE" | jq -r '.error // "Unknown error"')
  echo "   Error: $ERROR"
  exit 1
fi

echo ""
echo "📧 Check your email (baptiste@margo-hospitality.com) for the test notification"
echo ""
echo "Available test scenarios:"
echo "  - manual_cancellation (default)"
echo "  - reservation_cancelled"
echo "  - reservation_dates_changed (includes new dates + token link)"
