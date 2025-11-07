/**
 * Response Modal Component
 * Allows players to respond to claims with truth/lie guesses or pass back
 */

import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { GameRound } from '@/types/database';
import type { Card, CreatureType } from '@/types/cards';
import {
  getCreatureTypeSymbol,
  getCreatureTypeName,
} from '@/types/cards';

interface ResponseModalProps {
  visible: boolean;
  currentRound: GameRound | null;
  onResponse: (response: 'truth' | 'lie' | 'pass_back') => void;
  onCancel: () => void;
}

export function ResponseModal({
  visible,
  currentRound,
  onResponse,
  onCancel,
}: ResponseModalProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  const handleResponse = (response: 'truth' | 'lie' | 'pass_back') => {
    if (!currentRound) return;

    let confirmMessage = '';
    switch (response) {
      case 'truth':
        confirmMessage = 'You believe your opponent is telling the truth.';
        break;
      case 'lie':
        confirmMessage = 'You believe your opponent is lying.';
        break;
      case 'pass_back':
        confirmMessage = 'You are passing the card back to your opponent.';
        break;
    }

    Alert.alert(
      'Confirm Response',
      confirmMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => onResponse(response),
        },
      ]
    );
  };

  if (!currentRound) return null;

  const claimedType = currentRound.claimed_creature_type as CreatureType;
  const currentCard = currentRound.current_card as Card;
  const passCount = currentRound.pass_count;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <ThemedView style={[styles.modal, { backgroundColor }]}>
          <View style={styles.header}>
            <ThemedText type="subtitle" style={styles.title}>
              Your opponent claims:
            </ThemedText>

            <View style={styles.claimDisplay}>
              <View style={styles.claimIcon}>
                <ThemedText style={styles.claimSymbol}>
                  {getCreatureTypeSymbol(claimedType)}
                </ThemedText>
              </View>
              <ThemedText style={styles.claimText}>
                {getCreatureTypeName(claimedType)}
              </ThemedText>
            </View>

            {passCount > 0 && (
              <ThemedText style={styles.passCountText}>
                This card has been passed back {passCount} time(s)
              </ThemedText>
            )}
          </View>

          <View style={styles.question}>
            <ThemedText style={styles.questionText}>
              Do you think they're telling the truth?
            </ThemedText>
          </View>

          <View style={styles.responseButtons}>
            {/* Truth Button */}
            <TouchableOpacity
              style={[styles.responseButton, styles.truthButton]}
              onPress={() => handleResponse('truth')}
            >
              <ThemedText style={styles.responseButtonIcon}>✓</ThemedText>
              <ThemedText style={styles.responseButtonText}>
                Truth
              </ThemedText>
              <ThemedText style={styles.responseButtonDesc}>
                I believe you
              </ThemedText>
            </TouchableOpacity>

            {/* Lie Button */}
            <TouchableOpacity
              style={[styles.responseButton, styles.lieButton]}
              onPress={() => handleResponse('lie')}
            >
              <ThemedText style={styles.responseButtonIcon}>✗</ThemedText>
              <ThemedText style={styles.responseButtonText}>
                Lie
              </ThemedText>
              <ThemedText style={styles.responseButtonDesc}>
                You're lying!
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Pass Back Option */}
          <View style={styles.passBackSection}>
            <ThemedText style={styles.passBackTitle}>
              Or pass it back:
            </ThemedText>

            <TouchableOpacity
              style={[styles.passBackButton, { backgroundColor: iconColor + '20', borderColor: iconColor }]}
              onPress={() => handleResponse('pass_back')}
            >
              <ThemedText style={styles.passBackIcon}>↩️</ThemedText>
              <ThemedText style={[styles.passBackText, { color: textColor }]}>
                Pass Back
              </ThemedText>
              <ThemedText style={[styles.passBackDesc, { color: textColor }]}>
                Let them decide again
              </ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.cancelSection}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: iconColor }]}
              onPress={onCancel}
            >
              <ThemedText style={[styles.cancelButtonText, { color: textColor }]}>
                Cancel
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Game Rules Reminder */}
          <View style={styles.rulesReminder}>
            <ThemedText style={styles.rulesTitle}>🎯 Remember:</ThemedText>
            <ThemedText style={styles.rulesText}>
              • If you guess correctly, they get the penalty card
            </ThemedText>
            <ThemedText style={styles.rulesText}>
              • If you guess wrong, you get the penalty card
            </ThemedText>
            <ThemedText style={styles.rulesText}>
              • First to collect 3 of the same creature loses
            </ThemedText>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
  },
  claimDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 8,
  },
  claimIcon: {
    marginRight: 12,
  },
  claimSymbol: {
    fontSize: 32,
  },
  claimText: {
    fontSize: 20,
    fontWeight: '600',
  },
  passCountText: {
    fontSize: 14,
    opacity: 0.7,
    fontStyle: 'italic',
  },
  question: {
    alignItems: 'center',
    marginBottom: 24,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  responseButtons: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  responseButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minHeight: 100,
    justifyContent: 'center',
  },
  truthButton: {
    backgroundColor: '#2ecc71',
  },
  lieButton: {
    backgroundColor: '#e74c3c',
  },
  responseButtonIcon: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 8,
  },
  responseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  responseButtonDesc: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
  },
  passBackSection: {
    marginBottom: 24,
  },
  passBackTitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 12,
  },
  passBackButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  passBackIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  passBackText: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  passBackDesc: {
    fontSize: 12,
    opacity: 0.7,
  },
  cancelSection: {
    marginBottom: 16,
  },
  cancelButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  rulesReminder: {
    padding: 16,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  rulesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#856404',
  },
  rulesText: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 2,
    color: '#856404',
  },
});