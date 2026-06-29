import { createClient } from '@supabase/supabase-js';
import env from './env.js';

/**
 * Storage Bucket identifiers utilized by the platform.
 * 
 * @type {Readonly<{DOCUMENTS: string, PREVIEWS: string, AUDITS: string}>}
 */
export const STORAGE_BUCKETS = Object.freeze({
  DOCUMENTS: 'mc-documents',
  PREVIEWS: 'mc-previews',
  AUDITS: 'mc-audits-archive',
});

let supabaseAnonInstance = null;
let supabaseAdminInstance = null;

/**
 * Retrieves the standard Anon Supabase Client singleton.
 * Configured with the public anon key. Safe for client-facing identity checks.
 * 
 * @function getSupabaseAnonClient
 * @returns {import('@supabase/supabase-js').SupabaseClient} Anon Supabase Client
 */
export function getSupabaseAnonClient() {
  if (!supabaseAnonInstance) {
    supabaseAnonInstance = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    console.log('Supabase Anon Client singleton initialized.');
  }
  return supabaseAnonInstance;
}

/**
 * Retrieves the privileged Admin Supabase Client singleton.
 * Configured with the service role key. Bypass RLS (Row Level Security) rules.
 * STRICTLY owned by the backend; must never be leaked to clients.
 * Used for admin operations such as document deletes, lock overrides, and signed url generation.
 * 
 * @function getSupabaseAdminClient
 * @returns {import('@supabase/supabase-js').SupabaseClient} Service Role Admin Supabase Client
 */
export function getSupabaseAdminClient() {
  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    console.log('Supabase Admin Client singleton initialized.');
  }
  return supabaseAdminInstance;
}

export const supabaseAnon = getSupabaseAnonClient();
export const supabaseAdmin = getSupabaseAdminClient();

export default {
  supabaseAnon,
  supabaseAdmin,
  STORAGE_BUCKETS,
};
