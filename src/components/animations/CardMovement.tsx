/**
 * Card Movement Animations
 * Handles card playing, moving, and transition animations with React Native Reanimated 3
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

import { Card } from '../cards/Card';
import { Card as CardEntity } from '../../lib/entities/Card';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Animation configurations
const TIMING_CONFIG = {
  duration: 600,
  easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
};

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 120,
};

const QUICK_SPRING = {
  damping: 20,
  stiffness: 200,
};

// Card positions
const PLAY_AREA_CENTER = {
  x: SCREEN_WIDTH / 2 - 40,
  y: SCREEN_HEIGHT / 2 - 60,
};

export type CardMovementType = 
  | 'play-to-center'
  | 'return-to-hand' 
  | 'move-to-penalty'
  | 'flip-reveal'
  | 'highlight-select'
  | 'shake-invalid'
  | 'slide-in'
  | 'slide-out';

export interface CardMovementProps {
  card: CardEntity;
  movementType: CardMovementType;
  fromPosition: { x: number; y: number };
  toPosition?: { x: number; y: number };
  isActive: boolean;
  onAnimationComplete?: () => void;
  duration?: number;
  delay?: number;
  showBack?: boolean;
  testID?: string;
}

export const CardMovement: React.FC<CardMovementProps> = ({
  card,
  movementType,
  fromPosition,
  toPosition,
  isActive,
  onAnimationComplete,
  duration,
  delay = 0,
  showBack = false,
  testID,
}) => {
  // Animation values
  const translateX = useSharedValue(fromPosition.x);
  const translateY = useSharedValue(fromPosition.y);
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(1);
  const flipRotation = useSharedValue(0);
  const elevation = useSharedValue(1);
  const borderWidth = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  // Start animation when active
  useEffect(() => {
    if (isActive) {
      startMovementAnimation();
    } else {
      resetAnimation();
    }
  }, [isActive, movementType]);

  const startMovementAnimation = () => {
    const animationDelay = delay;
    const animationDuration = duration || TIMING_CONFIG.duration;

    switch (movementType) {
      case 'play-to-center':
        playToCenterAnimation(animationDelay, animationDuration);
        break;
      case 'return-to-hand':
        returnToHandAnimation(animationDelay, animationDuration);
        break;
      case 'move-to-penalty':
        moveToPenaltyAnimation(animationDelay, animationDuration);
        break;
      case 'flip-reveal':
        flipRevealAnimation(animationDelay);
        break;
      case 'highlight-select':
        highlightSelectAnimation();
        break;
      case 'shake-invalid':
        shakeInvalidAnimation();
        break;
      case 'slide-in':
        slideInAnimation(animationDelay, animationDuration);
        break;
      case 'slide-out':
        slideOutAnimation(animationDelay, animationDuration);
        break;
    }
  };

  const resetAnimation = () => {
    translateX.value = fromPosition.x;
    translateY.value = fromPosition.y;
    scale.value = 1;
    rotation.value = 0;
    opacity.value = 1;
    flipRotation.value = 0;
    elevation.value = 1;
    borderWidth.value = 0;
    glowOpacity.value = 0;
  };

  const playToCenterAnimation = (animationDelay: number, animationDuration: number) => {
    const target = toPosition || PLAY_AREA_CENTER;
    
    // Lift card up first
    elevation.value = withTiming(10, { duration: 200 });
    scale.value = withSequence(
      withTiming(1.1, { duration: 200 }),
      withTiming(1, { duration: animationDuration - 200 })
    );

    // Move to center with arc motion
    setTimeout(() => {
      const midPointY = Math.min(fromPosition.y, target.y) - 50;
      
      // Arc motion - up then down
      translateY.value = withSequence(
        withTiming(midPointY, { duration: animationDuration / 2, easing: Easing.out(Easing.quad) }),
        withTiming(target.y, { duration: animationDuration / 2, easing: Easing.in(Easing.quad) })
      );
      
      translateX.value = withTiming(target.x, { duration: animationDuration });
      
      // Add slight rotation for natural feel
      rotation.value = withSpring((Math.random() - 0.5) * 10, SPRING_CONFIG);
      
      setTimeout(() => {
        runOnJS(() => onAnimationComplete?.())();
      }, animationDuration);
      
    }, animationDelay);
  };

  const returnToHandAnimation = (animationDelay: number, animationDuration: number) => {
    if (!toPosition) return;

    setTimeout(() => {
      translateX.value = withSpring(toPosition.x, SPRING_CONFIG);
      translateY.value = withSpring(toPosition.y, SPRING_CONFIG);
      scale.value = withSpring(1, SPRING_CONFIG);
      rotation.value = withSpring(0, SPRING_CONFIG);
      elevation.value = withTiming(1, { duration: 200 });
      
      setTimeout(() => {
        runOnJS(() => onAnimationComplete?.())();
      }, animationDuration);
      
    }, animationDelay);
  };

  const moveToPenaltyAnimation = (animationDelay: number, animationDuration: number) => {
    if (!toPosition) return;

    setTimeout(() => {
      // Dramatic movement to penalty pile
      scale.value = withSequence(
        withTiming(1.2, { duration: 200 }),
        withTiming(0.8, { duration: animationDuration - 200 })
      );
      
      opacity.value = withSequence(
        withTiming(0.8, { duration: 100 }),
        withTiming(1, { duration: animationDuration - 100 })
      );
      
      translateX.value = withTiming(toPosition.x, { 
        duration: animationDuration,
        easing: Easing.bezier(0.25, 0.46, 0.45, 0.94)
      });
      translateY.value = withTiming(toPosition.y, { 
        duration: animationDuration,
        easing: Easing.bezier(0.25, 0.46, 0.45, 0.94)
      });
      
      // Stack effect
      rotation.value = withTiming((Math.random() - 0.5) * 20, { duration: animationDuration });
      
      setTimeout(() => {
        runOnJS(() => onAnimationComplete?.())();
      }, animationDuration);
      
    }, animationDelay);
  };

  const flipRevealAnimation = (animationDelay: number) => {
    setTimeout(() => {
      // Flip animation
      flipRotation.value = withSequence(
        withTiming(90, { duration: 200 }),
        withTiming(0, { duration: 200 })
      );
      
      // Scale effect during flip
      scale.value = withSequence(
        withTiming(1.1, { duration: 200 }),
        withTiming(1, { duration: 200 })
      );
      
      setTimeout(() => {
        runOnJS(() => onAnimationComplete?.())();
      }, 400);
      
    }, animationDelay);
  };

  const highlightSelectAnimation = () => {
    // Pulsing glow effect
    glowOpacity.value = withSequence(
      withTiming(0.8, { duration: 300 }),
      withTiming(0.4, { duration: 300 }),
      withTiming(0.8, { duration: 300 })
    );
    
    // Subtle scale and elevation
    scale.value = withSpring(1.05, QUICK_SPRING);
    elevation.value = withTiming(5, { duration: 300 });
    borderWidth.value = withTiming(3, { duration: 200 });
  };

  const shakeInvalidAnimation = () => {
    // Shake effect
    translateX.value = withSequence(
      withTiming(fromPosition.x + 10, { duration: 100 }),
      withTiming(fromPosition.x - 10, { duration: 100 }),
      withTiming(fromPosition.x + 5, { duration: 100 }),
      withTiming(fromPosition.x - 5, { duration: 100 }),
      withTiming(fromPosition.x, { duration: 100 })
    );
    
    // Red tint effect
    borderWidth.value = withSequence(
      withTiming(2, { duration: 100 }),
      withTiming(0, { duration: 400 })
    );
    
    setTimeout(() => {
      runOnJS(() => onAnimationComplete?.())();
    }, 500);
  };

  const slideInAnimation = (animationDelay: number, animationDuration: number) => {
    // Start from off-screen
    opacity.value = 0;
    translateX.value = fromPosition.x + SCREEN_WIDTH;
    
    setTimeout(() => {
      opacity.value = withTiming(1, { duration: 200 });
      translateX.value = withSpring(fromPosition.x, SPRING_CONFIG);
      scale.value = withSequence(
        withTiming(1.1, { duration: 200 }),
        withSpring(1, SPRING_CONFIG)
      );
      
      setTimeout(() => {
        runOnJS(() => onAnimationComplete?.())();
      }, animationDuration);
      
    }, animationDelay);
  };

  const slideOutAnimation = (animationDelay: number, animationDuration: number) => {
    const target = toPosition || { x: -SCREEN_WIDTH, y: fromPosition.y };
    
    setTimeout(() => {
      opacity.value = withTiming(0, { duration: animationDuration });
      translateX.value = withTiming(target.x, { duration: animationDuration });
      scale.value = withTiming(0.8, { duration: animationDuration });
      
      setTimeout(() => {
        runOnJS(() => onAnimationComplete?.())();
      }, animationDuration);
      
    }, animationDelay);
  };

  // Animated styles
  const animatedCardStyle = useAnimatedStyle(() => {
    const rotateY = flipRotation.value;
    
    return {
      position: 'absolute',
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
        { rotate: `${rotation.value}deg` },
        { rotateY: `${rotateY}deg` },
      ],
      opacity: opacity.value,
      zIndex: elevation.value,
    };
  });

  const animatedGlowStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    width: 88,
    height: 128,
    backgroundColor: '#00D4FF',
    borderRadius: 8,
    opacity: glowOpacity.value,
    transform: [
      { translateX: translateX.value - 4 },
      { translateY: translateY.value - 4 },
      { scale: scale.value * 1.05 },
    ],
    zIndex: elevation.value - 1,
  }));

  const animatedBorderStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    width: 80,
    height: 120,
    borderWidth: borderWidth.value,
    borderColor: movementType === 'shake-invalid' ? '#FF6B6B' : '#00D4FF',
    borderRadius: 8,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: elevation.value + 1,
  }));

  if (!isActive) {
    return null;
  }

  return (
    <View style={styles.container} testID={testID}>
      {/* Glow effect */}
      {(movementType === 'highlight-select') && (
        <Animated.View style={animatedGlowStyle} />
      )}
      
      {/* Card */}
      <Animated.View style={animatedCardStyle}>
        <Card
          card={card}
          {...(showBack && { showBack: true })}
          size="small"
          style={styles.movingCard}
        />
      </Animated.View>
      
      {/* Border overlay */}
      {(movementType === 'highlight-select' || movementType === 'shake-invalid') && (
        <Animated.View style={animatedBorderStyle} />
      )}
    </View>
  );
};

// Multi-card movement component for coordinated animations
export interface MultiCardMovementProps {
  cards: { card: CardEntity; fromPosition: { x: number; y: number }; toPosition?: { x: number; y: number } }[];
  movementType: CardMovementType;
  isActive: boolean;
  onAnimationComplete?: () => void;
  staggerDelay?: number;
  testID?: string;
}

export const MultiCardMovement: React.FC<MultiCardMovementProps> = ({
  cards,
  movementType,
  isActive,
  onAnimationComplete,
  staggerDelay = 100,
  testID,
}) => {
  const [completedCount, setCompletedCount] = React.useState(0);

  useEffect(() => {
    if (completedCount === cards.length && completedCount > 0) {
      onAnimationComplete?.();
      setCompletedCount(0);
    }
  }, [completedCount, cards.length]);

  const handleCardAnimationComplete = () => {
    setCompletedCount(prev => prev + 1);
  };

  return (
    <View style={styles.container} testID={testID}>
      {cards.map((cardData, index) => (
        <CardMovement
          key={cardData.card.id}
          card={cardData.card}
          fromPosition={cardData.fromPosition}
          {...(cardData.toPosition && { toPosition: cardData.toPosition })}
          movementType={movementType}
          isActive={isActive}
          delay={index * staggerDelay}
          onAnimationComplete={handleCardAnimationComplete}
        />
      ))}
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
    zIndex: 999,
    pointerEvents: 'none',
  },
  movingCard: {
    width: 80,
    height: 120,
  },
});

export default CardMovement;