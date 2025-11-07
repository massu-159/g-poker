/**
 * Game Play Screen Component
 * Real-time Cockroach Poker gameplay with Socket.io
 * Server-authoritative architecture - all game logic on backend
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/src/hooks/useAuth';
import { socketClient } from '@/src/services/SocketClient';
import { Card } from './Card';
import { PlayerArea } from './PlayerArea';
import { PenaltyPileDisplay } from './PenaltyPileDisplay';
import { ActionButtonArea } from './ActionButtonArea';
import type { Card as CardType, CreatureType, PenaltyPile } from '@/types/cards';

interface GamePlayScreenProps {
  gameId: string;
}

interface PlayerHand {
  cards: CardType[];
  penaltyPile: PenaltyPile;
}

interface GameState {
  roomId: string | null;
  currentPlayer: string | null;
  player1: PlayerHand | null;
  player2: PlayerHand | null;
  claimedCard: CardType | null;
  currentClaim: CreatureType | null;
  isLoading: boolean;
  myPlayerId: string | null;
  gamePhase: 'waiting' | 'playing' | 'guessing' | 'round-end' | 'game-end';
  selectedCardId: string | null;
  actionTimer: number;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
}

export function GamePlayScreen({ gameId }: GamePlayScreenProps) {
  const { authState } = useAuth();
  const [gameState, setGameState] = useState<GameState>({
    roomId: gameId,
    currentPlayer: null,
    player1: null,
    player2: null,
    claimedCard: null,
    currentClaim: null,
    isLoading: true,
    myPlayerId: authState.user?.id || null,
    gamePhase: 'waiting',
    selectedCardId: null,
    actionTimer: 30,
    connectionStatus: socketClient.isConnected() ? 'connected' : 'disconnected',
  });

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  // Screen dimensions for responsive design
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const isLandscape = screenWidth > screenHeight;

  /**
   * Handle card selection from hand
   */
  const handleCardSelection = useCallback((cardId: string) => {
    setGameState(prev => {
      if (!isMyTurn || prev.gamePhase !== 'playing') return prev;

      return {
        ...prev,
        selectedCardId: prev.selectedCardId === cardId ? null : cardId,
      };
    });
  }, []);

  /**
   * Handle game actions via Socket.io
   */
  const handleGameAction = useCallback(async (action: string, data?: any) => {
    console.log('[GamePlayScreen] Game action:', action, data);

    try {
      switch (action) {
        case 'claim':
          if (data.cardId && data.creatureType) {
            const validCreatureTypes = ['cockroach', 'mouse', 'bat', 'frog'];
            if (!validCreatureTypes.includes(data.creatureType)) {
              Alert.alert('Error', 'Invalid creature type selected');
              return;
            }

            // Get opponent's player ID
            const opponentPlayerId = gameState.player1?.cards[0]?.id === data.cardId
              ? gameState.player2?.cards[0]?.id
              : gameState.player1?.cards[0]?.id;

            // Emit claim_card event via Socket.io
            socketClient.claimCard(gameId, data.creatureType, opponentPlayerId || '');

            setGameState(prev => ({
              ...prev,
              selectedCardId: null,
              gamePhase: 'guessing',
              actionTimer: 30,
            }));
          }
          break;

        case 'guess':
          // Emit respond_to_claim event
          socketClient.respondToClaim(gameId, data.isTrue ? 'truth' : 'lie');

          setGameState(prev => ({
            ...prev,
            gamePhase: 'playing',
            actionTimer: 30,
          }));
          break;

        case 'pass':
          // Emit pass_card event
          socketClient.passCard(gameId);

          setGameState(prev => ({
            ...prev,
            actionTimer: 30,
          }));
          break;

        default:
          console.warn('[GamePlayScreen] Unknown game action:', action);
      }
    } catch (error) {
      console.error('[GamePlayScreen] Game action error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  }, [gameId, gameState]);

  /**
   * Setup Socket.io event listeners for game events
   */
  useEffect(() => {
    console.log('[GamePlayScreen] Setting up Socket.io listeners for game:', gameId);

    // Card claimed event
    const unsubscribeCardClaimed = socketClient.on('card_claimed', (data) => {
      console.log('[GamePlayScreen] Card claimed:', data);
      if (data.room_id === gameId) {
        setGameState(prev => ({
          ...prev,
          claimedCard: data.card,
          currentClaim: data.claimed_creature as CreatureType,
          currentPlayer: data.target_player_id,
          gamePhase: 'guessing',
          actionTimer: 30,
        }));
      }
    });

    // Claim responded event
    const unsubscribeClaimResponded = socketClient.on('claim_responded', (data) => {
      console.log('[GamePlayScreen] Claim responded:', data);
      if (data.room_id === gameId) {
        setGameState(prev => ({
          ...prev,
          claimedCard: null,
          currentClaim: null,
          gamePhase: 'playing',
          actionTimer: 30,
        }));
      }
    });

    // Card passed event
    const unsubscribeCardPassed = socketClient.on('card_passed', (data) => {
      console.log('[GamePlayScreen] Card passed:', data);
      if (data.room_id === gameId) {
        setGameState(prev => ({
          ...prev,
          currentPlayer: data.new_target_player_id,
          actionTimer: 30,
        }));
      }
    });

    // Game state update
    const unsubscribeGameStateUpdate = socketClient.on('game_state_update', (data) => {
      console.log('[GamePlayScreen] Game state update:', data);
      if (data.room_id === gameId) {
        // Update player hands and penalty piles
        const player1: PlayerHand = {
          cards: data.player1_hand || [],
          penaltyPile: data.player1_penalty_pile || {
            cockroach: [],
            mouse: [],
            bat: [],
            frog: [],
          },
        };

        const player2: PlayerHand = {
          cards: data.player2_hand || [],
          penaltyPile: data.player2_penalty_pile || {
            cockroach: [],
            mouse: [],
            bat: [],
            frog: [],
          },
        };

        setGameState(prev => ({
          ...prev,
          player1,
          player2,
          currentPlayer: data.current_player_id,
          isLoading: false,
        }));
      }
    });

    // Round completed event
    const unsubscribeRoundCompleted = socketClient.on('round_completed', (data) => {
      console.log('[GamePlayScreen] Round completed:', data);
      if (data.room_id === gameId) {
        const message = data.penalty_to_player_id === gameState.myPlayerId
          ? 'You received a penalty card!'
          : 'Your opponent received a penalty card!';

        Alert.alert('Round Over', message);

        setGameState(prev => ({
          ...prev,
          claimedCard: null,
          currentClaim: null,
          gamePhase: 'playing',
          actionTimer: 30,
        }));
      }
    });

    // Game ended event
    const unsubscribeGameEnded = socketClient.on('game_ended', (data) => {
      console.log('[GamePlayScreen] Game ended:', data);
      if (data.room_id === gameId) {
        const isWinner = data.winner_id === gameState.myPlayerId;
        const resultMessage = isWinner
          ? '🎉 Congratulations! You won!'
          : '😔 You lost this round. Better luck next time!';

        setGameState(prev => ({
          ...prev,
          gamePhase: 'game-end',
        }));

        Alert.alert(
          'Game Over!',
          resultMessage,
          [
            { text: 'Play Again', onPress: () => router.replace('/lobby') },
            { text: 'Back to Lobby', onPress: () => router.back() }
          ]
        );
      }
    });

    // Socket connection status changes
    const unsubscribeConnected = socketClient.on('connect', () => {
      console.log('[GamePlayScreen] Socket connected');
      setGameState(prev => ({ ...prev, connectionStatus: 'connected' }));
    });

    const unsubscribeDisconnected = socketClient.on('disconnect', () => {
      console.log('[GamePlayScreen] Socket disconnected');
      setGameState(prev => ({ ...prev, connectionStatus: 'disconnected' }));
    });

    const unsubscribeReconnecting = socketClient.on('reconnecting', () => {
      console.log('[GamePlayScreen] Socket reconnecting');
      setGameState(prev => ({ ...prev, connectionStatus: 'reconnecting' }));
    });

    return () => {
      unsubscribeCardClaimed();
      unsubscribeClaimResponded();
      unsubscribeCardPassed();
      unsubscribeGameStateUpdate();
      unsubscribeRoundCompleted();
      unsubscribeGameEnded();
      unsubscribeConnected();
      unsubscribeDisconnected();
      unsubscribeReconnecting();
    };
  }, [gameId, gameState.myPlayerId]);

  /**
   * Action timer countdown
   */
  useEffect(() => {
    if (gameState.actionTimer > 0 && isMyTurn && gameState.gamePhase !== 'waiting') {
      const timer = setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          actionTimer: prev.actionTimer - 1
        }));
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [gameState.actionTimer, gameState.gamePhase]);

  /**
   * Handle leave game
   */
  const handleLeaveGame = useCallback(() => {
    Alert.alert(
      'Leave Game',
      'Are you sure you want to leave this game?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => {
          socketClient.leaveRoom(gameId);
          router.back();
        }},
      ]
    );
  }, [gameId]);

  /**
   * Handle reconnect
   */
  const handleReconnect = useCallback(async () => {
    console.log('[GamePlayScreen] Manual reconnect triggered');
    await socketClient.connect();
  }, []);

  if (gameState.isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tintColor} />
          <ThemedText style={styles.loadingText}>Loading game...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const isMyTurn = gameState.currentPlayer === gameState.myPlayerId;
  const player1IsMe = gameState.myPlayerId === gameState.player1?.cards[0]?.id;

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.container}>

        {/* Header with game info */}
        <View style={[styles.header, { borderBottomColor: iconColor }]}>
          <View style={styles.headerLeft}>
            <ThemedText type="subtitle" style={styles.gameTitle}>
              🪳🐭🦇🐸 Cockroach Poker
            </ThemedText>
            <View style={styles.statusRow}>
              <ThemedText style={styles.gameStatus}>
                {isMyTurn ? 'Your Turn' : `Opponent's Turn`}
              </ThemedText>
              {/* Connection status indicator */}
              {gameState.connectionStatus !== 'connected' && (
                <View style={[
                  styles.connectionStatusBadge,
                  {
                    backgroundColor: gameState.connectionStatus === 'reconnecting' ? '#f39c12' : '#e74c3c'
                  }
                ]}>
                  <ThemedText style={styles.connectionStatusText}>
                    {gameState.connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Disconnected'}
                  </ThemedText>
                </View>
              )}
            </View>
          </View>

          <View style={styles.headerActions}>
            {/* Reconnect button for disconnected state */}
            {gameState.connectionStatus === 'disconnected' && (
              <TouchableOpacity
                style={[styles.reconnectButton, { backgroundColor: tintColor }]}
                onPress={handleReconnect}
              >
                <ThemedText style={styles.reconnectButtonText}>
                  Reconnect
                </ThemedText>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.leaveButton, { borderColor: iconColor }]}
              onPress={handleLeaveGame}
            >
              <ThemedText style={[styles.leaveButtonText, { color: textColor }]}>
                Leave
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Main game area */}
        <View style={[
          styles.gameArea,
          isLandscape ? styles.gameAreaLandscape : styles.gameAreaPortrait
        ]}>

          {/* Opponent area (top) */}
          <View style={[
            styles.opponentArea,
            isLandscape ? styles.opponentAreaLandscape : styles.opponentAreaPortrait
          ]}>
            <PlayerArea
              playerData={player1IsMe ? gameState.player2 : gameState.player1}
              isOpponent={true}
              isCurrentPlayer={!isMyTurn}
              position="top"
              screenWidth={screenWidth}
              playerInfo={{
                displayName: 'Opponent',
                avatarUrl: null,
                connectionStatus: gameState.connectionStatus,
                latency: 0,
                lastConnected: new Date(),
              }}
              selectedCardId={null}
              onCardSelect={undefined}
              style={styles.playerAreaTop}
            />

            {/* Opponent's penalty pile */}
            <PenaltyPileDisplay
              penaltyPile={player1IsMe ? gameState.player2?.penaltyPile : gameState.player1?.penaltyPile}
              isOpponent={true}
              style={styles.penaltyPileTop}
            />
          </View>

          {/* Center area for card claims */}
          <View style={[
            styles.centerArea,
            isLandscape ? styles.centerAreaLandscape : styles.centerAreaPortrait
          ]}>
            {gameState.claimedCard ? (
              <View style={styles.claimedCardContainer}>
                <ThemedText style={styles.claimLabel}>
                  Claimed: {gameState.currentClaim}
                </ThemedText>
                <Card
                  card={gameState.claimedCard}
                  visibility="face"
                  size="large"
                  style={styles.claimedCard}
                />
              </View>
            ) : (
              <View style={styles.emptyClaimArea}>
                <ThemedText style={[styles.waitingText, { color: iconColor }]}>
                  Waiting for card claim...
                </ThemedText>
              </View>
            )}
          </View>

          {/* Player area (bottom) */}
          <View style={[
            styles.playerArea,
            isLandscape ? styles.playerAreaLandscape : styles.playerAreaPortrait
          ]}>
            <PlayerArea
              playerData={player1IsMe ? gameState.player1 : gameState.player2}
              isOpponent={false}
              isCurrentPlayer={isMyTurn}
              position="bottom"
              screenWidth={screenWidth}
              playerInfo={{
                displayName: 'You',
                avatarUrl: null,
                connectionStatus: gameState.connectionStatus,
                latency: 0,
                lastConnected: new Date(),
              }}
              selectedCardId={gameState.selectedCardId}
              onCardSelect={handleCardSelection}
              style={styles.playerAreaBottom}
            />

            {/* Player's penalty pile */}
            <PenaltyPileDisplay
              penaltyPile={player1IsMe ? gameState.player1?.penaltyPile : gameState.player2?.penaltyPile}
              isOpponent={false}
              style={styles.penaltyPileBottom}
            />
          </View>

        </View>

        {/* Action button area */}
        <View style={[
          styles.actionArea,
          isLandscape ? styles.actionAreaLandscape : styles.actionAreaPortrait
        ]}>
          <ActionButtonArea
            gameState={gameState}
            isMyTurn={isMyTurn}
            onAction={handleGameAction}
            selectedCardId={gameState.selectedCardId}
            actionTimer={gameState.actionTimer}
            style={styles.actionButtons}
          />
        </View>

      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    minHeight: 60,
  },
  headerLeft: {
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  gameTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  gameStatus: {
    fontSize: 14,
    opacity: 0.8,
  },
  connectionStatusBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  connectionStatusText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reconnectButton: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reconnectButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  leaveButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  leaveButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  gameArea: {
    flex: 1,
    padding: 8,
  },
  gameAreaPortrait: {
    flexDirection: 'column',
  },
  gameAreaLandscape: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  opponentArea: {
    alignItems: 'center',
  },
  opponentAreaPortrait: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  opponentAreaLandscape: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  centerArea: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 120,
  },
  centerAreaPortrait: {
    flex: 0,
    marginVertical: 16,
  },
  centerAreaLandscape: {
    flex: 1,
    marginHorizontal: 16,
  },
  claimedCardContainer: {
    alignItems: 'center',
  },
  claimLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  claimedCard: {
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  emptyClaimArea: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  waitingText: {
    fontSize: 16,
    fontStyle: 'italic',
  },
  playerArea: {
    alignItems: 'center',
  },
  playerAreaPortrait: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 8,
  },
  playerAreaLandscape: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  playerAreaTop: {
    marginBottom: 8,
  },
  playerAreaBottom: {
    marginTop: 8,
  },
  penaltyPileTop: {
    marginTop: 8,
  },
  penaltyPileBottom: {
    marginBottom: 8,
  },
  actionArea: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  actionAreaPortrait: {
    minHeight: 80,
  },
  actionAreaLandscape: {
    minHeight: 60,
  },
  actionButtons: {
    flex: 1,
  },
});
