/**
 * PenaltyPile Component
 * Displays accumulated penalty cards organized by creature type with lose condition tracking
 */

import React, { useMemo } from 'react';
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
  Extrapolate,
  FadeIn,
  FadeOut,
  Layout,
  SlideInDown,
} from 'react-native-reanimated';
import { Card as CardEntity, CreatureType } from '../../lib/entities/Card';
import Card from '../cards/Card';

// Get screen dimensions
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PILE_WIDTH = SCREEN_WIDTH * 0.2;

// Animation configurations
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
};

const TIMING_CONFIG = {
  duration: 300,
};

// Creature type configurations for penalty display
const CREATURE_CONFIG = {
  [CreatureType.COCKROACH]: {
    emoji: '🪳',
    name: 'ゴキブリ',
    shortName: 'ゴキ',
    color: '#8B4513',
  },
  [CreatureType.MOUSE]: {
    emoji: '🐭',
    name: 'ネズミ',
    shortName: 'ネズ',
    color: '#696969',
  },
  [CreatureType.BAT]: {
    emoji: '🦇',
    name: 'コウモリ',
    shortName: 'コウ',
    color: '#4B0082',
  },
  [CreatureType.FROG]: {
    emoji: '🐸',
    name: 'カエル',
    shortName: 'カエ',
    color: '#228B22',
  },
};

export interface PenaltyPileProps {
  penaltyCards: { [key in CreatureType]?: CardEntity[] };
  playerId: string;
  playerName?: string;
  isCurrentPlayer?: boolean;
  winCondition?: number; // Number of cards of same type to lose (typically 3)
  isCompact?: boolean;
  showWarnings?: boolean;
  onPilePress?: (creatureType: CreatureType, cards: CardEntity[]) => void;
  style?: ViewStyle;
  testID?: string;
}

export const PenaltyPile: React.FC<PenaltyPileProps> = ({
  penaltyCards,
  playerId,
  playerName,
  isCurrentPlayer = false,
  winCondition = 3,
  isCompact = false,
  showWarnings = true,
  onPilePress,
  style,
  testID,
}) => {
  // Animation values
  const warningPulse = useSharedValue(0);
  const pileScale = useSharedValue(1);

  // Analyze penalty situation
  const penaltyAnalysis = useMemo(() => {
    const analysis = {
      totalCards: 0,
      nearLoss: false,
      hasLost: false,
      dangerousTypes: [] as CreatureType[],
      loseType: null as CreatureType | null,
      typeCounts: {} as Record<CreatureType, number>,
    };

    Object.entries(penaltyCards).forEach(([type, cards]) => {
      const creatureType = type as CreatureType;
      const count = cards?.length || 0;
      
      analysis.totalCards += count;
      analysis.typeCounts[creatureType] = count;

      if (count >= winCondition) {
        analysis.hasLost = true;
        analysis.loseType = creatureType;
      } else if (count === winCondition - 1) {
        analysis.nearLoss = true;
        analysis.dangerousTypes.push(creatureType);
      }
    });

    return analysis;
  }, [penaltyCards, winCondition]);

  // Start warning animation when near loss
  React.useEffect(() => {
    if (penaltyAnalysis.nearLoss || penaltyAnalysis.hasLost) {
      warningPulse.value = withSpring(1, SPRING_CONFIG, (finished) => {
        if (finished) {
          warningPulse.value = withSpring(0, SPRING_CONFIG);
        }
      });
    }
  }, [penaltyAnalysis.nearLoss, penaltyAnalysis.hasLost, warningPulse]);

  React.useEffect(() => {
    pileScale.value = withSpring(isCurrentPlayer ? 1.05 : 1, SPRING_CONFIG);
  }, [isCurrentPlayer, pileScale]);

  // Animated container style
  const animatedContainerStyle = useAnimatedStyle(() => {
    const pulseScale = interpolate(
      warningPulse.value,
      [0, 1],
      [1, 1.1],
      Extrapolate.CLAMP
    );

    return {
      transform: [
        { scale: pileScale.value * pulseScale },
      ],
    };
  });

  // Handle pile press
  const handlePilePress = (creatureType: CreatureType) => {
    const cards = penaltyCards[creatureType] || [];
    if (cards.length > 0) {
      onPilePress?.(creatureType, cards);
    }
  };

  // Render individual creature pile
  const renderCreaturePile = (creatureType: CreatureType) => {
    const cards = penaltyCards[creatureType] || [];
    const count = cards.length;
    const config = CREATURE_CONFIG[creatureType];
    
    if (count === 0 && isCompact) return null;

    const isNearLoss = count === winCondition - 1;
    const hasLost = count >= winCondition;
    const isDangerous = isNearLoss || hasLost;

    return (
      <Animated.View
        key={creatureType}
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        layout={Layout.springify()}
        style={[
          styles.creaturePile,
          isDangerous && styles.dangerousPile,
          hasLost && styles.lostPile,
        ]}
      >
        {/* Creature type header */}
        <View style={styles.pileHeader}>
          <Animated.Text style={[styles.creatureEmoji, { color: config.color }]}>
            {config.emoji}
          </Animated.Text>
          <Animated.Text style={[styles.creatureName, { color: config.color }]}>
            {isCompact ? config.shortName : config.name}
          </Animated.Text>
        </View>

        {/* Card stack */}
        <View 
          style={styles.cardStack}
          onTouchEnd={() => handlePilePress(creatureType)}
        >
          {count === 0 ? (
            // Empty pile placeholder
            <View style={[styles.emptyPile, { borderColor: config.color }]}>
              <Animated.Text style={[styles.emptyPileText, { color: config.color }]}>
                0
              </Animated.Text>
            </View>
          ) : (
            // Stack of cards
            <View style={styles.stackContainer}>
              {cards.slice(0, Math.min(3, count)).map((card, index) => (
                <Animated.View
                  key={`${card.id}-${index}`}
                  entering={SlideInDown.delay(index * 100)}
                  style={[
                    styles.stackedCard,
                    {
                      top: -index * 2,
                      left: index * 1,
                      zIndex: count - index,
                    },
                  ]}
                >
                  <Card
                    card={card}
                    size="small"
                    isSelectable={false}
                    testID={`penalty-card-${creatureType}-${index}`}
                  />
                </Animated.View>
              ))}
              
              {/* Card count badge */}
              <Animated.View 
                style={[
                  styles.countBadge,
                  { backgroundColor: config.color },
                  isDangerous && styles.dangerousBadge,
                ]}
              >
                <Animated.Text style={styles.countText}>
                  {count}
                </Animated.Text>
              </Animated.View>
            </View>
          )}
        </View>

        {/* Warning indicators */}
        {showWarnings && isDangerous && (
          <Animated.View 
            style={[
              styles.warningIndicator,
              hasLost ? styles.loseIndicator : styles.dangerIndicator,
            ]}
            entering={FadeIn.duration(200)}
          >
            <Animated.Text style={styles.warningText}>
              {hasLost ? '負け!' : '危険!'}
            </Animated.Text>
          </Animated.View>
        )}
      </Animated.View>
    );
  };

  return (
    <Animated.View 
      style={[styles.container, style, animatedContainerStyle]} 
      testID={testID}
    >
      {/* Player info header */}
      {!isCompact && (
        <View style={styles.playerHeader}>
          <Animated.Text style={[styles.playerName, isCurrentPlayer && styles.currentPlayerName]}>
            {playerName || `Player ${playerId.substring(0, 8)}`}
          </Animated.Text>
          <Animated.Text style={styles.totalCount}>
            ペナルティ: {penaltyAnalysis.totalCards}枚
          </Animated.Text>
        </View>
      )}

      {/* Penalty piles grid */}
      <View style={[styles.pilesGrid, isCompact && styles.compactGrid]}>
        {Object.values(CreatureType).map(creatureType => 
          renderCreaturePile(creatureType)
        )}
      </View>

      {/* Overall status */}
      {penaltyAnalysis.hasLost && (
        <Animated.View 
          style={styles.loseStatus}
          entering={SlideInDown.duration(500)}
        >
          <Animated.Text style={styles.loseStatusText}>
            {CREATURE_CONFIG[penaltyAnalysis.loseType!].emoji} で負け!
          </Animated.Text>
        </Animated.View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 8,
  },
  playerHeader: {
    marginBottom: 12,
    alignItems: 'center',
  },
  playerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  currentPlayerName: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  totalCount: {
    fontSize: 11,
    color: '#666',
  },
  pilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  compactGrid: {
    gap: 8,
  },
  creaturePile: {
    alignItems: 'center',
    minWidth: 60,
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: '#E9ECEF',
  },
  dangerousPile: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF5F3',
  },
  lostPile: {
    borderColor: '#DC3545',
    backgroundColor: '#F8D7DA',
  },
  pileHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  creatureEmoji: {
    fontSize: 16,
    marginBottom: 2,
  },
  creatureName: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  cardStack: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  emptyPile: {
    width: 40,
    height: 56,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  emptyPileText: {
    fontSize: 12,
    fontWeight: 'bold',
    opacity: 0.5,
  },
  stackContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackedCard: {
    position: 'absolute',
  },
  countBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.22,
        shadowRadius: 2.22,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  dangerousBadge: {
    backgroundColor: '#FF6B35',
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  warningIndicator: {
    position: 'absolute',
    top: -5,
    right: -5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    zIndex: 1001,
  },
  dangerIndicator: {
    backgroundColor: '#FF6B35',
  },
  loseIndicator: {
    backgroundColor: '#DC3545',
  },
  warningText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  loseStatus: {
    marginTop: 16,
    backgroundColor: '#DC3545',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
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
  loseStatusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default PenaltyPile;