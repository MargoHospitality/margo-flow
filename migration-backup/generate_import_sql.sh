#!/bin/bash
# Génère les fichiers SQL d'import depuis JSON

echo "Génération 006_import_reservations.sql..."
jq -r '.[] | 
  "INSERT INTO public.reservations (id, reservation_id, property_id, riad_id, guest_last_name, guest_first_name, guest_country_code, check_in_date, check_out_date, nights, status, source, cloudbeds_raw, created_at, updated_at) VALUES (" +
  "'" + (.id // "") + "'::uuid, " +
  "'" + (.reservation_id // "") + "', " +
  "'" + (.property_id // "") + "', " +
  (if .riad_id then "'" + .riad_id + "'::uuid" else "NULL" end) + ", " +
  "'" + (.guest_last_name // "" | gsub("'";"''")) + "', " +
  (if .guest_first_name then "'" + (.guest_first_name | gsub("'";"''")) + "'" else "NULL" end) + ", " +
  (if .guest_country_code then "'" + .guest_country_code + "'" else "NULL" end) + ", " +
  "'" + (.check_in_date // "") + "'::date, " +
  (if .check_out_date then "'" + .check_out_date + "'::date" else "NULL" end) + ", " +
  (.nights | tostring) + ", " +
  "'" + (.status // "confirmed") + "'::public.reservation_status, " +
  (if .source then "'" + (.source | gsub("'";"''")) + "'" else "NULL" end) + ", " +
  "'" + (.cloudbeds_raw | tostring | gsub("'";"''")) + "'::jsonb, " +
  "'" + .created_at + "'::timestamptz, " +
  "'" + .updated_at + "'::timestamptz" +
  ") ON CONFLICT (reservation_id) DO NOTHING;"
' reservations_complete.json > 006_import_reservations.sql

echo "Génération 007_import_transport_requests.sql..."
jq -r '.[] |
  "INSERT INTO public.transport_requests (id, reservation_id, riad_id, transport_offer_id, transport_date, transport_time, pax, computed_price, payment_mode, payload_details, guest_comment, status, is_free_transfer, public_token, rejection_reason, cancellation_reason, cancelled_at, created_at, updated_at) VALUES (" +
  "'" + .id + "'::uuid, " +
  "'" + .reservation_id + "', " +
  "'" + .riad_id + "'::uuid, " +
  "'" + .transport_offer_id + "'::uuid, " +
  "'" + .transport_date + "'::date, " +
  "'" + .transport_time + "'::time, " +
  (.pax | tostring) + ", " +
  (.computed_price | tostring) + ", " +
  "'" + .payment_mode + "'::public.payment_mode, " +
  "'" + (.payload_details | tostring | gsub("'";"''")) + "'::jsonb, " +
  (if .guest_comment then "'" + (.guest_comment | gsub("'";"''")) + "'" else "NULL" end) + ", " +
  "'" + .status + "'::public.request_status, " +
  (.is_free_transfer | tostring) + ", " +
  (if .public_token then "'" + .public_token + "'" else "NULL" end) + ", " +
  (if .rejection_reason then "'" + (.rejection_reason | gsub("'";"''")) + "'" else "NULL" end) + ", " +
  (if .cancellation_reason then "'" + (.cancellation_reason | gsub("'";"''")) + "'" else "NULL" end) + ", " +
  (if .cancelled_at then "'" + .cancelled_at + "'::timestamptz" else "NULL" end) + ", " +
  "'" + .created_at + "'::timestamptz, " +
  "'" + .updated_at + "'::timestamptz" +
  ") ON CONFLICT (id) DO NOTHING;"
' transport_requests.json > 007_import_transport_requests.sql

echo "Génération 008_import_notification_attempts.sql..."
jq -r '.[] |
  "INSERT INTO public.notification_attempts (id, transport_request_id, notification_type, channel, recipient_phone, recipient_email, template_sid, status, error_message, provider_message_id, is_fallback, metadata, created_at, updated_at) VALUES (" +
  "'" + .id + "'::uuid, " +
  (if .transport_request_id then "'" + .transport_request_id + "'::uuid" else "NULL" end) + ", " +
  "'" + .notification_type + "', " +
  "'" + .channel + "', " +
  (if .recipient_phone then "'" + .recipient_phone + "'" else "NULL" end) + ", " +
  (if .recipient_email then "'" + .recipient_email + "'" else "NULL" end) + ", " +
  (if .template_sid then "'" + .template_sid + "'" else "NULL" end) + ", " +
  "'" + .status + "', " +
  (if .error_message then "'" + (.error_message | gsub("'";"''")) + "'" else "NULL" end) + ", " +
  (if .provider_message_id then "'" + .provider_message_id + "'" else "NULL" end) + ", " +
  (.is_fallback | tostring) + ", " +
  "'" + (.metadata | tostring | gsub("'";"''")) + "'::jsonb, " +
  "'" + .created_at + "'::timestamptz, " +
  "'" + .updated_at + "'::timestamptz" +
  ") ON CONFLICT (id) DO NOTHING;"
' notification_attempts.json > 008_import_notification_attempts.sql

echo ""
echo "✅ Fichiers SQL générés:"
ls -lh 006_*.sql 007_*.sql 008_*.sql
