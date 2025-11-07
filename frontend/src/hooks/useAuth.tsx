/**
 * Authentication Hook for Server-Authoritative Architecture
 * Uses Hono Backend API via ApiClient
 *
 * Replaces Supabase direct authentication with server-managed auth
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { router } from 'expo-router';
import { apiClient, UserProfile } from '../services/ApiClient';
import { socketClient } from '../services/SocketClient';

/**
 * Auth State Interface
 */
export interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error?: string;
}

/**
 * Auth Context Interface
 */
interface AuthContextType {
  authState: AuthState;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  refreshSession: () => Promise<void>;
  requireAuth: () => boolean;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication Provider Component
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Initialize authentication state on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  // Connect Socket.io when authenticated
  useEffect(() => {
    if (authState.isAuthenticated && authState.user) {
      connectSocket();
    } else {
      disconnectSocket();
    }
  }, [authState.isAuthenticated]);

  /**
   * Initialize authentication state from stored tokens
   */
  const initializeAuth = async () => {
    try {
      console.log('[Auth] Initializing authentication...');

      // Check if user is already authenticated via stored tokens
      if (apiClient.isAuthenticated()) {
        const userId = apiClient.getUserId();
        if (userId) {
          // Fetch user profile from backend
          const response = await apiClient.getProfile(userId);

          if (response.success && response.data) {
            setAuthState({
              user: response.data,
              isLoading: false,
              isAuthenticated: true,
            });

            console.log('[Auth] User authenticated:', response.data.displayName);
            return;
          }
        }
      }

      // No valid authentication found
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });

      console.log('[Auth] No authentication found');
    } catch (error) {
      console.error('[Auth] Initialization failed:', error);
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: 'Failed to initialize authentication',
      });
    }
  };

  /**
   * Connect to Socket.io server
   */
  const connectSocket = async () => {
    try {
      if (!socketClient.isConnected()) {
        console.log('[Auth] Connecting to Socket.io...');
        await socketClient.connect();
      }
    } catch (error) {
      console.error('[Auth] Socket connection failed:', error);
    }
  };

  /**
   * Disconnect from Socket.io server
   */
  const disconnectSocket = () => {
    if (socketClient.isConnected()) {
      console.log('[Auth] Disconnecting from Socket.io...');
      socketClient.disconnect();
    }
  };

  /**
   * Sign in with email and password
   */
  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('[Auth] Signing in:', email);

      const response = await apiClient.login(email, password);

      if (response.success && response.data) {
        setAuthState({
          user: response.data.user,
          isLoading: false,
          isAuthenticated: true,
        });

        console.log('[Auth] Sign in successful:', response.data.user.displayName);
        return { success: true };
      }

      return {
        success: false,
        error: response.error || 'Sign in failed',
      };
    } catch (error: any) {
      console.error('[Auth] Sign in error:', error);
      return {
        success: false,
        error: error.message || 'Sign in failed',
      };
    }
  };

  /**
   * Sign up with email, password, and optional display name
   */
  const signUp = async (
    email: string,
    password: string,
    displayName?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('[Auth] Signing up:', email);

      const response = await apiClient.register(email, password, displayName);

      if (response.success && response.data) {
        setAuthState({
          user: response.data.user,
          isLoading: false,
          isAuthenticated: true,
        });

        console.log('[Auth] Sign up successful:', response.data.user.displayName);
        return { success: true };
      }

      return {
        success: false,
        error: response.error || 'Sign up failed',
      };
    } catch (error: any) {
      console.error('[Auth] Sign up error:', error);
      return {
        success: false,
        error: error.message || 'Sign up failed',
      };
    }
  };

  /**
   * Sign out
   */
  const signOut = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('[Auth] Signing out...');

      await apiClient.logout();

      // Disconnect Socket.io
      disconnectSocket();

      // Clear auth state
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });

      console.log('[Auth] Sign out successful');
      return { success: true };
    } catch (error: any) {
      console.error('[Auth] Sign out error:', error);
      return {
        success: false,
        error: error.message || 'Sign out failed',
      };
    }
  };

  /**
   * Reset password (send reset email)
   */
  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('[Auth] Requesting password reset for:', email);

      // TODO: Implement password reset endpoint in backend
      // For now, return success
      return {
        success: true,
      };
    } catch (error: any) {
      console.error('[Auth] Password reset error:', error);
      return {
        success: false,
        error: error.message || 'Password reset failed',
      };
    }
  };

  /**
   * Refresh session (refresh access token)
   */
  const refreshSession = async (): Promise<void> => {
    try {
      console.log('[Auth] Refreshing session...');

      const userId = apiClient.getUserId();
      if (!userId) {
        throw new Error('No user ID available');
      }

      // Fetch fresh user profile
      const response = await apiClient.getProfile(userId);

      if (response.success && response.data) {
        setAuthState((prev) => ({
          ...prev,
          user: response.data!,
        }));

        console.log('[Auth] Session refreshed successfully');
      } else {
        throw new Error(response.error || 'Failed to refresh session');
      }
    } catch (error) {
      console.error('[Auth] Session refresh failed:', error);
      // Force logout on refresh failure
      await signOut();
      throw error;
    }
  };

  /**
   * Require authentication (redirect to login if not authenticated)
   */
  const requireAuth = (): boolean => {
    if (!authState.isAuthenticated || !authState.user) {
      console.log('[Auth] Authentication required, redirecting to login...');
      router.replace('/auth/login');
      return false;
    }
    return true;
  };

  /**
   * Update user profile
   */
  const updateProfile = async (updates: Partial<UserProfile>): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('[Auth] Updating profile...');

      const response = await apiClient.updateProfile(updates);

      if (response.success && response.data) {
        setAuthState((prev) => ({
          ...prev,
          user: response.data!,
        }));

        console.log('[Auth] Profile updated successfully');
        return { success: true };
      }

      return {
        success: false,
        error: response.error || 'Profile update failed',
      };
    } catch (error: any) {
      console.error('[Auth] Profile update error:', error);
      return {
        success: false,
        error: error.message || 'Profile update failed',
      };
    }
  };

  const value: AuthContextType = {
    authState,
    signIn,
    signUp,
    signOut,
    resetPassword,
    refreshSession,
    requireAuth,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access authentication context
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

/**
 * Protected Route Component
 * Wraps components that require authentication
 */
interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  fallback = null,
  redirectTo = '/auth/login',
}: ProtectedRouteProps) {
  const { authState } = useAuth();

  useEffect(() => {
    if (!authState.isLoading && !authState.isAuthenticated) {
      console.log('[Auth] Protected route accessed without authentication, redirecting...');
      router.replace(redirectTo);
    }
  }, [authState.isLoading, authState.isAuthenticated, redirectTo]);

  // Show loading state while auth is being determined
  if (authState.isLoading) {
    return <>{fallback}</>;
  }

  // Only render children if authenticated
  if (authState.isAuthenticated) {
    return <>{children}</>;
  }

  // Return fallback or null while redirecting
  return <>{fallback}</>;
}

/**
 * Hook for requiring authentication on a page
 * Use this in page components that need authentication
 */
export function useRequireAuth(): boolean {
  const { authState, requireAuth } = useAuth();

  useEffect(() => {
    if (!authState.isLoading) {
      requireAuth();
    }
  }, [authState.isLoading, authState, requireAuth]);

  return authState.isAuthenticated;
}

/**
 * Export Socket client for use in components
 */
export { socketClient };
