/**
 * Supabase Client Configuration and Initialization
 * Configures connection to Supabase Cloud with auth, realtime, and database services
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '../types/database';

// Re-export Database type for other services
export type { Database };

// Environment configuration
const supabaseUrl = process.env['EXPO_PUBLIC_SUPABASE_URL']!;
const supabaseAnonKey = process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY']!;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.'
  );
}

// Create typed Supabase client
export const supabase: SupabaseClient<Database> = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      // Auto refresh sessions
      autoRefreshToken: true,
      // Persist session in local storage
      persistSession: true,
      // Detect session from URL on login callbacks  
      detectSessionInUrl: false
    },
    realtime: {
      // Realtime configuration for game updates
      params: {
        eventsPerSecond: 50 // Higher rate for responsive gameplay
      }
    },
    db: {
      // Database configuration
      schema: 'public'
    }
  }
);

// Supabase service status
export interface SupabaseServiceStatus {
  database: boolean;
  auth: boolean;
  realtime: boolean;
  lastChecked: string;
  error?: string;
}

// Connection and health check functions
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('games')
      .select('id')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') {
      console.error('❌ Supabase connection error:', error);
      return false;
    }
    
    console.log('✅ Supabase connection successful');
    return true;
  } catch (err) {
    console.error('❌ Supabase connection failed:', err);
    return false;
  }
}

export async function checkSupabaseHealth(): Promise<SupabaseServiceStatus> {
  const status: SupabaseServiceStatus = {
    database: false,
    auth: false,
    realtime: false,
    lastChecked: new Date().toISOString()
  };

  try {
    // Test database connection
    const { error: dbError } = await supabase
      .from('games')
      .select('id')
      .limit(1);
    
    status.database = !dbError || dbError.code === 'PGRST116';
    
    // Test auth service
    const { data: authData, error: authError } = await supabase.auth.getSession();
    status.auth = !authError;
    
    // Test realtime (basic connection test)
    const channel = supabase.channel('health-check');
    const realtimePromise = new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 5000);
      
      channel
        .on('presence', { event: 'sync' }, () => {
          clearTimeout(timeout);
          resolve(true);
        })
        .subscribe();
        
      // Clean up after test
      setTimeout(() => {
        channel.unsubscribe();
      }, 1000);
    });
    
    status.realtime = await realtimePromise;
    
  } catch (error) {
    status.error = error instanceof Error ? error.message : 'Unknown error';
  }
  
  return status;
}

// Helper function to create authenticated user session
export async function createDeviceSession(deviceId: string): Promise<{
  success: boolean;
  session?: any;
  error?: string;
}> {
  try {
    // For device-based authentication, we'll use anonymous sign in
    const { data, error } = await supabase.auth.signInAnonymously();
    
    if (error) {
      return {
        success: false,
        error: error.message
      };
    }
    
    return {
      success: true,
      session: data.session
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    };
  }
}

// Helper function to get current user session
export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  
  return session;
}

// Helper function to sign out
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('Error signing out:', error);
    return false;
  }
  
  return true;
}

// Realtime channel management
export function createGameChannel(gameId: string): RealtimeChannel {
  return supabase.channel(`game:${gameId}`, {
    config: {
      presence: {
        key: gameId,
      },
    },
  });
}

// Database query helpers
export function gamesTable() {
  return supabase.from('games');
}

export function playersTable() {
  return supabase.from('players');
}

export function roundsTable() {
  return supabase.from('rounds');
}

export function gameActionsTable() {
  return supabase.from('game_actions');
}

// Error handling helpers
export function isSupabaseError(error: any): boolean {
  return error && typeof error === 'object' && 'code' in error;
}

export function formatSupabaseError(error: any): string {
  if (!isSupabaseError(error)) {
    return 'Unknown error';
  }
  
  // Common Supabase error codes and user-friendly messages
  const errorMessages: Record<string, string> = {
    'PGRST116': 'Table not found',
    'PGRST204': 'No data found',
    '23505': 'Data already exists',
    '23503': 'Referenced data not found',
    '42501': 'Insufficient permissions',
    'PGRST301': 'Query too complex',
    '08006': 'Connection failed'
  };
  
  return errorMessages[error.code] || error.message || 'Database error';
}

// Connection state management
let connectionState = {
  isConnected: false,
  lastConnected: null as Date | null,
  reconnectAttempts: 0
};

// Listen for connection state changes
supabase.channel('system').on('system', {}, (payload) => {
  const { eventType, connectionState: state } = payload;
  
  if (eventType === 'connected') {
    connectionState.isConnected = true;
    connectionState.lastConnected = new Date();
    connectionState.reconnectAttempts = 0;
    console.log('✅ Supabase realtime connected');
  } else if (eventType === 'disconnected') {
    connectionState.isConnected = false;
    console.log('⚠️ Supabase realtime disconnected');
  }
}).subscribe();

export function getConnectionState() {
  return { ...connectionState };
}

