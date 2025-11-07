/**
 * Game Waiting Room Component
 * Players wait here before game starts (server-authoritative architecture)
 * Uses ApiClient for REST operations and SocketClient for real-time updates
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
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/src/hooks/useAuth';
import { apiClient, Room, RoomParticipant } from '@/src/services/ApiClient';
import { socketClient } from '@/src/services/SocketClient';
import { PlayerList } from './PlayerList';

interface GameWaitingRoomProps {
  roomId: string;
  onGameStarted?: () => void;
  onRoomLeft?: () => void;
}

interface LobbyPlayer {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  isReady: boolean;
  isCreator: boolean;
}

export function GameWaitingRoom({ roomId, onGameStarted, onRoomLeft }: GameWaitingRoomProps) {
  const { authState } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [isUpdatingReady, setIsUpdatingReady] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [isLeavingRoom, setIsLeavingRoom] = useState(false);

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  /**
   * Load room data from API
   */
  const loadRoomData = useCallback(async () => {
    try {
      console.log('[GameWaitingRoom] Loading room data:', roomId);

      const [roomResponse, participantsResponse] = await Promise.all([
        apiClient.getRoomDetails(roomId),
        apiClient.getRoomParticipants(roomId),
      ]);

      if (roomResponse.success && roomResponse.data) {
        setRoom(roomResponse.data);
        console.log('[GameWaitingRoom] Room loaded:', roomResponse.data);
      } else {
        console.error('[GameWaitingRoom] Failed to load room:', roomResponse.error);
        Alert.alert('Error', roomResponse.error || 'Failed to load room');
        router.back();
        return;
      }

      if (participantsResponse.success && participantsResponse.data) {
        setParticipants(participantsResponse.data);

        // Convert to lobby players format
        const players: LobbyPlayer[] = participantsResponse.data.map(p => ({
          id: p.userId,
          displayName: p.displayName || p.userId.slice(0, 8),
          avatarUrl: null,
          isReady: p.isReady,
          isCreator: p.isCreator,
        }));

        setLobbyPlayers(players);

        // Find current user's ready status
        const currentParticipant = participantsResponse.data.find(
          p => p.userId === authState.user?.id
        );
        if (currentParticipant) {
          setIsReady(currentParticipant.isReady);
        }
      }
    } catch (error) {
      console.error('[GameWaitingRoom] Load room error:', error);
      Alert.alert('Error', 'Failed to load room data');
    } finally {
      setIsLoading(false);
    }
  }, [roomId, authState.user?.id]);

  /**
   * Handle ready toggle
   */
  const handleReadyToggle = async (newReadyState: boolean) => {
    setIsUpdatingReady(true);

    try {
      const response = await apiClient.updateReadyStatus(roomId, newReadyState);

      if (response.success) {
        setIsReady(newReadyState);

        // Emit ready status via Socket.io for instant feedback
        if (socketClient.isConnected()) {
          socketClient.updateReadyStatus(roomId, newReadyState);
        }
      } else {
        Alert.alert('Error', response.error || 'Failed to update ready status');
      }
    } catch (error) {
      console.error('[GameWaitingRoom] Ready toggle error:', error);
      Alert.alert('Error', 'Failed to update ready status');
    } finally {
      setIsUpdatingReady(false);
    }
  };

  /**
   * Handle start game (creator only)
   */
  const handleStartGame = async () => {
    const currentParticipant = participants.find(p => p.userId === authState.user?.id);
    if (!currentParticipant?.isCreator) {
      Alert.alert('Cannot Start', 'Only the room creator can start the game');
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
      const response = await apiClient.startGame(roomId);

      if (response.success) {
        console.log('[GameWaitingRoom] Game started successfully');

        // Game started event will be received via Socket.io
        // Will handle navigation in the event listener
      } else {
        Alert.alert('Start Failed', response.error || 'Failed to start game');
      }
    } catch (error) {
      console.error('[GameWaitingRoom] Start game error:', error);
      Alert.alert('Error', 'Failed to start game');
    } finally {
      setIsStartingGame(false);
    }
  };

  /**
   * Handle leave room
   */
  const handleLeaveRoom = () => {
    Alert.alert(
      'Leave Room',
      'Are you sure you want to leave this room?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: confirmLeaveRoom,
        },
      ]
    );
  };

  const confirmLeaveRoom = async () => {
    setIsLeavingRoom(true);

    try {
      const response = await apiClient.leaveRoom(roomId);

      if (response.success) {
        // Leave via Socket.io as well
        if (socketClient.isConnected()) {
          socketClient.leaveRoom(roomId);
        }

        if (onRoomLeft) {
          onRoomLeft();
        } else {
          router.back();
        }
      } else {
        Alert.alert('Error', response.error || 'Failed to leave room');
      }
    } catch (error) {
      console.error('[GameWaitingRoom] Leave room error:', error);
      Alert.alert('Error', 'Failed to leave room');
    } finally {
      setIsLeavingRoom(false);
    }
  };

  /**
   * Setup Socket.io event listeners for real-time updates
   */
  useEffect(() => {
    // Participant joined
    const unsubscribeParticipantJoined = socketClient.on('participant_joined', (data) => {
      console.log('[GameWaitingRoom] Participant joined:', data);
      if (data.room_id === roomId) {
        loadRoomData(); // Refresh room data
      }
    });

    // Participant left
    const unsubscribeParticipantLeft = socketClient.on('participant_left', (data) => {
      console.log('[GameWaitingRoom] Participant left:', data);
      if (data.room_id === roomId) {
        loadRoomData(); // Refresh room data
      }
    });

    // Participant ready changed
    const unsubscribeReadyChanged = socketClient.on('participant_ready_changed', (data) => {
      console.log('[GameWaitingRoom] Participant ready changed:', data);
      if (data.room_id === roomId) {
        loadRoomData(); // Refresh room data
      }
    });

    // Game started
    const unsubscribeGameStarted = socketClient.on('game_started', (data) => {
      console.log('[GameWaitingRoom] Game started:', data);
      if (data.room_id === roomId) {
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
                  router.push(`/game/play/${roomId}`);
                }
              },
            },
          ]
        );
      }
    });

    return () => {
      unsubscribeParticipantJoined();
      unsubscribeParticipantLeft();
      unsubscribeReadyChanged();
      unsubscribeGameStarted();
    };
  }, [roomId, loadRoomData, onGameStarted]);

  /**
   * Load room data on mount
   */
  useEffect(() => {
    loadRoomData();
  }, [loadRoomData]);

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={tintColor} />
        <ThemedText style={styles.loadingText}>Loading room...</ThemedText>
      </ThemedView>
    );
  }

  if (!room) {
    return (
      <ThemedView style={styles.errorContainer}>
        <ThemedText style={styles.errorText}>Room not found</ThemedText>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: tintColor }]}
          onPress={() => router.back()}
        >
          <ThemedText style={styles.backButtonText}>Go Back</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const currentParticipant = participants.find(p => p.userId === authState.user?.id);
  const isCreator = currentParticipant?.isCreator || false;
  const allPlayersReady = lobbyPlayers.length >= 2 && lobbyPlayers.every(p => p.isReady);
  const canStart = isCreator && allPlayersReady;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Cockroach Poker Room
            </ThemedText>
            <View style={styles.roomStatus}>
              <View style={[styles.statusIndicator, { backgroundColor: '#f39c12' }]} />
              <ThemedText style={styles.statusText}>
                Waiting for {room.maxPlayers - room.currentPlayerCount} more player
                {room.maxPlayers - room.currentPlayerCount !== 1 ? 's' : ''}
              </ThemedText>
            </View>
          </View>

          {/* Game Information */}
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Game Information
            </ThemedText>
            <View style={styles.settingsContainer}>
              <View style={styles.settingItem}>
                <ThemedText style={styles.settingText}>
                  Players: {room.currentPlayerCount} / {room.maxPlayers}
                </ThemedText>
              </View>
              <View style={styles.settingItem}>
                <ThemedText style={styles.settingText}>
                  Time Limit: {room.settings.timeLimitSeconds}s per turn
                </ThemedText>
              </View>
              <View style={styles.settingItem}>
                <ThemedText style={styles.settingText}>
                  Cards: 24 creature cards (4 types × 6 cards)
                </ThemedText>
              </View>
              <View style={styles.settingItem}>
                <ThemedText style={styles.settingText}>
                  Game Type: Bluffing and deduction
                </ThemedText>
              </View>
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
                • Each player starts with cards from the deck
              </ThemedText>
              <ThemedText style={styles.ruleText}>
                • Pass a card face-down and claim what creature it is
              </ThemedText>
              <ThemedText style={styles.ruleText}>
                • Opponent can call 'truth', 'lie', or pass it back
              </ThemedText>
              <ThemedText style={styles.ruleText}>
                • Wrong guesses go to your penalty pile
              </ThemedText>
              <ThemedText style={styles.ruleText}>
                • Lose if you collect 4 of the same creature type!
              </ThemedText>
            </View>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {isCreator && (
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
            onPress={handleLeaveRoom}
            disabled={isLeavingRoom}
          >
            {isLeavingRoom ? (
              <ActivityIndicator color="#e74c3c" size="small" />
            ) : (
              <ThemedText style={[styles.leaveButtonText, { color: '#e74c3c' }]}>
                Leave Room
              </ThemedText>
            )}
          </TouchableOpacity>
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
  roomStatus: {
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
