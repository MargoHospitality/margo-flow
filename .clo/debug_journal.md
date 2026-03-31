# margo-flow — Debug Journal

## Focus actuel
Aucun incident bloquant.
Focus : validation E2E Sierra — vérifier que `cloudbeds-add-note` est déclenché
après check-in depuis Guest App et que la note apparaît dans Cloudbeds.

---

## Zones fragiles connues

### 1. Pricing calculé côté frontend (non revalidé serveur)
`computed_price` calculé dans `TransportForm.tsx`, transmis brut à `submit-transport-request`.
Aucune revalidation côté Edge Function. Risque de manipulation client.

### 2. Rate limiting in-memory dans `cloudbeds-lookup`
Store rate limit réinitialisé à chaque cold start. Protection inefficace si déploiements fréquents.

### 3. Webhook Cloudbeds — pas de déduplication explicite
`cloudbeds-webhook` utilise `upsert` mais ne vérifie pas si une notification a déjà été envoyée.
Risque de double notification en cas de retry Cloudbeds.

### 4. `check-transport-status` — endpoint public sans auth
Accessible avec `reservation_id` seul, sans validation d'ownership.
Mitigation : envisager IDs non-devinables (UUID) ou accès par token + rate limiting.

---

## Résolus

### [2026-02-16] Webhooks Sierra configurés
3 webhooks Cloudbeds actifs pour Riad Sierra :
`reservation/created`, `reservation/dates_changed`, `reservation/status_changed`
