/**
 * PlayerArea Component
 * Displays player information, cards, and interactive elements for each player
 */

import React from 'react';
import {
  View,
  StyleSheet,
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
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';

import { Player } from '../../lib/entities/Player';
import { Card as CardEntity } from '../../lib/entities/Card';
import Hand from '../cards/Hand';
import PenaltyPile from './PenaltyPile';


// Animation configurations
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
};

const TIMING_CONFIG = {
  duration: 300,
};

// Connection status colors
const CONNECTION_COLORS = {
  connected: '#4CAF50',
  connecting: '#FF9800',
  disconnected: '#F44336',
  reconnecting: '#2196F3',
};

export interface PlayerAreaProps {
  player: Player;
  isCurrentPlayer: boolean;
  isOpponent?: boolean;
  isPlayerTurn?: boolean;
  showCards?: boolean;
  isCompactView?: boolean;
  selectedCardId?: string;
  connectionStatus?: 'connected' | 'connecting' | 'disconnected' | 'reconnecting';
  
  // Card interaction
  onCardSelect?: (card: CardEntity) => void;
  onCardPlay?: (card: CardEntity) => void;
  onCardLongPress?: (card: CardEntity) => void;
  onPenaltyPilePress?: (player: Player) => void;
  
  style?: ViewStyle;
  testID?: string;
}

export const PlayerArea: React.FC<PlayerAreaProps> = ({
  player,
  isCurrentPlayer,
  isOpponent = false,
  isPlayerTurn = false,
  showCards = true,
  isCompactView = false,
  selectedCardId,
  connectionStatus = 'connected',
  onCardSelect,
  onCardLongPress,
  onPenaltyPilePress,
  style,
  testID,
}) => {
  // Animation values
  const areaScale = useSharedValue(1);
  const connectionPulse = useSharedValue(0);
  const turnGlow = useSharedValue(isPlayerTurn ? 1 : 0);

  // Player hand cards
  const playerCards = player.gameState?.hand || [];
  const penaltyCards = player.gameState?.penaltyPile || {};

  // Calculate total penalty cards
  const totalPenaltyCards: number = (() => {
    let total = 0;
    for (const cards of Object.values(penaltyCards)) {
      if (Array.isArray(cards)) {
        total += cards.length;
      }
    }
    return total;
  })();

  // Player display name
  const displayName = player.profile?.displayName || 
                     `Player ${player.id.substring(0, 6)}`;

  // Update animations based on props
  React.useEffect(() => {
    areaScale.value = withSpring(isCurrentPlayer && isPlayerTurn ? 1.05 : 1, SPRING_CONFIG);
  }, [isCurrentPlayer, isPlayerTurn, areaScale]);

  React.useEffect(() => {
    turnGlow.value = withTiming(isPlayerTurn ? 1 : 0, TIMING_CONFIG);
  }, [isPlayerTurn, turnGlow]);

  React.useEffect(() => {
    if (connectionStatus === 'connecting' || connectionStatus === 'reconnecting') {
      connectionPulse.value = withSpring(1, SPRING_CONFIG, (finished) => {
        if (finished) {
          connectionPulse.value = withSpring(0, SPRING_CONFIG);
        }
      });
    }
  }, [connectionStatus, connectionPulse]);

  // Animated styles
  const animatedAreaStyle = useAnimatedStyle(() => {
    const glowOpacity = interpolate(
      turnGlow.value,
      [0, 1],
      [0, 0.3],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale: areaScale.value }],
      shadowOpacity: Platform.OS === 'ios' ? glowOpacity : 0,
      elevation: Platform.OS === 'android' ? turnGlow.value * 8 : 0,
    };
  });

  const animatedConnectionStyle = useAnimatedStyle(() => {
    const pulseScale = interpolate(
      connectionPulse.value,
      [0, 1],
      [1, 1.2],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale: pulseScale }],
    };
  });

  // Handle card interactions
  const handleCardSelect = (card: CardEntity) => {
    if (isOpponent || !isPlayerTurn) return;
    onCardSelect?.(card);
  };

  const handleCardLongPress = (card: CardEntity) => {
    if (isOpponent) return;
    onCardLongPress?.(card);
  };

  const handlePenaltyPilePress = () => {
    onPenaltyPilePress?.(player);
  };

  if (isCompactView) {
    // Compact layout for opponent or space-constrained areas
    return (
      <Animated.View 
        style={[styles.compactContainer, style, animatedAreaStyle]} 
        testID={testID}
      >
        <View style={styles.compactHeader}>
          {/* Player info */}
          <View style={styles.compactPlayerInfo}>
            <Animated.View 
              style={[
                styles.connectionDot,
                { backgroundColor: CONNECTION_COLORS[connectionStatus] },
                animatedConnectionStyle
              ]} 
            />
            <Animated.Text 
              style={[
                styles.compactPlayerName,
                isPlayerTurn && styles.activePlayerName
              ]}
              numberOfLines={1}
            >
              {displayName}
            </Animated.Text>
            
            {/* Card count indicator */}
            <Animated.Text style={styles.cardCount}>
              {playerCards.length}枚
            </Animated.Text>
          </View>

          {/* Penalty summary */}
          {totalPenaltyCards > 0 && (
            <Animated.View 
              style={styles.penaltySummary}
              onTouchEnd={handlePenaltyPilePress}
            >
              <Animated.Text style={styles.penaltyCount}>
                ペナルティ: {totalPenaltyCards}
              </Animated.Text>
            </Animated.View>
          )}
        </View>

        {/* Turn indicator */}
        {isPlayerTurn && (
          <Animated.View 
            style={styles.compactTurnIndicator}
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
          >
            <Animated.Text style={styles.compactTurnText}>
              {isCurrentPlayer ? 'あなたの番' : '相手の番'}
            </Animated.Text>
          </Animated.View>
        )}
      </Animated.View>
    );
  }

  // Full layout for main player area
  return (
    <Animated.View 
      style={[styles.container, style, animatedAreaStyle]} 
      testID={testID}
    >
      {/* Player header */}
      <View style={styles.playerHeader}>
        <View style={styles.playerInfo}>
          {/* Avatar placeholder and connection status */}
          <Animated.View style={styles.avatarContainer}>
            <Animated.View 
              style={[
                styles.avatar,
                { borderColor: CONNECTION_COLORS[connectionStatus] }
              ]}
            >
              <Animated.Text style={styles.avatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Animated.Text>
            </Animated.View>
            <Animated.View 
              style={[
                styles.connectionIndicator,
                { backgroundColor: CONNECTION_COLORS[connectionStatus] },
                animatedConnectionStyle
              ]} 
            />
          </Animated.View>

          {/* Player name and stats */}
          <View style={styles.playerDetails}>
            <Animated.Text 
              style={[
                styles.playerName,
                isPlayerTurn && styles.activePlayerName
              ]}
            >
              {displayName}
            </Animated.Text>
            <Animated.Text style={styles.playerStats}>
              手札: {playerCards.length}枚 | ペナルティ: {totalPenaltyCards}枚
            </Animated.Text>
            
            {/* Connection status text */}
            <Animated.Text style={[styles.connectionStatus, { color: CONNECTION_COLORS[connectionStatus] }]}>
              {connectionStatus === 'connected' && '接続中'}
              {connectionStatus === 'connecting' && '接続中...'}
              {connectionStatus === 'disconnected' && '切断'}
              {connectionStatus === 'reconnecting' && '再接続中...'}
            </Animated.Text>
          </View>
        </View>

        {/* Turn indicator */}
        {isPlayerTurn && (
          <Animated.View 
            style={styles.turnIndicator}
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
          >
            <View style={styles.turnIndicatorContent}>
              <View style={styles.turnDot} />
              <Animated.Text style={styles.turnText}>
                {isCurrentPlayer ? 'あなたの番' : '相手の番'}
              </Animated.Text>
            </View>
          </Animated.View>
        )}
      </View>

      {/* Main content area */}
      <View style={styles.contentArea}>
        {/* Player hand */}
        {showCards && playerCards.length > 0 && (
          <View style={styles.handArea}>
            <Hand
              cards={playerCards}
              {...(selectedCardId && { selectedCardId })}
              isPlayerTurn={isPlayerTurn}
              isVisible={true}
              isOpponentHand={isOpponent}
              onCardSelect={handleCardSelect}
              onCardLongPress={handleCardLongPress}
              testID={`${testID}-hand`}
            />
          </View>
        )}

        {/* Action hints */}
        {isCurrentPlayer && isPlayerTurn && !isOpponent && (
          <Animated.View 
            style={styles.actionHints}
            entering={FadeIn.delay(500)}
          >
            {selectedCardId ? (
              <Animated.Text style={styles.hintText}>
                選択されたカードを出すか、別のカードを選んでください
              </Animated.Text>
            ) : (
              <Animated.Text style={styles.hintText}>
                出したいカードを選んでください
              </Animated.Text>
            )}
          </Animated.View>
        )}

        {/* Penalty pile (if not compact) */}
        {totalPenaltyCards > 0 && !isCompactView && (
          <View style={styles.penaltyArea}>
            <PenaltyPile
              penaltyCards={penaltyCards}
              playerId={player.id}
              playerName={displayName}
              isCurrentPlayer={isCurrentPlayer}
              isCompact={false}
              showWarnings={true}
              onPilePress={handlePenaltyPilePress}
              testID={`${testID}-penalty-pile`}
            />
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0,
        shadowRadius: 8,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  compactContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compactPlayerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  connectionIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  playerDetails: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  compactPlayerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  activePlayerName: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  playerStats: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 2,
  },
  connectionStatus: {
    fontSize: 10,
    fontWeight: '500',
  },
  cardCount: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  turnIndicator: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  compactTurnIndicator: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  turnIndicatorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  turnDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginRight: 6,
  },
  turnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  compactTurnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  penaltySummary: {
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  penaltyCount: {
    color: '#FF6B35',
    fontSize: 10,
    fontWeight: '600',
  },
  contentArea: {
    alignItems: 'center',
  },
  handArea: {
    width: '100%',
    marginBottom: 16,
  },
  actionHints: {
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.3)',
    marginBottom: 16,
  },
  hintText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  penaltyArea: {
    marginTop: 8,
  },
});

export default PlayerArea;