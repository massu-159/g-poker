/**
 * GameBoard Component
 * Main game layout that orchestrates the entire ごきぶりポーカー game interface
 */

import React from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  ViewStyle,
  SafeAreaView,
  Platform,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card as CardEntity } from '../../lib/entities/Card';
import { Player } from '../../lib/entities/Player';
import { Round } from '../../lib/entities/Round';

import Card from '../cards/Card';
import PenaltyPile from './PenaltyPile';
import PlayerArea from './PlayerArea';
import GameStatus from './GameStatus';

// Get screen dimensions
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Layout constants
const HEADER_HEIGHT = 80;
const FOOTER_HEIGHT = 120;

// Animation configurations
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
};

const TIMING_CONFIG = {
  duration: 300,
};

export interface GameBoardProps {
  // Game state
  currentPlayer: Player;
  opponentPlayer: Player;
  currentRound?: Round;
  isCurrentPlayerTurn: boolean;
  gameStatus: 'waiting' | 'in_progress' | 'ended';
  winnerId?: string;

  // Card interactions
  selectedCardId?: string;
  cardInPlay?: CardEntity;
  lastPlayedCard?: CardEntity;

  // Event handlers
  onCardSelect: (card: CardEntity) => void;
  onCardPlay: (card: CardEntity, claim: string, targetPlayerId: string) => void;
  onCardResponse: (response: 'believe' | 'disbelieve' | 'pass_back') => void;
  onGameAction: (action: string, data?: any) => void;

  // UI options
  showDebugInfo?: boolean;
  isAnimationEnabled?: boolean;
  cardAnimationSpeed?: 'slow' | 'normal' | 'fast';

  style?: ViewStyle;
  testID?: string;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  currentPlayer,
  opponentPlayer,
  currentRound,
  isCurrentPlayerTurn,
  gameStatus,
  winnerId,
  selectedCardId,
  cardInPlay,
  onCardSelect,
  onCardPlay,
  onCardResponse,
  onGameAction,
  showDebugInfo = false,
  cardAnimationSpeed = 'normal',
  style,
  testID,
}) => {
  const insets = useSafeAreaInsets();

  // Animation values
  const boardScale = useSharedValue(1);
  const centerAreaOpacity = useSharedValue(1);
  const gameEndOverlay = useSharedValue(gameStatus === 'ended' ? 1 : 0);

  // Update animations based on game state
  React.useEffect(() => {
    if (gameStatus === 'ended') {
      gameEndOverlay.value = withTiming(1, TIMING_CONFIG);
      boardScale.value = withSpring(0.9, SPRING_CONFIG);
    } else {
      gameEndOverlay.value = withTiming(0, TIMING_CONFIG);
      boardScale.value = withSpring(1, SPRING_CONFIG);
    }
  }, [gameStatus, gameEndOverlay, boardScale]);

  React.useEffect(() => {
    centerAreaOpacity.value = withTiming(
      cardInPlay ? 1 : 0.7, 
      { duration: cardAnimationSpeed === 'fast' ? 150 : cardAnimationSpeed === 'slow' ? 500 : 300 }
    );
  }, [cardInPlay, centerAreaOpacity, cardAnimationSpeed]);

  // Animated styles
  const animatedBoardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: boardScale.value }],
  }));

  const animatedCenterStyle = useAnimatedStyle(() => ({
    opacity: centerAreaOpacity.value,
  }));

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: gameEndOverlay.value,
    pointerEvents: gameEndOverlay.value > 0 ? 'auto' : 'none',
  }));

  // Handle card play with validation
  const handleCardPlay = (card: CardEntity) => {
    if (!isCurrentPlayerTurn || !currentPlayer) return;
    
    // For now, we'll implement a simple auto-claim system
    // In a full implementation, this would open a claim selection dialog
    const claim = card.creatureType; // Truth for simplicity
    onCardPlay(card, claim, opponentPlayer.id);
  };

  // Calculate dynamic layout based on screen size
  const layoutProps = {
    headerHeight: Math.max(HEADER_HEIGHT, insets.top + 60),
    footerHeight: Math.max(FOOTER_HEIGHT, insets.bottom + 100),
    centerHeight: SCREEN_HEIGHT - Math.max(HEADER_HEIGHT, insets.top + 60) - Math.max(FOOTER_HEIGHT, insets.bottom + 100),
  };

  return (
    <SafeAreaView style={[styles.container, style]} testID={testID}>
      <Animated.View style={[styles.gameBoard, animatedBoardStyle]}>
        
        {/* Opponent Area (Top) */}
        <View style={[styles.opponentArea, { height: layoutProps.headerHeight }]}>
          <PlayerArea
            player={opponentPlayer}
            isCurrentPlayer={false}
            isOpponent={true}
            showCards={false}
            isCompactView={true}
            style={styles.playerAreaOpponent}
          />
        </View>

        {/* Center Game Area */}
        <Animated.View 
          style={[
            styles.centerArea, 
            { height: layoutProps.centerHeight },
            animatedCenterStyle
          ]}
        >
          {/* Game Status Header */}
          <View style={styles.gameStatusContainer}>
            <GameStatus
              gameStatus={gameStatus}
              {...(currentRound && { currentRound })}
              isCurrentPlayerTurn={isCurrentPlayerTurn}
              currentPlayerName={currentPlayer.profile?.displayName}
              opponentPlayerName={opponentPlayer.profile?.displayName}
              {...(winnerId && { winnerId })}
            />
          </View>

          {/* Card Play Area */}
          <View style={styles.cardPlayArea}>
            {cardInPlay ? (
              <Animated.View 
                entering={FadeIn.duration(300)}
                exiting={FadeOut.duration(200)}
                style={styles.cardInPlayContainer}
              >
                <Card
                  card={cardInPlay}
                  size="large"
                  isSelectable={false}
                  testID="card-in-play"
                />
                
                {/* Card claim information */}
                {currentRound?.cardInPlay?.claim && (
                  <Animated.View style={styles.claimBadge}>
                    <Animated.Text style={styles.claimText}>
                      "{currentRound.cardInPlay.claim}" と主張
                    </Animated.Text>
                  </Animated.View>
                )}

                {/* Response options for receiving player */}
                {isCurrentPlayerTurn && currentRound && !currentRound.response && (
                  <Animated.View 
                    style={styles.responseButtons}
                    entering={FadeIn.delay(300)}
                  >
                    <Animated.Text style={styles.responsePrompt}>
                      どうしますか？
                    </Animated.Text>
                    <View style={styles.buttonRow}>
                      <Animated.Text 
                        style={[styles.responseButton, styles.believeButton]}
                        onPress={() => onCardResponse('believe')}
                      >
                        信じる
                      </Animated.Text>
                      <Animated.Text 
                        style={[styles.responseButton, styles.disbelieveButton]}
                        onPress={() => onCardResponse('disbelieve')}
                      >
                        疑う
                      </Animated.Text>
                      <Animated.Text 
                        style={[styles.responseButton, styles.passBackButton]}
                        onPress={() => onCardResponse('pass_back')}
                      >
                        返す
                      </Animated.Text>
                    </View>
                  </Animated.View>
                )}
              </Animated.View>
            ) : (
              // Empty play area
              <Animated.View style={styles.emptyPlayArea}>
                <Animated.Text style={styles.emptyPlayText}>
                  {isCurrentPlayerTurn ? 'カードを選んで出してください' : '相手の番です'}
                </Animated.Text>
              </Animated.View>
            )}
          </View>

          {/* Side Penalty Piles */}
          <View style={styles.penaltyAreas}>
            <View style={styles.penaltyColumn}>
              <Animated.Text style={styles.penaltyLabel}>相手</Animated.Text>
              <PenaltyPile
                penaltyCards={opponentPlayer.gameState?.penaltyPile || {}}
                playerId={opponentPlayer.id}
                playerName={opponentPlayer.profile?.displayName}
                isCurrentPlayer={false}
                isCompact={true}
                showWarnings={true}
                testID="opponent-penalty-pile"
              />
            </View>
            
            <View style={styles.penaltyColumn}>
              <Animated.Text style={styles.penaltyLabel}>あなた</Animated.Text>
              <PenaltyPile
                penaltyCards={currentPlayer.gameState?.penaltyPile || {}}
                playerId={currentPlayer.id}
                playerName={currentPlayer.profile?.displayName}
                isCurrentPlayer={true}
                isCompact={true}
                showWarnings={true}
                testID="current-penalty-pile"
              />
            </View>
          </View>
        </Animated.View>

        {/* Current Player Area (Bottom) */}
        <View style={[styles.currentPlayerArea, { height: layoutProps.footerHeight }]}>
          <PlayerArea
            player={currentPlayer}
            isCurrentPlayer={true}
            isOpponent={false}
            showCards={true}
            {...(selectedCardId && { selectedCardId })}
            isPlayerTurn={isCurrentPlayerTurn}
            onCardSelect={onCardSelect}
            onCardPlay={handleCardPlay}
            style={styles.playerAreaCurrent}
          />
        </View>

        {/* Game End Overlay */}
        <Animated.View 
          style={[styles.gameEndOverlay, animatedOverlayStyle]}
          pointerEvents={gameStatus === 'ended' ? 'auto' : 'none'}
        >
          <Animated.View style={styles.gameEndContent}>
            <Animated.Text style={styles.gameEndTitle}>
              ゲーム終了
            </Animated.Text>
            {winnerId && (
              <Animated.Text style={styles.gameEndWinner}>
                {winnerId === currentPlayer.id ? 'あなたの勝ち！' : '相手の勝ち'}
              </Animated.Text>
            )}
            <Animated.Text 
              style={styles.gameEndButton}
              onPress={() => onGameAction('new_game')}
            >
              新しいゲーム
            </Animated.Text>
          </Animated.View>
        </Animated.View>

        {/* Debug Info Overlay */}
        {showDebugInfo && __DEV__ && (
          <View style={styles.debugOverlay}>
            <Animated.Text style={styles.debugText}>
              Current Player: {isCurrentPlayerTurn ? 'You' : 'Opponent'}
            </Animated.Text>
            <Animated.Text style={styles.debugText}>
              Game Status: {gameStatus}
            </Animated.Text>
            <Animated.Text style={styles.debugText}>
              Selected: {selectedCardId?.substring(0, 8) || 'None'}
            </Animated.Text>
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E3A5F',
  },
  gameBoard: {
    flex: 1,
  },
  opponentArea: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  centerArea: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#2C5F7C',
  },
  gameStatusContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  cardPlayArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80, // Space for game status
  },
  cardInPlayContainer: {
    alignItems: 'center',
  },
  claimBadge: {
    marginTop: 12,
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  claimText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  responseButtons: {
    marginTop: 20,
    alignItems: 'center',
  },
  responsePrompt: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  responseButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    color: '#FFFFFF',
    overflow: 'hidden',
  },
  believeButton: {
    backgroundColor: '#4CAF50',
  },
  disbelieveButton: {
    backgroundColor: '#F44336',
  },
  passBackButton: {
    backgroundColor: '#FF9800',
  },
  emptyPlayArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyPlayText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  penaltyAreas: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  penaltyColumn: {
    alignItems: 'center',
  },
  penaltyLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  currentPlayerArea: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  playerAreaOpponent: {
    // Additional styles for opponent area if needed
  },
  playerAreaCurrent: {
    // Additional styles for current player area if needed
  },
  gameEndOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameEndContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    minWidth: 200,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  gameEndTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  gameEndWinner: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  gameEndButton: {
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    overflow: 'hidden',
  },
  debugOverlay: {
    position: 'absolute',
    top: 100,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 8,
  },
  debugText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
});

export default GameBoard;