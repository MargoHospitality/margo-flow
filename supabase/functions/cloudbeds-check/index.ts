import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CloudbedsProperty {
  propertyID: number;
  propertyName: string;
  propertyStatus: string;
}

interface CloudbedsResponse {
  success: boolean;
  data?: CloudbedsProperty[];
  message?: string;
}

interface CheckResult {
  status: 'ok' | 'error';
  authMethod: 'api_key' | 'oauth' | 'unknown';
  lastCheck: string;
  propertiesCount: number;
  properties?: { id: number; name: string }[];
  riadMassibaFound: boolean;
  riadMassibaPropertyId: string | null;
  errorMessage?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify super_admin authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the user is a super_admin
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check super_admin role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Access denied: super_admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Cloudbeds API key from secrets
    const cloudbedsApiKey = Deno.env.get('CLOUDBEDS_API_KEY');
    
    if (!cloudbedsApiKey) {
      const result: CheckResult = {
        status: 'error',
        authMethod: 'unknown',
        lastCheck: new Date().toISOString(),
        propertiesCount: 0,
        riadMassibaFound: false,
        riadMassibaPropertyId: null,
        errorMessage: 'Cloudbeds API key not configured in secrets',
      };
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine auth method (API key detected since we have CLOUDBEDS_API_KEY)
    const authMethod: 'api_key' | 'oauth' = 'api_key';

    // Get known Riad Massiba property_id from database
    const { data: riadMassiba } = await supabase
      .from('riads')
      .select('cloudbeds_property_id')
      .eq('name', 'Riad Massiba')
      .maybeSingle();

    const knownMassibaPropertyId = riadMassiba?.cloudbeds_property_id || null;

    // Call Cloudbeds API to get properties
    // IMPORTANT: Correct endpoint is hotels.cloudbeds.com (not api.cloudbeds.com)
    // Docs: https://developers.cloudbeds.com/docs/api-keys-authentication-guide-for-technology-partners
    console.log('Calling Cloudbeds API to check connectivity...');
    
    const cloudbedsResponse = await fetch('https://hotels.cloudbeds.com/api/v1.1/getHotels', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cloudbedsApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await cloudbedsResponse.text();
    console.log('Cloudbeds API response status:', cloudbedsResponse.status);
    console.log('Cloudbeds API response:', responseText.substring(0, 500));

    if (!cloudbedsResponse.ok) {
      console.error('Cloudbeds API error:', cloudbedsResponse.status, responseText);
      
      let errorMessage = 'Cloudbeds API connection failed';
      if (cloudbedsResponse.status === 401) {
        errorMessage = 'Authentication failed: Invalid or expired API key';
      } else if (cloudbedsResponse.status === 403) {
        errorMessage = 'Access denied: Insufficient API permissions';
      } else if (cloudbedsResponse.status === 429) {
        errorMessage = 'Rate limit exceeded: Too many API requests';
      } else if (cloudbedsResponse.status >= 500) {
        errorMessage = 'Cloudbeds service temporarily unavailable';
      } else {
        // Try to parse error message from response
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.message) {
            errorMessage = `Cloudbeds API: ${errorData.message}`;
          }
        } catch {
          errorMessage = `Cloudbeds API error (HTTP ${cloudbedsResponse.status})`;
        }
      }

      const result: CheckResult = {
        status: 'error',
        authMethod,
        lastCheck: new Date().toISOString(),
        propertiesCount: 0,
        riadMassibaFound: false,
        riadMassibaPropertyId: knownMassibaPropertyId,
        errorMessage,
      };
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse JSON response
    let cloudbedsData: CloudbedsResponse;
    try {
      cloudbedsData = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse Cloudbeds response:', e);
      const result: CheckResult = {
        status: 'error',
        authMethod,
        lastCheck: new Date().toISOString(),
        propertiesCount: 0,
        riadMassibaFound: false,
        riadMassibaPropertyId: knownMassibaPropertyId,
        errorMessage: 'Invalid response from Cloudbeds API',
      };
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Cloudbeds parsed response:', JSON.stringify(cloudbedsData).substring(0, 300));

    // Handle response - getHotels returns { success: true, data: [...] }
    let properties: CloudbedsProperty[] = [];
    if (cloudbedsData.success && cloudbedsData.data) {
      properties = Array.isArray(cloudbedsData.data) ? cloudbedsData.data : [cloudbedsData.data];
    }

    // Check if Riad Massiba is found
    let riadMassibaFound = false;
    if (knownMassibaPropertyId) {
      // Match by property ID (compare as strings since DB stores as text)
      riadMassibaFound = properties.some(
        (p) => String(p.propertyID) === knownMassibaPropertyId
      );
    }
    
    // Also try to find by name if not found by ID
    if (!riadMassibaFound) {
      riadMassibaFound = properties.some(
        (p) => p.propertyName?.toLowerCase().includes('massiba')
      );
    }

    const result: CheckResult = {
      status: 'ok',
      authMethod,
      lastCheck: new Date().toISOString(),
      propertiesCount: properties.length,
      properties: properties.map(p => ({ id: p.propertyID, name: p.propertyName })),
      riadMassibaFound,
      riadMassibaPropertyId: knownMassibaPropertyId,
    };

    console.log('Cloudbeds check completed successfully:', JSON.stringify(result));

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Cloudbeds check error:', error);
    
    const result: CheckResult = {
      status: 'error',
      authMethod: 'unknown',
      lastCheck: new Date().toISOString(),
      propertiesCount: 0,
      riadMassibaFound: false,
      riadMassibaPropertyId: null,
      errorMessage: 'An unexpected error occurred during the connectivity check',
    };

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});