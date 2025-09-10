/**
 * GameStatus Component
 * Displays current game state, turn information, and round progress indicators
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
  withRepeat,
  withSequence,
  interpolate,
  Extrapolation,
  FadeIn,
  SlideInDown,
  SlideOutUp,
} from 'react-native-reanimated';

import { Round } from '../../lib/entities/Round';
import { CreatureType } from '../../lib/entities/Card';

// Animation configurations
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
};

const TIMING_CONFIG = {
  duration: 300,
};

// Creature type configurations
const CREATURE_CONFIG = {
  [CreatureType.COCKROACH]: { emoji: '🪳', name: 'ゴキブリ' },
  [CreatureType.MOUSE]: { emoji: '🐭', name: 'ネズミ' },
  [CreatureType.BAT]: { emoji: '🦇', name: 'コウモリ' },
  [CreatureType.FROG]: { emoji: '🐸', name: 'カエル' },
};

export interface GameStatusProps {
  gameStatus: 'waiting' | 'in_progress' | 'ended';
  currentRound?: Round;
  isCurrentPlayerTurn?: boolean;
  currentPlayerName?: string;
  opponentPlayerName?: string;
  winnerId?: string;
  gameTimer?: number; // Seconds remaining in game
  turnTimer?: number; // Seconds remaining in current turn
  roundNumber?: number;
  totalRounds?: number;
  showDetailedStatus?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export const GameStatus: React.FC<GameStatusProps> = ({
  gameStatus,
  currentRound,
  isCurrentPlayerTurn = false,
  winnerId,
  gameTimer,
  turnTimer,
  roundNumber = 1,
  totalRounds,
  showDetailedStatus = true,
  style,
  testID,
}) => {
  // Animation values
  const statusScale = useSharedValue(1);
  const turnGlow = useSharedValue(0);
  const urgencyPulse = useSharedValue(0);

  // Start urgency animation when timer is low
  React.useEffect(() => {
    if (turnTimer && turnTimer <= 10 && turnTimer > 0) {
      urgencyPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 500 }),
          withTiming(0, { duration: 500 })
        ),
        -1,
        false
      );
    } else {
      urgencyPulse.value = withTiming(0, TIMING_CONFIG);
    }
  }, [turnTimer, urgencyPulse]);

  // Pulse animation for active turn
  React.useEffect(() => {
    if (gameStatus === 'in_progress') {
      turnGlow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1500 }),
          withTiming(0.3, { duration: 1500 })
        ),
        -1,
        false
      );
    } else {
      turnGlow.value = withTiming(0, TIMING_CONFIG);
    }
  }, [gameStatus, turnGlow]);

  React.useEffect(() => {
    statusScale.value = withSpring(gameStatus === 'ended' ? 1.1 : 1, SPRING_CONFIG);
  }, [gameStatus, statusScale]);

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Animated styles
  const animatedStatusStyle = useAnimatedStyle(() => {
    const glowIntensity = interpolate(
      turnGlow.value,
      [0, 1],
      [0.7, 1],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale: statusScale.value }],
      opacity: glowIntensity,
    };
  });

  const animatedTimerStyle = useAnimatedStyle(() => {
    const urgencyColor = interpolate(
      urgencyPulse.value,
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP
    );

    return {
      backgroundColor: urgencyColor > 0.5 ? '#FF4444' : '#007AFF',
    };
  });

  const animatedUrgencyStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      urgencyPulse.value,
      [0, 1],
      [1, 1.1],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale }],
    };
  });

  // Render game waiting state
  if (gameStatus === 'waiting') {
    return (
      <Animated.View 
        style={[styles.container, styles.waitingContainer, style]} 
        entering={FadeIn.duration(300)}
        testID={testID}
      >
        <Animated.Text style={styles.waitingText}>
          ゲーム開始を待っています...
        </Animated.Text>
        <View style={styles.loadingDots}>
          <Animated.View style={styles.loadingDot} />
          <Animated.View style={styles.loadingDot} />
          <Animated.View style={styles.loadingDot} />
        </View>
      </Animated.View>
    );
  }

  // Render game ended state
  if (gameStatus === 'ended') {
    return (
      <Animated.View 
        style={[styles.container, styles.endedContainer, style, animatedStatusStyle]} 
        entering={SlideInDown.duration(500)}
        testID={testID}
      >
        <Animated.Text style={styles.endedTitle}>
          ゲーム終了
        </Animated.Text>
        {winnerId && (
          <Animated.Text style={styles.winnerText}>
            {winnerId === 'current_player' ? '🎉 あなたの勝ち！' : '😔 相手の勝ち'}
          </Animated.Text>
        )}
        <Animated.Text style={styles.endedSubtitle}>
          ラウンド {roundNumber} で終了
        </Animated.Text>
      </Animated.View>
    );
  }

  // Main game in-progress status
  return (
    <Animated.View 
      style={[styles.container, style, animatedStatusStyle]} 
      testID={testID}
    >
      {/* Main status bar */}
      <View style={styles.mainStatus}>
        {/* Turn indicator */}
        <Animated.View 
          style={[
            styles.turnIndicator,
            isCurrentPlayerTurn ? styles.yourTurn : styles.opponentTurn
          ]}
        >
          <Animated.Text 
            style={[
              styles.turnText,
              isCurrentPlayerTurn ? styles.yourTurnText : styles.opponentTurnText
            ]}
          >
            {isCurrentPlayerTurn ? '🎯 あなたの番' : '⏳ 相手の番'}
          </Animated.Text>
        </Animated.View>

        {/* Timer section */}
        {(turnTimer !== undefined || gameTimer !== undefined) && (
          <View style={styles.timerSection}>
            {turnTimer !== undefined && turnTimer > 0 && (
              <Animated.View 
                style={[styles.timer, styles.turnTimer, animatedTimerStyle, animatedUrgencyStyle]}
              >
                <Animated.Text style={styles.timerText}>
                  {formatTime(turnTimer)}
                </Animated.Text>
              </Animated.View>
            )}
            
            {gameTimer !== undefined && gameTimer > 0 && showDetailedStatus && (
              <Animated.View style={[styles.timer, styles.gameTimer]}>
                <Animated.Text style={styles.timerLabel}>残り時間</Animated.Text>
                <Animated.Text style={styles.timerText}>
                  {formatTime(gameTimer)}
                </Animated.Text>
              </Animated.View>
            )}
          </View>
        )}
      </View>

      {/* Round information */}
      {currentRound && showDetailedStatus && (
        <Animated.View 
          style={styles.roundInfo}
          entering={SlideInDown.duration(300)}
          exiting={SlideOutUp.duration(200)}
        >
          {/* Round header */}
          <View style={styles.roundHeader}>
            <Animated.Text style={styles.roundNumber}>
              ラウンド {roundNumber}
              {totalRounds && ` / ${totalRounds}`}
            </Animated.Text>
            
            {/* Game phase indicator */}
            <View style={styles.phaseIndicator}>
              <Animated.Text style={styles.phaseText}>
                {currentRound.cardInPlay ? 'カード判定中' : 'カード選択中'}
              </Animated.Text>
            </View>
          </View>

          {/* Current round details */}
          {currentRound.cardInPlay && (
            <Animated.View 
              style={styles.roundDetails}
              entering={FadeIn.duration(300)}
            >
              {/* Card claim information */}
              {currentRound.cardInPlay?.claim && (
                <View style={styles.claimInfo}>
                  <Animated.Text style={styles.claimLabel}>主張:</Animated.Text>
                  <View style={styles.claimBadge}>
                    <Animated.Text style={styles.claimEmoji}>
                      {CREATURE_CONFIG[currentRound.cardInPlay.claim as CreatureType]?.emoji}
                    </Animated.Text>
                    <Animated.Text style={styles.claimText}>
                      {CREATURE_CONFIG[currentRound.cardInPlay.claim as CreatureType]?.name}
                    </Animated.Text>
                  </View>
                </View>
              )}

              {/* Response status */}
              {currentRound.response ? (
                <View style={styles.responseStatus}>
                  <Animated.Text style={styles.responseLabel}>
                    {currentRound.response.type === 'believe' && '✅ 信じる'}
                    {currentRound.response.type === 'disbelieve' && '❌ 疑う'}
                    {currentRound.response.type === 'pass_back' && '🔄 返す'}
                  </Animated.Text>
                </View>
              ) : (
                isCurrentPlayerTurn && (
                  <Animated.View style={styles.waitingResponse}>
                    <Animated.Text style={styles.waitingResponseText}>
                      あなたの判断を待っています...
                    </Animated.Text>
                  </Animated.View>
                )
              )}
            </Animated.View>
          )}
        </Animated.View>
      )}

      {/* Connection status (if needed) */}
      {gameStatus === 'in_progress' && Platform.OS !== 'web' && (
        <Animated.View style={styles.connectionStatus}>
          <View style={styles.connectionDot} />
          <Animated.Text style={styles.connectionText}>接続中</Animated.Text>
        </Animated.View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  waitingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  endedContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  mainStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  turnIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flex: 1,
    marginRight: 12,
  },
  yourTurn: {
    backgroundColor: '#4CAF50',
  },
  opponentTurn: {
    backgroundColor: '#FF9800',
  },
  turnText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  yourTurnText: {
    color: '#FFFFFF',
  },
  opponentTurnText: {
    color: '#FFFFFF',
  },
  timerSection: {
    flexDirection: 'row',
    gap: 8,
  },
  timer: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 60,
    alignItems: 'center',
  },
  turnTimer: {
    backgroundColor: '#007AFF',
  },
  gameTimer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  timerLabel: {
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: '500',
    marginBottom: 2,
  },
  timerText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  roundInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  roundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roundNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  phaseIndicator: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  phaseText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  roundDetails: {
    gap: 8,
  },
  claimInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  claimLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  claimBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  claimEmoji: {
    fontSize: 14,
  },
  claimText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  responseStatus: {
    alignItems: 'center',
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  waitingResponse: {
    alignItems: 'center',
  },
  waitingResponseText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 6,
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
  },
  connectionText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  waitingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
  },
  endedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  winnerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 4,
  },
  endedSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
});

export default GameStatus;