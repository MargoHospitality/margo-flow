# margo-flow — Runbook

## Dev local (frontend)
```bash
cd ~/projets/margo-flow
npm run dev      # Vite → http://localhost:8080
npm run build && npm run preview
```

## Deploy Edge Functions
```bash
# Une fonction
supabase functions deploy cloudbeds-webhook --project-ref <SUPABASE_PROJECT_REF>

# Toutes
supabase functions deploy --project-ref <SUPABASE_PROJECT_REF>
```

## Tester un appel Cloudbeds sans risque
- Utiliser un `reservation_id` de réservation test (statut "checked_out" ou annulée)
- Ne jamais appeler l'API Cloudbeds prod depuis local sans vérifier l'env
- Préférer inspecter `cloudbeds-lookup` via logs Edge Functions (voir ci-dessous)

## Tester Twilio WhatsApp sans spammer
- Modifier le destinataire dans `.env.local` → pointer vers numéro de dev personnel
- Ne jamais déclencher `notify-manager` / `notify-client` en prod pour un test
- Option : commenter temporairement l'appel Twilio dans la fonction ciblée

## Vérifier les logs
- Supabase Dashboard → <SUPABASE_PROJECT_REF> → Edge Functions → <nom> → Logs
- Vercel Frontend → <VERCEL_PROJECT_URL> → onglet Deployments → Build/Function Logs
- Base URL Edge Functions : `<SUPABASE_FUNCTION_BASE_URL>/functions/v1/<nom>`

## Env vars

**Frontend (clés publiques Vercel — non secrètes) :**
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` ← clé anon/publique Supabase uniquement

**Edge Functions (secrets Supabase — jamais exposés au frontend) :**
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDBEDS_API_KEY`,
`RESEND_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`
