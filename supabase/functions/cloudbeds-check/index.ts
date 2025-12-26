import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CloudbedsProperty {
  propertyID: string;
  propertyName: string;
}

interface CheckResult {
  status: 'ok' | 'error';
  authMethod: 'api_key' | 'oauth' | 'unknown';
  lastCheck: string;
  propertiesCount: number;
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
    console.log('Calling Cloudbeds API to check connectivity...');
    
    const cloudbedsResponse = await fetch('https://api.cloudbeds.com/api/v1.2/getProperties', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cloudbedsApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!cloudbedsResponse.ok) {
      const errorText = await cloudbedsResponse.text();
      console.error('Cloudbeds API error:', cloudbedsResponse.status, errorText);
      
      let errorMessage = 'Cloudbeds API connection failed';
      if (cloudbedsResponse.status === 401) {
        errorMessage = 'Authentication failed: Invalid or expired API key';
      } else if (cloudbedsResponse.status === 403) {
        errorMessage = 'Access denied: Insufficient API permissions';
      } else if (cloudbedsResponse.status === 429) {
        errorMessage = 'Rate limit exceeded: Too many API requests';
      } else if (cloudbedsResponse.status >= 500) {
        errorMessage = 'Cloudbeds service temporarily unavailable';
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

    const cloudbedsData = await cloudbedsResponse.json();
    console.log('Cloudbeds API response received:', JSON.stringify(cloudbedsData).substring(0, 200));

    // Handle different response formats
    let properties: CloudbedsProperty[] = [];
    if (cloudbedsData.success && cloudbedsData.data) {
      properties = Array.isArray(cloudbedsData.data) ? cloudbedsData.data : [cloudbedsData.data];
    } else if (Array.isArray(cloudbedsData)) {
      properties = cloudbedsData;
    }

    // Check if Riad Massiba is found (by property_id if known, or by name)
    let riadMassibaFound = false;
    if (knownMassibaPropertyId) {
      riadMassibaFound = properties.some(
        (p: CloudbedsProperty) => p.propertyID === knownMassibaPropertyId
      );
    } else {
      riadMassibaFound = properties.some(
        (p: CloudbedsProperty) => p.propertyName?.toLowerCase().includes('massiba')
      );
    }

    const result: CheckResult = {
      status: 'ok',
      authMethod,
      lastCheck: new Date().toISOString(),
      propertiesCount: properties.length,
      riadMassibaFound,
      riadMassibaPropertyId: knownMassibaPropertyId,
    };

    console.log('Cloudbeds check completed successfully:', result);

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
