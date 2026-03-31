# Déploiement Notifications Annulation - 2026-02-06

## ✅ Ce Qui a Été Déployé

### 1. Nouvelle Edge Function: `notify-client-cancellation`
**Status:** ✅ Déployée (Supabase)  
**Localisation:** `supabase/functions/notify-client-cancellation/index.ts`

**Capacités:**
- Templates email FR/EN (ton neutre/informatif)
- 3 raisons d'annulation supportées:
  - `reservation_cancelled`: Réservation annulée dans Cloudbeds
  - `reservation_dates_changed`: Dates modifiées → transport invalidé
  - `manual_cancellation`: Annulation manuelle back-office par manager
- Pour `dates_changed`: Affiche nouvelles dates + bouton "Submit New Request" avec token link
- Récupère contact manager (email + WhatsApp) depuis table `riads`
- Logging dans `notification_attempts`

---

### 2. Modifications `cloudbeds-scheduled-reconcile`
**Status:** ✅ Déployée (Supabase)  
**Changement:** Fetch données complètes transport requests avant update → envoi notification après annulation

**Workflow:**
```typescript
// 1. Fetch transport requests avec données client
const { data: transportRequests } = await supabase
  .from('transport_requests')
  .select('id, transport_type, transport_date, guest_name, guest_email, guest_phone, payload')
  .eq('reservation_id', reservationId)
  .in('status', ['pending', 'confirmed']);

// 2. Update status
await supabase.from('transport_requests').update({ status: 'rejected', ... })

// 3. Send notifications
for (const tr of transportRequests) {
  await fetch(`${supabaseUrl}/functions/v1/notify-client-cancellation`, { ... })
}
```

**Triggers:**
- Dates réservation changées (check-in modifié)
- Statut réservation → cancelled

---

### 3. Modifications `cloudbeds-reconcile`
**Status:** ✅ Déployée (Supabase)  
**Changement:** Identique à `cloudbeds-scheduled-reconcile` (même workflow notifications)

---

### 4. Modifications Frontend: `RequestCard.tsx`
**Status:** ✅ Déployée (Vercel auto-deploy)  
**Changements:**

#### a) `handleReject()` (Reject pending request)
Envoie `notify-client-cancellation` avec `cancelReason: 'manual_cancellation'`

#### b) `handleCancel()` (Cancel confirmed request)
Envoie `notify-client-cancellation` avec `cancelReason: 'manual_cancellation'`

**Langue utilisée:** Détectée depuis `request.payload_details.language` (langue choisie par client lors soumission)

---

## 📋 Tests à Effectuer

### Test 1: Annulation Automatique (Dates Modifiées)
**Workflow:**
1. Sélectionner une réservation avec transport confirmé
2. Modifier dates check-in dans Cloudbeds
3. Attendre réconciliation (08:00 ou 20:00 UTC) OU lancer manuellement
4. **Vérifier:**
   - Transport request status → `rejected`
   - Email envoyé au client (langue correcte)
   - Email contient nouvelles dates + bouton "Submit New Request"
   - Contact manager affiché

**Résultat attendu:**
```
Subject: Transport Request Cancelled – Reservation Dates Updated (#123456)
Body: Dates modifiées, nouvelles dates affichées, lien token fourni
```

---

### Test 2: Annulation Automatique (Réservation Annulée)
**Workflow:**
1. Sélectionner une réservation avec transport confirmé
2. Annuler réservation dans Cloudbeds
3. Attendre réconciliation OU lancer manuellement
4. **Vérifier:**
   - Transport request status → `rejected`
   - Email envoyé au client (langue correcte)
   - Email informe de l'annulation (sans nouvelles dates)
   - Contact manager affiché

**Résultat attendu:**
```
Subject: Transport Request Cancelled (#123456)
Body: Transport annulé, contact manager pour questions
```

---

### Test 3: Rejet Manuel (Pending Request)
**Workflow:**
1. Client soumet nouveau transport request
2. Manager ouvre backoffice → clique "Reject"
3. Saisit raison de rejet
4. **Vérifier:**
   - Transport request status → `rejected`
   - Email envoyé au client (langue correcte)
   - Email neutre (pas de mention de raison interne)
   - Contact manager affiché

**Résultat attendu:**
```
Subject: Transport Request Cancelled (#123456)
Body: Demande annulée, contact manager pour questions
```

---

### Test 4: Annulation Manuelle (Confirmed Request)
**Workflow:**
1. Transport confirmé visible dans backoffice
2. Manager clique "Cancel Transport"
3. Saisit raison (ex: "Client changed plans")
4. **Vérifier:**
   - Transport request status → `cancelled`
   - Email envoyé au client (langue correcte)
   - Email neutre (pas de mention de raison interne)
   - Contact manager affiché

**Résultat attendu:**
```
Subject: Transport Request Cancelled (#123456)
Body: Demande annulée, contact manager pour questions
```

---

### Test 5: Langue FR/EN
**Workflow:**
1. Créer 2 transport requests (1 EN, 1 FR) via token page
2. Manager rejette les deux
3. **Vérifier:**
   - Email EN: Subject + body en anglais
   - Email FR: Subject + body en français

---

### Test 6: Logging `notification_attempts`
**Workflow:**
Après chaque test ci-dessus, vérifier table `notification_attempts`:
```sql
SELECT 
  transport_request_id,
  notification_type,
  channel,
  recipient_email,
  status,
  error_message,
  metadata
FROM notification_attempts
WHERE notification_type = 'client_cancellation'
ORDER BY created_at DESC
LIMIT 10;
```

**Vérifier:**
- `status = 'sent'` (succès)
- `metadata.language` correct
- `metadata.cancelReason` correct

---

## 🔍 Monitoring Production

### Métriques à Surveiller

**Table `notification_attempts`:**
```sql
-- Taux succès email annulation (derniers 7 jours)
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM notification_attempts
WHERE notification_type = 'client_cancellation'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY status;
```

**Raisons d'annulation:**
```sql
SELECT 
  metadata->>'cancelReason' as cancel_reason,
  COUNT(*) as count
FROM notification_attempts
WHERE notification_type = 'client_cancellation'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY metadata->>'cancelReason';
```

---

## 📊 Impacts Attendus

### Positifs
✅ Clients informés automatiquement des annulations  
✅ Réduction confusion client (plus de "où est mon transport?")  
✅ Expérience client améliorée (transparence)  
✅ Réduction support managers (moins de contacts réactifs)

### Risques
⚠️ **Si email échoue:** Client pas informé (mais logging permet détection)  
⚠️ **Si token expiré (dates changées):** Client ne peut pas re-soumettre → contactera manager

**Mitigation:**
- Monitoring quotidien `notification_attempts` (alertes si taux échec >5%)
- Baptiste peut re-envoyer notification manuellement si nécessaire

---

## 🛠️ Maintenance Future

### Phase 2 (Optionnel)
- WhatsApp pour annulations urgentes (<48h)
- Templates WhatsApp `client_cancel_urgent_fr/en`

### Phase 3 (Optionnel)
- Résumé quotidien manager (email après réconciliation)
- Stats: X annulations automatiques, raisons

---

## 📝 Checklist Déploiement

- [x] Edge Function `notify-client-cancellation` créée
- [x] Templates email FR/EN implémentés
- [x] `cloudbeds-scheduled-reconcile` modifiée
- [x] `cloudbeds-reconcile` modifiée
- [x] `RequestCard.tsx` modifiée (handleReject + handleCancel)
- [x] Edge Functions déployées (Supabase)
- [x] Frontend déployé (Vercel)
- [ ] Tests validation (Baptiste)
- [ ] Monitoring 7 jours (taux succès emails)
- [ ] Documentation feedback client

---

**Status:** ✅ Déployé en production  
**Prochaine étape:** Tests validation Baptiste
