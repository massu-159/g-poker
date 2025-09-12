/**
 * Result Screen
 * Displays game results, statistics, and options for next actions
 */

import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Platform,
  ScrollView,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  interpolate,
  Extrapolation,
  FadeIn,
  SlideInDown,
  BounceIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CreatureType } from '../lib/entities/Card';
import { useGameStore } from '../stores/gameStore';
import { useAuthState, useGameStats } from '../stores/userStore';

// Animation configurations
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
};

const TIMING_CONFIG = {
  duration: 500,
};

// Creature type configurations for results display
const CREATURE_CONFIG = {
  [CreatureType.COCKROACH]: {
    emoji: '🪳',
    name: 'ゴキブリ',
    color: '#8B4513',
  },
  [CreatureType.MOUSE]: {
    emoji: '🐭',
    name: 'ネズミ', 
    color: '#696969',
  },
  [CreatureType.BAT]: {
    emoji: '🦇',
    name: 'コウモリ',
    color: '#4B0082',
  },
  [CreatureType.FROG]: {
    emoji: '🐸',
    name: 'カエル',
    color: '#228B22',
  },
};

export interface ResultScreenProps {
  winnerId?: string;
  onNavigateToLobby?: () => void;
  onNavigateToNewGame?: () => void;
  testID?: string;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  winnerId,
  onNavigateToLobby,
  onNavigateToNewGame,
  testID,
}) => {
  const insets = useSafeAreaInsets();
  
  // State management
  const { connectionStatus, error } = useGameStore();
  const resetGame = useGameStore(state => state.reset);
  const { currentPlayer } = useAuthState();
  const { addGameResult } = useGameStats();

  // Animation values
  const titleScale = useSharedValue(0);
  const resultOpacity = useSharedValue(0);
  const statsSlide = useSharedValue(50);
  const buttonsOpacity = useSharedValue(0);
  const celebrationScale = useSharedValue(0);

  // Determine winner and game results
  // Note: This component needs to be integrated with actual game store structure
  const currentGame = null; // Placeholder - to be connected with actual game state
  const opponentPlayer = null; // Placeholder - to be connected with actual opponent data
  const userWon = winnerId === currentPlayer?.id;
  const gameEnded = false; // Placeholder - to be connected with actual game status

  // Calculate game statistics
  const gameStats = React.useMemo(() => {
    // Default values for when game data is not available
    const defaultStats = {
      totalRounds: 0,
      gameDuration: 0,
      userPenaltyCards: 0,
      opponentPenaltyCards: 0,
      userPenaltyBreakdown: {},
      opponentPenaltyBreakdown: {},
    };

    if (!currentGame || !currentPlayer) {
      return defaultStats;
    }

    // Safe access to penalty data
    const userPenalties = (currentPlayer as any)?.gameState?.penaltyPile || {};
    const opponentPenalties = (opponentPlayer as any)?.gameState?.penaltyPile || {};

    const userPenaltyCount = Object.values(userPenalties)
      .reduce((total: number, cards: any) => total + (Array.isArray(cards) ? cards.length : 0), 0);
    
    const opponentPenaltyCount = Object.values(opponentPenalties)
      .reduce((total: number, cards: any) => total + (Array.isArray(cards) ? cards.length : 0), 0);

    // Calculate game duration with safe access
    const gameData = currentGame as any;
    const startTime = gameData?.createdAt ? new Date(gameData.createdAt).getTime() : Date.now();
    const endTime = gameData?.endedAt ? 
      new Date(gameData.endedAt).getTime() : 
      Date.now();
    const durationMinutes = Math.round((endTime - startTime) / 60000);

    return {
      totalRounds: 0, // Placeholder - to be connected with actual game data
      gameDuration: durationMinutes,
      userPenaltyCards: userPenaltyCount,
      opponentPenaltyCards: opponentPenaltyCount,
      userPenaltyBreakdown: userPenalties,
      opponentPenaltyBreakdown: opponentPenalties,
    };
  }, [currentGame, currentPlayer, opponentPlayer]);

  // Entrance animations
  useEffect(() => {
    // Sequential entrance animation
    titleScale.value = withDelay(200, withSpring(1, SPRING_CONFIG));
    resultOpacity.value = withDelay(600, withTiming(1, TIMING_CONFIG));
    statsSlide.value = withDelay(1000, withTiming(0, TIMING_CONFIG));
    buttonsOpacity.value = withDelay(1400, withTiming(1, TIMING_CONFIG));
    
    // Celebration animation for winner
    if (userWon) {
      celebrationScale.value = withDelay(800, 
        withSequence(
          withSpring(1.2, SPRING_CONFIG),
          withSpring(1, SPRING_CONFIG),
          withSpring(1.1, SPRING_CONFIG),
          withSpring(1, SPRING_CONFIG)
        )
      );
    }
  }, [titleScale, resultOpacity, statsSlide, buttonsOpacity, celebrationScale, userWon]);

  // Update user's game history
  useEffect(() => {
    if (gameEnded && currentGame && currentPlayer) {
      addGameResult({
        gameId: (currentGame as any)?.id || '',
        result: userWon ? 'win' : 'loss',
        duration: gameStats.gameDuration,
        creatureType: 'cockroach', // Placeholder - to be determined from actual game data
      });
    }
  }, [gameEnded, currentGame, currentPlayer, userWon, gameStats, addGameResult]);

  // Animated styles
  const animatedTitleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: titleScale.value }],
  }));

  const animatedResultStyle = useAnimatedStyle(() => ({
    opacity: resultOpacity.value,
  }));

  const animatedStatsStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: statsSlide.value }],
    opacity: interpolate(statsSlide.value, [50, 0], [0, 1], Extrapolation.CLAMP),
  }));

  const animatedButtonsStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
  }));

  const animatedCelebrationStyle = useAnimatedStyle(() => ({
    transform: [{ scale: celebrationScale.value }],
  }));

  // Handle navigation actions
  const handleNewGame = () => {
    resetGame();
    onNavigateToNewGame?.();
  };

  const handleBackToLobby = () => {
    resetGame();
    onNavigateToLobby?.();
  };

  // Render penalty breakdown
  const renderPenaltyBreakdown = (penaltyPile: any, title: string) => (
    <View style={styles.penaltySection}>
      <Animated.Text style={styles.penaltySectionTitle}>
        {title}
      </Animated.Text>
      <View style={styles.penaltyGrid}>
        {Object.values(CreatureType).map((creatureType) => {
          const cards = penaltyPile[creatureType] || [];
          const count = Array.isArray(cards) ? cards.length : 0;
          const config = CREATURE_CONFIG[creatureType];
          
          return (
            <View key={creatureType} style={styles.penaltyItem}>
              <Animated.Text style={styles.penaltyEmoji}>
                {config.emoji}
              </Animated.Text>
              <Animated.Text 
                style={[
                  styles.penaltyCount,
                  count >= 3 && styles.penaltyCountDanger,
                  { color: config.color }
                ]}
              >
                {count}
              </Animated.Text>
              <Animated.Text style={styles.penaltyName}>
                {config.name}
              </Animated.Text>
            </View>
          );
        })}
      </View>
    </View>
  );

  if (!currentGame || !gameEnded) {
    return (
      <SafeAreaView style={styles.container} testID={testID}>
        <Animated.View style={styles.errorContainer}>
          <Animated.Text style={styles.errorText}>
            ゲーム結果が見つかりません
          </Animated.Text>
          <Animated.View 
            style={styles.errorButton}
            onTouchEnd={handleBackToLobby}
          >
            <Animated.Text style={styles.errorButtonText}>
              ロビーに戻る
            </Animated.Text>
          </Animated.View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} testID={testID}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: Math.max(insets.top, 20) }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Game Result Header */}
        <Animated.View 
          style={[styles.header, animatedTitleStyle]}
          entering={FadeIn.duration(300)}
        >
          <Animated.Text style={styles.gameEndTitle}>
            ゲーム終了
          </Animated.Text>
          
          {userWon && (
            <Animated.View style={[styles.celebrationContainer, animatedCelebrationStyle]}>
              <Animated.Text style={styles.celebrationEmoji}>
                🎉
              </Animated.Text>
            </Animated.View>
          )}
        </Animated.View>

        {/* Winner Announcement */}
        <Animated.View 
          style={[styles.resultContainer, animatedResultStyle]}
        >
          <Animated.Text 
            style={[
              styles.resultText,
              userWon ? styles.winText : styles.loseText
            ]}
          >
            {userWon ? 'あなたの勝ち！' : '相手の勝ち'}
          </Animated.Text>
          
          {winnerId && (
            <Animated.Text style={styles.winnerName}>
              勝者: {userWon ? 
                (currentPlayer?.profile?.displayName || 'あなた') :
                '相手'
              }
            </Animated.Text>
          )}
        </Animated.View>

        {/* Game Statistics */}
        <Animated.View 
          style={[styles.statsContainer, animatedStatsStyle]}
          entering={SlideInDown.delay(800).duration(500)}
        >
          <Animated.Text style={styles.statsTitle}>
            ゲーム統計
          </Animated.Text>
          
          {/* Basic Stats */}
          <View style={styles.basicStats}>
            <View style={styles.statItem}>
              <Animated.Text style={styles.statValue}>
                {gameStats.totalRounds}
              </Animated.Text>
              <Animated.Text style={styles.statLabel}>
                ラウンド数
              </Animated.Text>
            </View>
            
            <View style={styles.statItem}>
              <Animated.Text style={styles.statValue}>
                {gameStats.gameDuration}分
              </Animated.Text>
              <Animated.Text style={styles.statLabel}>
                プレイ時間
              </Animated.Text>
            </View>
            
            <View style={styles.statItem}>
              <Animated.Text style={styles.statValue}>
                {gameStats.userPenaltyCards as number}
              </Animated.Text>
              <Animated.Text style={styles.statLabel}>
                あなたのペナルティ
              </Animated.Text>
            </View>
            
            <View style={styles.statItem}>
              <Animated.Text style={styles.statValue}>
                {gameStats.opponentPenaltyCards as number}
              </Animated.Text>
              <Animated.Text style={styles.statLabel}>
                相手のペナルティ
              </Animated.Text>
            </View>
          </View>

          {/* Penalty Breakdown */}
          {renderPenaltyBreakdown(gameStats.userPenaltyBreakdown, 'あなたのペナルティカード')}
          {renderPenaltyBreakdown(gameStats.opponentPenaltyBreakdown, '相手のペナルティカード')}
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View 
          style={[styles.buttonContainer, animatedButtonsStyle]}
          entering={BounceIn.delay(1200).duration(600)}
        >
          <Animated.View 
            style={styles.primaryButton}
            onTouchEnd={handleNewGame}
          >
            <Animated.Text style={styles.primaryButtonText}>
              もう一度プレイ
            </Animated.Text>
          </Animated.View>
          
          <Animated.View 
            style={styles.secondaryButton}
            onTouchEnd={handleBackToLobby}
          >
            <Animated.Text style={styles.secondaryButtonText}>
              ロビーに戻る
            </Animated.Text>
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E3A5F',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  errorButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 20,
  },
  gameEndTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  celebrationContainer: {
    marginTop: 16,
  },
  celebrationEmoji: {
    fontSize: 48,
    textAlign: 'center',
  },
  resultContainer: {
    alignItems: 'center',
    marginBottom: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 24,
  },
  resultText: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  winText: {
    color: '#4CAF50',
  },
  loseText: {
    color: '#F44336',
  },
  winnerName: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  statsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  basicStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  penaltySection: {
    marginBottom: 20,
  },
  penaltySectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  penaltyGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  penaltyItem: {
    alignItems: 'center',
    minWidth: 70,
    marginBottom: 12,
  },
  penaltyEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  penaltyCount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  penaltyCountDanger: {
    color: '#F44336',
    fontSize: 20,
  },
  penaltyName: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  buttonContainer: {
    gap: 16,
    paddingHorizontal: 20,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ResultScreen;