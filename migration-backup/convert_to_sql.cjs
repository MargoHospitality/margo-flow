const fs = require('fs');

function escapeSQL(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''").replace(/\\/g, '\\\\') + "'";
}

function jsonToSQL(str) {
  if (!str) return "'{}'::jsonb";
  return escapeSQL(JSON.stringify(str)) + '::jsonb';
}

// Reservations
console.log('Génération reservations...');
const reservations = JSON.parse(fs.readFileSync('reservations_complete.json', 'utf8'));
let sql = '-- Import reservations (2838 records)\n\n';
reservations.forEach(r => {
  sql += `INSERT INTO public.reservations (id, reservation_id, property_id, riad_id, guest_last_name, guest_first_name, guest_country_code, check_in_date, check_out_date, nights, status, source, cloudbeds_raw, created_at, updated_at) VALUES (${escapeSQL(r.id)}::uuid, ${escapeSQL(r.reservation_id)}, ${escapeSQL(r.property_id)}, ${r.riad_id ? escapeSQL(r.riad_id) + '::uuid' : 'NULL'}, ${escapeSQL(r.guest_last_name)}, ${escapeSQL(r.guest_first_name)}, ${escapeSQL(r.guest_country_code)}, ${escapeSQL(r.check_in_date)}::date, ${r.check_out_date ? escapeSQL(r.check_out_date) + '::date' : 'NULL'}, ${r.nights || 'NULL'}, ${escapeSQL(r.status || 'confirmed')}::public.reservation_status, ${escapeSQL(r.source)}, ${jsonToSQL(r.cloudbeds_raw)}, ${escapeSQL(r.created_at)}::timestamptz, ${escapeSQL(r.updated_at)}::timestamptz) ON CONFLICT (reservation_id) DO NOTHING;\n`;
});
fs.writeFileSync('006_import_reservations.sql', sql);

// Transport requests
console.log('Génération transport_requests...');
const transports = JSON.parse(fs.readFileSync('transport_requests.json', 'utf8'));
sql = '-- Import transport_requests (121 records)\n\n';
transports.forEach(t => {
  sql += `INSERT INTO public.transport_requests (id, reservation_id, riad_id, transport_offer_id, transport_date, transport_time, pax, computed_price, payment_mode, payload_details, guest_comment, status, is_free_transfer, public_token, rejection_reason, cancellation_reason, cancelled_at, created_at, updated_at) VALUES (${escapeSQL(t.id)}::uuid, ${escapeSQL(t.reservation_id)}, ${escapeSQL(t.riad_id)}::uuid, ${escapeSQL(t.transport_offer_id)}::uuid, ${escapeSQL(t.transport_date)}::date, ${escapeSQL(t.transport_time)}::time, ${t.pax}, ${t.computed_price}, ${escapeSQL(t.payment_mode)}::public.payment_mode, ${jsonToSQL(t.payload_details)}, ${escapeSQL(t.guest_comment)}, ${escapeSQL(t.status)}::public.request_status, ${t.is_free_transfer}, ${escapeSQL(t.public_token)}, ${escapeSQL(t.rejection_reason)}, ${escapeSQL(t.cancellation_reason)}, ${t.cancelled_at ? escapeSQL(t.cancelled_at) + '::timestamptz' : 'NULL'}, ${escapeSQL(t.created_at)}::timestamptz, ${escapeSQL(t.updated_at)}::timestamptz) ON CONFLICT (id) DO NOTHING;\n`;
});
fs.writeFileSync('007_import_transport_requests.sql', sql);

// Notification attempts
console.log('Génération notification_attempts...');
const notifs = JSON.parse(fs.readFileSync('notification_attempts.json', 'utf8'));
sql = '-- Import notification_attempts (353 records)\n\n';
notifs.forEach(n => {
  sql += `INSERT INTO public.notification_attempts (id, transport_request_id, notification_type, channel, recipient_phone, recipient_email, template_sid, status, error_message, provider_message_id, is_fallback, metadata, created_at, updated_at) VALUES (${escapeSQL(n.id)}::uuid, ${n.transport_request_id ? escapeSQL(n.transport_request_id) + '::uuid' : 'NULL'}, ${escapeSQL(n.notification_type)}, ${escapeSQL(n.channel)}, ${escapeSQL(n.recipient_phone)}, ${escapeSQL(n.recipient_email)}, ${escapeSQL(n.template_sid)}, ${escapeSQL(n.status)}, ${escapeSQL(n.error_message)}, ${escapeSQL(n.provider_message_id)}, ${n.is_fallback}, ${jsonToSQL(n.metadata)}, ${escapeSQL(n.created_at)}::timestamptz, ${escapeSQL(n.updated_at)}::timestamptz) ON CONFLICT (id) DO NOTHING;\n`;
});
fs.writeFileSync('008_import_notification_attempts.sql', sql);

console.log('✅ Fichiers SQL générés!');
