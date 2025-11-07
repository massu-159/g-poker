/**
 * Supabase client configuration - Lazy Initialization Singleton Pattern
 * Following Supabase best practices for application-wide single client
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabaseClient: SupabaseClient | null = null

/**
 * Get the application-wide Supabase client (Lazy Singleton)
 * Creates client on first call, returns same instance thereafter
 * @returns {SupabaseClient} Configured Supabase client
 */
export function getSupabase(): SupabaseClient {
  if (!_supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL environment variable is required')
    }

    if (!supabaseServiceKey) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY environment variable is required'
      )
    }

    _supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  return _supabaseClient
}

// Convenience export following Supabase utility function best practice
export const createSupabaseClient = getSupabase
