# Configuration Variables Vercel pour Margo Flow

## Variables à configurer

Va sur: https://vercel.com/dashboard
→ Sélectionne le projet "margo-flow"
→ Settings → Environment Variables

### Variables OBLIGATOIRES (remplacer les anciennes):

**VITE_SUPABASE_URL**
```
https://bndrfqfzrolxfmdfqaqa.supabase.co
```

**VITE_SUPABASE_PUBLISHABLE_KEY** (anon key)
```
REDACTED_SUPABASE_ANON_KEY
```

**VITE_SUPABASE_PROJECT_ID**
```
bndrfqfzrolxfmdfqaqa
```

---

## Instructions

1. **Supprime les anciennes variables** Lovable (si présentes)
2. **Ajoute les 3 nouvelles** ci-dessus
3. **Environnements:** Coche "Production", "Preview", "Development" pour les 3
4. **Save**
5. **Redeploy** le projet (Deployments → dernier deploy → "Redeploy")

---

Une fois fait, le site Vercel utilisera TON Supabase au lieu de celui de Lovable.

