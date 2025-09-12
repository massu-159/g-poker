/**
 * Hand Component
 * Displays a player's hand of cards with fan layout and interactive selection
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  ViewStyle,
  Platform,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Card as CardEntity } from '../../lib/entities/Card';
import Card from './Card';

// Get screen dimensions
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_HAND_WIDTH = SCREEN_WIDTH * 0.9;

// Animation configurations
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
};

const TIMING_CONFIG = {
  duration: 300,
};

export interface HandProps {
  cards: CardEntity[];
  selectedCardId?: string;
  isPlayerTurn?: boolean;
  isVisible?: boolean;
  isOpponentHand?: boolean;
  maxVisibleCards?: number;
  onCardSelect?: (card: CardEntity) => void;
  onCardLongPress?: (card: CardEntity) => void;
  style?: ViewStyle;
  testID?: string;
}

export const Hand: React.FC<HandProps> = ({
  cards,
  selectedCardId,
  isPlayerTurn = false,
  isVisible = true,
  isOpponentHand = false,
  maxVisibleCards = 9,
  onCardSelect,
  onCardLongPress,
  style,
  testID,
}) => {

  // Animation values
  const fanAnimation = useSharedValue(isVisible ? 1 : 0);
  const handScale = useSharedValue(1);

  // Calculate card layout properties
  const cardLayoutProps = useMemo(() => {
    const numCards = Math.min(cards.length, maxVisibleCards);
    if (numCards === 0) return { cardSpacing: 0, fanAngle: 0, cardWidth: 0 };

    // Card dimensions
    const cardWidth = Math.min(60, MAX_HAND_WIDTH / (numCards * 0.7));
    const cardHeight = cardWidth * 1.4;

    // Calculate spacing and fan angle based on number of cards
    let cardSpacing: number;
    let fanAngle: number;

    if (numCards <= 3) {
      // Few cards: spread them out more
      cardSpacing = cardWidth * 0.8;
      fanAngle = 0; // No fan for few cards
    } else if (numCards <= 6) {
      // Medium number: moderate fan
      cardSpacing = cardWidth * 0.6;
      fanAngle = 15; // Slight fan
    } else {
      // Many cards: tight fan layout
      cardSpacing = cardWidth * 0.45;
      fanAngle = 25; // Full fan
    }

    // Ensure total width doesn't exceed screen width
    const totalWidth = (numCards - 1) * cardSpacing + cardWidth;
    if (totalWidth > MAX_HAND_WIDTH) {
      cardSpacing = (MAX_HAND_WIDTH - cardWidth) / (numCards - 1);
    }

    return {
      cardSpacing,
      fanAngle,
      cardWidth,
      cardHeight,
      totalWidth: (numCards - 1) * cardSpacing + cardWidth,
    };
  }, [cards.length, maxVisibleCards]);

  // Calculate individual card positions and rotations
  const getCardTransform = (index: number, isSelected: boolean) => {
    const { cardSpacing, fanAngle, cardWidth } = cardLayoutProps;
    const numCards = Math.min(cards.length, maxVisibleCards);
    
    if (numCards <= 1) {
      return { translateX: 0, rotate: 0, zIndex: 0 };
    }

    // Center the hand
    const centerOffset = -((numCards - 1) * cardSpacing) / 2;
    const baseX = centerOffset + index * cardSpacing;

    // Fan rotation - cards at edges rotate more
    const normalizedPosition = (index - (numCards - 1) / 2) / (numCards - 1);
    const rotation = normalizedPosition * fanAngle;

    // Z-index for proper layering (center cards on top)
    const centerIndex = (numCards - 1) / 2;
    const distanceFromCenter = Math.abs(index - centerIndex);
    const zIndex = isSelected ? 100 : Math.round((numCards - distanceFromCenter) * 10);

    // Selected card adjustment
    const selectedOffset = isSelected ? -20 : 0; // Move up when selected

    return {
      translateX: baseX,
      translateY: selectedOffset,
      rotate: rotation,
      zIndex,
    };
  };

  // Update animations when visibility changes
  React.useEffect(() => {
    fanAnimation.value = withTiming(isVisible ? 1 : 0, TIMING_CONFIG);
  }, [isVisible, fanAnimation]);

  React.useEffect(() => {
    handScale.value = withSpring(isPlayerTurn ? 1.05 : 1, SPRING_CONFIG);
  }, [isPlayerTurn, handScale]);

  // Animated hand container style
  const animatedHandStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      fanAnimation.value,
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [
        { scale: handScale.value },
        {
          translateY: interpolate(
            fanAnimation.value,
            [0, 1],
            [50, 0],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  // Handle card selection
  const handleCardPress = (card: CardEntity) => {
    if (isOpponentHand || !isPlayerTurn) return;
    onCardSelect?.(card);
  };

  const handleCardLongPress = (card: CardEntity) => {
    if (isOpponentHand) return;
    onCardLongPress?.(card);
  };

  if (cards.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, style]} testID={testID}>
      <Animated.View 
        style={[
          styles.handContainer,
          { height: (cardLayoutProps.cardHeight || 84) + 40 }, // Extra space for selection offset
          animatedHandStyle
        ]}
      >
        {cards.slice(0, maxVisibleCards).map((card, index) => {
          const isSelected = card.id === selectedCardId;
          const transform = getCardTransform(index, isSelected);

          return (
            <Animated.View
              key={card.id}
              style={[
                styles.cardWrapper,
                {
                  position: 'absolute',
                  width: cardLayoutProps.cardWidth,
                  height: cardLayoutProps.cardHeight,
                  zIndex: transform.zIndex,
                  transform: [
                    { translateX: transform.translateX },
                    { translateY: transform.translateY || 0 },
                    { rotate: `${transform.rotate}deg` },
                  ],
                },
              ]}
            >
              <Card
                card={card}
                isSelected={isSelected}
                isSelectable={!isOpponentHand && isPlayerTurn}
                isInHand={true}
                isRevealed={!isOpponentHand}
                size="normal"
                onPress={handleCardPress}
                onLongPress={handleCardLongPress}
                testID={`hand-card-${index}`}
              />
            </Animated.View>
          );
        })}

        {/* Card count indicator for opponent hands */}
        {isOpponentHand && cards.length > 0 && (
          <Animated.View style={styles.cardCountIndicator}>
            <Animated.Text style={styles.cardCountText}>
              {cards.length}
            </Animated.Text>
          </Animated.View>
        )}
      </Animated.View>

      {/* Hand status indicators */}
      {!isOpponentHand && (
        <View style={styles.statusContainer}>
          {isPlayerTurn && (
            <View style={styles.turnIndicator}>
              <View style={styles.turnIndicatorDot} />
              <Animated.Text style={styles.turnIndicatorText}>あなたの番</Animated.Text>
            </View>
          )}
          
          {selectedCardId && (
            <View style={styles.selectionHint}>
              <Animated.Text style={styles.selectionHintText}>
                カードが選択されました
              </Animated.Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  handContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWrapper: {
    // Position and transform set dynamically
  },
  cardCountIndicator: {
    position: 'absolute',
    top: -15,
    right: -15,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  cardCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  turnIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 4,
  },
  turnIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  turnIndicatorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  selectionHint: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectionHintText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500',
  },
});

export default Hand;