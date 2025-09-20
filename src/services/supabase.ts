/**
 * Enterprise Supabase Client Configuration
 * Secure Supabase client with enterprise authentication and logging
 */

import { createClient, SupabaseClient, AuthChangeEvent, Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import environment from '../config/environment';
import type { Database } from '../types/database';

// Enterprise Supabase client with typed database schema
export type TypedSupabaseClient = SupabaseClient<Database>;

// Security configuration for Supabase client
const supabaseClientConfig = {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce' as const,
  },
  global: {
    headers: {
      'X-Client-Info': 'g-poker-enterprise',
      'X-Security-Level': 'enterprise',
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10, // Rate limiting for security
    },
  },
};

// Create the enterprise Supabase client
export const supabase: TypedSupabaseClient = createClient<Database>(
  environment.supabaseUrl,
  environment.supabaseAnonKey,
  supabaseClientConfig
);

// Authentication state management
export class AuthManager {
  private static instance: AuthManager;
  private currentSession: Session | null = null;
  private authListeners: ((event: AuthChangeEvent, session: Session | null) => void)[] = [];

  private constructor() {
    this.initializeAuth();
  }

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  private async initializeAuth() {
    try {
      // Get initial session
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Failed to get initial session:', error);
        return;
      }

      this.currentSession = session;

      // Listen for auth changes
      supabase.auth.onAuthStateChange((event, session) => {
        this.currentSession = session;

        if (environment.enableLogging) {
          console.log('Auth state changed:', {
            event,
            userId: session?.user?.id || null,
            timestamp: new Date().toISOString(),
          });
        }

        // Notify all listeners
        this.authListeners.forEach(listener => {
          try {
            listener(event, session);
          } catch (error) {
            console.error('Auth listener error:', error);
          }
        });

        // Handle auth events
        this.handleAuthEvent(event, session);
      });
    } catch (error) {
      console.error('Auth initialization failed:', error);
    }
  }

  private handleAuthEvent(event: AuthChangeEvent, session: Session | null) {
    switch (event) {
      case 'SIGNED_IN':
        if (session?.user) {
          this.onUserSignedIn(session.user.id);
        }
        break;
      case 'SIGNED_OUT':
        this.onUserSignedOut();
        break;
      case 'TOKEN_REFRESHED':
        if (environment.enableLogging) {
          console.log('Token refreshed for user:', session?.user?.id);
        }
        break;
      case 'USER_UPDATED':
        if (environment.enableLogging) {
          console.log('User profile updated:', session?.user?.id);
        }
        break;
    }
  }

  private async onUserSignedIn(userId: string) {
    try {
      // Create or update user profile
      await this.ensureUserProfile(userId);

      if (environment.enableLogging) {
        console.log('User signed in:', userId);
      }
    } catch (error) {
      console.error('Failed to handle user sign in:', error);
    }
  }

  private async onUserSignedOut() {
    try {
      // Clear local data
      await AsyncStorage.multiRemove([
        'user-profile',
        'game-state',
        'player-cache',
      ]);

      if (environment.enableLogging) {
        console.log('User signed out and local data cleared');
      }
    } catch (error) {
      console.error('Failed to handle user sign out:', error);
    }
  }

  private async ensureUserProfile(userId: string) {
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (!existingProfile) {
        const { error } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            created_by: userId,
          });

        if (error && error.code !== '23505') { // Ignore duplicate key errors
          console.error('Failed to create user profile:', error);
        }
      }
    } catch (error) {
      console.error('Failed to ensure user profile:', error);
    }
  }

  // Public API
  public getCurrentSession(): Session | null {
    return this.currentSession;
  }

  public getCurrentUser() {
    return this.currentSession?.user || null;
  }

  public isAuthenticated(): boolean {
    return this.currentSession !== null;
  }

  public addAuthListener(listener: (event: AuthChangeEvent, session: Session | null) => void) {
    this.authListeners.push(listener);
  }

  public removeAuthListener(listener: (event: AuthChangeEvent, session: Session | null) => void) {
    const index = this.authListeners.indexOf(listener);
    if (index > -1) {
      this.authListeners.splice(index, 1);
    }
  }

  // Authentication methods
  public async signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error;
    }
  }

  public async signUp(email: string, password: string, metadata?: Record<string, any>) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata || {},
        },
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Sign up failed:', error);
      throw error;
    }
  }

  public async signOut() {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  }

  public async resetPassword(email: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Password reset failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const authManager = AuthManager.getInstance();

// Database type helpers
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

// Export commonly used types
export type Profile = Tables<'profiles'>;
export type PublicProfile = Tables<'public_profiles'>;
export type Player = Tables<'players'>;
export type Game = Tables<'games'>;
export type GamePlayer = Tables<'game_players'>;
export type Card = Tables<'cards'>;
export type Round = Tables<'rounds'>;
export type GameAction = Tables<'game_actions'>;

export default supabase;