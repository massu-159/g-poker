/**
 * Penalty Pile Display Component
 * Shows penalty cards grouped by creature type
 */

import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { GameParticipant } from '@/types/database';
import type { Card, CreatureType } from '@/types/cards';
import {
  getCreatureTypeSymbol,
  getCreatureTypeName,
  getCreatureTypeColor,
  CreatureType as CreatureEnum,
} from '@/types/cards';

interface PenaltyPileDisplayProps {
  participant: GameParticipant;
  isOpponent?: boolean;
}

export function PenaltyPileDisplay({
  participant,
  isOpponent = false,
}: PenaltyPileDisplayProps) {
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');

  // Extract penalty cards by type
  const penaltyCards = {
    [CreatureEnum.COCKROACH]: (participant.penalty_cockroach as Card[]) || [],
    [CreatureEnum.MOUSE]: (participant.penalty_mouse as Card[]) || [],
    [CreatureEnum.BAT]: (participant.penalty_bat as Card[]) || [],
    [CreatureEnum.FROG]: (participant.penalty_frog as Card[]) || [],
  };

  // Check for near-loss condition (2 of same type)
  const nearLossTypes = Object.entries(penaltyCards)
    .filter(([_, cards]) => cards.length === 2)
    .map(([type, _]) => type as CreatureType);

  // Check for loss condition (3 of same type)
  const lostType = Object.entries(penaltyCards)
    .find(([_, cards]) => cards.length >= 3)?.[0] as CreatureType;

  const creatureTypes: CreatureType[] = [
    CreatureEnum.COCKROACH,
    CreatureEnum.MOUSE,
    CreatureEnum.BAT,
    CreatureEnum.FROG,
  ];

  return (
    <View style={styles.container}>
      <ThemedText style={styles.title}>
        {isOpponent ? 'Opponent\'s' : 'Your'} Penalty Pile
      </ThemedText>

      {participant.has_lost && lostType && (
        <View style={[styles.lossIndicator, { backgroundColor: '#e74c3c20' }]}>
          <ThemedText style={[styles.lossText, { color: '#e74c3c' }]}>
            💀 Lost! 3 {getCreatureTypeName(lostType)} cards
          </ThemedText>
        </View>
      )}

      <View style={styles.penaltyGrid}>
        {creatureTypes.map((creatureType) => {
          const cards = penaltyCards[creatureType];
          const count = cards.length;
          const isNearLoss = nearLossTypes.includes(creatureType);
          const isLoss = lostType === creatureType;

          return (
            <View
              key={creatureType}
              style={[
                styles.penaltyColumn,
                {
                  backgroundColor: isLoss
                    ? '#e74c3c20'
                    : isNearLoss
                    ? '#f39c1220'
                    : getCreatureTypeColor(creatureType) + '10',
                  borderColor: isLoss
                    ? '#e74c3c'
                    : isNearLoss
                    ? '#f39c12'
                    : getCreatureTypeColor(creatureType),
                  borderWidth: isLoss || isNearLoss ? 2 : 1,
                }
              ]}
            >
              <View style={styles.creatureHeader}>
                <ThemedText style={styles.creatureSymbol}>
                  {getCreatureTypeSymbol(creatureType)}
                </ThemedText>
                <ThemedText style={styles.creatureName}>
                  {getCreatureTypeName(creatureType)}
                </ThemedText>
              </View>

              <View style={styles.cardCount}>
                <ThemedText style={[
                  styles.countText,
                  {
                    color: isLoss
                      ? '#e74c3c'
                      : isNearLoss
                      ? '#f39c12'
                      : textColor,
                    fontWeight: isLoss || isNearLoss ? 'bold' : 'normal',
                  }
                ]}>
                  {count}/3
                </ThemedText>
              </View>

              {/* Visual representation of cards */}
              <View style={styles.cardStack}>
                {Array.from({ length: Math.min(count, 3) }).map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.card,
                      {
                        backgroundColor: getCreatureTypeColor(creatureType),
                        transform: [{ translateX: index * 2 }],
                        zIndex: index,
                      }
                    ]}
                  />
                ))}
              </View>

              {/* Warning indicators */}
              {isNearLoss && !isLoss && (
                <ThemedText style={styles.warningText}>
                  ⚠️ Danger!
                </ThemedText>
              )}

              {isLoss && (
                <ThemedText style={styles.lossCardText}>
                  💀 Loss!
                </ThemedText>
              )}
            </View>
          );
        })}
      </View>

      {nearLossTypes.length > 0 && !participant.has_lost && (
        <View style={[styles.warningBox, { backgroundColor: '#f39c1220', borderColor: '#f39c12' }]}>
          <ThemedText style={[styles.warningTitle, { color: '#f39c12' }]}>
            ⚠️ Warning!
          </ThemedText>
          <ThemedText style={[styles.warningMessage, { color: '#f39c12' }]}>
            {nearLossTypes.length === 1
              ? `One more ${getCreatureTypeName(nearLossTypes[0])} card and you lose!`
              : `Multiple creature types at 2 cards - be careful!`
            }
          </ThemedText>
        </View>
      )}

      {Object.values(penaltyCards).every(cards => cards.length === 0) && (
        <View style={styles.emptyState}>
          <ThemedText style={[styles.emptyText, { color: iconColor }]}>
            No penalty cards yet
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  lossIndicator: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  lossText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  penaltyGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  penaltyColumn: {
    flex: 1,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    minHeight: 100,
  },
  creatureHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  creatureSymbol: {
    fontSize: 20,
    marginBottom: 2,
  },
  creatureName: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  cardCount: {
    marginBottom: 8,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardStack: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
    marginBottom: 4,
  },
  card: {
    width: 12,
    height: 16,
    borderRadius: 2,
    position: 'absolute',
  },
  warningText: {
    fontSize: 10,
    color: '#f39c12',
    fontWeight: '600',
  },
  lossCardText: {
    fontSize: 10,
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  warningBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  warningMessage: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 16,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});