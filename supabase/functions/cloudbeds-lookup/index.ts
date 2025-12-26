import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// MASSIBA ONLY - Only process this property ID
const MASSIBA_PROPERTY_ID = '9462';

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_REQUESTS_PER_IP = 10;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes cache for lookups
const SUSPICIOUS_FAILURE_COUNT = 3;
const SUSPICIOUS_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

// Progressive cooldown: 10s, 30s, 2min
const COOLDOWN_STEPS = [10, 30, 120];

// In-memory stores (reset on function restart, which is fine for edge functions)
const rateLimitStore = new Map<string, { count: number; firstRequest: number; failures: number; lastFailure: number; cooldownLevel: number }>();
const lookupCache = new Map<string, { found: boolean; data?: any; timestamp: number }>();

interface LookupResult {
  found: boolean;
  reservation?: {
    reservation_id: string;
    guest_first_name: string | null;
    guest_last_name: string;
    check_in_date: string;
    check_out_date: string | null;
    nights: number | null;
    status: string;
    source: string | null;
    riad_id: string;
    riad_name: string;
  };
  source: 'local' | 'cloudbeds' | 'cache';
  error?: string;
  rate_limited?: boolean;
  retry_after?: number;
  captcha_required?: boolean;
}

function getClientIP(req: Request): string {
  // Check various headers for client IP
  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  if (cfConnectingIP) return cfConnectingIP;
  
  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor) return xForwardedFor.split(',')[0].trim();
  
  const xRealIP = req.headers.get('x-real-ip');
  if (xRealIP) return xRealIP;
  
  return 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number; captchaRequired: boolean } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  
  if (!entry) {
    rateLimitStore.set(ip, { count: 1, firstRequest: now, failures: 0, lastFailure: 0, cooldownLevel: 0 });
    return { allowed: true, captchaRequired: false };
  }
  
  // Check if in cooldown
  if (entry.cooldownLevel > 0 && entry.lastFailure > 0) {
    const cooldownSeconds = COOLDOWN_STEPS[Math.min(entry.cooldownLevel - 1, COOLDOWN_STEPS.length - 1)];
    const cooldownEnds = entry.lastFailure + (cooldownSeconds * 1000);
    if (now < cooldownEnds) {
      return { allowed: false, retryAfter: Math.ceil((cooldownEnds - now) / 1000), captchaRequired: true };
    }
  }
  
  // Reset window if expired
  if (now - entry.firstRequest > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, firstRequest: now, failures: entry.failures, lastFailure: entry.lastFailure, cooldownLevel: entry.cooldownLevel });
    return { allowed: true, captchaRequired: entry.failures >= SUSPICIOUS_FAILURE_COUNT };
  }
  
  // Check if within limits
  if (entry.count >= MAX_REQUESTS_PER_IP) {
    return { allowed: false, retryAfter: Math.ceil((entry.firstRequest + RATE_LIMIT_WINDOW_MS - now) / 1000), captchaRequired: true };
  }
  
  // Increment counter
  entry.count++;
  
  // Check if captcha should be required due to suspicious failures
  const requireCaptcha = entry.failures >= SUSPICIOUS_FAILURE_COUNT && 
    (now - entry.lastFailure) < SUSPICIOUS_WINDOW_MS;
  
  return { allowed: true, captchaRequired: requireCaptcha };
}

function recordFailure(ip: string): void {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  
  if (entry) {
    entry.failures++;
    entry.lastFailure = now;
    
    // Apply progressive cooldown after suspicious failures
    if (entry.failures >= SUSPICIOUS_FAILURE_COUNT) {
      entry.cooldownLevel = Math.min(entry.cooldownLevel + 1, COOLDOWN_STEPS.length);
    }
  }
}

function resetFailures(ip: string): void {
  const entry = rateLimitStore.get(ip);
  if (entry) {
    entry.failures = 0;
    entry.cooldownLevel = 0;
  }
}

function getCacheKey(reservationId: string, checkInDate: string): string {
  return `${reservationId}:${checkInDate}`;
}

function getCachedResult(reservationId: string, checkInDate: string): { found: boolean; data?: any } | null {
  const key = getCacheKey(reservationId, checkInDate);
  const cached = lookupCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { found: cached.found, data: cached.data };
  }
  
  // Clean up expired entry
  if (cached) {
    lookupCache.delete(key);
  }
  
  return null;
}

function cacheResult(reservationId: string, checkInDate: string, found: boolean, data?: any): void {
  const key = getCacheKey(reservationId, checkInDate);
  lookupCache.set(key, { found, data, timestamp: Date.now() });
  
  // Cleanup old entries periodically (keep max 1000)
  if (lookupCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of lookupCache.entries()) {
      if (now - v.timestamp > CACHE_TTL_MS) {
        lookupCache.delete(k);
      }
    }
  }
}

async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secretKey = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secretKey) {
    console.log('[cloudbeds-lookup] TURNSTILE_SECRET_KEY not configured, skipping verification');
    return true; // Skip verification if not configured
  }
  
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });
    
    const data = await response.json();
    console.log('[cloudbeds-lookup] Turnstile verification result:', data.success);
    return data.success === true;
  } catch (error) {
    console.error('[cloudbeds-lookup] Turnstile verification error:', error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = getClientIP(req);
  console.log(`[cloudbeds-lookup] Request from IP: ${clientIP}`);

  try {
    const { reservation_id, property_id, check_in_date, turnstile_token } = await req.json();
    
    // CRITICAL: Ensure reservation_id is handled as a string
    const reservationIdStr = String(reservation_id).trim();
    const checkInDateStr = check_in_date ? String(check_in_date).trim() : '';
    
    console.log(`[cloudbeds-lookup] ====== START LOOKUP ======`);
    console.log(`[cloudbeds-lookup] Reservation ID: ${reservationIdStr}`);
    console.log(`[cloudbeds-lookup] Check-in Date: ${checkInDateStr}`);
    console.log(`[cloudbeds-lookup] Property ID: ${property_id}`);

    if (!reservationIdStr) {
      return new Response(
        JSON.stringify({ found: false, error: 'Reservation ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!checkInDateStr) {
      return new Response(
        JSON.stringify({ found: false, error: 'Check-in date is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    const rateLimitResult = checkRateLimit(clientIP);
    if (!rateLimitResult.allowed) {
      console.log(`[cloudbeds-lookup] Rate limited IP: ${clientIP}, retry after: ${rateLimitResult.retryAfter}s`);
      return new Response(
        JSON.stringify({ 
          found: false, 
          rate_limited: true, 
          retry_after: rateLimitResult.retryAfter,
          captcha_required: true 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If captcha is required, verify the token
    if (rateLimitResult.captchaRequired) {
      if (!turnstile_token) {
        console.log(`[cloudbeds-lookup] Captcha required but no token provided for IP: ${clientIP}`);
        return new Response(
          JSON.stringify({ found: false, captcha_required: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const isValidCaptcha = await verifyTurnstileToken(turnstile_token);
      if (!isValidCaptcha) {
        console.log(`[cloudbeds-lookup] Invalid captcha token for IP: ${clientIP}`);
        recordFailure(clientIP);
        return new Response(
          JSON.stringify({ found: false, captcha_required: true, error: 'Invalid verification' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check cache first
    const cachedResult = getCachedResult(reservationIdStr, checkInDateStr);
    if (cachedResult !== null) {
      console.log(`[cloudbeds-lookup] Cache hit for ${reservationIdStr}:${checkInDateStr}, found: ${cachedResult.found}`);
      if (!cachedResult.found) {
        // Still count as failure for rate limiting purposes
        recordFailure(clientIP);
      }
      return new Response(
        JSON.stringify({ 
          found: cachedResult.found, 
          reservation: cachedResult.data,
          source: 'cache'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // MASSIBA ONLY: Reject if property_id is not Massiba
    if (property_id && property_id !== MASSIBA_PROPERTY_ID) {
      console.log(`[cloudbeds-lookup] Rejected: property ${property_id} is not Massiba`);
      return new Response(
        JSON.stringify({ found: false, error: 'Cloudbeds lookup only available for Riad Massiba' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Massiba riad from database
    const { data: massibaRiad, error: riadError } = await supabase
      .from('riads')
      .select('id, name, cloudbeds_property_id')
      .eq('cloudbeds_property_id', MASSIBA_PROPERTY_ID)
      .maybeSingle();

    if (riadError || !massibaRiad) {
      console.error('[cloudbeds-lookup] Massiba riad not found in database:', riadError);
      return new Response(
        JSON.stringify({ found: false, error: 'Riad Massiba not configured in database' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[cloudbeds-lookup] Massiba riad found: id=${massibaRiad.id}, name=${massibaRiad.name}`);

    // Step 1: Check local database first
    const { data: localReservation, error: localError } = await supabase
      .from('reservations')
      .select(`
        reservation_id,
        guest_first_name,
        guest_last_name,
        check_in_date,
        check_out_date,
        nights,
        status,
        source,
        riad_id,
        riads(name)
      `)
      .eq('reservation_id', reservationIdStr)
      .eq('riad_id', massibaRiad.id)
      .maybeSingle();

    if (localError) {
      console.error('[cloudbeds-lookup] Local DB error:', localError);
    }

    if (localReservation) {
      console.log(`[cloudbeds-lookup] Found in local database: ${reservationIdStr}`);
      
      // Validate check-in date matches
      if (localReservation.check_in_date !== checkInDateStr) {
        console.log(`[cloudbeds-lookup] Check-in date mismatch: expected ${localReservation.check_in_date}, got ${checkInDateStr}`);
        recordFailure(clientIP);
        cacheResult(reservationIdStr, checkInDateStr, false);
        // Generic error - don't reveal that the reservation exists
        return new Response(
          JSON.stringify({ found: false }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      resetFailures(clientIP);
      
      const result: LookupResult = {
        found: true,
        reservation: {
          reservation_id: localReservation.reservation_id,
          guest_first_name: localReservation.guest_first_name,
          guest_last_name: localReservation.guest_last_name,
          check_in_date: localReservation.check_in_date,
          check_out_date: localReservation.check_out_date,
          nights: localReservation.nights,
          status: localReservation.status,
          source: localReservation.source,
          riad_id: localReservation.riad_id,
          riad_name: (localReservation.riads as any)?.name || 'Riad Massiba',
        },
        source: 'local',
      };
      
      cacheResult(reservationIdStr, checkInDateStr, true, result.reservation);
      
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Not found locally - Call Cloudbeds API
    console.log(`[cloudbeds-lookup] Not found locally, calling Cloudbeds API...`);
    
    const cloudbedsApiKey = Deno.env.get('CLOUDBEDS_API_KEY');
    if (!cloudbedsApiKey) {
      console.error('[cloudbeds-lookup] CLOUDBEDS_API_KEY not configured');
      return new Response(
        JSON.stringify({ found: false, error: 'Cloudbeds API not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to fetch the specific reservation using getReservation endpoint
    const getReservationUrl = `https://hotels.cloudbeds.com/api/v1.1/getReservation?propertyID=${MASSIBA_PROPERTY_ID}&reservationID=${reservationIdStr}`;
    
    console.log(`[cloudbeds-lookup] Request URL: ${getReservationUrl}`);
    
    const getReservationResponse = await fetch(getReservationUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cloudbedsApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const getResStatus = getReservationResponse.status;
    const getResText = await getReservationResponse.text();
    
    console.log(`[cloudbeds-lookup] getReservation Response Status: ${getResStatus}`);
    console.log(`[cloudbeds-lookup] getReservation Response Body: ${getResText.substring(0, 1000)}`);

    // If getReservation didn't work, try listing reservations as fallback
    if (!getReservationResponse.ok || getResText.includes('"success":false')) {
      console.log(`[cloudbeds-lookup] getReservation failed, trying getReservations list with wide date range...`);
      
      // Calculate date range: today - 7 days to today + 365 days
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 365);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      // Try getReservations list endpoint
      const listUrl = `https://hotels.cloudbeds.com/api/v1.1/getReservations?propertyID=${MASSIBA_PROPERTY_ID}&checkInFrom=${startDateStr}&checkInTo=${endDateStr}&pageSize=100`;
      
      console.log(`[cloudbeds-lookup] List Request URL: ${listUrl}`);
      
      const listResponse = await fetch(listUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cloudbedsApiKey}`,
          'Content-Type': 'application/json',
        },
      });
      
      const listStatus = listResponse.status;
      const listText = await listResponse.text();
      
      console.log(`[cloudbeds-lookup] getReservations Response Status: ${listStatus}`);
      console.log(`[cloudbeds-lookup] getReservations Response Body (first 2000 chars): ${listText.substring(0, 2000)}`);
      
      if (listResponse.ok) {
        try {
          const listData = JSON.parse(listText);
          
          if (listData.success && listData.data) {
            const reservations = Array.isArray(listData.data) ? listData.data : [];
            console.log(`[cloudbeds-lookup] Found ${reservations.length} reservations in list`);
            
            // Search for our reservation in the list
            const foundRes = reservations.find((r: any) => {
              const resId = String(r.reservationID || r.reservationId || r.reservation_id || '');
              return resId === reservationIdStr;
            });
            
            if (foundRes) {
              console.log(`[cloudbeds-lookup] Found reservation ${reservationIdStr} in list!`);
              
              // Validate check-in date
              const cbCheckIn = foundRes.startDate || foundRes.checkInDate || foundRes.check_in_date || '';
              if (cbCheckIn !== checkInDateStr) {
                console.log(`[cloudbeds-lookup] Check-in date mismatch from Cloudbeds: expected ${cbCheckIn}, got ${checkInDateStr}`);
                recordFailure(clientIP);
                cacheResult(reservationIdStr, checkInDateStr, false);
                return new Response(
                  JSON.stringify({ found: false }),
                  { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
              
              resetFailures(clientIP);
              return await processAndUpsertReservation(foundRes, massibaRiad, supabase, checkInDateStr, reservationIdStr);
            } else {
              console.log(`[cloudbeds-lookup] Reservation ${reservationIdStr} NOT found in list.`);
              recordFailure(clientIP);
              cacheResult(reservationIdStr, checkInDateStr, false);
              
              return new Response(
                JSON.stringify({ found: false }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        } catch (parseError) {
          console.error('[cloudbeds-lookup] Failed to parse list response:', parseError);
        }
      }
      
      // Both methods failed
      recordFailure(clientIP);
      return new Response(
        JSON.stringify({ found: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // getReservation succeeded - process the response
    try {
      const cloudbedsData = JSON.parse(getResText);
      console.log('[cloudbeds-lookup] Parsed getReservation response successfully');

      if (!cloudbedsData.success || !cloudbedsData.data) {
        recordFailure(clientIP);
        cacheResult(reservationIdStr, checkInDateStr, false);
        return new Response(
          JSON.stringify({ found: false }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate check-in date
      const cbData = cloudbedsData.data;
      const cbCheckIn = cbData.startDate || cbData.checkInDate || cbData.check_in_date || '';
      if (cbCheckIn !== checkInDateStr) {
        console.log(`[cloudbeds-lookup] Check-in date mismatch: expected ${cbCheckIn}, got ${checkInDateStr}`);
        recordFailure(clientIP);
        cacheResult(reservationIdStr, checkInDateStr, false);
        return new Response(
          JSON.stringify({ found: false }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      resetFailures(clientIP);
      return await processAndUpsertReservation(cbData, massibaRiad, supabase, checkInDateStr, reservationIdStr);
      
    } catch (parseError) {
      console.error('[cloudbeds-lookup] Failed to parse getReservation response:', parseError);
      recordFailure(clientIP);
      return new Response(
        JSON.stringify({ found: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[cloudbeds-lookup] Unexpected error:', error);
    return new Response(
      JSON.stringify({ found: false }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processAndUpsertReservation(
  cbRes: any, 
  massibaRiad: { id: string; name: string; cloudbeds_property_id: string | null }, 
  supabase: any,
  checkInDateStr: string,
  reservationIdStr: string
): Promise<Response> {
  console.log('[cloudbeds-lookup] Processing reservation:', JSON.stringify(cbRes).substring(0, 500));
  
  // Handle different possible field names from Cloudbeds API
  const reservationId = String(cbRes.reservationID || cbRes.reservationId || cbRes.reservation_id);
  const guestName = cbRes.guestName || cbRes.guestFirstName || cbRes.guest_name || '';
  const startDate = cbRes.startDate || cbRes.checkInDate || cbRes.check_in_date;
  const endDate = cbRes.endDate || cbRes.checkOutDate || cbRes.check_out_date;
  
  // Parse guest name
  const nameParts = guestName.split(' ');
  const guestFirstName = nameParts.length > 1 ? nameParts[0] : null;
  const guestLastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : guestName;

  // Calculate nights if not provided
  let nights = cbRes.nights;
  if (!nights && startDate && endDate) {
    const checkIn = new Date(startDate);
    const checkOut = new Date(endDate);
    nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Map status
  let status = 'confirmed';
  const cbStatus = (cbRes.status || '').toLowerCase();
  if (cbStatus.includes('cancel')) {
    status = 'canceled';
  } else if (cbStatus.includes('no_show') || cbStatus.includes('noshow')) {
    status = 'no_show';
  } else if (cbStatus.includes('checked_in') || cbStatus.includes('checkedin') || cbStatus.includes('in_house') || cbStatus.includes('inhouse')) {
    status = 'checked_in';
  } else if (cbStatus.includes('checked_out') || cbStatus.includes('checkedout')) {
    status = 'checked_out';
  }

  console.log(`[cloudbeds-lookup] Mapped reservation: id=${reservationId}, guest=${guestLastName}, status=${status}, checkIn=${startDate}`);

  // Upsert to local database
  const { error: upsertError } = await supabase
    .from('reservations')
    .upsert({
      reservation_id: reservationId,
      property_id: MASSIBA_PROPERTY_ID,
      riad_id: massibaRiad.id,
      guest_first_name: guestFirstName,
      guest_last_name: guestLastName,
      check_in_date: startDate,
      check_out_date: endDate,
      nights: nights,
      status: status,
      source: cbRes.source || 'cloudbeds',
      guest_country_code: cbRes.countryCode || cbRes.country_code || null,
      cloudbeds_raw: cbRes,
    }, {
      onConflict: 'reservation_id',
    });

  if (upsertError) {
    console.error('[cloudbeds-lookup] Failed to upsert reservation:', upsertError);
  } else {
    console.log(`[cloudbeds-lookup] Successfully upserted reservation ${reservationId}`);
  }

  const result: LookupResult = {
    found: true,
    reservation: {
      reservation_id: reservationId,
      guest_first_name: guestFirstName,
      guest_last_name: guestLastName,
      check_in_date: startDate,
      check_out_date: endDate,
      nights: nights,
      status: status,
      source: cbRes.source || 'cloudbeds',
      riad_id: massibaRiad.id,
      riad_name: massibaRiad.name,
    },
    source: 'cloudbeds',
  };

  // Cache the successful result
  cacheResult(reservationIdStr, checkInDateStr, true, result.reservation);

  console.log(`[cloudbeds-lookup] ====== LOOKUP SUCCESS ======`);

  return new Response(
    JSON.stringify(result),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
