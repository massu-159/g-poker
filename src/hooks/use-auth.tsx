/**
 * Authentication hook for G-Poker
 * Provides authentication state and methods to the entire app
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authManager, AuthState, type PublicProfile } from '@/services/supabase';

interface AuthContextType {
  authState: AuthState;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
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

  const value: AuthContextType = {
    authState,
    signIn,
    signUp,
    signOut,
    resetPassword,
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