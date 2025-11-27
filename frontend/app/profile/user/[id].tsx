/**
 * Other User Profile Screen
 * Display public profile information for other users
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { profileService } from '@/src/services/profile/profileService';
import type { PublicProfile } from '@/src/services/profile/profileService';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');
  const cardBackground = useThemeColor({ light: '#f8f9fa', dark: '#1a1a1a' }, 'background');

  useEffect(() => {
    if (id) {
      loadProfile();
    }
  }, [id]);

  const loadProfile = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      setError(null);
      const result = await profileService.getProfile(id);

      if (result.success && result.data) {
        setProfile(result.data);
      } else {
        setError(result.error || 'Failed to load profile');
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tintColor} />
          <ThemedText style={styles.loadingText}>Loading profile...</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <ThemedView style={[styles.header, { backgroundColor: cardBackground }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <IconSymbol name="chevron.left" size={24} color={iconColor} />
          </TouchableOpacity>
          <ThemedText type="subtitle" style={styles.headerTitle}>
            Profile
          </ThemedText>
          <View style={styles.backButton} />
        </ThemedView>

        <ThemedView style={styles.errorContainer}>
          <IconSymbol name="exclamationmark.triangle" size={48} color={iconColor} />
          <ThemedText type="subtitle" style={styles.errorTitle}>
            Profile Not Found
          </ThemedText>
          <ThemedText style={styles.errorText}>
            {error || 'The user profile could not be found.'}
          </ThemedText>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: tintColor }]}
            onPress={() => router.back()}
          >
            <ThemedText style={styles.actionButtonText}>Go Back</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <ThemedView style={[styles.header, { backgroundColor: cardBackground }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color={iconColor} />
        </TouchableOpacity>
        <ThemedText type="subtitle" style={styles.headerTitle}>
          Profile
        </ThemedText>
        <View style={styles.backButton} />
      </ThemedView>

      <ScrollView style={styles.scrollView}>
        {/* Profile Header */}
        <ThemedView style={[styles.profileHeader, { backgroundColor: cardBackground }]}>
          <View style={styles.avatarContainer}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: tintColor }]}>
                <ThemedText type="title" style={styles.avatarPlaceholderText}>
                  {profile.display_name.charAt(0).toUpperCase()}
                </ThemedText>
              </View>
            )}
          </View>

          <ThemedText type="title" style={styles.displayName}>
            {profile.display_name}
          </ThemedText>

          {profile.username && (
            <ThemedText style={styles.username}>@{profile.username}</ThemedText>
          )}

          <View style={styles.profileMetadata}>
            <View style={styles.metadataItem}>
              <IconSymbol name="calendar" size={16} color={iconColor} />
              <ThemedText style={styles.metadataText}>
                Joined {new Date(profile.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric'
                })}
              </ThemedText>
            </View>
          </View>
        </ThemedView>

        {/* Game Statistics */}
        <ThemedView style={[styles.section, { backgroundColor: cardBackground }]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Game Statistics
          </ThemedText>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <IconSymbol name="gamecontroller.fill" size={24} color={tintColor} />
              <ThemedText type="title" style={[styles.statValue, { color: tintColor }]}>
                -
              </ThemedText>
              <ThemedText style={styles.statLabel}>Games Played</ThemedText>
            </View>

            <View style={styles.statCard}>
              <IconSymbol name="trophy.fill" size={24} color="#f39c12" />
              <ThemedText type="title" style={[styles.statValue, { color: '#f39c12' }]}>
                -
              </ThemedText>
              <ThemedText style={styles.statLabel}>Win Rate</ThemedText>
            </View>
          </View>

          <ThemedText style={styles.privacyNote}>
            This user's detailed statistics are private
          </ThemedText>
        </ThemedView>

        {/* Recent Activity */}
        <ThemedView style={[styles.section, { backgroundColor: cardBackground }]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Recent Activity
          </ThemedText>

          <View style={styles.activityList}>
            <ThemedText style={styles.privacyNote}>
              Activity information is not available for this user
            </ThemedText>
          </View>
        </ThemedView>

        {/* Actions */}
        <ThemedView style={[styles.section, { backgroundColor: cardBackground }]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Actions
          </ThemedText>

          <TouchableOpacity
            style={[styles.actionItem, { borderColor: iconColor }]}
            onPress={() => {
              // TODO: Implement friend request functionality
              console.log('Send friend request to:', id);
            }}
          >
            <IconSymbol name="person.badge.plus" size={20} color={tintColor} />
            <ThemedText style={[styles.actionItemText, { color: tintColor }]}>
              Add Friend
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionItem, { borderColor: iconColor }]}
            onPress={() => {
              // TODO: Implement game invitation functionality
              console.log('Invite to game:', id);
            }}
          >
            <IconSymbol name="gamecontroller" size={20} color={tintColor} />
            <ThemedText style={[styles.actionItemText, { color: tintColor }]}>
              Invite to Game
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionItem, { borderColor: '#e74c3c' }]}
            onPress={() => {
              // TODO: Implement block user functionality
              console.log('Block user:', id);
            }}
          >
            <IconSymbol name="hand.raised.fill" size={20} color="#e74c3c" />
            <ThemedText style={[styles.actionItemText, { color: '#e74c3c' }]}>
              Block User
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    padding: 8,
    minWidth: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    margin: 16,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 40,
    color: 'white',
    fontWeight: 'bold',
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 16,
  },
  profileMetadata: {
    flexDirection: 'row',
    gap: 16,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metadataText: {
    fontSize: 14,
    opacity: 0.7,
  },
  section: {
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
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
  privacyNote: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  activityList: {
    padding: 16,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
  },
  actionItemText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
