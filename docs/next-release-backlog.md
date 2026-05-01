# Margo Flow Next Release Backlog

Working note for the next release cycle. The goal is to keep Margo Flow operationally reliable before adding larger visible features.

## 1. Cloudbeds Data Quality

Priority: high.

Cloudbeds can return partial reservation payloads depending on the endpoint or webhook source. Margo Flow should continue moving toward a defensive data layer.

Ideas:
- Detect incomplete reservation records automatically.
- Refresh missing operational fields from `getReservation` when needed.
- Avoid overwriting a complete `cloudbeds_raw` with a lighter list/webhook payload.
- Track when a reservation was last refreshed from Cloudbeds.
- Surface a discreet technical status only when useful, for example “Cloudbeds data refreshed”.

Fields to protect:
- room names
- guest country
- guest phone / WhatsApp
- guest app link
- balance / payment state
- arrival time

## 2. Arrivals: Needs Attention

Priority: high.

The Arrivals page should become the daily operational cockpit.

Potential quick filters:
- no digital check-in yet
- transport pending
- transport confirmed but missing key details
- Cloudbeds notes available
- guest app link missing
- WhatsApp unavailable or incomplete
- reservation data incomplete

Potential improvements:
- Sort by operational arrival time by default.
- Add a compact `Needs attention` badge or filter.
- Keep mobile usage highly actionable for managers.

## 3. System Activity / Operational Logs

Priority: medium-high.

Investigations are currently too manual when something does not sync or post correctly.

Potential admin page:
- latest Cloudbeds API calls
- latest Cloudbeds sync errors
- latest Stripe webhook events
- latest payment posting attempts
- latest review fetch status
- retry actions where safe

Primary goal: make support/debugging faster without opening logs manually.

## 4. Backend ACL Hardening

Priority: high.

All operational modules should enforce property access server-side, even if the frontend or upstream API also filters.

Modules to review:
- Arrivals
- Transport
- Payments
- Reviews
- Cloudbeds notes
- Guest App links

Rule: never return out-of-scope property data to the frontend.

## 5. Margo Pay Reliability

Priority: medium.

The payment link flow is working and should be made more transparent for managers.

Potential improvements:
- Clear lifecycle per payment: `Link sent`, `Paid`, `Posted to Cloudbeds`, `Posting failed`.
- Manual retry when Stripe is paid but Cloudbeds posting failed.
- Better payment timeline in the backoffice.
- More explicit manager confirmation email.
- Safer handling for split payments.

## Suggested Order

1. Cloudbeds data quality layer.
2. Arrivals `Needs attention`.
3. Backend ACL hardening pass.
4. System Activity admin page.
5. Margo Pay lifecycle improvements.
