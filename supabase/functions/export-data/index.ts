import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const ALLOWED_TABLES = ['reservations', 'transport_requests', 'notification_attempts'] as const
type AllowedTable = typeof ALLOWED_TABLES[number]

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const table = url.searchParams.get('table') as AllowedTable | null
    const format = url.searchParams.get('format') || 'json' // json or csv

    // Validate table parameter
    if (!table || !ALLOWED_TABLES.includes(table)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid or missing table parameter',
          allowed: ALLOWED_TABLES,
          usage: '?table=reservations or ?table=transport_requests or ?table=notification_attempts'
        }), 
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Exporting table: ${table}, format: ${format}`)

    // Fetch ALL data using pagination to bypass 1000 row limit
    const PAGE_SIZE = 1000
    let allData: Record<string, unknown>[] = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('created_at', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)

      if (error) {
        console.error('Database error:', error)
        return new Response(
          JSON.stringify({ error: error.message }), 
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      if (data && data.length > 0) {
        allData = allData.concat(data)
        offset += data.length
        hasMore = data.length === PAGE_SIZE
        console.log(`Fetched batch: ${data.length} records, total: ${allData.length}`)
      } else {
        hasMore = false
      }
    }

    console.log(`Fetched ${allData.length} total records from ${table}`)

    // Return as JSON
    if (format === 'json') {
      return new Response(JSON.stringify(allData, null, 2), {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${table}_export.json"`
        }
      })
    }

    // Return as CSV
    if (format === 'csv' && allData.length > 0) {
      const headers = Object.keys(allData[0])
      const csvRows = [
        headers.join(','), // Header row
        ...allData.map(row => 
          headers.map(header => {
            const value = (row as Record<string, unknown>)[header]
            if (value === null || value === undefined) return ''
            if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
              return `"${value.replace(/"/g, '""')}"`
            }
            return String(value)
          }).join(',')
        )
      ]
      
      return new Response(csvRows.join('\n'), {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${table}_export.csv"`
        }
      })
    }

    // Empty result
    return new Response(JSON.stringify([]), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${table}_export.json"`
      }
    })

  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(err) }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
