/**
 * Tutorial Screen Component for G-Poker
 * Provides Cockroach Poker rules explanation with skip functionality
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/use-auth';
import { authManager } from '@/services/supabase';

interface TutorialScreenProps {
  isModal?: boolean;
  onComplete?: () => void;
}

export function TutorialScreen({
  isModal = false,
  onComplete
}: TutorialScreenProps = {}) {
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const { authState } = useAuth();
  const [currentPage, setCurrentPage] = useState(0);

  const tutorialPages = [
    {
      title: "Welcome to Cockroach Poker!",
      content: "ごきぶりポーカーへようこそ！\nThis is a fun bluffing card game where deception is key.",
      emoji: "🎯"
    },
    {
      title: "Four Creature Types",
      content: "The game uses 4 types of creatures:\n• 🪳 Cockroach (ゴキブリ)\n• 🐭 Mouse (ネズミ)\n• 🦇 Bat (コウモリ)\n• 🐸 Frog (カエル)\n\nEach type has 6 cards, total 24 cards.",
      emoji: "🃏"
    },
    {
      title: "Game Setup",
      content: "• 2 players online multiplayer\n• Each player gets 9 cards\n• 6 cards remain hidden for randomness\n• Players can see only their own cards",
      emoji: "🎮"
    },
    {
      title: "How to Play",
      content: "1. Pass a card face-down to opponent\n2. Make a claim about what creature it is\n3. Opponent can:\n   • Believe you (take the card)\n   • Call you a liar (check the card)\n   • Pass it back to you",
      emoji: "🎭"
    },
    {
      title: "Winning & Losing",
      content: "🏆 Goal: Avoid collecting 3 of the same creature type\n\n💀 You LOSE if you get:\n• 3 Cockroaches\n• 3 Mice\n• 3 Bats\n• 3 Frogs\n\nBluff wisely to survive!",
      emoji: "⚡"
    }
  ];


  const handleNext = () => {
    if (currentPage < tutorialPages.length - 1) {
      setCurrentPage(currentPage + 1);
    } else {
      completeTutorial();
    }
  };

  const handlePrevious = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const completeTutorial = async () => {
    if (!authState.user?.id) {
      Alert.alert('Error', 'User not authenticated. Please log in again.');
      return;
    }

    try {
      // Update tutorial completion status in database
      const result = await authManager.updateTutorialCompleted(authState.user.id);

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to save tutorial completion');
        return;
      }

      console.log('Tutorial completed for user:', authState.user.id);

      if (isModal && onComplete) {
        // Modal mode: call completion callback
        onComplete();
      } else {
        // Full screen mode: navigate to lobby
        router.replace('/lobby');
      }
    } catch (error) {
      console.error('Tutorial completion error:', error);
      Alert.alert('Error', 'Failed to save tutorial completion. Please try again.');
    }
  };

  const currentTutorial = tutorialPages[currentPage];

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      {/* Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageContainer}>
          {/* Emoji */}
          <View style={styles.emojiContainer}>
            <ThemedText style={styles.emojiText}>
              {currentTutorial.emoji}
            </ThemedText>
          </View>

          {/* Title */}
          <ThemedText style={styles.titleText}>
            {currentTutorial.title}
          </ThemedText>

          {/* Content */}
          <ThemedText style={styles.contentText}>
            {currentTutorial.content}
          </ThemedText>

          {/* Page Indicator */}
          <View style={styles.pageIndicator}>
            {tutorialPages.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  {
                    backgroundColor: index === currentPage ? tintColor : textColor,
                    opacity: index === currentPage ? 1 : 0.3,
                  }
                ]}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Navigation */}
      <View style={styles.navigationContainer}>
        {/* Previous Button */}
        <TouchableOpacity
          style={[
            styles.navButton,
            {
              backgroundColor: currentPage > 0 ? tintColor : 'transparent',
              opacity: currentPage > 0 ? 1 : 0.3,
            }
          ]}
          onPress={handlePrevious}
          disabled={currentPage === 0}
        >
          <ThemedText style={[
            styles.navButtonText,
            { color: currentPage > 0 ? backgroundColor : textColor }
          ]}>
            Previous
          </ThemedText>
        </TouchableOpacity>

        {/* Next/Finish Button */}
        <TouchableOpacity
          style={[styles.navButton, { backgroundColor: tintColor }]}
          onPress={handleNext}
        >
          <ThemedText style={[styles.navButtonText, { color: backgroundColor }]}>
            {currentPage === tutorialPages.length - 1 ? 'Start Playing!' : 'Next'}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  pageContainer: {
    alignItems: 'center',
    minHeight: 400,
    justifyContent: 'center',
  },
  emojiContainer: {
    marginBottom: 32,
  },
  emojiText: {
    fontSize: 64,
    textAlign: 'center',
  },
  titleText: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
  },
  contentText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 40,
    opacity: 0.9,
    maxWidth: 320,
  },
  pageIndicator: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 16,
  },
  navButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});