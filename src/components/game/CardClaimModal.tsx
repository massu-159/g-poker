/**
 * Card Claim Modal Component
 * Allows players to claim a creature type when passing a card
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
import type { Card, CreatureType } from '@/types/cards';
import {
  getCreatureTypeSymbol,
  getCreatureTypeName,
  getCreatureTypeColor,
  CreatureType as CreatureEnum,
} from '@/types/cards';

interface CardClaimModalProps {
  visible: boolean;
  selectedCard: Card | null;
  onClaim: (claimedType: CreatureType) => void;
  onCancel: () => void;
}

export function CardClaimModal({
  visible,
  selectedCard,
  onClaim,
  onCancel,
}: CardClaimModalProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  const handleClaim = (claimedType: CreatureType) => {
    if (!selectedCard) return;

    // Show confirmation with truth/lie indication
    const isActuallyThisType = selectedCard.creatureType === claimedType;
    const claimText = isActuallyThisType
      ? 'This is a truthful claim!'
      : 'This is a lie!';

    Alert.alert(
      'Confirm Claim',
      `You are claiming this card is a ${getCreatureTypeName(claimedType)}. ${claimText}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => onClaim(claimedType),
        },
      ]
    );
  };

  const creatureTypes: CreatureType[] = [
    CreatureEnum.COCKROACH,
    CreatureEnum.MOUSE,
    CreatureEnum.BAT,
    CreatureEnum.FROG,
  ];

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
              What creature type do you claim?
            </ThemedText>

            {selectedCard && (
              <View style={styles.cardInfo}>
                <ThemedText style={styles.cardText}>
                  Selected card: {getCreatureTypeSymbol(selectedCard.creatureType)}
                  {getCreatureTypeName(selectedCard.creatureType)}
                </ThemedText>
                <ThemedText style={styles.hintText}>
                  (You can lie about what this card is!)
                </ThemedText>
              </View>
            )}
          </View>

          <View style={styles.creatureGrid}>
            {creatureTypes.map((creatureType) => (
              <TouchableOpacity
                key={creatureType}
                style={[
                  styles.creatureButton,
                  {
                    backgroundColor: getCreatureTypeColor(creatureType) + '20',
                    borderColor: getCreatureTypeColor(creatureType),
                  }
                ]}
                onPress={() => handleClaim(creatureType)}
              >
                <ThemedText style={styles.creatureSymbol}>
                  {getCreatureTypeSymbol(creatureType)}
                </ThemedText>
                <ThemedText style={styles.creatureName}>
                  {getCreatureTypeName(creatureType)}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: iconColor }]}
              onPress={onCancel}
            >
              <ThemedText style={[styles.cancelButtonText, { color: textColor }]}>
                Cancel
              </ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.instructions}>
            <ThemedText style={styles.instructionText}>
              💡 You can claim any creature type - truth or lie!
            </ThemedText>
            <ThemedText style={styles.instructionText}>
              🎯 Your opponent must guess if you're telling the truth
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
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
  },
  cardInfo: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  hintText: {
    fontSize: 14,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  creatureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  creatureButton: {
    width: '48%',
    aspectRatio: 1,
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatureSymbol: {
    fontSize: 32,
    marginBottom: 8,
  },
  creatureName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttons: {
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
  instructions: {
    padding: 16,
    backgroundColor: '#e8f4f8',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  instructionText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
    color: '#2c3e50',
  },
});