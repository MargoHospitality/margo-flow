# Import SQL Margo Flow → Supabase

## URL SQL Editor
https://supabase.com/dashboard/project/bndrfqfzrolxfmdfqaqa/sql/new

## Ordre d'exécution (copier-coller chaque fichier)

### 1/5: Schema (ENUMs, Tables, Indexes)
**Fichier:** `migration/001_schema.sql`

→ Copier tout le contenu du fichier
→ Coller dans SQL Editor
→ Cliquer "Run"
→ Vérifier message de succès

---

### 2/5: Functions (RPC + Triggers)
**Fichier:** `migration/002_functions.sql`

→ Copier tout le contenu du fichier
→ Coller dans SQL Editor
→ Cliquer "Run"
→ Vérifier message de succès

---

### 3/5: RLS Policies (Sécurité)
**Fichier:** `migration/003_policies.sql`

→ Copier tout le contenu du fichier
→ Coller dans SQL Editor
→ Cliquer "Run"
→ Vérifier message de succès

---

### 4/5: Data (Riads, Offers, Users)
**Fichier:** `migration/004_data.sql`

→ Copier tout le contenu du fichier
→ Coller dans SQL Editor
→ Cliquer "Run"
→ Vérifier message de succès

---

### 5/5: Riad Pricing Overrides
**Fichier:** `migration/005_riad_transport_offers.sql`

→ Copier tout le contenu du fichier
→ Coller dans SQL Editor
→ Cliquer "Run"
→ Vérifier message de succès

---

## Vérification post-import

Après avoir exécuté les 5 fichiers, lance cette requête SQL pour vérifier:

```sql
-- Vérifier tables créées
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Vérifier données importées
SELECT 
  (SELECT COUNT(*) FROM riads) as riads_count,
  (SELECT COUNT(*) FROM transport_offers) as offers_count,
  (SELECT COUNT(*) FROM user_roles) as users_count,
  (SELECT COUNT(*) FROM riad_transport_offers) as pricing_count;

-- Devrait retourner:
-- riads_count: 12
-- offers_count: 8
-- users_count: 14
-- pricing_count: (nombre de pricing overrides)
```

---

## Prochaine étape

Une fois les 5 fichiers importés avec succès:
- [ ] Attendre Edge Function export-data de Lovable
- [ ] Télécharger les 3 fichiers JSON (reservations, transport_requests, notification_attempts)
- [ ] Importer ces données volumineuses
- [ ] Configurer Edge Functions
- [ ] Déployer sur Vercel

---

**Si problème:** Me copier le message d'erreur exact.
