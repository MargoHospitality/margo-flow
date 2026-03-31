# Analyse Architecture Notifications Margo Flow

**Date:** 2026-02-06  
**Contexte:** Vérification suite rationalisation réconciliation (1 propriété à la fois)

## Architecture Actuelle

### Fonctions de Notification

#### 1. `notify-client` (Confirmations transport)
**Trigger:** Appelée quand manager confirme un transport request  
**Canaux:**
- **Email (primaire):** Resend → `flow@margo-hospitality.com`
- **WhatsApp (bonus):** Twilio (si `whatsapp_enabled = true` pour la propriété ET numéro fourni)

**Templates WhatsApp:**
- `client_confirm_en` (anglais)
- `client_confirm_fr` (français)

**Logging:** Enregistre chaque tentative dans `notification_attempts`

**Données envoyées:**
- Détails réservation + transport
- Public token link: `https://flow.margo-hospitality.com/confirmation/{token}`
- Contact manager (email + WhatsApp si disponible)

---

#### 2. `notify-manager` (Nouveaux transport requests)
**Trigger:** Appelée quand client soumet un nouveau transport request  
**Canaux:**
- **WhatsApp (urgent seulement):** Si `isUrgent = true` ET `whatsapp_enabled = true` ET numéro fourni
- **Email (fallback ou standard):** Toujours envoyé si WhatsApp échoue ou non-urgent

**Templates WhatsApp:**
- `manager_urgent_en` (pour transports <48h)

**Logging:** Enregistre chaque tentative dans `notification_attempts`

**Données envoyées:**
- Détails réservation + transport
- Backoffice link: `https://flow.margo-hospitality.com/backoffice`

---

#### 3. `send-manager-notification` (Legacy)
**Status:** Semble être une ancienne version de `notify-manager`  
**Usage:** Probablement obsolète (à vérifier)

---

### Autres Fonctions Notification
- `send-whatsapp`: Fonction générique appelée par `notify-client` et `notify-manager`
- `send-reminder-emails`: Rappels (à investiguer)
- `send-client-confirmation`: Peut-être doublon avec `notify-client` (à vérifier)

---

## Annulations Transport Requests

### Triggers Annulation

**Via webhook (`cloudbeds-webhook`):**
```typescript
// Event: reservation/status_changed → cancelled
// Action: Révoque guest_token
// ⚠️ N'ANNULE PAS les transport requests (fait par réconciliation)
```

**Via réconciliation (`cloudbeds-scheduled-reconcile` ou `cloudbeds-reconcile`):**
```typescript
// Conditions:
// 1. Dates réservation changées (checkInDateChanged)
// 2. Status réservation → cancelled (statusBecameCancelled)

// Action:
const { data: cancelled } = await supabase
  .from('transport_requests')
  .update({
    status: 'rejected',
    rejection_reason: 'reservation_cancelled' | 'reservation_dates_changed',
    updated_at: new Date().toISOString(),
  })
  .eq('reservation_id', reservationId)
  .in('status', ['pending', 'confirmed'])
  .select('id');

// ⚠️ PAS DE NOTIFICATION ENVOYÉE AU CLIENT OU MANAGER
```

---

## ⚠️ GAPS IDENTIFIÉS

### 1. Annulation Transport Request → Pas de Notification Client
**Situation:**
- Réservation annulée dans Cloudbeds
- Token révoqué ✅
- Transport requests annulés ✅
- **Client JAMAIS informé de l'annulation du transport** ❌

**Impact:**
- Client peut croire que transport est toujours confirmé
- Risque show-up client sans transport organisé

**Solution proposée:**
Ajouter notification client dans fonction réconciliation quand transport request annulé:
- Email automatique: "Votre transport a été annulé suite à modification/annulation de réservation"
- WhatsApp optionnel si activé

---

### 2. Annulation Transport Request → Pas de Notification Manager
**Situation:**
- Dates réservation changées
- Transport requests annulés automatiquement
- **Manager JAMAIS informé** ❌

**Impact:**
- Manager peut contacter chauffeur/organiser transport pour dates périmées
- Risque coordination avec partenaires transport

**Solution proposée:**
- Email récapitulatif quotidien (dans scheduled-reconcile final summary)
- Ou notification immédiate si transport était <48h

---

### 3. Modification Dates → Client Doit Re-soumettre Demande
**Situation actuelle:**
- Dates changées → transport annulé
- Client doit retourner sur token page et re-soumettre

**Comportement attendu:**
- Informer client que transport annulé
- Inviter à soumettre nouvelle demande avec nouvelles dates
- Fournir lien token page

---

## Recommandations Priorisation

### 🔴 CRITIQUE (Implémenter immédiatement)
1. **Notification client annulation transport**
   - Email automatique lors annulation par réconciliation
   - Template: "Transport Cancelled – Reservation Modified/Cancelled"
   - Langues: FR/EN (détecté depuis réservation)

### 🟠 IMPORTANT (Prochaine itération)
2. **Notification manager réconciliation**
   - Résumé quotidien: "X transport requests annulés automatiquement (dates/annulation)"
   - Ou notification immédiate si transport <48h annulé

### 🟡 NICE-TO-HAVE
3. **WhatsApp pour annulations urgentes (<48h)**
   - Client: WhatsApp si numéro fourni ET transport <48h
   - Manager: WhatsApp si transport <48h

---

## Architecture Proposée

### Nouvelle Fonction: `notify-client-cancellation`

**Input:**
```typescript
{
  transportRequestId: string;
  reservationId: string;
  propertyName: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  transportType: string;
  originalDate: string;
  cancelReason: 'reservation_cancelled' | 'reservation_dates_changed';
  language: 'en' | 'fr';
  newCheckIn?: string; // Si dates changées
  newCheckOut?: string; // Si dates changées
  tokenUrl?: string; // Pour re-soumettre si dates changées
}
```

**Templates Email:**
- `client_cancellation_dates_changed_fr/en`: Dates modifiées, inviter à re-soumettre
- `client_cancellation_reservation_cancelled_fr/en`: Réservation annulée, transport annulé

**Templates WhatsApp (optionnel):**
- `client_cancel_urgent_fr/en`: Si transport <48h

**Appel depuis:**
- `cloudbeds-scheduled-reconcile` après annulation transport
- `cloudbeds-reconcile` après annulation transport

---

### Modification: `cloudbeds-scheduled-reconcile`

**Après annulation transport requests:**
```typescript
if ((checkInDateChanged || statusBecameCancelled) && existingRes) {
  const cancelReason = statusBecameCancelled ? 'reservation_cancelled' : 'reservation_dates_changed';

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

  // 🆕 ENVOYER NOTIFICATIONS ANNULATION
  for (const cancelledRequest of cancelled || []) {
    await fetch(`${supabaseUrl}/functions/v1/notify-client-cancellation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        transportRequestId: cancelledRequest.id,
        reservationId,
        propertyName: riad.name,
        guestName: cancelledRequest.guest_name,
        guestEmail: cancelledRequest.guest_email,
        guestPhone: cancelledRequest.guest_phone,
        transportType: cancelledRequest.transport_type,
        originalDate: cancelledRequest.transport_date,
        cancelReason,
        language: cancelledRequest.payload?.language || 'en',
        newCheckIn: checkInDateChanged ? updatedRes.check_in_date : undefined,
        newCheckOut: checkInDateChanged ? updatedRes.check_out_date : undefined,
        tokenUrl: checkInDateChanged ? `https://flow.margo-hospitality.com/token/${updatedRes.guest_app_token}` : undefined,
      }),
    });
  }

  transportCancelled += cancelled?.length || 0;
}
```

---

## Prochaines Étapes

1. **Créer `notify-client-cancellation` Edge Function**
   - Templates email FR/EN (dates changées vs annulation complète)
   - Logging dans `notification_attempts`
   - Support WhatsApp optionnel (<48h)

2. **Modifier `cloudbeds-scheduled-reconcile`**
   - Appeler `notify-client-cancellation` après annulation transport
   - Fetch données transport annulés (guest_email, payload, etc.)

3. **Tester Workflow Complet**
   - Annulation réservation → token révoqué + transport annulé + email client
   - Dates modifiées → transport annulé + email client avec invitation re-submit

4. **Monitoring Production**
   - Vérifier `notification_attempts` pour taux succès
   - Feedback Baptiste sur templates email

---

## Questions pour Baptiste

1. **Ton des emails annulation:**
   - Formel ou décontracté?
   - Excuses pour désagrément ou juste informatif?

2. **WhatsApp pour annulations:**
   - Activer pour annulations urgentes (<48h)?
   - Ou rester email-only?

3. **Notification manager:**
   - Récapitulatif quotidien suffisant?
   - Ou alert immédiate pour annulations <48h?

4. **Fonction `send-manager-notification`:**
   - Confirmer obsolète ou encore utilisée?
