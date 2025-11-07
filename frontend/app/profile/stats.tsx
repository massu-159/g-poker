/**
 * Profile Statistics Screen
 * Detailed game statistics and performance metrics
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { profileService } from '@/services/profileService';
import type { ProfileStats } from '@/services/profileService';

const { width: screenWidth } = Dimensions.get('window');

export default function ProfileStatsScreen() {
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
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      const result = await profileService.getUserStatistics();

      if (result.stats) {
        setStats(result.stats);
      } else if (result.error) {
        console.error('Failed to load stats:', result.error);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const StatCard = ({ title, value, subtitle, icon, color }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: string;
    color: string;
  }) => (
    <ThemedView style={[styles.statCard, { backgroundColor: cardBackground }]}>
      <View style={styles.statHeader}>
        <IconSymbol name={icon} size={24} color={color} />
        <ThemedText style={styles.statTitle}>{title}</ThemedText>
      </View>
      <ThemedText type="title" style={[styles.statValue, { color }]}>
        {value}
      </ThemedText>
      {subtitle && (
        <ThemedText style={styles.statSubtitle}>{subtitle}</ThemedText>
      )}
    </ThemedView>
  );

  const ProgressBar = ({ label, value, maxValue, color }: {
    label: string;
    value: number;
    maxValue: number;
    color: string;
  }) => {
    const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

    return (
      <View style={styles.progressItem}>
        <View style={styles.progressHeader}>
          <ThemedText style={styles.progressLabel}>{label}</ThemedText>
          <ThemedText style={styles.progressValue}>{value}</ThemedText>
        </View>
        <View style={[styles.progressBarBackground, { backgroundColor: cardBackground }]}>
          <View
            style={[
              styles.progressBarFill,
              { backgroundColor: color, width: `${Math.min(percentage, 100)}%` }
            ]}
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <ThemedView style={[styles.header, { backgroundColor: cardBackground }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color={iconColor} />
        </TouchableOpacity>
        <ThemedText type="subtitle" style={styles.headerTitle}>
          Game Statistics
        </ThemedText>
        <View style={styles.backButton} />
      </ThemedView>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Overall Performance */}
        <ThemedView style={[styles.section, { backgroundColor: cardBackground }]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Overall Performance
          </ThemedText>

          <View style={styles.statsGrid}>
            <StatCard
              title="Games Played"
              value={stats?.gamesPlayed || 0}
              icon="gamecontroller.fill"
              color={tintColor}
            />

            <StatCard
              title="Win Rate"
              value={stats?.winRate ? `${Math.round(stats.winRate)}%` : '0%'}
              subtitle={`${stats?.gamesWon || 0} wins, ${stats?.gamesLost || 0} losses`}
              icon="trophy.fill"
              color="#f39c12"
            />

            <StatCard
              title="Games Won"
              value={stats?.gamesWon || 0}
              icon="checkmark.circle.fill"
              color="#27ae60"
            />

            <StatCard
              title="Games Lost"
              value={stats?.gamesLost || 0}
              icon="xmark.circle.fill"
              color="#e74c3c"
            />
          </View>
        </ThemedView>

        {/* Game Performance Breakdown */}
        <ThemedView style={[styles.section, { backgroundColor: cardBackground }]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Performance Breakdown
          </ThemedText>

          <View style={styles.progressContainer}>
            <ProgressBar
              label="Games Won"
              value={stats?.gamesWon || 0}
              maxValue={stats?.gamesPlayed || 1}
              color="#27ae60"
            />

            <ProgressBar
              label="Games Lost"
              value={stats?.gamesLost || 0}
              maxValue={stats?.gamesPlayed || 1}
              color="#e74c3c"
            />
          </View>

          {/* Win Rate Visualization */}
          <View style={styles.winRateContainer}>
            <ThemedText style={styles.winRateLabel}>Win Rate</ThemedText>
            <View style={styles.winRateCircle}>
              <ThemedText type="title" style={[styles.winRateText, { color: tintColor }]}>
                {stats?.winRate ? `${Math.round(stats.winRate)}%` : '0%'}
              </ThemedText>
              <ThemedText style={styles.winRateSubtext}>
                {stats?.gamesPlayed || 0} games
              </ThemedText>
            </View>
          </View>
        </ThemedView>

        {/* Additional Statistics */}
        {(stats?.averageGameDuration || stats?.longestWinStreak || stats?.totalPlayTime) && (
          <ThemedView style={[styles.section, { backgroundColor: cardBackground }]}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Additional Stats
            </ThemedText>

            <View style={styles.additionalStats}>
              {stats?.averageGameDuration && (
                <View style={styles.additionalStatItem}>
                  <IconSymbol name="clock.fill" size={20} color={iconColor} />
                  <View style={styles.additionalStatText}>
                    <ThemedText style={styles.additionalStatLabel}>Average Game Duration</ThemedText>
                    <ThemedText style={styles.additionalStatValue}>
                      {formatDuration(stats.averageGameDuration)}
                    </ThemedText>
                  </View>
                </View>
              )}

              {stats?.longestWinStreak && (
                <View style={styles.additionalStatItem}>
                  <IconSymbol name="flame.fill" size={20} color="#f39c12" />
                  <View style={styles.additionalStatText}>
                    <ThemedText style={styles.additionalStatLabel}>Longest Win Streak</ThemedText>
                    <ThemedText style={styles.additionalStatValue}>
                      {stats.longestWinStreak} games
                    </ThemedText>
                  </View>
                </View>
              )}

              {stats?.totalPlayTime && (
                <View style={styles.additionalStatItem}>
                  <IconSymbol name="hourglass.fill" size={20} color={tintColor} />
                  <View style={styles.additionalStatText}>
                    <ThemedText style={styles.additionalStatLabel}>Total Play Time</ThemedText>
                    <ThemedText style={styles.additionalStatValue}>
                      {formatDuration(stats.totalPlayTime)}
                    </ThemedText>
                  </View>
                </View>
              )}

              {stats?.favoriteCreatureType && (
                <View style={styles.additionalStatItem}>
                  <IconSymbol name="heart.fill" size={20} color="#e74c3c" />
                  <View style={styles.additionalStatText}>
                    <ThemedText style={styles.additionalStatLabel}>Favorite Creature</ThemedText>
                    <ThemedText style={styles.additionalStatValue}>
                      {stats.favoriteCreatureType}
                    </ThemedText>
                  </View>
                </View>
              )}
            </View>
          </ThemedView>
        )}

        {/* Achievement Suggestions */}
        <ThemedView style={[styles.section, { backgroundColor: cardBackground }]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Achievements
          </ThemedText>

          <ThemedText style={styles.achievementText}>
            Keep playing to unlock achievements and improve your statistics!
          </ThemedText>

          <TouchableOpacity
            style={[styles.achievementButton, { borderColor: tintColor }]}
            onPress={() => router.push('/profile/achievements')}
          >
            <IconSymbol name="trophy.fill" size={20} color={tintColor} />
            <ThemedText style={[styles.achievementButtonText, { color: tintColor }]}>
              View Achievements
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        {/* Loading state */}
        {isLoading && (
          <ThemedView style={styles.loadingContainer}>
            <ThemedText style={styles.loadingText}>Loading statistics...</ThemedText>
          </ThemedView>
        )}

        {/* Empty state */}
        {!isLoading && !stats?.gamesPlayed && (
          <ThemedView style={[styles.section, { backgroundColor: cardBackground }]}>
            <View style={styles.emptyState}>
              <IconSymbol name="gamecontroller" size={48} color={iconColor} />
              <ThemedText type="subtitle" style={styles.emptyTitle}>
                No Games Played Yet
              </ThemedText>
              <ThemedText style={styles.emptyText}>
                Start playing Cockroach Poker to see your statistics here!
              </ThemedText>
              <TouchableOpacity
                style={[styles.playButton, { backgroundColor: tintColor }]}
                onPress={() => router.push('/lobby')}
              >
                <ThemedText style={styles.playButtonText}>Find a Game</ThemedText>
              </TouchableOpacity>
            </View>
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
  section: {
    margin: 16,
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
    gap: 12,
  },
  statCard: {
    width: (screenWidth - 64) / 2,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statSubtitle: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
  progressContainer: {
    gap: 16,
    marginBottom: 24,
  },
  progressItem: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressBarBackground: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  winRateContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  winRateLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  winRateCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    borderColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  winRateText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  winRateSubtext: {
    fontSize: 12,
    opacity: 0.7,
  },
  additionalStats: {
    gap: 16,
  },
  additionalStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  additionalStatText: {
    flex: 1,
  },
  additionalStatLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  additionalStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  achievementText: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 16,
  },
  achievementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 8,
    gap: 8,
  },
  achievementButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    opacity: 0.7,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 20,
  },
  playButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  playButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});