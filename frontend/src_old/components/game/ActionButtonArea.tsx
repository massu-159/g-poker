/**
 * Action Button Area Component
 * Handles all game actions: claim, guess, pass for Cockroach Poker
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { CreatureType } from '@/types/cards';

interface ActionButtonAreaProps {
  gameState: any; // TODO: Replace with proper game state type
  isMyTurn: boolean;
  onAction: (action: string, data?: any) => void;
  selectedCardId?: string | null;
  actionTimer?: number;
  style?: any;
}

interface CreatureClaimButtonProps {
  creatureType: CreatureType;
  onClaim: (creatureType: CreatureType) => void;
  disabled: boolean;
}

const getCreatureTypeSymbol = (creatureType: CreatureType): string => {
  switch (creatureType) {
    case 'cockroach': return '🪳';
    case 'mouse': return '🐭';
    case 'bat': return '🦇';
    case 'frog': return '🐸';
    default: return '❓';
  }
};

const getCreatureTypeName = (creatureType: CreatureType): string => {
  switch (creatureType) {
    case 'cockroach': return 'Cockroach';
    case 'mouse': return 'Mouse';
    case 'bat': return 'Bat';
    case 'frog': return 'Frog';
    default: return 'Unknown';
  }
};

function CreatureClaimButton({ creatureType, onClaim, disabled }: CreatureClaimButtonProps) {
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  return (
    <TouchableOpacity
      style={[
        styles.creatureButton,
        {
          borderColor: disabled ? iconColor : tintColor,
          backgroundColor: disabled ? 'transparent' : `${tintColor}20`,
        }
      ]}
      onPress={() => onClaim(creatureType)}
      disabled={disabled}
    >
      <ThemedText style={[
        styles.creatureButtonSymbol,
        { color: disabled ? iconColor : tintColor }
      ]}>
        {getCreatureTypeSymbol(creatureType)}
      </ThemedText>
      <ThemedText style={[
        styles.creatureButtonText,
        { color: disabled ? iconColor : tintColor }
      ]}>
        {getCreatureTypeName(creatureType)}
      </ThemedText>
    </TouchableOpacity>
  );
}

export function ActionButtonArea({ gameState, isMyTurn, onAction, selectedCardId, actionTimer, style }: ActionButtonAreaProps) {
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  // Determine current game phase and available actions
  const gamePhase = gameState.gamePhase || 'waiting';

  const handleCardClaim = (creatureType: CreatureType) => {
    if (!selectedCardId) {
      Alert.alert('Select Card', 'Please select a card from your hand first');
      return;
    }

    Alert.alert(
      'Confirm Claim',
      `Claim this card as ${getCreatureTypeSymbol(creatureType)} ${getCreatureTypeName(creatureType)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Claim', onPress: () => onAction('claim', { cardId: selectedCardId, creatureType }) },
      ]
    );
  };

  const handleGuess = (isTrue: boolean) => {
    const guessText = isTrue ? 'TRUE' : 'LIE';
    Alert.alert(
      'Confirm Guess',
      `You think the opponent's claim is ${guessText}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: `Yes, ${guessText}`, onPress: () => onAction('guess', { isTrue }) },
      ]
    );
  };

  const handlePass = () => {
    Alert.alert(
      'Pass Card',
      'Pass this card back to your opponent?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pass', onPress: () => onAction('pass') },
      ]
    );
  };

  // Render different action sets based on game phase
  const renderActions = () => {
    if (!isMyTurn) {
      return (
        <View style={styles.waitingContainer}>
          <ThemedText style={[styles.waitingText, { color: iconColor }]}>
            Waiting for opponent's action...
          </ThemedText>
        </View>
      );
    }

    switch (gamePhase) {
      case 'waiting':
        return (
          <View style={styles.waitingContainer}>
            <ThemedText style={[styles.waitingText, { color: iconColor }]}>
              Game starting...
            </ThemedText>
          </View>
        );

      case 'playing':
        // Player needs to select card and make claim
        const creatureTypes: CreatureType[] = ['cockroach', 'mouse', 'bat', 'frog'];

        return (
          <View style={styles.actionsContainer}>
            <ThemedText style={styles.actionTitle}>
              Select a creature type to claim:
            </ThemedText>

            <View style={styles.creatureButtonsContainer}>
              {creatureTypes.map(creatureType => (
                <CreatureClaimButton
                  key={creatureType}
                  creatureType={creatureType}
                  onClaim={handleCardClaim}
                  disabled={!selectedCardId}
                />
              ))}
            </View>

            {!selectedCardId && (
              <ThemedText style={[styles.hintText, { color: iconColor }]}>
                💡 First select a card from your hand above
              </ThemedText>
            )}
          </View>
        );

      case 'guessing':
        // Player needs to decide if opponent's claim is true or false
        const claimSymbol = gameState.currentClaim ? getCreatureTypeSymbol(gameState.currentClaim) : '❓';
        const claimName = gameState.currentClaim ? getCreatureTypeName(gameState.currentClaim) : 'Unknown';

        return (
          <View style={styles.actionsContainer}>
            <ThemedText style={styles.actionTitle}>
              Opponent claims: {claimSymbol} {claimName}
            </ThemedText>
            <ThemedText style={styles.actionSubtitle}>
              Is this card really a {claimName}?
            </ThemedText>

            <View style={styles.guessButtonsContainer}>
              <TouchableOpacity
                style={[styles.guessButton, styles.trueButton, { backgroundColor: '#27ae60' }]}
                onPress={() => handleGuess(true)}
              >
                <ThemedText style={styles.guessButtonText}>✓ TRUE</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.guessButton, styles.lieButton, { backgroundColor: '#e74c3c' }]}
                onPress={() => handleGuess(false)}
              >
                <ThemedText style={styles.guessButtonText}>✗ LIE</ThemedText>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.passButton, { borderColor: tintColor }]}
              onPress={handlePass}
            >
              <ThemedText style={[styles.passButtonText, { color: tintColor }]}>
                🔄 Pass Back
              </ThemedText>
            </TouchableOpacity>
          </View>
        );

      default:
        return (
          <View style={styles.waitingContainer}>
            <ThemedText style={[styles.waitingText, { color: iconColor }]}>
              Unknown game state
            </ThemedText>
          </View>
        );
    }
  };

  // Render timer display
  const renderTimer = () => {
    if (!isMyTurn || !actionTimer || actionTimer <= 0) return null;

    const timerColor = actionTimer <= 10 ? '#e74c3c' : actionTimer <= 20 ? '#f39c12' : tintColor;

    return (
      <View style={styles.timerContainer}>
        <View style={[styles.timerCircle, { borderColor: timerColor }]}>
          <ThemedText style={[styles.timerText, { color: timerColor }]}>
            {actionTimer}s
          </ThemedText>
        </View>
        <ThemedText style={[styles.timerLabel, { color: timerColor }]}>
          {actionTimer <= 10 ? 'Hurry up!' : 'Time remaining'}
        </ThemedText>
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {renderTimer()}
      {renderActions()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 12,
  },
  waitingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  waitingText: {
    fontSize: 16,
    fontStyle: 'italic',
  },
  actionsContainer: {
    alignItems: 'center',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
  creatureButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  creatureButton: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    minWidth: 80,
    maxWidth: 90,
  },
  creatureButtonSymbol: {
    fontSize: 20,
    marginBottom: 4,
  },
  creatureButtonText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  guessButtonsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  guessButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    minWidth: 100,
  },
  trueButton: {
    // Green styling handled in style prop
  },
  lieButton: {
    // Red styling handled in style prop
  },
  guessButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  passButton: {
    borderWidth: 2,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  passButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  hintText: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  timerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  timerText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  timerLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});