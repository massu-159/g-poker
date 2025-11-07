/**
 * Profile Achievements Screen
 * Display user achievements and progress
 */

import React from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function ProfileAchievementsScreen() {
  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');
  const cardBackground = useThemeColor({ light: '#f8f9fa', dark: '#1a1a1a' }, 'background');

  const mockAchievements = [
    {
      id: '1',
      title: 'First Game',
      description: 'Play your first game of Cockroach Poker',
      icon: 'gamecontroller.fill',
      color: tintColor,
      completed: true,
      progress: 1,
      total: 1,
    },
    {
      id: '2',
      title: 'Winner',
      description: 'Win your first game',
      icon: 'trophy.fill',
      color: '#f39c12',
      completed: false,
      progress: 0,
      total: 1,
    },
    {
      id: '3',
      title: 'Dedicated Player',
      description: 'Play 10 games',
      icon: 'star.fill',
      color: '#e74c3c',
      completed: false,
      progress: 3,
      total: 10,
    },
    {
      id: '4',
      title: 'Master Bluffer',
      description: 'Successfully bluff 5 times',
      icon: 'eye.slash.fill',
      color: '#9b59b6',
      completed: false,
      progress: 1,
      total: 5,
    },
  ];

  const AchievementCard = ({ achievement }: { achievement: typeof mockAchievements[0] }) => (
    <ThemedView style={[styles.achievementCard, { backgroundColor: cardBackground }]}>
      <View style={styles.achievementHeader}>
        <View style={[
          styles.achievementIcon,
          {
            backgroundColor: achievement.completed ? achievement.color : 'rgba(0,0,0,0.2)',
          }
        ]}>
          <IconSymbol
            name={achievement.icon}
            size={24}
            color={achievement.completed ? 'white' : iconColor}
          />
        </View>

        <View style={styles.achievementInfo}>
          <ThemedText style={[
            styles.achievementTitle,
            { opacity: achievement.completed ? 1 : 0.6 }
          ]}>
            {achievement.title}
          </ThemedText>
          <ThemedText style={[
            styles.achievementDescription,
            { opacity: achievement.completed ? 0.8 : 0.5 }
          ]}>
            {achievement.description}
          </ThemedText>
        </View>

        {achievement.completed && (
          <IconSymbol name="checkmark.circle.fill" size={24} color={achievement.color} />
        )}
      </View>

      {!achievement.completed && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: achievement.color,
                  width: `${(achievement.progress / achievement.total) * 100}%`,
                }
              ]}
            />
          </View>
          <ThemedText style={styles.progressText}>
            {achievement.progress}/{achievement.total}
          </ThemedText>
        </View>
      )}
    </ThemedView>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <ThemedView style={[styles.header, { backgroundColor: cardBackground }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color={iconColor} />
        </TouchableOpacity>
        <ThemedText type="subtitle" style={styles.headerTitle}>
          Achievements
        </ThemedText>
        <View style={styles.backButton} />
      </ThemedView>

      <ScrollView style={styles.scrollView}>
        {/* Achievement Stats */}
        <ThemedView style={[styles.statsSection, { backgroundColor: cardBackground }]}>
          <View style={styles.statItem}>
            <ThemedText type="title" style={[styles.statValue, { color: tintColor }]}>
              {mockAchievements.filter(a => a.completed).length}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Unlocked</ThemedText>
          </View>

          <View style={styles.statItem}>
            <ThemedText type="title" style={[styles.statValue, { color: '#f39c12' }]}>
              {mockAchievements.length}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Total</ThemedText>
          </View>

          <View style={styles.statItem}>
            <ThemedText type="title" style={[styles.statValue, { color: '#e74c3c' }]}>
              {Math.round((mockAchievements.filter(a => a.completed).length / mockAchievements.length) * 100)}%
            </ThemedText>
            <ThemedText style={styles.statLabel}>Complete</ThemedText>
          </View>
        </ThemedView>

        {/* Achievements List */}
        <ThemedView style={[styles.section, { backgroundColor: cardBackground }]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            All Achievements
          </ThemedText>

          {mockAchievements.map((achievement) => (
            <AchievementCard key={achievement.id} achievement={achievement} />
          ))}
        </ThemedView>

        {/* Coming Soon */}
        <ThemedView style={[styles.section, { backgroundColor: cardBackground }]}>
          <View style={styles.comingSoon}>
            <IconSymbol name="star.circle" size={48} color={iconColor} />
            <ThemedText type="subtitle" style={styles.comingSoonTitle}>
              More Achievements Coming Soon!
            </ThemedText>
            <ThemedText style={styles.comingSoonText}>
              We're working on adding more exciting achievements and challenges. Keep playing to unlock them all!
            </ThemedText>
          </View>
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  statsSection: {
    margin: 16,
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
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
  achievementCard: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  achievementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  achievementIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementInfo: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  achievementDescription: {
    fontSize: 14,
  },
  progressContainer: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  comingSoon: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  comingSoonTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  comingSoonText: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 20,
  },
});