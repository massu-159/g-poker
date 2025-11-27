/**
 * Profile Game History Screen
 * Display user's game history and match details
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { profileService } from '@/src/services/profile/profileService';

interface GameHistoryItem {
  id: string;
  opponent: string;
  result: 'won' | 'lost';
  duration: string;
  date: string;
  rounds: number;
  winMethod?: string;
}

export default function ProfileHistoryScreen() {
  const [gameHistory, setGameHistory] = useState<GameHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterType, setFilterType] = useState<'all' | 'won' | 'lost'>('all');

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');
  const cardBackground = useThemeColor({ light: '#f8f9fa', dark: '#1a1a1a' }, 'background');

  useEffect(() => {
    loadGameHistory();
  }, [currentPage]);

  const loadGameHistory = async () => {
    try {
      setIsLoading(true);
      const result = await profileService.getUserGames(currentPage, 20);

      if (result.success && result.data) {
        // Transform API response to local format
        const transformedGames: GameHistoryItem[] = (result.data.games || []).map((game: any) => ({
          id: game.id || game.gameId,
          opponent: game.opponentName || 'Unknown Player',
          result: game.result === 'win' || game.won ? 'won' : 'lost',
          duration: formatDuration(game.duration || 0),
          date: game.completedAt || game.created_at || new Date().toISOString(),
          rounds: game.roundsPlayed || game.rounds || 0,
          winMethod: game.winMethod || game.end_reason,
        }));

        setGameHistory(transformedGames);
        setTotalPages(result.data.pagination?.totalPages || 1);
      } else {
        console.error('Failed to load game history:', result.error);
        setGameHistory([]);
      }
    } catch (error) {
      console.error('Failed to load game history:', error);
      setGameHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setCurrentPage(1);
    await loadGameHistory();
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds) return '0m 0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const GameHistoryCard = ({ game }: { game: GameHistoryItem }) => (
    <ThemedView style={[styles.gameCard, { backgroundColor: cardBackground }]}>
      <View style={styles.gameHeader}>
        <View style={styles.gameInfo}>
          <View style={styles.opponentInfo}>
            <ThemedText style={styles.opponentName}>{game.opponent}</ThemedText>
            <View style={[
              styles.resultBadge,
              { backgroundColor: game.result === 'won' ? '#27ae60' : '#e74c3c' }
            ]}>
              <ThemedText style={styles.resultText}>
                {game.result.toUpperCase()}
              </ThemedText>
            </View>
          </View>

          <ThemedText style={styles.gameDate}>
            {new Date(game.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </ThemedText>
        </View>

        <IconSymbol
          name={game.result === 'won' ? 'trophy.fill' : 'xmark.circle.fill'}
          size={24}
          color={game.result === 'won' ? '#f39c12' : '#e74c3c'}
        />
      </View>

      <View style={styles.gameDetails}>
        <View style={styles.gameDetailItem}>
          <IconSymbol name="clock.fill" size={16} color={iconColor} />
          <ThemedText style={styles.gameDetailText}>{game.duration}</ThemedText>
        </View>

        <View style={styles.gameDetailItem}>
          <IconSymbol name="arrow.triangle.2.circlepath" size={16} color={iconColor} />
          <ThemedText style={styles.gameDetailText}>{game.rounds} rounds</ThemedText>
        </View>
      </View>

      {game.winMethod && (
        <View style={styles.winMethodContainer}>
          <ThemedText style={styles.winMethodText}>
            {game.winMethod}
          </ThemedText>
        </View>
      )}
    </ThemedView>
  );

  const filteredHistory = filterType === 'all'
    ? gameHistory
    : gameHistory.filter(g => g.result === filterType);

  const StatSummary = () => {
    const totalGames = gameHistory.length;
    const wonGames = gameHistory.filter(g => g.result === 'won').length;
    const winRate = totalGames > 0 ? Math.round((wonGames / totalGames) * 100) : 0;

    return (
      <ThemedView style={[styles.summarySection, { backgroundColor: cardBackground }]}>
        <ThemedText type="subtitle" style={styles.summaryTitle}>
          Recent Performance
        </ThemedText>

        <View style={styles.summaryStats}>
          <View style={styles.summaryStatItem}>
            <ThemedText type="title" style={[styles.summaryStatValue, { color: tintColor }]}>
              {totalGames}
            </ThemedText>
            <ThemedText style={styles.summaryStatLabel}>Games</ThemedText>
          </View>

          <View style={styles.summaryStatItem}>
            <ThemedText type="title" style={[styles.summaryStatValue, { color: '#27ae60' }]}>
              {wonGames}
            </ThemedText>
            <ThemedText style={styles.summaryStatLabel}>Won</ThemedText>
          </View>

          <View style={styles.summaryStatItem}>
            <ThemedText type="title" style={[styles.summaryStatValue, { color: '#e74c3c' }]}>
              {totalGames - wonGames}
            </ThemedText>
            <ThemedText style={styles.summaryStatLabel}>Lost</ThemedText>
          </View>

          <View style={styles.summaryStatItem}>
            <ThemedText type="title" style={[styles.summaryStatValue, { color: '#f39c12' }]}>
              {winRate}%
            </ThemedText>
            <ThemedText style={styles.summaryStatLabel}>Win Rate</ThemedText>
          </View>
        </View>
      </ThemedView>
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
          Game History
        </ThemedText>
        <View style={styles.backButton} />
      </ThemedView>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Performance Summary */}
        <StatSummary />

        {/* Filter Options */}
        <ThemedView style={[styles.filterSection, { backgroundColor: cardBackground }]}>
          <View style={styles.filterButtons}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                filterType === 'all' && { backgroundColor: tintColor },
                filterType !== 'all' && { borderColor: iconColor }
              ]}
              onPress={() => setFilterType('all')}
            >
              <ThemedText style={filterType === 'all' ? styles.filterButtonTextActive : [styles.filterButtonText, { color: textColor }]}>
                All Games
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterButton,
                filterType === 'won' && { backgroundColor: tintColor },
                filterType !== 'won' && { borderColor: iconColor }
              ]}
              onPress={() => setFilterType('won')}
            >
              <ThemedText style={filterType === 'won' ? styles.filterButtonTextActive : [styles.filterButtonText, { color: textColor }]}>
                Won
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterButton,
                filterType === 'lost' && { backgroundColor: tintColor },
                filterType !== 'lost' && { borderColor: iconColor }
              ]}
              onPress={() => setFilterType('lost')}
            >
              <ThemedText style={filterType === 'lost' ? styles.filterButtonTextActive : [styles.filterButtonText, { color: textColor }]}>
                Lost
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>

        {/* Game History */}
        <ThemedView style={[styles.historySection, { backgroundColor: cardBackground }]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Recent Games
          </ThemedText>

          {isLoading && currentPage === 1 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={tintColor} />
              <ThemedText style={styles.loadingText}>Loading games...</ThemedText>
            </View>
          ) : filteredHistory.length > 0 ? (
            filteredHistory.map((game) => (
              <GameHistoryCard key={game.id} game={game} />
            ))
          ) : (
            <View style={styles.emptyState}>
              <IconSymbol name="gamecontroller" size={48} color={iconColor} />
              <ThemedText type="subtitle" style={styles.emptyTitle}>
                No Games Yet
              </ThemedText>
              <ThemedText style={styles.emptyText}>
                Start playing to see your game history here!
              </ThemedText>
              <TouchableOpacity
                style={[styles.playButton, { backgroundColor: tintColor }]}
                onPress={() => router.push('/lobby')}
              >
                <ThemedText style={styles.playButtonText}>Find a Game</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </ThemedView>

        {/* Load More */}
        {filteredHistory.length > 0 && currentPage < totalPages && (
          <ThemedView style={[styles.loadMoreSection, { backgroundColor: cardBackground }]}>
            <TouchableOpacity
              style={[styles.loadMoreButton, { borderColor: tintColor }]}
              onPress={handleLoadMore}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={tintColor} />
              ) : (
                <ThemedText style={[styles.loadMoreText, { color: tintColor }]}>
                  Load More Games
                </ThemedText>
              )}
            </TouchableOpacity>
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
  summarySection: {
    margin: 16,
    borderRadius: 12,
    padding: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryStatItem: {
    alignItems: 'center',
  },
  summaryStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryStatLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  filterSection: {
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterButtonTextActive: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  historySection: {
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
  gameCard: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  gameHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gameInfo: {
    flex: 1,
  },
  opponentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  opponentName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  resultText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  gameDate: {
    fontSize: 12,
    opacity: 0.7,
  },
  gameDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  gameDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gameDetailText: {
    fontSize: 12,
    opacity: 0.8,
  },
  winMethodContainer: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  winMethodText: {
    fontSize: 12,
    opacity: 0.7,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
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
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 12,
  },
  loadMoreSection: {
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  loadMoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderRadius: 8,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
});