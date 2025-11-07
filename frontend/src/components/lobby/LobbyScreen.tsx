/**
 * Main Lobby Screen Component
 * Central hub for browsing rooms and creating new ones
 * Uses new ApiClient + SocketClient architecture
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/src/hooks/useAuth';
import { RoomList } from './RoomList';
import { RoomCreation } from './RoomCreation';

type LobbyTab = 'browse' | 'create';

interface LobbyScreenProps {
  initialTab?: LobbyTab;
  onRoomJoined?: (roomId: string) => void;
  onRoomCreated?: (roomId: string) => void;
}

export function LobbyScreen({
  initialTab = 'browse',
  onRoomJoined,
  onRoomCreated,
}: LobbyScreenProps) {
  const { authState, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<LobbyTab>(initialTab);

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  /**
   * Handle room joined
   */
  const handleRoomJoined = (roomId: string) => {
    if (onRoomJoined) {
      onRoomJoined(roomId);
    } else {
      router.push(`/game/lobby/${roomId}`);
    }
  };

  /**
   * Handle room created
   */
  const handleRoomCreated = (roomId: string) => {
    if (onRoomCreated) {
      onRoomCreated(roomId);
    } else {
      router.push(`/game/lobby/${roomId}`);
    }
  };

  /**
   * Handle create room button press
   */
  const handleCreateRoomPress = () => {
    setActiveTab('create');
  };

  /**
   * Handle cancel create
   */
  const handleCancelCreate = () => {
    setActiveTab('browse');
  };

  /**
   * Handle sign out
   */
  const handleSignOut = async () => {
    try {
      const result = await signOut();
      if (result.success) {
        router.replace('/auth/login');
      }
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  /**
   * Render tab button
   */
  const renderTabButton = (tab: LobbyTab, label: string) => {
    const isActive = activeTab === tab;
    return (
      <TouchableOpacity
        style={[
          styles.tabButton,
          {
            backgroundColor: isActive ? tintColor : 'transparent',
            borderColor: tintColor,
          }
        ]}
        onPress={() => setActiveTab(tab)}
      >
        <ThemedText
          style={[
            styles.tabButtonText,
            { color: isActive ? '#fff' : tintColor }
          ]}
        >
          {label}
        </ThemedText>
      </TouchableOpacity>
    );
  };

  /**
   * Get display name from user
   */
  const getDisplayName = () => {
    if (authState.user?.displayName) {
      return authState.user.displayName;
    }
    if (authState.user?.email) {
      return authState.user.email.split('@')[0];
    }
    return 'Player';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <ThemedText type="title" style={styles.headerTitle}>
              G-Poker Lobby
            </ThemedText>
            <ThemedText style={[styles.welcomeText, { color: iconColor }]}>
              Welcome, {getDisplayName()}!
            </ThemedText>
          </View>

          <TouchableOpacity
            style={[styles.signOutButton, { borderColor: iconColor }]}
            onPress={handleSignOut}
          >
            <ThemedText style={[styles.signOutButtonText, { color: textColor }]}>
              Sign Out
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          {renderTabButton('browse', 'Browse Rooms')}
          {renderTabButton('create', 'Create Room')}
        </View>

        {/* Tab Content */}
        <View style={styles.content}>
          {activeTab === 'browse' ? (
            <RoomList
              onRoomJoined={handleRoomJoined}
              onCreateRoom={handleCreateRoomPress}
            />
          ) : (
            <RoomCreation
              onRoomCreated={handleRoomCreated}
              onCancel={handleCancelCreate}
            />
          )}
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    marginBottom: 4,
  },
  welcomeText: {
    fontSize: 14,
  },
  signOutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  signOutButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  tabButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
});
