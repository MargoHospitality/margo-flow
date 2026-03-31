# margo-flow — Backlog

## P0 — Critique

### 1. Notification annulation transport non envoyée
- `cloudbeds-reconcile` passe le transport en `rejected` mais n'appelle PAS `notify-client-cancellation`
- `notify-client-cancellation` **existe** (`supabase/functions/notify-client-cancellation/`) mais n'est jamais appelée depuis la réconciliation
- Impact : guest croit transport confirmé jusqu'au jour J → risque show-up sans prise en charge
- Fix : dans `cloudbeds-reconcile/index.ts`, après le passage en `rejected`, appeler `notify-client-cancellation`
  avec : `transportRequestId`, `reservationId`, `propertyId`, `propertyName`, `guestName`, `guestEmail`

### 2. Pricing calculé côté frontend — non revalidé serveur
- `computed_price` calculé dans `TransportForm.tsx` (override ?? default), transmis brut à `submit-transport-request`
- Aucune vérification côté Edge Function → un client peut soumettre un prix arbitraire
- Fix P1 (acceptable court terme) : ajouter une vérification de plausibilité dans `submit-transport-request`
  (recalculer le prix attendu depuis `riad_transport_offers` et rejeter si écart > X%)

### 3. Double notification sur retry webhook Cloudbeds
- `cloudbeds-webhook` fait un `upsert` sur la réservation mais **ne track pas les notifications déjà envoyées**
- En cas de retry Cloudbeds (timeout / 5xx), manager et guest reçoivent la même notification deux fois
- Fix : vérifier `notification_attempts` avant d'appeler `notify-manager` / `notify-client`
  OU ajouter un champ `notified_at` sur `transport_requests` comme garde-fou d'idempotence

---

## P1 — Important

### Tests automatisés Edge Functions
Aucun test existant. Smoke tests minimaux sur `submit-transport-request` et `check-transport-status`.

---

## P2 — Souhaitable

### Observabilité
Pas d'alerting si une Edge Function échoue silencieusement.
Envisager : webhook Slack/email sur erreurs `notify-*`.
