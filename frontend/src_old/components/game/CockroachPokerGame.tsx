/**
 * Cockroach Poker Game Interface
 * Main game component for 2-player Cockroach Poker gameplay
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useGameState } from '@/hooks/useGameState';
import { CardClaimModal } from './CardClaimModal';
import { ResponseModal } from './ResponseModal';
import { PenaltyPileDisplay } from './PenaltyPileDisplay';
import { PlayerHandDisplay } from './PlayerHandDisplay';
import type { Card, CreatureType } from '@/types/cards';
import { getCreatureTypeSymbol, getCreatureTypeName } from '@/types/cards';

interface CockroachPokerGameProps {
  gameId: string;
  onGameEnd?: (winnerId: string) => void;
  onLeaveGame?: () => void;
}

export function CockroachPokerGame({
  gameId,
  onGameEnd,
  onLeaveGame
}: CockroachPokerGameProps) {
  const {
    game,
    participants,
    currentRound,
    currentPlayerHand,
    isMyTurn,
    isLoading,
    error,
    makeCardClaim,
    respondToClaim,
    leaveGame,
  } = useGameState(gameId);

  // Modal states
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  // Get current user participant
  const currentParticipant = participants.find(p => {
    // This is simplified - in real implementation we'd match against current user
    return p.position === 1; // For now, assume position 1 is current user
  });

  const opponentParticipant = participants.find(p => p.id !== currentParticipant?.id);

  // Handle card selection for claiming
  const handleCardSelect = (card: Card) => {
    if (!isMyTurn || !currentParticipant || isLoading) {
      Alert.alert('Not Your Turn', 'Wait for your turn to make a move');
      return;
    }

    setSelectedCard(card);
    setShowClaimModal(true);
  };

  // Handle card claim submission
  const handleCardClaim = async (claimedType: CreatureType) => {
    if (!selectedCard || !opponentParticipant) return;

    try {
      await makeCardClaim(selectedCard.id, claimedType, opponentParticipant.id);
      setShowClaimModal(false);
      setSelectedCard(null);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  // Handle response to claim
  const handleResponse = async (response: 'truth' | 'lie' | 'pass_back') => {
    if (!currentRound) return;

    try {
      await respondToClaim(currentRound.id, response);
      setShowResponseModal(false);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  // Handle leave game
  const handleLeaveGame = () => {
    Alert.alert(
      'Leave Game',
      'Are you sure you want to leave this game?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            await leaveGame();
            onLeaveGame?.();
          },
        },
      ]
    );
  };

  if (isLoading && !game) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={tintColor} />
          <ThemedText style={styles.loadingText}>Loading game...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centered}>
          <ThemedText style={[styles.errorText, { color: '#e74c3c' }]}>
            {error}
          </ThemedText>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: tintColor }]}
            onPress={onLeaveGame}
          >
            <ThemedText style={styles.buttonText}>Back to Lobby</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  if (!game || !currentParticipant) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centered}>
          <ThemedText>Game not found</ThemedText>
        </View>
      </ThemedView>
    );
  }

  // Check if game ended
  const hasLost = currentParticipant.has_lost;
  const opponentHasLost = opponentParticipant?.has_lost;
  const gameEnded = hasLost || opponentHasLost;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header with game info */}
        <View style={styles.header}>
          <ThemedText type="title" style={styles.gameTitle}>
            ごきぶりポーカー
          </ThemedText>

          <View style={styles.gameInfo}>
            <ThemedText style={styles.gameStatus}>
              {game.status === 'waiting' && 'Waiting for players...'}
              {game.status === 'in_progress' && !gameEnded && (
                isMyTurn ? 'Your Turn' : "Opponent's Turn"
              )}
              {gameEnded && (hasLost ? 'You Lost!' : 'You Won!')}
            </ThemedText>

            <TouchableOpacity
              style={[styles.leaveButton, { borderColor: iconColor }]}
              onPress={handleLeaveGame}
            >
              <ThemedText style={[styles.leaveButtonText, { color: textColor }]}>
                Leave Game
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Opponent area */}
        {opponentParticipant && (
          <View style={styles.opponentArea}>
            <ThemedText type="subtitle" style={styles.playerName}>
              Opponent ({opponentParticipant.cards_remaining} cards)
            </ThemedText>

            <PenaltyPileDisplay
              participant={opponentParticipant}
              isOpponent={true}
            />
          </View>
        )}

        {/* Center area - current round info */}
        {currentRound && !currentRound.is_completed && (
          <View style={[styles.centerArea, { backgroundColor: iconColor + '20' }]}>
            <ThemedText type="subtitle" style={styles.centerTitle}>
              Current Claim
            </ThemedText>

            <View style={styles.claimInfo}>
              <ThemedText style={styles.claimText}>
                Claimed: {getCreatureTypeSymbol(currentRound.claimed_creature_type as CreatureType)} {getCreatureTypeName(currentRound.claimed_creature_type as CreatureType)}
              </ThemedText>

              <ThemedText style={styles.passCount}>
                Passed {currentRound.pass_count} time(s)
              </ThemedText>
            </View>

            {/* Response buttons for target player */}
            {!isMyTurn && !gameEnded && (
              <View style={styles.responseButtons}>
                <TouchableOpacity
                  style={[styles.responseButton, { backgroundColor: '#2ecc71' }]}
                  onPress={() => handleResponse('truth')}
                  disabled={isLoading}
                >
                  <ThemedText style={styles.responseButtonText}>
                    Truth
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.responseButton, { backgroundColor: '#e74c3c' }]}
                  onPress={() => handleResponse('lie')}
                  disabled={isLoading}
                >
                  <ThemedText style={styles.responseButtonText}>
                    Lie
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.responseButton, { backgroundColor: iconColor }]}
                  onPress={() => handleResponse('pass_back')}
                  disabled={isLoading}
                >
                  <ThemedText style={styles.responseButtonText}>
                    Pass Back
                  </ThemedText>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Current player area */}
        <View style={styles.playerArea}>
          <ThemedText type="subtitle" style={styles.playerName}>
            Your Hand ({currentPlayerHand.length} cards)
          </ThemedText>

          <PlayerHandDisplay
            cards={currentPlayerHand}
            onCardSelect={handleCardSelect}
            disabled={!isMyTurn || gameEnded || isLoading}
          />

          <PenaltyPileDisplay
            participant={currentParticipant}
            isOpponent={false}
          />
        </View>

        {/* Game ended message */}
        {gameEnded && (
          <View style={[styles.gameEndArea, { backgroundColor: hasLost ? '#e74c3c20' : '#2ecc7120' }]}>
            <ThemedText type="title" style={[
              styles.gameEndTitle,
              { color: hasLost ? '#e74c3c' : '#2ecc71' }
            ]}>
              {hasLost ? 'Game Over - You Lost!' : 'Congratulations - You Won!'}
            </ThemedText>

            {currentParticipant.losing_creature_type && (
              <ThemedText style={styles.gameEndReason}>
                Lost by collecting 3 {getCreatureTypeName(currentParticipant.losing_creature_type as CreatureType)} cards
              </ThemedText>
            )}
          </View>
        )}

        {/* Turn indicator */}
        {!gameEnded && (
          <View style={[styles.turnIndicator, {
            backgroundColor: isMyTurn ? tintColor + '20' : iconColor + '20'
          }]}>
            <ThemedText style={styles.turnText}>
              {isMyTurn ? '🎯 Your turn - Select a card to claim' : '⏳ Waiting for opponent...'}
            </ThemedText>
          </View>
        )}
      </ScrollView>

      {/* Card claim modal */}
      <CardClaimModal
        visible={showClaimModal}
        selectedCard={selectedCard}
        onClaim={handleCardClaim}
        onCancel={() => {
          setShowClaimModal(false);
          setSelectedCard(null);
        }}
      />

      {/* Response modal */}
      <ResponseModal
        visible={showResponseModal}
        currentRound={currentRound}
        onResponse={handleResponse}
        onCancel={() => setShowResponseModal(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  header: {
    marginBottom: 24,
  },
  gameTitle: {
    textAlign: 'center',
    marginBottom: 16,
  },
  gameInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gameStatus: {
    fontSize: 16,
    fontWeight: '600',
  },
  leaveButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  leaveButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  opponentArea: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  playerArea: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  playerName: {
    marginBottom: 12,
    textAlign: 'center',
  },
  centerArea: {
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
  },
  centerTitle: {
    textAlign: 'center',
    marginBottom: 12,
  },
  claimInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  claimText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  passCount: {
    fontSize: 14,
    opacity: 0.7,
  },
  responseButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  responseButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  responseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  gameEndArea: {
    padding: 24,
    borderRadius: 12,
    marginVertical: 16,
    alignItems: 'center',
  },
  gameEndTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  gameEndReason: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
  turnIndicator: {
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  turnText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});