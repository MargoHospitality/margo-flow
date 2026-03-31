import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bndrfqfzrolxfmdfqaqa.supabase.co';
const supabaseKey = 'REDACTED_SUPABASE_SERVICE_ROLE_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

const { data, error } = await supabase
  .from('transport_requests')
  .select('riad_id, created_at')
  .order('created_at', { ascending: true });

if (error) {
  console.error('Error:', JSON.stringify(error, null, 2));
  process.exit(1);
}

if (!data || data.length === 0) {
  console.log('No transport requests found');
  process.exit(0);
}

const grouped = data.reduce((acc, req) => {
  acc[req.riad_id] = (acc[req.riad_id] || 0) + 1;
  return acc;
}, {});

console.log(JSON.stringify({
  total: data.length,
  by_property: grouped,
  earliest: data[0]?.created_at,
  latest: data[data.length - 1]?.created_at
}, null, 2));
