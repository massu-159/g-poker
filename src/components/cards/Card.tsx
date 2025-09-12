/**
 * Card Component
 * Displays individual ごきぶりポーカー cards with creature types and interactive animations
 */

import React from 'react';
import { 
  TouchableOpacity, 
  StyleSheet, 
  ViewStyle, 
  Dimensions,
  Platform 
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
  runOnJS,
} from 'react-native-reanimated';
import { Card as CardEntity, CreatureType } from '../../lib/entities/Card';

// Get screen dimensions for responsive design
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.18; // 18% of screen width
const CARD_HEIGHT = CARD_WIDTH * 1.4; // Standard card aspect ratio

// Creature type emojis and colors
const CREATURE_CONFIG = {
  [CreatureType.COCKROACH]: {
    emoji: '🪳',
    name: 'ゴキブリ',
    color: '#8B4513',
    backgroundColor: '#FDF5E6',
  },
  [CreatureType.MOUSE]: {
    emoji: '🐭',
    name: 'ネズミ',
    color: '#696969',
    backgroundColor: '#F5F5F5',
  },
  [CreatureType.BAT]: {
    emoji: '🦇',
    name: 'コウモリ',
    color: '#4B0082',
    backgroundColor: '#E6E6FA',
  },
  [CreatureType.FROG]: {
    emoji: '🐸',
    name: 'カエル',
    color: '#228B22',
    backgroundColor: '#F0FFF0',
  },
};

// Animation configurations
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
};

const TIMING_CONFIG = {
  duration: 200,
};

export interface CardProps {
  card: CardEntity;
  isSelected?: boolean;
  isSelectable?: boolean;
  isInHand?: boolean;
  isRevealed?: boolean;
  size?: 'small' | 'normal' | 'large';
  onPress?: (card: CardEntity) => void;
  onLongPress?: (card: CardEntity) => void;
  style?: ViewStyle;
  testID?: string;
}

export const Card: React.FC<CardProps> = ({
  card,
  isSelected = false,
  isSelectable = true,
  isInHand = false,
  isRevealed = true,
  size = 'normal',
  onPress,
  onLongPress,
  style,
  testID,
}) => {
  // Animation values
  const scale = useSharedValue(1);
  const rotateY = useSharedValue(isRevealed ? 0 : 180);
  const elevation = useSharedValue(isSelected ? 8 : 2);

  // Get creature configuration
  const creatureConfig = CREATURE_CONFIG[card.creatureType];

  // Card dimensions based on size
  const getCardDimensions = () => {
    switch (size) {
      case 'small':
        return { width: CARD_WIDTH * 0.8, height: CARD_HEIGHT * 0.8 };
      case 'large':
        return { width: CARD_WIDTH * 1.3, height: CARD_HEIGHT * 1.3 };
      default:
        return { width: CARD_WIDTH, height: CARD_HEIGHT };
    }
  };

  const cardDimensions = getCardDimensions();

  // Handle press events
  const handlePress = () => {
    if (isSelectable && onPress) {
      // Animate press feedback
      scale.value = withSpring(0.95, SPRING_CONFIG, (finished) => {
        if (finished) {
          scale.value = withSpring(1, SPRING_CONFIG);
        }
      });
      
      runOnJS(onPress)(card);
    }
  };

  const handleLongPress = () => {
    if (isSelectable && onLongPress) {
      runOnJS(onLongPress)(card);
    }
  };

  // Animated styles
  const animatedCardStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        {
          rotateY: `${rotateY.value}deg`,
        },
        ...(isSelected && isInHand ? [{ translateY: -20 }] : []),
      ],
      elevation: elevation.value,
      shadowOpacity: interpolate(
        elevation.value,
        [2, 8],
        [0.1, 0.3],
        Extrapolate.CLAMP
      ),
    };
  });

  // Card face styles
  const frontFaceStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      rotateY.value,
      [0, 90, 180],
      [1, 0, 0],
      Extrapolate.CLAMP
    );
    
    return {
      opacity,
      backfaceVisibility: 'hidden' as const,
    };
  });

  const backFaceStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      rotateY.value,
      [0, 90, 180],
      [0, 0, 1],
      Extrapolate.CLAMP
    );
    
    return {
      opacity,
      backfaceVisibility: 'hidden' as const,
    };
  });

  // Update animation when props change
  React.useEffect(() => {
    rotateY.value = withTiming(isRevealed ? 0 : 180, TIMING_CONFIG);
  }, [isRevealed, rotateY]);

  React.useEffect(() => {
    elevation.value = withTiming(isSelected ? 8 : 2, TIMING_CONFIG);
  }, [isSelected, elevation]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={isSelectable ? 0.8 : 1}
      disabled={!isSelectable}
      testID={testID}
      style={[style]}
    >
      <Animated.View style={[styles.cardContainer, cardDimensions, animatedCardStyle]}>
        {/* Card Front (Creature Face) */}
        <Animated.View 
          style={[
            styles.cardFace, 
            styles.frontFace,
            { backgroundColor: creatureConfig.backgroundColor },
            frontFaceStyle
          ]}
        >
          <Animated.Text style={[styles.creatureEmoji, { fontSize: cardDimensions.width * 0.4 }]}>
            {creatureConfig.emoji}
          </Animated.Text>
          <Animated.Text style={[styles.creatureName, { color: creatureConfig.color }]}>
            {creatureConfig.name}
          </Animated.Text>
          
          {/* Card corners with creature type indicators */}
          <Animated.View style={styles.topLeftCorner}>
            <Animated.Text style={[styles.cornerEmoji, { color: creatureConfig.color }]}>
              {creatureConfig.emoji}
            </Animated.Text>
          </Animated.View>
          <Animated.View style={styles.bottomRightCorner}>
            <Animated.Text style={[styles.cornerEmoji, styles.rotated, { color: creatureConfig.color }]}>
              {creatureConfig.emoji}
            </Animated.Text>
          </Animated.View>
        </Animated.View>

        {/* Card Back */}
        <Animated.View 
          style={[
            styles.cardFace,
            styles.backFace,
            backFaceStyle
          ]}
        >
          <Animated.Text style={styles.backPattern}>🃏</Animated.Text>
          <Animated.Text style={styles.backTitle}>ごきぶり</Animated.Text>
          <Animated.Text style={styles.backTitle}>ポーカー</Animated.Text>
        </Animated.View>

        {/* Selection indicator */}
        {isSelected && (
          <Animated.View style={styles.selectionIndicator} />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 12,
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
  cardFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  frontFace: {
    // backgroundColor set dynamically
  },
  backFace: {
    backgroundColor: '#2C3E50',
    borderColor: '#34495E',
  },
  creatureEmoji: {
    // fontSize set dynamically
    marginBottom: 4,
  },
  creatureName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    // color set dynamically
  },
  topLeftCorner: {
    position: 'absolute',
    top: 4,
    left: 4,
  },
  bottomRightCorner: {
    position: 'absolute',
    bottom: 4,
    right: 4,
  },
  cornerEmoji: {
    fontSize: 10,
    opacity: 0.7,
  },
  rotated: {
    transform: [{ rotate: '180deg' }],
  },
  backPattern: {
    fontSize: 40,
    color: '#ECF0F1',
    marginBottom: 8,
  },
  backTitle: {
    color: '#ECF0F1',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  selectionIndicator: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: '#007AFF',
    backgroundColor: 'transparent',
  },
});

export default Card;