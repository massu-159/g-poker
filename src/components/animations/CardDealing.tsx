/**
 * Card Dealing Animations
 * Handles card dealing animations with React Native Reanimated 3
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

import { Card } from '../cards/Card';
import { Card as CardEntity } from '../../lib/entities/Card';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');


const SPRING_CONFIG = {
  damping: 20,
  stiffness: 90,
};

// Card positions
const DECK_POSITION = {
  x: SCREEN_WIDTH / 2 - 40,
  y: SCREEN_HEIGHT / 2 - 60,
};

const PLAYER_HAND_Y = SCREEN_HEIGHT * 0.8;
const OPPONENT_HAND_Y = SCREEN_HEIGHT * 0.2;

export interface CardDealingProps {
  cards: CardEntity[];
  playerCards: CardEntity[];
  opponentCards: CardEntity[];
  isDealing: boolean;
  onDealingComplete?: () => void;
  dealingSpeed?: 'slow' | 'normal' | 'fast';
  testID?: string;
}

export const CardDealing: React.FC<CardDealingProps> = ({
  cards,
  playerCards,
  opponentCards,
  isDealing,
  onDealingComplete,
  dealingSpeed = 'normal',
  testID,
}) => {
  // Animation values for each card
  const cardAnimations = cards.map(() => ({
    translateX: useSharedValue(DECK_POSITION.x),
    translateY: useSharedValue(DECK_POSITION.y),
    scale: useSharedValue(0.5),
    rotation: useSharedValue(0),
    opacity: useSharedValue(0),
  }));

  // Deck animation
  const deckScale = useSharedValue(1);
  const deckOpacity = useSharedValue(1);

  // Speed configurations
  const getSpeedConfig = () => {
    switch (dealingSpeed) {
      case 'slow':
        return { dealDelay: 300, duration: 1000 };
      case 'fast':
        return { dealDelay: 100, duration: 400 };
      default:
        return { dealDelay: 200, duration: 600 };
    }
  };

  const { dealDelay, duration } = getSpeedConfig();

  // Start dealing animation
  useEffect(() => {
    if (isDealing && cards.length > 0) {
      startDealingAnimation();
    }
  }, [isDealing, cards.length]);

  const startDealingAnimation = () => {
    // Reset all animations
    cardAnimations.forEach((anim) => {
      anim.translateX.value = DECK_POSITION.x;
      anim.translateY.value = DECK_POSITION.y;
      anim.scale.value = 0.5;
      anim.rotation.value = 0;
      anim.opacity.value = 0;
    });

    // Animate deck preparation
    deckScale.value = withSpring(1.1, SPRING_CONFIG);
    deckOpacity.value = withTiming(0.8, { duration: 200 });

    // Deal cards one by one
    cards.forEach((card, index) => {
      const cardAnim = cardAnimations[index];
      if (!cardAnim) return;
      
      const isPlayerCard = playerCards.some(pc => pc.id === card.id);
      const isOpponentCard = opponentCards.some(oc => oc.id === card.id);

      let targetX = SCREEN_WIDTH / 2;
      let targetY = SCREEN_HEIGHT / 2;

      if (isPlayerCard) {
        const playerIndex = playerCards.findIndex(pc => pc.id === card.id);
        targetX = 50 + (playerIndex * 45);
        targetY = PLAYER_HAND_Y;
      } else if (isOpponentCard) {
        const opponentIndex = opponentCards.findIndex(oc => oc.id === card.id);
        targetX = 50 + (opponentIndex * 45);
        targetY = OPPONENT_HAND_Y;
      }

      const delay = index * dealDelay;
      
      // Show card with initial animation
      setTimeout(() => {
        cardAnim.opacity.value = withTiming(1, { duration: 200 });
        cardAnim.scale.value = withSpring(0.8, SPRING_CONFIG);
      }, delay);

      // Move card to position with slight arc
      setTimeout(() => {
        const midPointY = Math.min(targetY, DECK_POSITION.y) - 100;
        
        // First half of arc
        cardAnim.translateY.value = withTiming(
          midPointY, 
          { duration: duration / 2 }
        );
        cardAnim.translateX.value = withTiming(
          (DECK_POSITION.x + targetX) / 2, 
          { duration: duration / 2 }
        );
        
        // Second half of arc
        setTimeout(() => {
          cardAnim.translateX.value = withTiming(targetX, {
            duration: duration / 2,
          });
          cardAnim.translateY.value = withTiming(targetY, {
            duration: duration / 2,
          });
          cardAnim.scale.value = withSpring(1, SPRING_CONFIG);
          
          // Add slight rotation for natural feel
          if (isPlayerCard || isOpponentCard) {
            cardAnim.rotation.value = withSpring(
              (Math.random() - 0.5) * 10, // Random rotation between -5 and 5 degrees
              SPRING_CONFIG
            );
          }
        }, duration / 2);

        // Call completion callback for last card
        if (index === cards.length - 1) {
          setTimeout(() => {
            runOnJS(() => {
              deckOpacity.value = withTiming(0.3, { duration: 300 });
              deckScale.value = withSpring(0.8, SPRING_CONFIG);
              onDealingComplete?.();
            })();
          }, duration);
        }
      }, delay + 100);
    });
  };

  // Animated styles for each card
  const getCardAnimatedStyle = (index: number) => {
    const cardAnim = cardAnimations[index];
    if (!cardAnim) {
      return useAnimatedStyle(() => ({
        opacity: 0,
      }));
    }
    
    return useAnimatedStyle(() => ({
      position: 'absolute',
      transform: [
        { translateX: cardAnim.translateX.value },
        { translateY: cardAnim.translateY.value },
        { scale: cardAnim.scale.value },
        { rotate: `${cardAnim.rotation.value}deg` },
      ],
      opacity: cardAnim.opacity.value,
      zIndex: index + 10,
    }));
  };

  // Deck animated style
  const deckAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: deckScale.value }],
    opacity: deckOpacity.value,
  }));

  if (!isDealing) {
    return null;
  }

  return (
    <View style={styles.container} testID={testID}>
      {/* Card deck */}
      <Animated.View 
        style={[styles.deck, deckAnimatedStyle]}
      >
        <View style={styles.deckCard} />
        <View style={[styles.deckCard, styles.deckCardOffset]} />
        <View style={[styles.deckCard, styles.deckCardOffset2]} />
      </Animated.View>

      {/* Dealing cards */}
      {cards.map((card, index) => (
        <Animated.View
          key={card.id}
          style={getCardAnimatedStyle(index)}
        >
          <Card
            card={card}
            size="small"
            {...(!playerCards.some(pc => pc.id === card.id) && { showBack: true })}
            style={styles.dealingCard}
          />
        </Animated.View>
      ))}

      {/* Dealing effect overlay */}
      <View style={styles.effectOverlay} pointerEvents="none">
        {/* Particle effects could be added here */}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    pointerEvents: 'none',
  },
  deck: {
    position: 'absolute',
    left: DECK_POSITION.x,
    top: DECK_POSITION.y,
    width: 80,
    height: 120,
    zIndex: 5,
  },
  deckCard: {
    position: 'absolute',
    width: 80,
    height: 120,
    backgroundColor: '#1E3A5F',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#34495E',
  },
  deckCardOffset: {
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  deckCardOffset2: {
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
  dealingCard: {
    width: 80,
    height: 120,
  },
  effectOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
});

export default CardDealing;