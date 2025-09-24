/**
 * Profile Tab Screen
 * Main profile management interface for G-Poker users
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/use-auth';
import { profileService } from '@/services/profileService';
import type { PublicProfile, ProfileStats } from '@/services/profileService';

export default function ProfileScreen() {
  const { authState, signOut } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');
  const cardBackground = useThemeColor({ light: '#f8f9fa', dark: '#1a1a1a' }, 'background');

  useEffect(() => {
    if (authState.isAuthenticated) {
      loadProfileData();
    }
  }, [authState.isAuthenticated]);

  const loadProfileData = async () => {
    try {
      setIsLoading(true);

      // Load profile and stats in parallel
      const [profileResult, statsResult] = await Promise.all([
        profileService.getCurrentProfile(),
        profileService.getUserStatistics(),
      ]);

      if (profileResult.profile) {
        setProfile(profileResult.profile);
      } else if (profileResult.error) {
        console.error('Failed to load profile:', profileResult.error);
      }

      if (statsResult.stats) {
        setStats(statsResult.stats);
      } else if (statsResult.error) {
        console.error('Failed to load stats:', statsResult.error);
      }
    } catch (error) {
      console.error('Failed to load profile data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProfileData();
    setRefreshing(false);
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            const result = await signOut();
            if (result.success) {
              router.replace('/auth/login');
            } else {
              Alert.alert('Error', result.error || 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const handleEditProfile = () => {
    // Navigate to profile editing screen
    router.push('/profile/edit');
  };

  const handleViewStats = () => {
    // Navigate to detailed statistics screen
    router.push('/profile/stats');
  };

  const handleSettings = () => {
    // Navigate to settings screen
    router.push('/profile/settings');
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return { icon: 'checkmark.seal.fill', color: '#27ae60', text: 'Verified' };
      case 'pending':
        return { icon: 'clock.fill', color: '#f39c12', text: 'Pending' };
      case 'rejected':
        return { icon: 'xmark.seal.fill', color: '#e74c3c', text: 'Rejected' };
      default:
        return { icon: 'person.fill', color: iconColor, text: 'Unverified' };
    }
  };

  if (!authState.isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <ThemedView style={styles.centerContainer}>
          <IconSymbol name="person.circle" size={64} color={iconColor} />
          <ThemedText type="title" style={styles.notAuthenticatedTitle}>
            Please Sign In
          </ThemedText>
          <ThemedText style={styles.notAuthenticatedText}>
            Sign in to view and manage your profile
          </ThemedText>
          <TouchableOpacity
            style={[styles.signInButton, { backgroundColor: tintColor }]}
            onPress={() => router.push('/auth/login')}
          >
            <ThemedText style={styles.signInButtonText}>Sign In</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </SafeAreaView>
    );
  }

  const verificationBadge = getVerificationBadge(profile?.verification_status || 'unverified');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Profile Header */}
        <ThemedView style={[styles.header, { backgroundColor: cardBackground }]}>
          <View style={styles.profileInfo}>
            <View style={styles.avatarContainer}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: tintColor }]}>
                  <ThemedText style={styles.avatarText}>
                    {profile?.display_name?.charAt(0).toUpperCase() || 'U'}
                  </ThemedText>
                </View>
              )}

              {/* Verification badge */}
              <View style={[styles.verificationBadge, { backgroundColor: verificationBadge.color }]}>
                <IconSymbol name={verificationBadge.icon} size={12} color="white" />
              </View>
            </View>

            <View style={styles.userInfo}>
              <ThemedText type="subtitle" style={styles.displayName}>
                {profile?.display_name || 'Unknown Player'}
              </ThemedText>
              <ThemedText style={[styles.verificationText, { color: verificationBadge.color }]}>
                {verificationBadge.text}
              </ThemedText>
              {authState.user?.email && (
                <ThemedText style={styles.email}>{authState.user.email}</ThemedText>
              )}
            </View>

            <TouchableOpacity
              style={styles.editButton}
              onPress={handleEditProfile}
            >
              <IconSymbol name="pencil" size={20} color={iconColor} />
            </TouchableOpacity>
          </View>
        </ThemedView>

        {/* Quick Stats */}
        <ThemedView style={[styles.statsCard, { backgroundColor: cardBackground }]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Game Statistics</ThemedText>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <ThemedText type="title" style={[styles.statValue, { color: tintColor }]}>
                {stats?.gamesPlayed || 0}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Games Played</ThemedText>
            </View>

            <View style={styles.statItem}>
              <ThemedText type="title" style={[styles.statValue, { color: '#27ae60' }]}>
                {stats?.gamesWon || 0}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Games Won</ThemedText>
            </View>

            <View style={styles.statItem}>
              <ThemedText type="title" style={[styles.statValue, { color: '#e74c3c' }]}>
                {stats?.gamesLost || 0}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Games Lost</ThemedText>
            </View>

            <View style={styles.statItem}>
              <ThemedText type="title" style={[styles.statValue, { color: '#f39c12' }]}>
                {stats?.winRate ? `${Math.round(stats.winRate)}%` : '0%'}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Win Rate</ThemedText>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.viewMoreButton, { borderColor: tintColor }]}
            onPress={handleViewStats}
          >
            <ThemedText style={[styles.viewMoreText, { color: tintColor }]}>
              View Detailed Statistics
            </ThemedText>
            <IconSymbol name="chevron.right" size={16} color={tintColor} />
          </TouchableOpacity>
        </ThemedView>

        {/* Menu Options */}
        <ThemedView style={[styles.menuCard, { backgroundColor: cardBackground }]}>
          <TouchableOpacity style={styles.menuItem} onPress={handleSettings}>
            <View style={styles.menuItemLeft}>
              <IconSymbol name="gearshape.fill" size={24} color={iconColor} />
              <ThemedText style={styles.menuItemText}>Settings</ThemedText>
            </View>
            <IconSymbol name="chevron.right" size={16} color={iconColor} />
          </TouchableOpacity>

          <View style={[styles.menuSeparator, { backgroundColor: iconColor }]} />

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/profile/achievements')}>
            <View style={styles.menuItemLeft}>
              <IconSymbol name="trophy.fill" size={24} color="#f39c12" />
              <ThemedText style={styles.menuItemText}>Achievements</ThemedText>
            </View>
            <IconSymbol name="chevron.right" size={16} color={iconColor} />
          </TouchableOpacity>

          <View style={[styles.menuSeparator, { backgroundColor: iconColor }]} />

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/profile/history')}>
            <View style={styles.menuItemLeft}>
              <IconSymbol name="clock.fill" size={24} color={iconColor} />
              <ThemedText style={styles.menuItemText}>Game History</ThemedText>
            </View>
            <IconSymbol name="chevron.right" size={16} color={iconColor} />
          </TouchableOpacity>

          <View style={[styles.menuSeparator, { backgroundColor: iconColor }]} />

          <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
            <View style={styles.menuItemLeft}>
              <IconSymbol name="rectangle.portrait.and.arrow.right" size={24} color="#e74c3c" />
              <ThemedText style={[styles.menuItemText, { color: '#e74c3c' }]}>Sign Out</ThemedText>
            </View>
            <IconSymbol name="chevron.right" size={16} color="#e74c3c" />
          </TouchableOpacity>
        </ThemedView>

        {/* Loading indicator */}
        {isLoading && (
          <ThemedView style={styles.loadingContainer}>
            <ThemedText style={styles.loadingText}>Loading profile...</ThemedText>
          </ThemedView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    margin: 16,
    marginTop: 8,
    borderRadius: 12,
    padding: 20,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  verificationBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  verificationText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  email: {
    fontSize: 14,
    opacity: 0.7,
  },
  editButton: {
    padding: 8,
  },
  statsCard: {
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 8,
    gap: 8,
  },
  viewMoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
  menuCard: {
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  menuSeparator: {
    height: 1,
    marginHorizontal: 16,
    opacity: 0.1,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    opacity: 0.7,
  },
  notAuthenticatedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 16,
  },
  notAuthenticatedText: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 24,
  },
  signInButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  signInButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});