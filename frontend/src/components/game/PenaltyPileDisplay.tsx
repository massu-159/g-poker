/**
 * Penalty Pile Display Component
 * Shows penalty cards grouped by creature type for Cockroach Poker
 */

import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { Card, CreatureType } from '@/types/cards';

interface PenaltyPileDisplayProps {
  penaltyPile?: {
    cockroach: Card[];
    mouse: Card[];
    bat: Card[];
    frog: Card[];
  } | null;
  isOpponent?: boolean;
  style?: any;
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

const getCreatureTypeColor = (creatureType: CreatureType): string => {
  switch (creatureType) {
    case 'cockroach': return '#8B4513'; // Brown
    case 'mouse': return '#708090'; // Gray
    case 'bat': return '#2F4F4F'; // Dark Gray
    case 'frog': return '#228B22'; // Green
    default: return '#666666';
  }
};

export function PenaltyPileDisplay({
  penaltyPile,
  isOpponent = false,
  style,
}: PenaltyPileDisplayProps) {
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');

  // Return empty state if no penalty pile data
  if (!penaltyPile) {
    return (
      <View style={[styles.container, style]}>
        <ThemedText style={styles.title}>
          {isOpponent ? 'Opponent\'s' : 'Your'} Penalty Pile
        </ThemedText>
        <View style={styles.emptyState}>
          <ThemedText style={[styles.emptyText, { color: iconColor }]}>
            Loading penalty pile...
          </ThemedText>
        </View>
      </View>
    );
  }

  // Extract penalty cards by type from the penalty pile structure
  const penaltyCards = {
    cockroach: penaltyPile.cockroach || [],
    mouse: penaltyPile.mouse || [],
    bat: penaltyPile.bat || [],
    frog: penaltyPile.frog || [],
  };

  // Check for near-loss condition (2 of same type)
  const nearLossTypes = Object.entries(penaltyCards)
    .filter(([_, cards]) => cards.length === 2)
    .map(([type, _]) => type as CreatureType);

  // Check for loss condition (3 of same type)
  const lostType = Object.entries(penaltyCards)
    .find(([_, cards]) => cards.length >= 3)?.[0] as CreatureType;

  // Check if player has lost
  const hasLost = !!lostType;

  const creatureTypes: CreatureType[] = ['cockroach', 'mouse', 'bat', 'frog'];

  return (
    <View style={[styles.container, style]}>
      <ThemedText style={styles.title}>
        {isOpponent ? 'Opponent\'s' : 'Your'} Penalty Pile
      </ThemedText>

      {hasLost && lostType && (
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

      {nearLossTypes.length > 0 && !hasLost && (
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