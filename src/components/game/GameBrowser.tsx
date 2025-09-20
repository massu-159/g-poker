/**
 * Game Browser Component
 * Displays list of available games with join functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { gameService } from '@/services/gameService';
import type { Game, GameStatus, GameSettings } from '@/types/database';

interface GameBrowserProps {
  onGameJoined?: (gameId: string) => void;
  onCreateGame?: () => void;
}

interface GameListItem extends Game {
  canJoin: boolean;
  isFull: boolean;
}

export function GameBrowser({ onGameJoined, onCreateGame }: GameBrowserProps) {
  const [games, setGames] = useState<GameListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<GameStatus[]>(['waiting']);
  const [searchText, setSearchText] = useState('');
  const [joiningGameId, setJoiningGameId] = useState<string | null>(null);

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  const loadGames = useCallback(async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) {
      setIsLoading(true);
    }

    try {
      const result = await gameService.getGamesList({
        status: filterStatus,
        hasSpace: true,
        limit: 50,
      });

      if (result.success && result.data) {
        const gameListItems: GameListItem[] = result.data.map(game => ({
          ...game,
          canJoin: game.status === 'waiting' && game.current_players < game.max_players,
          isFull: game.current_players >= game.max_players,
        }));

        setGames(gameListItems);
      } else {
        Alert.alert('Error', result.error || 'Failed to load games');
      }
    } catch (error) {
      console.error('Load games error:', error);
      Alert.alert('Error', 'Failed to load games');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [filterStatus]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadGames(false);
  }, [loadGames]);

  const handleJoinGame = async (gameId: string) => {
    setJoiningGameId(gameId);

    try {
      const result = await gameService.joinGame({
        gameId,
        playerId: '', // Will be resolved by the service
      });

      if (result.success) {
        Alert.alert(
          'Joined Game!',
          'You have successfully joined the game.',
          [
            {
              text: 'Go to Lobby',
              onPress: () => {
                if (onGameJoined) {
                  onGameJoined(gameId);
                } else {
                  router.push(`/game/lobby/${gameId}`);
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Join Failed', result.error || 'Failed to join game');
      }
    } catch (error) {
      console.error('Join game error:', error);
      Alert.alert('Error', 'Failed to join game');
    } finally {
      setJoiningGameId(null);
    }
  };

  const getStatusColor = (status: GameStatus) => {
    switch (status) {
      case 'waiting':
        return '#27ae60'; // Green
      case 'in_progress':
        return '#f39c12'; // Orange
      case 'completed':
        return '#95a5a6'; // Gray
      case 'cancelled':
        return '#e74c3c'; // Red
      default:
        return iconColor;
    }
  };

  const getStatusText = (status: GameStatus) => {
    switch (status) {
      case 'waiting':
        return 'Waiting for Players';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const formatGameSettings = (settings: GameSettings) => {
    return `${settings.smallBlind}/${settings.bigBlind} - Buy-in: ${settings.buyIn}`;
  };

  const filteredGames = games.filter(game => {
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      const settings = game.game_settings as GameSettings;
      const settingsText = formatGameSettings(settings).toLowerCase();
      const statusText = getStatusText(game.status as GameStatus).toLowerCase();

      return settingsText.includes(searchLower) || statusText.includes(searchLower);
    }
    return true;
  });

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const renderGameItem = ({ item }: { item: GameListItem }) => {
    const settings = item.game_settings as GameSettings;
    const isJoining = joiningGameId === item.id;

    return (
      <TouchableOpacity
        style={[styles.gameItem, { borderColor: iconColor }]}
        onPress={() => item.canJoin ? handleJoinGame(item.id) : undefined}
        disabled={!item.canJoin || isJoining}
      >
        <View style={styles.gameHeader}>
          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: getStatusColor(item.status as GameStatus) }
              ]}
            />
            <ThemedText style={styles.statusText}>
              {getStatusText(item.status as GameStatus)}
            </ThemedText>
          </View>

          <View style={styles.playersContainer}>
            <ThemedText style={styles.playersText}>
              {item.current_players}/{item.max_players} players
            </ThemedText>
            {item.isFull && (
              <ThemedText style={[styles.fullText, { color: '#e74c3c' }]}>
                FULL
              </ThemedText>
            )}
          </View>
        </View>

        <View style={styles.gameDetails}>
          <ThemedText style={styles.settingsText}>
            {formatGameSettings(settings)}
          </ThemedText>

          {settings.timeLimit && (
            <ThemedText style={styles.timeLimitText}>
              {settings.timeLimit}s per action
            </ThemedText>
          )}

          <View style={styles.gameOptionsContainer}>
            {settings.enableChat && (
              <View style={[styles.optionTag, { backgroundColor: tintColor }]}>
                <ThemedText style={styles.optionTagText}>Chat</ThemedText>
              </View>
            )}
            {settings.isPrivate && (
              <View style={[styles.optionTag, { backgroundColor: '#e74c3c' }]}>
                <ThemedText style={styles.optionTagText}>Private</ThemedText>
              </View>
            )}
            {settings.allowSpectators && (
              <View style={[styles.optionTag, { backgroundColor: '#95a5a6' }]}>
                <ThemedText style={styles.optionTagText}>Spectators</ThemedText>
              </View>
            )}
          </View>
        </View>

        <View style={styles.gameActions}>
          <ThemedText style={styles.createdText}>
            Created {new Date(item.created_at).toLocaleDateString()}
          </ThemedText>

          {item.canJoin && (
            <TouchableOpacity
              style={[styles.joinButton, { backgroundColor: tintColor }]}
              onPress={() => handleJoinGame(item.id)}
              disabled={isJoining}
            >
              {isJoining ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <ThemedText style={styles.joinButtonText}>
                  Join Game
                </ThemedText>
              )}
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <ThemedText style={styles.emptyTitle}>No Games Available</ThemedText>
      <ThemedText style={styles.emptySubtitle}>
        Be the first to create a new poker game!
      </ThemedText>
      {onCreateGame && (
        <TouchableOpacity
          style={[styles.createGameButton, { backgroundColor: tintColor }]}
          onPress={onCreateGame}
        >
          <ThemedText style={styles.createGameButtonText}>
            Create New Game
          </ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Search Bar */}
      <TextInput
        style={[
          styles.searchInput,
          { borderColor: iconColor, color: textColor }
        ]}
        value={searchText}
        onChangeText={setSearchText}
        placeholder="Search games..."
        placeholderTextColor={iconColor}
      />

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {(['waiting', 'in_progress'] as GameStatus[]).map(status => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterButton,
              {
                backgroundColor: filterStatus.includes(status) ? tintColor : 'transparent',
                borderColor: tintColor,
              }
            ]}
            onPress={() => {
              setFilterStatus(prev =>
                prev.includes(status)
                  ? prev.filter(s => s !== status)
                  : [...prev, status]
              );
            }}
          >
            <ThemedText
              style={[
                styles.filterButtonText,
                {
                  color: filterStatus.includes(status) ? '#fff' : tintColor,
                }
              ]}
            >
              {getStatusText(status)}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {/* Create Game Button */}
      {onCreateGame && (
        <TouchableOpacity
          style={[styles.headerCreateButton, { backgroundColor: tintColor }]}
          onPress={onCreateGame}
        >
          <ThemedText style={styles.headerCreateButtonText}>
            Create Game
          </ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={filteredGames}
        renderItem={renderGameItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={tintColor}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          filteredGames.length === 0 && styles.emptyListContent
        ]}
        showsVerticalScrollIndicator={false}
      />

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tintColor} />
          <ThemedText style={styles.loadingText}>Loading games...</ThemedText>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  header: {
    marginBottom: 24,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerCreateButton: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  headerCreateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  gameItem: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  playersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playersText: {
    fontSize: 14,
    fontWeight: '500',
  },
  fullText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  gameDetails: {
    marginBottom: 12,
  },
  settingsText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  timeLimitText: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 8,
  },
  gameOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  optionTag: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  optionTagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  gameActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  createdText: {
    fontSize: 12,
    opacity: 0.6,
  },
  joinButton: {
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    opacity: 0.8,
    marginBottom: 24,
    textAlign: 'center',
  },
  createGameButton: {
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  createGameButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
});