import { createClient } from '@supabase/supabase-js';

// When VITE_DB_PROVIDER=mysql the Supabase client is never used.
// Fall back to placeholder values so createClient doesn't throw at import time.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'http://localhost:54321';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
