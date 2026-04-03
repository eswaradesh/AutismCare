import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase-types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isSupabaseConfigured) {
  // Avoid a hard app crash in environments where .env values are missing.
  // API calls will fail gracefully and screens can show actionable messages.
  console.warn('Supabase environment variables are missing. Running in limited mode.');
}

const url = SUPABASE_URL || 'https://placeholder.supabase.co';
const key = SUPABASE_ANON_KEY || 'public-anon-key';

export const supabase = createClient<Database>(url, key, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
