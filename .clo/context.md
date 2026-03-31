# margo-flow — Contexte

## Architecture
Acteurs : Guest (formulaire web) → Riad staff (backoffice) → Manager (WhatsApp/email)
Systèmes : Supabase (DB + Edge Functions) · Cloudbeds API · Resend (email) · Twilio (WhatsApp)
Frontend : React + Vite → Vercel. Backend : Edge Functions Deno → Supabase.

## Workflow core
1. Guest arrive sur `/` ou `/token/:token` (deep-link depuis Guest App)
2. Lookup réservation : DB locale → fallback Cloudbeds API (`cloudbeds-lookup`)
3. Guest remplit formulaire transport → `submit-transport-request` (RPC Supabase)
4. → `notify-manager` (WhatsApp Twilio) + `send-manager-notification` (email Resend)
5. Staff confirme dans `/backoffice` → `notify-client` (email) + `send-whatsapp` (Twilio)
6. Guest App consulte `check-transport-status?reservation_id=` pour afficher TransportCard

## Pricing (calculé côté frontend)
- Source : table `riad_transport_offers` JOIN `transport_offers`
- Logique : `override_X ?? default_X` (override par riad, défaut global)
- Champs : `day_price`, `night_price`, `base_pax`, `extra_pax_price` (tranches via `day_start_time`/`day_end_time`)
- `computed_price` transmis tel quel à `submit-transport-request` — pas revalidé côté serveur

## Tables clés (Supabase)
- `transport_requests` — demandes, statut, prix, token public
- `riad_transport_offers` — overrides prix par riad
- `transport_offers` — offres globales avec prix par défaut
- `reservations` — cache local des réservations Cloudbeds
- `riads` — config par riad (manager_whatsapp, cloudbeds_property_id)

## Résolution réservation Cloudbeds
- Identifiant lookup : `reservation_id` (numéro confirmation Cloudbeds)
- Flux : DB locale → si absent → `GET /api/v1.3/getReservation?reservationID=`
- Auth Cloudbeds : `Bearer CLOUDBEDS_API_KEY` (secret Edge Function uniquement)
- Rate limiting in-memory dans `cloudbeds-lookup` (reset à chaque cold start)

## Deep-link depuis Guest App
```
https://flow.margo-hospitality.com/?token=<guest_token>&pax=<N>&returnTo=<url>
https://flow.margo-hospitality.com/token/<public_token>?pax=<N>
```
- `pax` → pré-remplit le nombre de passagers (max 10)
- `returnTo` + `token` → redirect retour vers Guest App après soumission
- Pas d'auth stricte : confiance sur `reservation_id` récupéré via token Supabase

## Edge Functions principales
| Fonction | Déclencheur | Rôle |
|---|---|---|
| `cloudbeds-webhook` | Cloudbeds event | Import réservation + révocation token si annulation |
| `cloudbeds-lookup` | Appel frontend | Lookup résev + cache DB local |
| `submit-transport-request` | Formulaire guest | Crée demande (RPC) |
| `notify-manager` | Post-submit | WhatsApp Twilio → manager riad |
| `notify-client` | Confirmation staff | Email Resend → guest |
| `check-transport-status` | Guest App poll | Retourne statut demande |
| `cloudbeds-add-note` | Post check-in | Note dans Cloudbeds via API |
| `cloudbeds-reconcile` | Manuel/scheduled | Sync réservations + annulations |

## Invariants critiques (ne pas casser)
- `notify-client-cancellation` **doit** être appelée chaque fois qu'un transport passe en `rejected`
  (actuellement manquant dans `cloudbeds-reconcile` — voir backlog P0)
- `computed_price` vient du frontend : toute modification du pricing DB ne se reflète pas sans rechargement du formulaire
- Les notifications manager/client ne sont pas idempotentes : s'assurer qu'aucun retry ne peut les déclencher deux fois
