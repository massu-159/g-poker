/**
 * Welcome Screen - G-Poker App Introduction
 * Introduces the Cockroach Poker game and provides entry to authentication
 */

import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function WelcomeScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');

  const handleGetStarted = () => {
    router.push('/auth/login');
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo and Title */}
        <View style={styles.headerContainer}>
          <View style={[styles.logoContainer, { borderColor: tintColor }]}>
            <ThemedText style={[styles.logoText, { color: tintColor }]}>
              G-Poker
            </ThemedText>
          </View>

          <ThemedText style={styles.titleText}>
            ごきぶりポーカー
          </ThemedText>
          <ThemedText style={styles.subtitleText}>
            Cockroach Poker
          </ThemedText>
        </View>

        {/* Game Introduction */}
        <View style={styles.introContainer}>
          <ThemedText style={styles.welcomeText}>
            Welcome to G-Poker!
          </ThemedText>

          <ThemedText style={styles.descriptionText}>
            Experience the thrilling bluffing card game where deception is key.
            Pass cards, make claims, and guess whether your opponent is telling
            the truth or lying.
          </ThemedText>

          {/* Game Features */}
          <View style={styles.featuresContainer}>
            <View style={styles.featureItem}>
              <View style={[styles.featureDot, { backgroundColor: tintColor }]} />
              <ThemedText style={styles.featureText}>
                2-player online multiplayer
              </ThemedText>
            </View>

            <View style={styles.featureItem}>
              <View style={[styles.featureDot, { backgroundColor: tintColor }]} />
              <ThemedText style={styles.featureText}>
                4 creature types to master
              </ThemedText>
            </View>

            <View style={styles.featureItem}>
              <View style={[styles.featureDot, { backgroundColor: tintColor }]} />
              <ThemedText style={styles.featureText}>
                Quick 10-minute games
              </ThemedText>
            </View>

            <View style={styles.featureItem}>
              <View style={[styles.featureDot, { backgroundColor: tintColor }]} />
              <ThemedText style={styles.featureText}>
                Real-time synchronization
              </ThemedText>
            </View>
          </View>

          {/* Creature Types Preview */}
          <View style={styles.creaturesContainer}>
            <ThemedText style={styles.creaturesTitle}>
              Master the Four Creatures:
            </ThemedText>
            <View style={styles.creaturesGrid}>
              <View style={styles.creatureItem}>
                <ThemedText style={styles.creatureEmoji}>🪳</ThemedText>
                <ThemedText style={styles.creatureLabel}>Cockroach</ThemedText>
              </View>
              <View style={styles.creatureItem}>
                <ThemedText style={styles.creatureEmoji}>🐭</ThemedText>
                <ThemedText style={styles.creatureLabel}>Mouse</ThemedText>
              </View>
              <View style={styles.creatureItem}>
                <ThemedText style={styles.creatureEmoji}>🦇</ThemedText>
                <ThemedText style={styles.creatureLabel}>Bat</ThemedText>
              </View>
              <View style={styles.creatureItem}>
                <ThemedText style={styles.creatureEmoji}>🐸</ThemedText>
                <ThemedText style={styles.creatureLabel}>Frog</ThemedText>
              </View>
            </View>
          </View>
        </View>

        {/* Get Started Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.getStartedButton, { backgroundColor: tintColor }]}
            onPress={handleGetStarted}
            activeOpacity={0.8}
          >
            <ThemedText style={[styles.buttonText, { color: backgroundColor }]}>
              Get Started
            </ThemedText>
          </TouchableOpacity>

          <ThemedText style={styles.footerText}>
            Join the bluffing challenge today!
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  titleText: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 18,
    opacity: 0.8,
    textAlign: 'center',
  },
  introContainer: {
    flex: 1,
    marginBottom: 40,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    opacity: 0.9,
    marginBottom: 32,
  },
  featuresContainer: {
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 16,
  },
  featureText: {
    fontSize: 16,
    flex: 1,
  },
  creaturesContainer: {
    alignItems: 'center',
  },
  creaturesTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  creaturesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  creatureItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,
  },
  creatureEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  creatureLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  buttonContainer: {
    alignItems: 'center',
  },
  getStartedButton: {
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 28,
    minWidth: 200,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  footerText: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
});