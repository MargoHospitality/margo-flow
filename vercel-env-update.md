# Configuration Variables Vercel pour Margo Flow

## Variables à configurer

Va sur: https://vercel.com/dashboard
→ Sélectionne le projet "margo-flow"
→ Settings → Environment Variables

### Variables OBLIGATOIRES (remplacer les anciennes):

**VITE_SUPABASE_URL**
```
https://your-project-id.supabase.co
```

**VITE_SUPABASE_PUBLISHABLE_KEY** (anon key)
```
your_supabase_anon_public_key
```

**VITE_SUPABASE_PROJECT_ID**
```
your_supabase_project_id
```

---

## Instructions

1. **Supprime les anciennes variables** Lovable (si présentes)
2. **Ajoute les 3 nouvelles** avec les valeurs du projet Supabase actif
3. **Environnements:** Coche "Production", "Preview", "Development" pour les 3
4. **Save**
5. **Redeploy** le projet (Deployments → dernier deploy → "Redeploy")

---

Tu peux reprendre directement les placeholders documentés dans `.env.example` pour éviter de recoller des secrets dans le repo.
