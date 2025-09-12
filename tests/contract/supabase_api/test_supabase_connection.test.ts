/**
 * T012: Contract test - Supabase connection and health
 * Tests the basic Supabase client connection and database access
 * MUST FAIL before implementation exists
 */
import { describe, test, expect, beforeAll } from '@jest/globals';

describe('Supabase Connection Contract', () => {
  let supabaseClient: any;

  beforeAll(async () => {
    // This will fail until we implement the Supabase client
    const { createSupabaseClient } = await import('../../../src/services/supabase');
    supabaseClient = createSupabaseClient();
  });

  test('should establish connection to Supabase Cloud', async () => {
    // Test basic connection health
    const { data, error } = await supabaseClient.from('games').select('count').limit(1);
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  test('should have correct database tables', async () => {
    // Test that all required tables exist
    const requiredTables = ['games', 'players', 'cards', 'rounds', 'game_actions'];
    
    for (const table of requiredTables) {
      const { data, error } = await supabaseClient.from(table).select('*').limit(0);
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    }
  });

  test('should enforce Row Level Security', async () => {
    // Test that RLS blocks unauthorized access
    const { data, error } = await supabaseClient.from('games').insert({
      status: 'waiting_for_players'
    });
    
    // Should fail without proper authentication
    expect(error).toBeDefined();
    expect(error.code).toBe('42501'); // insufficient_privilege
  });

  test('should validate table constraints', async () => {
    // Test that database constraints are properly enforced
    const { data, error } = await supabaseClient.from('games').insert({
      status: 'invalid_status' // Should violate CHECK constraint
    });
    
    expect(error).toBeDefined();
    expect(error.code).toBe('23514'); // check_violation
  });
});