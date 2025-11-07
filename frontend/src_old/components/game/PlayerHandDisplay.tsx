/**
 * Player Hand Display Component
 * Shows player's hand cards with selection capability
 */

import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { Card } from '@/types/cards';
import {
  getCreatureTypeSymbol,
  getCreatureTypeName,
  getCreatureTypeColor,
} from '@/types/cards';

interface PlayerHandDisplayProps {
  cards: Card[];
  onCardSelect?: (card: Card) => void;
  disabled?: boolean;
}

export function PlayerHandDisplay({
  cards,
  onCardSelect,
  disabled = false,
}: PlayerHandDisplayProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  if (cards.length === 0) {
    return (
      <View style={styles.emptyHand}>
        <ThemedText style={[styles.emptyText, { color: iconColor }]}>
          No cards in hand
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {cards.map((card, index) => (
          <TouchableOpacity
            key={card.id}
            style={[
              styles.card,
              {
                backgroundColor: disabled
                  ? iconColor + '20'
                  : getCreatureTypeColor(card.creatureType) + '20',
                borderColor: disabled
                  ? iconColor
                  : getCreatureTypeColor(card.creatureType),
                opacity: disabled ? 0.6 : 1,
              }
            ]}
            onPress={() => !disabled && onCardSelect?.(card)}
            disabled={disabled}
          >
            <View style={styles.cardHeader}>
              <ThemedText style={[
                styles.cardSymbol,
                { color: disabled ? iconColor : getCreatureTypeColor(card.creatureType) }
              ]}>
                {getCreatureTypeSymbol(card.creatureType)}
              </ThemedText>
            </View>

            <View style={styles.cardBody}>
              <ThemedText style={[
                styles.cardName,
                { color: disabled ? iconColor : textColor }
              ]}>
                {getCreatureTypeName(card.creatureType)}
              </ThemedText>
            </View>

            <View style={styles.cardFooter}>
              <ThemedText style={[
                styles.cardId,
                { color: disabled ? iconColor : textColor, opacity: 0.5 }
              ]}>
                #{card.id}
              </ThemedText>
            </View>

            {!disabled && (
              <View style={[styles.selectIndicator, { backgroundColor: tintColor }]}>
                <ThemedText style={styles.selectText}>
                  Tap to claim
                </ThemedText>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.instructions}>
        {!disabled ? (
          <ThemedText style={[styles.instructionText, { color: textColor }]}>
            🎯 Tap a card to pass it to your opponent with a claim
          </ThemedText>
        ) : (
          <ThemedText style={[styles.instructionText, { color: iconColor }]}>
            ⏳ Wait for your turn to select a card
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  scrollContent: {
    paddingHorizontal: 8,
    gap: 12,
  },
  card: {
    width: 100,
    height: 140,
    borderRadius: 12,
    borderWidth: 2,
    padding: 8,
    position: 'relative',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSymbol: {
    fontSize: 36,
  },
  cardBody: {
    alignItems: 'center',
    marginVertical: 8,
  },
  cardName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  cardFooter: {
    alignItems: 'center',
  },
  cardId: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
  selectIndicator: {
    position: 'absolute',
    bottom: -8,
    left: 8,
    right: 8,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  selectText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  instructions: {
    marginTop: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyHand: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontStyle: 'italic',
  },
});