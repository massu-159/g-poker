/**
 * Game Screen
 * Main gameplay interface where players play ごきぶりポーカー
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Platform,
  Alert,
  BackHandler,
  AppState,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  FadeIn,
  FadeOut,
  SlideInDown,
} from 'react-native-reanimated';

import { Card as CardEntity } from '../lib/entities/Card';
import { useGameStore, useGameActions, useGameState } from '../stores/gameStore';
import { useAuthState } from '../stores/userStore';
import GameBoard from '../components/game/GameBoard';
import LoadingScreen from './LoadingScreen';

// Animation configurations
const TIMING_CONFIG = {
  duration: 300,
};

export interface GameScreenProps {
  gameId?: string;
  onNavigateToLobby?: () => void;
  onNavigateToResults?: (winnerId?: string) => void;
  testID?: string;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  onNavigateToLobby,
  onNavigateToResults,
  testID,
}) => {
  
  // State management
  const gameState = useGameState();
  const gameActions = useGameActions();
  const { connectionStatus, isLoading, error } = useGameStore();
  const { currentPlayer } = useAuthState();
  
  // Extract game data from gameState
  const currentGame = gameState.game;
  const currentRound = currentGame?.currentRound || null;

  // Local state
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);

  // Animation values
  const screenOpacity = useSharedValue(1);
  const gameEndOverlay = useSharedValue(0);

  // Get current player and opponent
  const gameCurrentPlayer = currentGame?.players?.find((p: any) => p.id === currentPlayer?.id);
  const opponentPlayer = currentGame?.players?.find((p: any) => p.id !== currentPlayer?.id);
  
  // Game state checks
  const isCurrentPlayerTurn = currentGame?.state?.currentTurn === currentPlayer?.id;
  const gameStatus = currentGame?.status || 'waiting_for_players';

  // Handle back button (Android)
  useEffect(() => {
    const backAction = () => {
      handleExitGame();
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, []);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Game continues in background, connection is maintained by Supabase
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  // Screen focus effect
  useEffect(() => {
    screenOpacity.value = withTiming(1, TIMING_CONFIG);
  }, [screenOpacity]);

  // Handle game end
  useEffect(() => {
    if (gameStatus === 'ended' && currentGame?.winnerId) {
      gameEndOverlay.value = withTiming(1, TIMING_CONFIG);
      
      // Navigate to results after animation
      setTimeout(() => {
        onNavigateToResults?.(currentGame.winnerId);
      }, 2000);
    }
  }, [gameStatus, currentGame?.winnerId, gameEndOverlay, onNavigateToResults]);

  // Animated styles
  const animatedScreenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const animatedGameEndStyle = useAnimatedStyle(() => ({
    opacity: gameEndOverlay.value,
    pointerEvents: gameEndOverlay.value > 0 ? 'auto' : 'none',
  }));

  // Handle card selection
  const handleCardSelect = (card: CardEntity) => {
    if (!isCurrentPlayerTurn || !currentPlayer) return;
    
    if (selectedCardId === card.id) {
      // Deselect if already selected
      setSelectedCardId(null);
    } else {
      setSelectedCardId(card.id);
    }
  };

  // Handle card play
  const handleCardPlay = async (card: CardEntity, claim: string) => {
    if (!isCurrentPlayerTurn || !gameCurrentPlayer || !opponentPlayer) return;

    try {
      await gameActions.playCard(card, claim, opponentPlayer.id);
      
      setSelectedCardId(null);
    } catch (error) {
      Alert.alert('エラー', 'カードを出すことができませんでした。');
    }
  };

  // Handle round response
  const handleRoundResponse = async (response: 'believe' | 'disbelieve' | 'pass_back') => {
    if (!currentRound || !isCurrentPlayerTurn) return;

    try {
      await gameActions.respondToCard(response);
    } catch (error) {
      Alert.alert('エラー', '応答できませんでした。');
    }
  };

  // Handle game actions
  const handleGameAction = async (action: string) => {
    switch (action) {
      case 'exit_game':
        handleExitGame();
        break;
      case 'forfeit_game':
        handleForfeitGame();
        break;
      case 'new_game':
        onNavigateToLobby?.();
        break;
      default:
        console.log('Unknown game action:', action);
    }
  };

  // Handle exit game
  const handleExitGame = () => {
    if (isExiting) return;

    const exitAction = async () => {
      setIsExiting(true);
      screenOpacity.value = withTiming(0, TIMING_CONFIG);
      
      try {
        // End game regardless of status
        await gameActions.endGame();
      } finally {
        setTimeout(() => {
          onNavigateToLobby?.();
        }, 300);
      }
    };

    if (gameStatus === 'in_progress') {
      Alert.alert(
        '確認',
        'ゲーム中です。退出すると負けになりますが、よろしいですか？',
        [
          { text: 'キャンセル', style: 'cancel' },
          { 
            text: '退出', 
            style: 'destructive',
            onPress: exitAction
          },
        ]
      );
    } else {
      Alert.alert(
        '確認',
        'ロビーに戻りますか？',
        [
          { text: 'キャンセル', style: 'cancel' },
          { text: '戻る', onPress: exitAction },
        ]
      );
    }
  };

  // Handle forfeit game
  const handleForfeitGame = () => {
    Alert.alert(
      '降参確認',
      '本当に降参しますか？相手の勝利になります。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { 
          text: '降参', 
          style: 'destructive',
          onPress: async () => {
            try {
              await gameActions.endGame();
            } catch (error) {
              Alert.alert('エラー', '降参できませんでした。');
            }
          }
        },
      ]
    );
  };

  // Show loading screen while game is loading or players are joining
  if (isLoading || !currentGame || !currentPlayer || !opponentPlayer) {
    return (
      <LoadingScreen
        message={
          !currentGame ? 'ゲームを読み込み中...' :
          !currentPlayer || !opponentPlayer ? 'プレイヤーの参加を待っています...' :
          '読み込み中...'
        }
        {...(onNavigateToLobby && { onCancel: onNavigateToLobby })}
        testID={`${testID}-loading`}
      />
    );
  }

  // Show error screen if there's a critical error
  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer} testID={testID}>
        <Animated.View style={styles.errorContent}>
          <Animated.Text style={styles.errorTitle}>
            エラーが発生しました
          </Animated.Text>
          <Animated.Text style={styles.errorMessage}>
            {error}
          </Animated.Text>
          <Animated.View 
            style={styles.errorButton}
            onTouchEnd={onNavigateToLobby}
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
      <Animated.View style={[styles.gameContainer, animatedScreenStyle]}>
        
        {/* Main game board */}
        {/* @ts-ignore - GameBoard props need interface update */}
        <GameBoard
          currentPlayer={currentPlayer}
          opponentPlayer={opponentPlayer}
          currentRound={currentRound || undefined}
          isCurrentPlayerTurn={isCurrentPlayerTurn}
          gameStatus={gameStatus as 'in_progress' | 'ended' | 'waiting'}
          {...(currentGame?.winnerId && { winnerId: currentGame.winnerId })}
          {...(selectedCardId && { selectedCardId })}
          {...(currentRound?.cardInPlay && { cardInPlay: currentRound.cardInPlay })}
          onCardSelect={handleCardSelect}
          onCardPlay={handleCardPlay}
          onCardResponse={handleRoundResponse}
          onGameAction={handleGameAction}
          style={styles.gameBoard}
          testID={`${testID}-game-board`}
        />

        {/* Connection status overlay */}
        {connectionStatus !== 'connected' && (
          <Animated.View 
            style={styles.connectionOverlay}
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(300)}
          >
            <Animated.View style={styles.connectionStatus}>
              <Animated.Text style={styles.connectionStatusText}>
                {connectionStatus === 'connecting' && '接続中...'}
                {connectionStatus === 'disconnected' && '接続が切断されました'}
                {connectionStatus === 'reconnecting' && '再接続中...'}
              </Animated.Text>
              
              {connectionStatus === 'disconnected' && (
                <Animated.View 
                  style={styles.reconnectButton}
                  onTouchEnd={() => {/* TODO: Implement manual reconnect */}}
                >
                  <Animated.Text style={styles.reconnectButtonText}>
                    再接続
                  </Animated.Text>
                </Animated.View>
              )}
            </Animated.View>
          </Animated.View>
        )}

        {/* Game end overlay */}
        <Animated.View 
          style={[styles.gameEndOverlay, animatedGameEndStyle]}
        >
          <Animated.View 
            style={styles.gameEndContent}
            entering={SlideInDown.duration(500)}
          >
            <Animated.Text style={styles.gameEndTitle}>
              ゲーム終了
            </Animated.Text>
            
            {currentGame.winnerId && (
              <Animated.Text style={styles.gameEndWinner}>
                {currentGame.winnerId === currentPlayer?.id ? 
                  '🎉 あなたの勝ち！' : 
                  '😔 相手の勝ち'
                }
              </Animated.Text>
            )}
            
            <Animated.Text style={styles.gameEndMessage}>
              結果画面に移動します...
            </Animated.Text>
          </Animated.View>
        </Animated.View>

        {/* Debug info (development only) */}
        {__DEV__ && (
          <View style={styles.debugInfo}>
            <Animated.Text style={styles.debugText}>
              Game: {currentGame.id.substring(0, 8)}
            </Animated.Text>
            <Animated.Text style={styles.debugText}>
              Turn: {isCurrentPlayerTurn ? 'You' : 'Opponent'}
            </Animated.Text>
            <Animated.Text style={styles.debugText}>
              Status: {gameStatus}
            </Animated.Text>
            {currentRound && (
              <Animated.Text style={styles.debugText}>
                Round: {currentRound.id.substring(0, 8)}
              </Animated.Text>
            )}
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
  gameContainer: {
    flex: 1,
  },
  gameBoard: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#1E3A5F',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    maxWidth: 300,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F44336',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 20,
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
  connectionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  connectionStatus: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    minWidth: 200,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  connectionStatusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  reconnectButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
  },
  reconnectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
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
    zIndex: 999,
  },
  gameEndContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    minWidth: 250,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  gameEndTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  gameEndWinner: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  gameEndMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  debugInfo: {
    position: 'absolute',
    top: 50,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 8,
    zIndex: 999,
  },
  debugText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
});

export default GameScreen;