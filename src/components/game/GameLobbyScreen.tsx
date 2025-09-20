/**
 * Game Lobby Screen Component
 * Cockroach Poker lobby where 2 players wait before game starts
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/use-auth';
import { gameService } from '@/services/gameService';
import { PlayerList } from './PlayerList';
import type { GameWithParticipants, LobbyPlayer } from '@/types/database';

interface GameLobbyScreenProps {
  gameId: string;
  onGameStarted?: () => void;
  onGameLeft?: () => void;
}

export function GameLobbyScreen({ gameId, onGameStarted, onGameLeft }: GameLobbyScreenProps) {
  const { authState } = useAuth();
  const [game, setGame] = useState<GameWithParticipants | null>(null);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [canStartGame, setCanStartGame] = useState(false);
  const [isUpdatingReady, setIsUpdatingReady] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [isLeavingGame, setIsLeavingGame] = useState(false);

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  const loadGameData = useCallback(async () => {
    try {
      const [gameResult, playersResult, canStartResult] = await Promise.all([
        gameService.getGameWithParticipants(gameId),
        gameService.getLobbyPlayers(gameId),
        gameService.canStartGame(gameId),
      ]);

      if (gameResult.success && gameResult.data) {
        setGame(gameResult.data);
      }

      if (playersResult.success && playersResult.data) {
        setLobbyPlayers(playersResult.data);

        // Find current user's ready status
        const currentPlayer = playersResult.data.find(p => p.id === authState.user?.id);
        if (currentPlayer) {
          setIsReady(currentPlayer.isReady);
        }
      }

      setCanStartGame(canStartResult);
    } catch (error) {
      console.error('Load game data error:', error);
      Alert.alert('Error', 'Failed to load game data');
    } finally {
      setIsLoading(false);
    }
  }, [gameId, authState.user?.id]);

  const handleReadyToggle = async (newReadyState: boolean) => {
    setIsUpdatingReady(true);

    try {
      const result = await gameService.updateReadyStatus(gameId, newReadyState);

      if (result.success) {
        setIsReady(newReadyState);
        // Reload players to get updated status
        const playersResult = await gameService.getLobbyPlayers(gameId);
        if (playersResult.success && playersResult.data) {
          setLobbyPlayers(playersResult.data);
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to update ready status');
      }
    } catch (error) {
      console.error('Ready toggle error:', error);
      Alert.alert('Error', 'Failed to update ready status');
    } finally {
      setIsUpdatingReady(false);
    }
  };

  const handleStartGame = async () => {
    if (!canStartGame) {
      Alert.alert('Cannot Start', 'You are not the game creator');
      return;
    }

    const allReady = lobbyPlayers.every(p => p.isReady);
    if (!allReady) {
      Alert.alert('Cannot Start', 'All players must be ready before starting the game');
      return;
    }

    if (lobbyPlayers.length < 2) {
      Alert.alert('Cannot Start', 'At least 2 players are required to start the game');
      return;
    }

    setIsStartingGame(true);

    try {
      const result = await gameService.startGame(gameId);

      if (result.success) {
        Alert.alert(
          'Game Started!',
          'The Cockroach Poker game has begun. May the best bluffer win!',
          [
            {
              text: 'Continue',
              onPress: () => {
                if (onGameStarted) {
                  onGameStarted();
                } else {
                  router.push(`/game/cockroach-poker/${gameId}`);
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Start Failed', result.error || 'Failed to start game');
      }
    } catch (error) {
      console.error('Start game error:', error);
      Alert.alert('Error', 'Failed to start game');
    } finally {
      setIsStartingGame(false);
    }
  };

  const handleLeaveGame = () => {
    Alert.alert(
      'Leave Game',
      'Are you sure you want to leave this game?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: confirmLeaveGame,
        },
      ]
    );
  };

  const confirmLeaveGame = async () => {
    setIsLeavingGame(true);

    try {
      const result = await gameService.leaveGame(gameId);

      if (result.success) {
        if (onGameLeft) {
          onGameLeft();
        } else {
          router.back();
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to leave game');
      }
    } catch (error) {
      console.error('Leave game error:', error);
      Alert.alert('Error', 'Failed to leave game');
    } finally {
      setIsLeavingGame(false);
    }
  };

  const getCockroachPokerInfo = () => {
    return [
      'Players: 2',
      'Cards: 24 creature cards (4 types × 6 cards)',
      'Goal: Avoid getting 3 of the same creature type',
      'Game Type: Bluffing and deduction',
    ];
  };

  useEffect(() => {
    loadGameData();

    // Set up periodic refresh for real-time updates
    const interval = setInterval(loadGameData, 5000);

    return () => clearInterval(interval);
  }, [loadGameData]);

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={tintColor} />
        <ThemedText style={styles.loadingText}>Loading lobby...</ThemedText>
      </ThemedView>
    );
  }

  if (!game) {
    return (
      <ThemedView style={styles.errorContainer}>
        <ThemedText style={styles.errorText}>Game not found</ThemedText>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: tintColor }]}
          onPress={() => router.back()}
        >
          <ThemedText style={styles.backButtonText}>Go Back</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const allPlayersReady = lobbyPlayers.length === 2 && lobbyPlayers.every(p => p.isReady);
  const canStart = canStartGame && allPlayersReady;

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Cockroach Poker Lobby
          </ThemedText>
          <View style={styles.gameStatus}>
            <View style={[styles.statusIndicator, { backgroundColor: '#f39c12' }]} />
            <ThemedText style={styles.statusText}>Waiting for {2 - lobbyPlayers.length} more player{2 - lobbyPlayers.length !== 1 ? 's' : ''}</ThemedText>
          </View>
        </View>

        {/* Game Information */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Game Information
          </ThemedText>
          <View style={styles.settingsContainer}>
            {getCockroachPokerInfo().map((info, index) => (
              <View key={index} style={styles.settingItem}>
                <ThemedText style={styles.settingText}>{info}</ThemedText>
              </View>
            ))}
          </View>

          {/* Creature Types Display */}
          <View style={styles.creaturesContainer}>
            <ThemedText style={styles.creaturesTitle}>Creature Types:</ThemedText>
            <View style={styles.creaturesList}>
              {['🪳 Cockroach', '🐭 Mouse', '🦇 Bat', '🐸 Frog'].map((creature, index) => (
                <View key={index} style={[styles.creatureTag, { backgroundColor: tintColor }]}>
                  <ThemedText style={styles.creatureTagText}>{creature}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Player List */}
        <PlayerList
          players={lobbyPlayers}
          currentUserId={authState.user?.id}
          showReadyStatus={true}
        />

        {/* Ready Status Toggle */}
        <View style={styles.section}>
          <View style={styles.readyToggleContainer}>
            <ThemedText style={styles.readyToggleLabel}>
              Ready to Play
            </ThemedText>
            <Switch
              value={isReady}
              onValueChange={handleReadyToggle}
              trackColor={{ false: iconColor, true: tintColor }}
              disabled={isUpdatingReady}
            />
          </View>
          {isReady ? (
            <ThemedText style={[styles.readyStatusText, { color: '#27ae60' }]}>
              You are ready to play!
            </ThemedText>
          ) : (
            <ThemedText style={[styles.readyStatusText, { color: '#e74c3c' }]}>
              Toggle ready when you're prepared to start
            </ThemedText>
          )}
        </View>

        {/* Game Rules */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Cockroach Poker Rules
          </ThemedText>
          <View style={styles.rulesContainer}>
            <ThemedText style={styles.ruleText}>
              • Each player starts with 12 cards
            </ThemedText>
            <ThemedText style={styles.ruleText}>
              • Pass a card face-down and claim what it is
            </ThemedText>
            <ThemedText style={styles.ruleText}>
              • Opponent can call 'truth', 'lie', or pass it back
            </ThemedText>
            <ThemedText style={styles.ruleText}>
              • Wrong guesses go to your penalty pile
            </ThemedText>
            <ThemedText style={styles.ruleText}>
              • Lose if you get 3 of the same creature type!
            </ThemedText>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        {canStartGame && (
          <TouchableOpacity
            style={[
              styles.startButton,
              {
                backgroundColor: canStart ? tintColor : iconColor,
                opacity: canStart ? 1 : 0.6,
              }
            ]}
            onPress={handleStartGame}
            disabled={!canStart || isStartingGame}
          >
            {isStartingGame ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <ThemedText style={styles.startButtonText}>
                Start Game
              </ThemedText>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.leaveButton, { borderColor: '#e74c3c' }]}
          onPress={handleLeaveGame}
          disabled={isLeavingGame}
        >
          {isLeavingGame ? (
            <ActivityIndicator color="#e74c3c" size="small" />
          ) : (
            <ThemedText style={[styles.leaveButtonText, { color: '#e74c3c' }]}>
              Leave Game
            </ThemedText>
          )}
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    marginBottom: 24,
    textAlign: 'center',
  },
  backButton: {
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    marginBottom: 12,
    textAlign: 'center',
  },
  gameStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  settingsContainer: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  settingItem: {
    marginBottom: 4,
  },
  settingText: {
    fontSize: 16,
  },
  creaturesContainer: {
    marginTop: 12,
  },
  creaturesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  creaturesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  creatureTag: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  creatureTagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  readyToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  readyToggleLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  readyStatusText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  rulesContainer: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    padding: 16,
  },
  ruleText: {
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 20,
  },
  actionContainer: {
    padding: 24,
    gap: 12,
  },
  startButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  leaveButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  leaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});