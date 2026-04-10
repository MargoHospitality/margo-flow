import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;

    process.env[key] = rawValue.trim().replace(/^['"]|['"]$/g, '');
  }
}

for (const envFile of ['.env.local', '.env', '.env.supabase']) {
  loadEnvFile(path.join(scriptDir, envFile));
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing Supabase env vars. Expected SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.'
  );
  process.exit(1);
}

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
