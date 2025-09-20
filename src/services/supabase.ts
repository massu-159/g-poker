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
      // Check if user already has profiles (both authentication and public)
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      const { data: existingPublicProfile } = await supabase
        .from('public_profiles')
        .select('id, profile_id')
        .eq('profile_id', userId)
        .single();

      // Create authentication profile if missing
      if (!existingProfile) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: this.currentSession?.user?.email || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
            is_active: true,
          });

        if (profileError && profileError.code !== '23505') { // Ignore duplicate key errors
          console.error('Failed to create authentication profile:', profileError);
          throw profileError;
        }
      }

      // Create public profile if missing
      if (!existingPublicProfile) {
        // Extract display name from metadata or email
        const displayName = this.currentSession?.user?.user_metadata?.displayName
          || this.currentSession?.user?.email?.split('@')[0]
          || 'Player';

        const { error: publicProfileError } = await supabase
          .from('public_profiles')
          .insert({
            profile_id: userId,
            display_name: displayName,
            avatar_url: null,
            verification_status: 'unverified',
            games_played: 0,
            games_won: 0,
            win_rate: 0.0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (publicProfileError && publicProfileError.code !== '23505') { // Ignore duplicate key errors
          console.error('Failed to create public profile:', publicProfileError);
          throw publicProfileError;
        }
      }

      if (environment.enableLogging) {
        console.log('User profile ensured for:', userId);
      }
    } catch (error) {
      console.error('Failed to ensure user profile:', error);
      throw error;
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

  // Auth state subscription for hooks
  public subscribe(callback: (authState: AuthState) => void): () => void {
    const listener = (event: AuthChangeEvent, session: Session | null) => {
      const authState: AuthState = {
        user: session?.user || null,
        session,
        isLoading: false,
        isAuthenticated: session !== null,
      };
      callback(authState);
    };

    this.addAuthListener(listener);

    // Return unsubscribe function
    return () => {
      this.removeAuthListener(listener);
    };
  }

  public getAuthState(): AuthState {
    return {
      user: this.currentSession?.user || null,
      session: this.currentSession,
      isLoading: false,
      isAuthenticated: this.currentSession !== null,
    };
  }

  // Authentication methods
  public async signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Update last seen timestamp
      await this.updateLastSeen();

      return { success: true };
    } catch (error: any) {
      console.error('Sign in failed:', error);
      return { success: false, error: error.message || 'Sign in failed' };
    }
  }

  public async signUp(email: string, password: string, metadata?: Record<string, any>): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata || {},
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Sign up failed:', error);
      return { success: false, error: error.message || 'Sign up failed' };
    }
  }

  public async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Sign out failed:', error);
      return { success: false, error: error.message || 'Sign out failed' };
    }
  }

  public async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Password reset failed:', error);
      return { success: false, error: error.message || 'Password reset failed' };
    }
  }

  // ENUM validation methods for data integrity
  public validateCreatureType(value: string): value is CreatureType {
    return ['cockroach', 'mouse', 'bat', 'frog'].includes(value);
  }

  public validateGameStatus(value: string): value is GameStatus {
    return ['waiting', 'in_progress', 'completed', 'cancelled'].includes(value);
  }

  public validatePlayerStatus(value: string): value is PlayerStatus {
    return ['joined', 'playing', 'disconnected', 'left'].includes(value);
  }

  public validateVerificationStatus(value: string): value is VerificationStatus {
    return ['unverified', 'pending', 'verified', 'rejected', 'suspended'].includes(value);
  }

  // Helper method to get current user's public profile
  public async getCurrentUserProfile(): Promise<PublicProfile | null> {
    try {
      const user = this.getCurrentUser();
      if (!user) return null;

      const { data: profile, error } = await supabase
        .from('public_profiles')
        .select('*')
        .eq('profile_id', user.id)
        .single();

      if (error) {
        console.error('Failed to get user profile:', error);
        return null;
      }

      return profile;
    } catch (error) {
      console.error('Failed to get current user profile:', error);
      return null;
    }
  }

  // Helper method to update user's last seen timestamp
  public async updateLastSeen(): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        console.error('Failed to update last seen:', error);
      }
    } catch (error) {
      console.error('Failed to update last seen timestamp:', error);
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
export type Game = Tables<'games'>;
export type GameParticipant = Tables<'game_participants'>;
export type GameRound = Tables<'game_rounds'>;
export type GameAction = Tables<'game_actions'>;

// Export enum types for validation
export type CreatureType = Enums<'creature_type'>;
export type GameStatus = Enums<'game_status'>;
export type PlayerStatus = Enums<'player_status'>;
export type VerificationStatus = Enums<'verification_status'>;

// Auth state interface
export interface AuthState {
  user: any | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export default supabase;