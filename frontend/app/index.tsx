/**
 * Splash Screen - G-Poker App Entry Point
 * Displays app logo and handles authentication state routing
 */

import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/src/hooks/useAuth';

export default function SplashScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const { authState } = useAuth();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const navigateBasedOnAuthState = async () => {
      console.log('🔍 Simplified navigation check:', {
        isLoading: authState.isLoading,
        isAuthenticated: authState.isAuthenticated,
        hasUser: !!authState.user,
        isNavigating
      });

      // Wait for auth state to be determined
      if (authState.isLoading || isNavigating) {
        console.log('⏳ Waiting for auth state or already navigating');
        return;
      }

      setIsNavigating(true);
      console.log('🚀 Starting simple navigation process');

      // Add minimum splash screen display time
      await new Promise(resolve => setTimeout(resolve, 1500));

      try {
        if (!authState.isAuthenticated || !authState.user) {
          // Not authenticated - go to welcome screen
          console.log('❌ User not authenticated, redirecting to welcome');
          router.replace('/welcome');
        } else {
          // Authenticated - go directly to lobby (tutorial handled there)
          console.log('✅ User authenticated, redirecting to lobby');
          router.replace('/lobby');
        }
      } catch (error) {
        console.error('💥 Navigation error:', error);
        router.replace('/welcome');
      } finally {
        setTimeout(() => {
          setIsNavigating(false);
        }, 500);
      }
    };

    navigateBasedOnAuthState();
  }, [authState.isLoading, authState.isAuthenticated, authState.user?.id]);

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <View style={styles.logoContainer}>
        {/* G-Poker Logo */}
        <View style={[styles.logoPlaceholder, { borderColor: tintColor }]}>
          <ThemedText style={[styles.logoText, { color: tintColor }]}>
            G-Poker
          </ThemedText>
        </View>

        {/* App Title */}
        <ThemedText style={styles.titleText}>
          ごきぶりポーカー
        </ThemedText>

        {/* Subtitle */}
        <ThemedText style={styles.subtitleText}>
          Cockroach Poker
        </ThemedText>
      </View>

      {/* Loading Animation */}
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={tintColor}
          style={styles.loadingIndicator}
        />
        <ThemedText style={styles.loadingText}>
          Loading...
        </ThemedText>
      </View>

      {/* App Version */}
      <View style={styles.versionContainer}>
        <ThemedText style={styles.versionText}>
          Version 1.0.0
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  titleText: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 16,
    opacity: 0.8,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  loadingIndicator: {
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    opacity: 0.7,
  },
  versionContainer: {
    position: 'absolute',
    bottom: 40,
  },
  versionText: {
    fontSize: 12,
    opacity: 0.5,
  },
});