# Gaps Notifications – Action Required

**Date:** 2026-02-06  
**Contexte:** Ajustement notifications suite rationalisation réconciliation

---

## 🚨 Problème Critique Identifié

### Transport Requests Annulés → Clients JAMAIS Informés

**Workflow actuel:**
1. Réservation annulée dans Cloudbeds (ou dates modifiées)
2. Webhook révoque token guest ✅
3. Réconciliation annule transport requests (status → rejected) ✅
4. **⚠️ AUCUNE notification envoyée au client** ❌

**Conséquence:**
- Client croit transport toujours confirmé
- Risque show-up sans transport organisé
- Mauvaise expérience client

---

## Architecture Actuelle (Recap)

### Notifications Fonctionnelles

| Fonction | Trigger | Canal | Usage |
|----------|---------|-------|-------|
| `notify-client` | Manager confirme transport | Email (primaire) + WhatsApp (bonus si activé) | ✅ Production |
| `notify-manager` | Client soumet transport request | WhatsApp (si urgent <48h) + Email (fallback/standard) | ✅ Production |

### Notifications Manquantes

| Événement | Canal Actuel | Impact |
|-----------|--------------|--------|
| Transport annulé (résa annulée) | ❌ Aucun | Client pas informé |
| Transport annulé (dates changées) | ❌ Aucun | Client pas informé + doit re-soumettre |
| Réconciliation quotidienne | ❌ Aucun | Manager pas informé des annulations auto |

---

## 🎯 Solution Proposée

### 1. Nouvelle Edge Function: `notify-client-cancellation`

**Templates Email:**

#### a) Réservation Annulée
```
Subject: Your Transport Request Has Been Cancelled

Dear [Guest Name],

Your reservation at [Property Name] has been cancelled.
As a result, your confirmed transport for [Date] has also been cancelled.

If you have questions, please contact:
- Email: [manager_email]
- WhatsApp: [manager_whatsapp]

Best regards,
Margo Flow Team
```

#### b) Dates Modifiées
```
Subject: Your Transport Request Has Been Cancelled (Reservation Dates Changed)

Dear [Guest Name],

The dates for your reservation at [Property Name] have been updated.
Your previous transport request for [Original Date] has been cancelled.

Your new check-in: [New Check-In]
Your new check-out: [New Check-Out]

👉 Submit a new transport request for your updated dates:
[Token Link]

If you have questions, please contact:
- Email: [manager_email]
- WhatsApp: [manager_whatsapp]

Best regards,
Margo Flow Team
```

**Langues:** FR + EN (détecté depuis payload transport request)

**WhatsApp (optionnel):**
- Seulement si transport <48h ET numéro fourni
- Template simple: "Transport annulé - réservation modifiée/annulée"

---

### 2. Modification `cloudbeds-scheduled-reconcile`

**Après annulation transport requests, ajouter:**

```typescript
// Fetch full data for cancelled requests
const { data: cancelled } = await supabase
  .from('transport_requests')
  .update({
    status: 'rejected',
    rejection_reason: cancelReason,
    updated_at: new Date().toISOString(),
  })
  .eq('reservation_id', reservationId)
  .in('status', ['pending', 'confirmed'])
  .select('id, transport_type, transport_date, guest_name, guest_email, guest_phone, payload');

// Send cancellation notifications
for (const tr of cancelled || []) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/notify-client-cancellation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        transportRequestId: tr.id,
        reservationId,
        propertyId: riad.id,
        propertyName: riad.name,
        guestName: tr.guest_name,
        guestEmail: tr.guest_email,
        guestPhone: tr.guest_phone,
        transportType: tr.transport_type,
        originalDate: tr.transport_date,
        cancelReason,
        language: tr.payload?.language || 'en',
        newCheckIn: checkInDateChanged ? updatedRes.check_in_date : undefined,
        newCheckOut: checkInDateChanged ? updatedRes.check_out_date : undefined,
        tokenUrl: checkInDateChanged ? `https://flow.margo-hospitality.com/token/${updatedRes.guest_app_token}` : undefined,
      }),
    });
  } catch (err) {
    console.error('[reconcile] Failed to send cancellation notification:', err);
    // Continue processing other cancellations
  }
}

transportCancelled += cancelled?.length || 0;
```

---

### 3. (Optionnel) Résumé Quotidien Manager

**Envoyé à la fin de `cloudbeds-scheduled-reconcile` (08:00 & 20:00 UTC):**

```
Subject: Daily Reconciliation Summary – Margo Flow

Property: [Property Name]
Run: [Timestamp]

📊 Summary:
- Reservations processed: 142
- New reservations: 3
- Updated reservations: 8
- Transport requests cancelled: 2
  - Reason: Reservation cancelled (1)
  - Reason: Dates changed (1)

Review details: https://flow.margo-hospitality.com/backoffice
```

---

## 📋 Plan d'Implémentation

### Phase 1: Notifications Annulation Client (CRITIQUE)
1. ✅ Créer `notify-client-cancellation` Edge Function
2. ✅ Templates email FR/EN (2 variantes: annulation complète vs dates changées)
3. ✅ Modifier `cloudbeds-scheduled-reconcile` pour appeler fonction
4. ✅ Modifier `cloudbeds-reconcile` (manuel) pour appeler fonction
5. ✅ Tester workflow complet (annulation + dates changées)
6. ✅ Deploy production

**Estimation:** 2-3h développement + 1h test

---

### Phase 2: WhatsApp Annulations Urgentes (IMPORTANT)
1. ✅ Templates WhatsApp `client_cancel_urgent_fr/en`
2. ✅ Ajouter logique <48h dans `notify-client-cancellation`
3. ✅ Tester avec numéro WhatsApp test
4. ✅ Deploy production

**Estimation:** 1h développement + 30min test

---

### Phase 3: Résumé Manager (NICE-TO-HAVE)
1. ✅ Template email récapitulatif
2. ✅ Modifier `cloudbeds-scheduled-reconcile` pour envoyer à fin d'exécution
3. ✅ Tester avec propriété test
4. ✅ Deploy production

**Estimation:** 1-2h développement + 30min test

---

## 🔍 Cleanup Optionnel

**Fonctions obsolètes détectées:**
- `send-client-confirmation` (remplacée par `notify-client`)
- `send-manager-notification` (remplacée par `notify-manager`)

**Action:** Supprimer ou documenter comme deprecated

---

## ❓ Questions pour Validation

### 1. Ton Email Annulation
- **Option A:** Formel + excuses ("We apologize for the inconvenience...")
- **Option B:** Informatif neutre ("Your transport has been cancelled due to...")
- **Préférence?**

### 2. WhatsApp Annulations
- Activer pour transports <48h?
- Ou rester email-only pour simplifier?

### 3. Résumé Manager
- Quotidien (2x/jour après réconciliation)?
- Ou seulement si annulations détectées?
- Ou pas du tout (manager consulte backoffice)?

### 4. Langue Email
- Détecter depuis `payload.language` du transport request?
- Ou toujours anglais par défaut?

---

## 📊 Métriques à Monitorer (Post-Déploiement)

**Table `notification_attempts`:**
- `notification_type = 'client_cancellation'`
- Taux succès email
- Taux succès WhatsApp (si activé)
- Taux échec + raisons

**Feedback Baptiste:**
- Clients se plaignent-ils encore de ne pas être informés?
- Fréquence annulations automatiques (baseline pour monitoring)

---

**Prêt à implémenter Phase 1 dès validation.**
