/**
 * Authentication hook for G-Poker
 * Provides authentication state and methods to the entire app
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { router } from 'expo-router';
import { authManager, AuthState, type PublicProfile } from '@/services/supabase';

interface AuthContextType {
  authState: AuthState;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  refreshSession: () => Promise<void>;
  requireAuth: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = authManager.subscribe((newAuthState) => {
      setAuthState(newAuthState);
    });

    // Get initial auth state
    setAuthState(authManager.getAuthState());

    return unsubscribe;
  }, []);

  // Automatic session refresh
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout;

    if (authState.isAuthenticated && authState.session) {
      // Refresh session every 50 minutes (token expires in 60 minutes)
      refreshInterval = setInterval(async () => {
        console.log('🔄 Auto-refreshing session...');
        await refreshSession();
      }, 50 * 60 * 1000);
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [authState.isAuthenticated, authState.session]);

  const signIn = async (email: string, password: string) => {
    return await authManager.signIn(email, password);
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const result = await authManager.signUp(email, password, { displayName });
    return result;
  };

  const signOut = async () => {
    return await authManager.signOut();
  };

  const resetPassword = async (email: string) => {
    return await authManager.resetPassword(email);
  };

  const refreshSession = async () => {
    try {
      console.log('🔄 Refreshing authentication session...');
      await authManager.refreshSession();
    } catch (error) {
      console.error('Session refresh failed:', error);
      // Force logout on refresh failure
      await signOut();
    }
  };

  const requireAuth = () => {
    if (!authState.isAuthenticated || !authState.user) {
      console.log('🔒 Authentication required, redirecting to login...');
      router.replace('/auth/login');
      return false;
    }
    return true;
  };

  const value: AuthContextType = {
    authState,
    signIn,
    signUp,
    signOut,
    resetPassword,
    refreshSession,
    requireAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

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
  redirectTo = '/auth/login'
}: ProtectedRouteProps) {
  const { authState } = useAuth();

  useEffect(() => {
    if (!authState.isLoading && !authState.isAuthenticated) {
      console.log('🔒 Protected route accessed without authentication, redirecting...');
      router.replace(redirectTo);
    }
  }, [authState.isLoading, authState.isAuthenticated, redirectTo]);

  // Show loading state while auth is being determined
  if (authState.isLoading) {
    return fallback;
  }

  // Only render children if authenticated
  if (authState.isAuthenticated) {
    return <>{children}</>;
  }

  // Return fallback or null while redirecting
  return fallback;
}

/**
 * Hook for requiring authentication on a page
 * Use this in page components that need authentication
 */
export function useRequireAuth() {
  const { authState, requireAuth } = useAuth();

  useEffect(() => {
    if (!authState.isLoading) {
      requireAuth();
    }
  }, [authState.isLoading, requireAuth]);

  return authState.isAuthenticated;
}