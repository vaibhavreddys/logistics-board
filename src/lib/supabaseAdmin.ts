import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const missingVars = [];
if (!supabaseUrl) missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
if (!supabaseServiceKey) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');

if (missingVars.length > 0) {
  throw new Error(
    `Missing Supabase environment variables: ${missingVars.join(', ')}. Please check .env.local`
  );
}

export const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!);