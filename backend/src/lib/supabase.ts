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

/**
 * Create a fresh Supabase client for Auth Admin operations
 * IMPORTANT: Creates a NEW instance each time to prevent session contamination
 * Use this ONLY for auth.admin.createUser/deleteUser operations
 *
 * Background: auth.admin.createUser() returns user sessions that override
 * the Authorization header in singleton clients, causing RLS violations
 * after 2-3 calls when service_role credential is replaced with user JWT
 *
 * @returns {SupabaseClient} Fresh Supabase client isolated from session side effects
 */
export function getAuthAdminClient(): SupabaseClient {
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

  // Create fresh client every time (no singleton - prevents session accumulation)
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Convenience export following Supabase utility function best practice
export const createSupabaseClient = getSupabase
