# Margo Flow - Database Migration Guide
## Overview
This directory contains SQL migration files to migrate from Lovable Cloud to self-hosted Supabase.
## Files
| File | Description |
|------|-------------|
| `001_schema.sql` | ENUMs, tables, indexes, RLS enablement |
| `002_functions.sql` | All database functions and triggers |
| `003_policies.sql` | Row Level Security policies |
| `004_data.sql` | Core reference data (riads, offers, users) |
| `005_riad_transport_offers.sql` | Riad-specific pricing overrides |
## Migration Steps
### 1. Create New Supabase Project
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project
3. Note your project URL and keys
### 2. Run Schema Migration
```bash
# In Supabase SQL Editor, run in order:
1. 001_schema.sql
2. 002_functions.sql  
3. 003_policies.sql
```
### 3. Configure Auth Trigger
After running the schema, execute this in SQL Editor:
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();
```
### 4. Import Data
```bash
# Run data imports:
1. 004_data.sql (core data)
2. 005_riad_transport_offers.sql (pricing)
```
### 5. Export Large Tables
The reservations and transport_requests tables are too large to include as static SQL. Export them from the source:
```sql
-- Export reservations (run in Lovable Cloud SQL)
COPY (SELECT * FROM reservations ORDER BY created_at) 
TO STDOUT WITH CSV HEADER;
-- Export transport_requests
COPY (SELECT * FROM transport_requests ORDER BY created_at) 
TO STDOUT WITH CSV HEADER;
-- Export notification_attempts  
COPY (SELECT * FROM notification_attempts ORDER BY created_at) 
TO STDOUT WITH CSV HEADER;
```
Then import using Supabase Table Editor or `COPY FROM`.
### 6. Configure Secrets
Set these secrets in your new Supabase project (Settings → Edge Functions → Secrets):
| Secret | Source |
|--------|--------|
| `CLOUDBEDS_API_KEY` | Cloudbeds Dashboard → API |
| `RESEND_API_KEY` | Resend Dashboard → API Keys |
| `TURNSTILE_SECRET_KEY` | Cloudflare Dashboard → Turnstile |
| `TWILIO_ACCOUNT_SID` | Twilio Console |
| `TWILIO_AUTH_TOKEN` | Twilio Console |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` (or your number) |
### 7. Deploy Edge Functions
```bash
# From project root
cd supabase/functions
# Deploy all functions
supabase functions deploy --project-ref YOUR_PROJECT_REF
```
### 8. Update Frontend Environment
Create `.env.production`:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
VITE_SUPABASE_PROJECT_ID=YOUR_PROJECT_REF
```
### 9. Deploy to Vercel
```bash
vercel --prod
```
## User Migration
**IMPORTANT**: Users are stored in `auth.users` which is Supabase-managed. You have two options:
### Option A: Fresh Users
- Have all users re-register on the new system
- Their profiles/roles will be auto-created by the trigger
### Option B: Manual Migration
1. Contact Supabase support for auth.users export
2. Or use Supabase CLI: `supabase auth users list`
3. Create users manually in new project
4. Match user_ids in profiles/user_roles/user_riads tables
## Verification Checklist
- [ ] All tables created with correct columns
- [ ] All ENUMs exist
- [ ] All functions created
- [ ] All RLS policies active
- [ ] Auth trigger functional
- [ ] Edge functions deployed
- [ ] Secrets configured
- [ ] Test guest form submission
- [ ] Test manager login
- [ ] Test transport request flow
## Rollback
Keep Lovable Cloud active until migration is verified. The source data remains intact.