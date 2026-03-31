# Data Export Instructions

The production data tables are too large to export as static SQL INSERT statements in the repository. Here are the recommended approaches to export the data:

## Table Sizes

| Table | Records |
|-------|---------|
| reservations | 2,838 |
| transport_requests | 121 |
| notification_attempts | 353 |

---

## Option A: Export via Supabase CLI (Recommended)

Since Lovable Cloud is powered by Supabase, you can use the Supabase CLI to dump the data.

**Note:** You'll need the Lovable Cloud database connection string. Contact Lovable support to obtain it, or use the alternative options below.

```bash
# Install Supabase CLI
npm install -g supabase

# Export specific tables to CSV
pg_dump "postgresql://postgres:[PASSWORD]@db.fnbqegolwitkgjmlesbc.supabase.co:5432/postgres" \
  --table=public.reservations \
  --data-only \
  --format=csv > reservations.csv

pg_dump "postgresql://postgres:[PASSWORD]@db.fnbqegolwitkgjmlesbc.supabase.co:5432/postgres" \
  --table=public.transport_requests \
  --data-only \
  --format=csv > transport_requests.csv

pg_dump "postgresql://postgres:[PASSWORD]@db.fnbqegolwitkgjmlesbc.supabase.co:5432/postgres" \
  --table=public.notification_attempts \
  --data-only \
  --format=csv > notification_attempts.csv
```

---

## Option B: Export via Edge Function

Create an edge function to stream the data as JSON/CSV.

**File: `supabase/functions/export-data/index.ts`**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const url = new URL(req.url)
  const table = url.searchParams.get('table')

  if (!table || !['reservations', 'transport_requests', 'notification_attempts'].includes(table)) {
    return new Response(JSON.stringify({ error: 'Invalid table' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Return as JSON
  return new Response(JSON.stringify(data), {
    headers: { 
      ...corsHeaders, 
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${table}.json"`
    }
  })
})
```

Deploy and call:
```bash
# Export each table
curl "https://fnbqegolwitkgjmlesbc.supabase.co/functions/v1/export-data?table=reservations" \
  -H "Authorization: Bearer YOUR_ANON_KEY" > reservations.json

curl "https://fnbqegolwitkgjmlesbc.supabase.co/functions/v1/export-data?table=transport_requests" \
  -H "Authorization: Bearer YOUR_ANON_KEY" > transport_requests.json

curl "https://fnbqegolwitkgjmlesbc.supabase.co/functions/v1/export-data?table=notification_attempts" \
  -H "Authorization: Bearer YOUR_ANON_KEY" > notification_attempts.json
```

---

## Option C: Contact Lovable Support

Contact Lovable support (support@lovable.dev) to request:
1. A full database backup (`.sql` dump)
2. The database connection credentials for direct access

---

## Importing Data to New Supabase Instance

Once you have the data exported:

### From JSON files:

```sql
-- You'll need to parse JSON and insert
-- Or use the Supabase Table Editor "Import Data" feature
```

### From CSV files:

```bash
# Using psql
psql "postgresql://postgres:[PASSWORD]@db.YOURPROJECT.supabase.co:5432/postgres" \
  -c "\COPY public.reservations FROM 'reservations.csv' WITH CSV HEADER"

psql "postgresql://postgres:[PASSWORD]@db.YOURPROJECT.supabase.co:5432/postgres" \
  -c "\COPY public.transport_requests FROM 'transport_requests.csv' WITH CSV HEADER"

psql "postgresql://postgres:[PASSWORD]@db.YOURPROJECT.supabase.co:5432/postgres" \
  -c "\COPY public.notification_attempts FROM 'notification_attempts.csv' WITH CSV HEADER"
```

### Via Supabase Dashboard:

1. Go to Table Editor
2. Select the table
3. Click "Import data"
4. Upload your CSV/JSON file

---

## Data Export Summary

The migration files already include:
- ✅ All riads (12 properties)
- ✅ All transport_offers (8 offers)
- ✅ All user_roles and profiles (14 entries)
- ✅ All riad_transport_offers (pricing overrides)

You only need to export and import:
- ⏳ reservations (2,838 records)
- ⏳ transport_requests (121 records)
- ⏳ notification_attempts (353 records)
