/**
 * Game Play Screen Component
 * 2-Player Cockroach Poker gameplay interface with complete layout
 */

import React, { useState, useEffect } from 'react';
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
import { useGameConnection } from '@/hooks/use-connection';
import { Card } from './Card';
import { PlayerArea } from './PlayerArea';
import { PenaltyPileDisplay } from './PenaltyPileDisplay';
import { ActionButtonArea } from './ActionButtonArea';
import { gameService } from '@/services/gameService';
import { supabase } from '@/services/supabase';
import type { Game, GameParticipant } from '@/types/database';
import type {
  Card as CardType,
  CreatureType,
  RoundState,
  PlayerHand
} from '@/types/cards';

interface GamePlayScreenProps {
  gameId: string;
}

interface GameState {
  game: Game | null;
  participants: GameParticipant[];
  currentPlayer: string | null;
  player1: PlayerHand | null;
  player2: PlayerHand | null;
  claimedCard: CardType | null;
  currentClaim: CreatureType | null;
  roundState: RoundState | null;
  currentRoundId: string | null; // Track current round for game actions
  isLoading: boolean;
  myPlayerId: string | null;
  gamePhase: 'waiting' | 'playing' | 'guessing' | 'round-end' | 'game-end';
  selectedCardId: string | null;
  actionTimer: number; // seconds remaining for current action
}

export function GamePlayScreen({ gameId }: GamePlayScreenProps) {
  const [gameState, setGameState] = useState<GameState>({
    game: null,
    participants: [],
    currentPlayer: null,
    player1: null,
    player2: null,
    claimedCard: null,
    currentClaim: null,
    roundState: null,
    currentRoundId: null,
    isLoading: true,
    myPlayerId: null,
    gamePhase: 'waiting',
    selectedCardId: null,
    actionTimer: 30, // 30 seconds default
  });

  // Connection monitoring
  const { connectionState, registerChannel, unregisterChannel, forceReconnect } = useGameConnection(gameId);

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  // Screen dimensions for responsive design
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const isLandscape = screenWidth > screenHeight;

  // Load game state and setup real-time subscriptions
  useEffect(() => {
    loadGameState();

    // Subscribe to game updates
    const gameSubscription = supabase
      .channel(`game-${gameId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`
      }, (payload) => {
        console.log('🔄 Game update received:', payload);
        loadGameState(); // Reload game state when game changes
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_participants',
        filter: `game_id=eq.${gameId}`
      }, (payload) => {
        console.log('🔄 Participant update received:', payload);
        loadGameState(); // Reload when participant state changes
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_rounds',
        filter: `game_id=eq.${gameId}`
      }, (payload) => {
        console.log('🔄 Round update received:', payload);
        loadGameState(); // Reload when round changes
      })
      .subscribe((status) => {
        console.log('🔗 Game subscription status:', status);
      });

    // Register the channel with connection monitor
    const channelId = `game-${gameId}`;
    registerChannel(channelId, gameSubscription);

    // Cleanup subscription on unmount
    return () => {
      unregisterChannel(channelId);
      gameSubscription.unsubscribe();
    };
  }, [gameId, registerChannel, unregisterChannel]);

  // Action timer countdown
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
  }, [gameState.actionTimer, isMyTurn, gameState.gamePhase]);

  // Handle card selection from hand
  const handleCardSelection = (cardId: string) => {
    if (!isMyTurn || gameState.gamePhase !== 'playing') return;

    setGameState(prev => ({
      ...prev,
      selectedCardId: prev.selectedCardId === cardId ? null : cardId // Toggle selection
    }));
  };

  // Handle game actions
  const handleGameAction = async (action: string, data?: any) => {
    console.log('🎮 Game action:', action, data);

    setGameState(prev => ({ ...prev, isLoading: true }));

    try {
      switch (action) {
        case 'claim':
          if (data.cardId && data.creatureType) {
            console.log(`Player claims ${data.cardId} as ${data.creatureType}`);

            // Validate creature type
            const validCreatureTypes = ['cockroach', 'mouse', 'bat', 'frog'];
            if (!validCreatureTypes.includes(data.creatureType)) {
              Alert.alert('Error', 'Invalid creature type selected');
              break;
            }

            // Validate that it's player's turn
            if (!isMyTurn) {
              Alert.alert('Error', 'It\'s not your turn');
              break;
            }

            // Get target participant (opponent)
            const targetParticipant = gameState.participants.find(p =>
              p.player_id !== gameState.myPlayerId
            );

            if (!targetParticipant) {
              Alert.alert('Error', 'Target player not found');
              break;
            }

            // Verify card is in player's hand
            const myPlayerData = gameState.myPlayerId === gameState.participants.find(p => p.position === 1)?.player_id
              ? gameState.player1
              : gameState.player2;

            if (myPlayerData && !myPlayerData.cards.some(card => card.id === data.cardId)) {
              Alert.alert('Error', 'Card not found in your hand');
              break;
            }

            const claimResult = await gameService.makeCardClaim(
              gameId,
              data.cardId,
              data.creatureType,
              targetParticipant.id // Use participant ID, not player ID
            );

            if (claimResult.success) {
              // Reload game state after claim
              await loadGameState();
              setGameState(prev => ({
                ...prev,
                selectedCardId: null,
                gamePhase: 'guessing',
                actionTimer: 30
              }));
            } else {
              Alert.alert('Error', claimResult.error || 'Failed to make claim');
            }
          }
          break;

        case 'guess':
          if (!gameState.currentRoundId) {
            Alert.alert('Error', 'No active round found');
            break;
          }

          const guessResult = await gameService.respondToCardClaim(
            gameId,
            gameState.currentRoundId,
            data.isTrue ? 'truth' : 'lie'
          );

          if (guessResult.success) {
            if (guessResult.data?.gameEnded) {
              const winnerName = guessResult.data.winner === gameState.myPlayerId ? 'You' : 'Your opponent';
              const resultMessage = guessResult.data.winner === gameState.myPlayerId
                ? '🎉 Congratulations! You won!'
                : '😔 You lost this round. Better luck next time!';

              Alert.alert(
                'Game Over!',
                resultMessage,
                [
                  { text: 'Play Again', onPress: () => router.replace('/lobby') },
                  { text: 'Back to Lobby', onPress: () => router.back() }
                ]
              );
            } else {
              await loadGameState();
              setGameState(prev => ({
                ...prev,
                gamePhase: 'playing',
                actionTimer: 30
              }));
            }
          } else {
            Alert.alert('Error', guessResult.error || 'Failed to make guess');
          }
          break;

        case 'pass':
          if (!gameState.currentRoundId) {
            Alert.alert('Error', 'No active round found');
            break;
          }

          const passResult = await gameService.respondToCardClaim(
            gameId,
            gameState.currentRoundId,
            'pass_back'
          );

          if (passResult.success) {
            await loadGameState();
            setGameState(prev => ({
              ...prev,
              actionTimer: 30
            }));
          } else {
            Alert.alert('Error', passResult.error || 'Failed to pass card');
          }
          break;

        default:
          console.warn('Unknown game action:', action);
      }
    } catch (error) {
      console.error('Game action error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setGameState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const loadGameState = async () => {
    setGameState(prev => ({ ...prev, isLoading: true }));

    try {
      // Load game data with participants
      const gameResult = await gameService.getGameWithParticipants(gameId);

      if (!gameResult.success || !gameResult.data) {
        Alert.alert('Error', 'Failed to load game data');
        router.back();
        return;
      }

      const { game, participants } = gameResult.data;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Authentication required');
        router.back();
        return;
      }

      // Find current player's participant record
      const myParticipant = participants.find(p => p.player_id === user.id);
      if (!myParticipant) {
        Alert.alert('Error', 'Player not found in game');
        router.back();
        return;
      }

      // Convert participant data to PlayerHand format
      const convertParticipantToPlayerHand = (participant: any): PlayerHand => ({
        cards: participant.hand_cards || [],
        penaltyPile: {
          cockroach: participant.penalty_cockroach || [],
          mouse: participant.penalty_mouse || [],
          bat: participant.penalty_bat || [],
          frog: participant.penalty_frog || [],
        },
      });

      // Sort participants by position
      const sortedParticipants = participants.sort((a, b) => a.position - b.position);
      const player1Data = sortedParticipants.find(p => p.position === 1);
      const player2Data = sortedParticipants.find(p => p.position === 2);

      const player1 = player1Data ? convertParticipantToPlayerHand(player1Data) : null;
      const player2 = player2Data ? convertParticipantToPlayerHand(player2Data) : null;

      // Get current round information if game is in progress
      let currentRound = null;
      let gamePhase: 'waiting' | 'playing' | 'guessing' | 'round-end' | 'game-end' = 'waiting';
      let claimedCard = null;
      let currentClaim = null;

      if (game.status === 'completed') {
        gamePhase = 'game-end';
      } else if (game.status === 'in_progress') {
        // Use gameService to get current round
        const roundResult = await gameService.getCurrentRound(gameId);

        if (roundResult.success && roundResult.data) {
          currentRound = roundResult.data;
          claimedCard = currentRound.current_card;
          currentClaim = currentRound.claimed_creature_type;

          // Determine if current player should be guessing or playing
          const isTargetPlayer = currentRound.target_player_id === myParticipant.id;
          if (isTargetPlayer && game.current_turn_player_id === user.id) {
            gamePhase = 'guessing'; // Player needs to guess or pass
          } else {
            gamePhase = 'playing'; // Player needs to make claim or wait
          }
        } else {
          gamePhase = 'playing'; // No active round, ready for new claim
        }
      }

      setGameState(prev => ({
        ...prev,
        game,
        participants,
        player1,
        player2,
        myPlayerId: user.id,
        gamePhase,
        currentPlayer: game.current_turn_player_id,
        currentRoundId: currentRound?.id || null,
        claimedCard,
        currentClaim,
        isLoading: false,
      }));

    } catch (error) {
      console.error('Load game state error:', error);
      Alert.alert('Error', 'Failed to load game');
      router.back();
    }
  };

  const handleLeaveGame = () => {
    Alert.alert(
      'Leave Game',
      'Are you sure you want to leave this game?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => router.back() },
      ]
    );
  };

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
  const player1IsMe = gameState.myPlayerId === 'player1';

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
              {connectionState.status !== 'connected' && (
                <View style={[
                  styles.connectionStatusBadge,
                  {
                    backgroundColor: connectionState.status === 'reconnecting' ? '#f39c12' : '#e74c3c'
                  }
                ]}>
                  <ThemedText style={styles.connectionStatusText}>
                    {connectionState.status === 'reconnecting' ? 'Reconnecting...' : 'Disconnected'}
                  </ThemedText>
                </View>
              )}
            </View>
          </View>

          <View style={styles.headerActions}>
            {/* Reconnect button for disconnected state */}
            {connectionState.status === 'disconnected' && (
              <TouchableOpacity
                style={[styles.reconnectButton, { backgroundColor: tintColor }]}
                onPress={forceReconnect}
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
                avatarUrl: null, // TODO: Get from user profile
                connectionStatus: connectionState.status,
                latency: connectionState.latency,
                lastConnected: connectionState.lastConnected,
              }}
              selectedCardId={null} // Opponent cards are not selectable
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
                avatarUrl: null, // TODO: Get from current user profile
                connectionStatus: connectionState.status,
                latency: connectionState.latency,
                lastConnected: connectionState.lastConnected,
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