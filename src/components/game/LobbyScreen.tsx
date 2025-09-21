/**
 * Main Lobby Screen Component
 * Central hub for browsing games and creating new ones
 */

import React, { useState, useEffect } from 'react';
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
import { useAuth } from '@/hooks/use-auth';
import { authManager } from '@/services/supabase';
import { TutorialModal } from '@/components/tutorial/TutorialModal';
import { GameBrowser } from './GameBrowser';
import { GameCreationInterface } from './GameCreationInterface';

type LobbyTab = 'browse' | 'create';

interface LobbyScreenProps {
  initialTab?: LobbyTab;
  onGameJoined?: (gameId: string) => void;
  onGameCreated?: (gameId: string) => void;
}

export function LobbyScreen({
  initialTab = 'browse',
  onGameJoined,
  onGameCreated,
}: LobbyScreenProps) {
  const { authState, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<LobbyTab>(initialTab);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [isCheckingTutorial, setIsCheckingTutorial] = useState(true);

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  // Check tutorial status on component mount
  useEffect(() => {
    checkTutorialStatus();
  }, [authState.user?.id]);

  const checkTutorialStatus = async () => {
    if (!authState.user?.id) {
      setIsCheckingTutorial(false);
      return;
    }

    console.log('🎓 Checking tutorial status in lobby for user:', authState.user.id);

    try {
      const result = await authManager.hasCompletedTutorial(authState.user.id);

      console.log('🎓 Tutorial status result:', result);

      if (!result.completed && !result.error) {
        console.log('🎓 Showing tutorial modal for first-time user');
        setShowTutorialModal(true);
      }
    } catch (error) {
      console.error('🎓 Failed to check tutorial status:', error);
    } finally {
      setIsCheckingTutorial(false);
    }
  };

  const handleTutorialComplete = () => {
    console.log('🎓 Tutorial completed via modal');
    setShowTutorialModal(false);
  };

  const handleGameJoined = (gameId: string) => {
    if (onGameJoined) {
      onGameJoined(gameId);
    } else {
      router.push(`/game/lobby/${gameId}`);
    }
  };

  const handleGameCreated = (gameId: string) => {
    if (onGameCreated) {
      onGameCreated(gameId);
    } else {
      router.push(`/game/lobby/${gameId}`);
    }
  };

  const handleCreateGamePress = () => {
    setActiveTab('create');
  };

  const handleCancelCreate = () => {
    setActiveTab('browse');
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/auth/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <ThemedText type="title" style={styles.headerTitle}>
              G-Poker Lobby
            </ThemedText>
            <ThemedText style={styles.welcomeText}>
              Welcome, {authState.user?.email?.split('@')[0] || 'Player'}!
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
          {renderTabButton('browse', 'Browse Games')}
          {renderTabButton('create', 'Create Game')}
        </View>

        {/* Tab Content */}
        <View style={styles.content}>
          {activeTab === 'browse' ? (
            <GameBrowser
              onGameJoined={handleGameJoined}
              onCreateGame={handleCreateGamePress}
            />
          ) : (
            <GameCreationInterface
              onGameCreated={handleGameCreated}
              onCancel={handleCancelCreate}
            />
          )}
        </View>
      </ThemedView>

      {/* Tutorial Modal */}
      <TutorialModal
        visible={showTutorialModal}
        onComplete={handleTutorialComplete}
      />
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
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  welcomeText: {
    fontSize: 14,
    opacity: 0.8,
  },
  signOutButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  signOutButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  tabButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
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