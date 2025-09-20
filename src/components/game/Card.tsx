/**
 * Card Component for G-Poker
 * Displays individual creature cards for Cockroach Poker with animations and states
 */

import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  Card as CardType,
  CreatureType,
  getCreatureTypeColor,
  getCreatureTypeSymbol,
  getCreatureTypeName,
  CardVisibility,
  CardAnimation,
} from '@/types/cards';

interface CardProps {
  card?: CardType;
  visibility?: CardVisibility;
  size?: 'small' | 'medium' | 'large';
  animation?: CardAnimation;
  onPress?: () => void;
  disabled?: boolean;
  highlighted?: boolean;
  style?: any;
}

export function Card({
  card,
  visibility = 'face',
  size = 'medium',
  animation,
  onPress,
  disabled = false,
  highlighted = false,
  style,
}: CardProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  const animatedValue = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (animation?.isAnimating) {
      const { animationType, duration = 300, delay = 0 } = animation;

      const animationSequence = () => {
        switch (animationType) {
          case 'deal':
            return Animated.sequence([
              Animated.delay(delay),
              Animated.timing(animatedValue, {
                toValue: 1.1,
                duration: duration / 2,
                useNativeDriver: true,
              }),
              Animated.timing(animatedValue, {
                toValue: 1,
                duration: duration / 2,
                useNativeDriver: true,
              }),
            ]);

          case 'flip':
            return Animated.sequence([
              Animated.delay(delay),
              Animated.timing(animatedValue, {
                toValue: 0,
                duration: duration / 2,
                useNativeDriver: true,
              }),
              Animated.timing(animatedValue, {
                toValue: 1,
                duration: duration / 2,
                useNativeDriver: true,
              }),
            ]);

          case 'move':
            return Animated.sequence([
              Animated.delay(delay),
              Animated.timing(animatedValue, {
                toValue: 1.05,
                duration: duration,
                useNativeDriver: true,
              }),
              Animated.timing(animatedValue, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
              }),
            ]);

          default:
            return Animated.timing(animatedValue, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            });
        }
      };

      animationSequence().start();
    }
  }, [animation, animatedValue]);

  const getCardDimensions = () => {
    switch (size) {
      case 'small':
        return { width: 40, height: 56 };
      case 'medium':
        return { width: 60, height: 84 };
      case 'large':
        return { width: 80, height: 112 };
      default:
        return { width: 60, height: 84 };
    }
  };

  const getFontSizes = () => {
    switch (size) {
      case 'small':
        return { name: 10, symbol: 20 };
      case 'medium':
        return { name: 12, symbol: 24 };
      case 'large':
        return { name: 14, symbol: 28 };
      default:
        return { name: 12, symbol: 24 };
    }
  };

  const cardDimensions = getCardDimensions();
  const fontSizes = getFontSizes();

  const renderCardContent = () => {
    if (visibility === 'hidden') {
      return null;
    }

    if (visibility === 'back' || !card) {
      return (
        <View style={[styles.cardBack, cardDimensions]}>
          <View style={styles.cardBackPattern}>
            <ThemedText style={[styles.cardBackText, { fontSize: fontSizes.name }]}>
              ごきぶり
            </ThemedText>
            <ThemedText style={[styles.cardBackText, { fontSize: fontSizes.name }]}>
              ポーカー
            </ThemedText>
          </View>
        </View>
      );
    }

    const creatureColor = getCreatureTypeColor(card.creatureType);
    const creatureSymbol = getCreatureTypeSymbol(card.creatureType);
    const creatureName = getCreatureTypeName(card.creatureType);

    return (
      <View
        style={[
          styles.cardFace,
          cardDimensions,
          { backgroundColor: '#ffffff' },
          highlighted && { borderColor: tintColor, borderWidth: 2 },
        ]}
      >
        {/* Top left creature symbol */}
        <View style={styles.topLeft}>
          <ThemedText
            style={[
              styles.creatureSymbol,
              { fontSize: fontSizes.symbol }
            ]}
          >
            {creatureSymbol}
          </ThemedText>
        </View>

        {/* Center creature display */}
        <View style={styles.center}>
          <ThemedText
            style={[
              styles.centerSymbol,
              {
                fontSize: Math.floor(fontSizes.symbol * 1.8),
              }
            ]}
          >
            {creatureSymbol}
          </ThemedText>
          <ThemedText
            style={[
              styles.creatureName,
              {
                fontSize: fontSizes.name,
                color: creatureColor,
              }
            ]}
          >
            {creatureName}
          </ThemedText>
        </View>

        {/* Bottom right creature symbol (rotated) */}
        <View style={styles.bottomRight}>
          <ThemedText
            style={[
              styles.creatureSymbol,
              styles.rotated,
              { fontSize: fontSizes.symbol }
            ]}
          >
            {creatureSymbol}
          </ThemedText>
        </View>
      </View>
    );
  };

  const CardComponent = onPress ? TouchableOpacity : View;

  return (
    <Animated.View
      style={[
        { transform: [{ scale: animatedValue }] },
        style,
      ]}
    >
      <CardComponent
        style={[
          styles.cardContainer,
          disabled && styles.disabled,
        ]}
        onPress={onPress}
        disabled={disabled || !onPress}
        activeOpacity={onPress ? 0.8 : 1}
      >
        {renderCardContent()}
      </CardComponent>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardFace: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBack: {
    backgroundColor: '#4a5568',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBackPattern: {
    backgroundColor: '#2d3748',
    borderRadius: 4,
    padding: 4,
    width: '80%',
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  cardBackText: {
    color: '#ffffff',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 8,
  },
  topLeft: {
    position: 'absolute',
    top: 4,
    left: 4,
    alignItems: 'center',
  },
  bottomRight: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    alignItems: 'center',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  creatureSymbol: {
    fontWeight: 'bold',
    lineHeight: 24,
  },
  creatureName: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 2,
  },
  centerSymbol: {
    fontWeight: 'bold',
    opacity: 0.8,
    textAlign: 'center',
  },
  rotated: {
    transform: [{ rotate: '180deg' }],
  },
  disabled: {
    opacity: 0.5,
  },
});

export default Card;