/**
 * Lobby Screen
 * Main entry point for players to create/join games and manage matchmaking
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
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

import { Game } from '../lib/entities/Game';
// Mock stores for testing - replace with real stores when navigation is implemented
let useGameStore: any;
let useUserStore: any;

try {
  useGameStore = require('../components/MockProviders').useGameStore;
  useUserStore = require('../components/MockProviders').useUserStore;
} catch {
  // Fallback to real stores if MockProviders not available
  useGameStore = require('../stores/gameStore').useGameStore;
  useUserStore = require('../stores/userStore').useUserStore;
}

// Animation configurations
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
};

const TIMING_CONFIG = {
  duration: 300,
};

export interface LobbyScreenProps {
  onNavigateToGame?: (gameId: string) => void;
  onNavigateToSettings?: () => void;
  testID?: string;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  onNavigateToGame,
  onNavigateToSettings,
  testID,
}) => {
  
  // State management
  const { 
    games, 
    currentGame, 
    connectionStatus,
    isLoading,
    error,
    createGame,
    joinGame,
    leaveGame,
    refreshGames,
  } = useGameStore();
  
  const { 
    user, 
    isAuthenticated,
    login 
  } = useUserStore();

  // Local state
  const [isCreatingGame, setIsCreatingGame] = useState(false);

  // Animation values
  const headerScale = useSharedValue(1);
  const connectionPulse = useSharedValue(0);
  const createGameScale = useSharedValue(1);
  const refreshSpinner = useSharedValue(0);

  // Auto-refresh available games
  useEffect(() => {
    if (isAuthenticated) {
      refreshGames();
      const interval = setInterval(refreshGames, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
    return undefined;
  }, [isAuthenticated, refreshGames]);

  // Navigate to game when current game changes
  useEffect(() => {
    if (currentGame && currentGame.status === 'in_progress') {
      onNavigateToGame?.(currentGame.id);
    }
  }, [currentGame, onNavigateToGame]);

  // Connection status animation
  useEffect(() => {
    if (connectionStatus === 'connecting' || connectionStatus === 'reconnecting') {
      connectionPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000 }),
          withTiming(0, { duration: 1000 })
        ),
        -1,
        false
      );
    } else {
      connectionPulse.value = withTiming(0, TIMING_CONFIG);
    }
  }, [connectionStatus, connectionPulse]);

  // Loading animation
  useEffect(() => {
    if (isLoading) {
      refreshSpinner.value = withRepeat(
        withTiming(360, { duration: 1000 }),
        -1,
        false
      );
    } else {
      refreshSpinner.value = withTiming(0, TIMING_CONFIG);
    }
  }, [isLoading, refreshSpinner]);

  // Animated styles
  const animatedHeaderStyle = useAnimatedStyle(() => ({
    transform: [{ scale: headerScale.value }],
  }));

  const animatedConnectionStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      connectionPulse.value,
      [0, 1],
      [0.5, 1],
      Extrapolation.CLAMP
    );
    
    return { opacity };
  });

  const animatedCreateButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: createGameScale.value }],
  }));

  const animatedRefreshStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${refreshSpinner.value}deg` }],
  }));

  // Handle authentication
  const handleLogin = async () => {
    try {
      await login();
    } catch (err) {
      Alert.alert('エラー', 'ログインに失敗しました。');
    }
  };

  // Handle game creation
  const handleCreateGame = async () => {
    if (!isAuthenticated || !user) {
      Alert.alert('エラー', 'ログインが必要です。');
      return;
    }

    setIsCreatingGame(true);
    createGameScale.value = withSpring(0.95, SPRING_CONFIG);

    try {
      const newGame = await createGame({
        maxPlayers: 2,
        isPrivate: false,
        gameOptions: {
          turnTimeLimit: 60,
          gameTimeLimit: 1800, // 30 minutes
        },
      });

      if (newGame) {
        // Auto-join the created game
        await joinGame(newGame.id);
      }
    } catch (err) {
      Alert.alert('エラー', 'ゲームの作成に失敗しました。');
    } finally {
      setIsCreatingGame(false);
      createGameScale.value = withSpring(1, SPRING_CONFIG);
    }
  };

  // Handle joining existing game
  const handleJoinGame = async (gameId: string) => {
    if (!isAuthenticated || !user) {
      Alert.alert('エラー', 'ログインが必要です。');
      return;
    }

    if (currentGame) {
      Alert.alert(
        '確認',
        '現在のゲームから退出して、新しいゲームに参加しますか？',
        [
          { text: 'キャンセル', style: 'cancel' },
          { 
            text: '参加', 
            onPress: async () => {
              await leaveGame();
              await joinGame(gameId);
            }
          },
        ]
      );
      return;
    }

    try {
      await joinGame(gameId);
    } catch (err) {
      Alert.alert('エラー', 'ゲームに参加できませんでした。');
    }
  };

  // Handle leaving current game
  const handleLeaveGame = async () => {
    if (!currentGame) return;

    Alert.alert(
      '確認',
      'ゲームから退出しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        { 
          text: '退出', 
          style: 'destructive',
          onPress: async () => {
            await leaveGame();
          }
        },
      ]
    );
  };

  // Handle refresh
  const handleRefresh = () => {
    refreshGames();
  };

  // Get connection status color
  const getConnectionColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#4CAF50';
      case 'connecting': return '#FF9800';
      case 'disconnected': return '#F44336';
      case 'reconnecting': return '#2196F3';
      default: return '#9E9E9E';
    }
  };

  // Get connection status text
  const getConnectionText = () => {
    switch (connectionStatus) {
      case 'connected': return '接続済み';
      case 'connecting': return '接続中...';
      case 'disconnected': return '切断';
      case 'reconnecting': return '再接続中...';
      default: return '不明';
    }
  };

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} testID={testID}>
        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Animated.View 
            style={styles.loginContainer}
            entering={FadeIn.duration(500)}
          >
            <Animated.Text style={styles.loginTitle}>
              ごきぶりポーカー
            </Animated.Text>
            <Animated.Text style={styles.loginSubtitle}>
              ゲームを開始するにはログインしてください
            </Animated.Text>
            
            <Animated.View 
              style={styles.loginButton}
              onTouchEnd={handleLogin}
            >
              <Animated.Text style={styles.loginButtonText}>
                ログイン
              </Animated.Text>
            </Animated.View>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} testID={testID}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <Animated.View 
          style={[
            styles.header,
            { paddingTop: 16 },
            animatedHeaderStyle
          ]}
        >
          <View style={styles.headerContent}>
            <View style={styles.titleSection}>
              <Animated.Text style={styles.title}>
                ごきぶりポーカー
              </Animated.Text>
              <Animated.Text style={styles.subtitle}>
                オンライン対戦ロビー
              </Animated.Text>
            </View>

            {/* Connection status */}
            <Animated.View 
              style={[styles.connectionStatus, animatedConnectionStyle]}
            >
              <Animated.View 
                style={[
                  styles.connectionDot,
                  { backgroundColor: getConnectionColor() }
                ]}
              />
              <Animated.Text 
                style={[
                  styles.connectionText,
                  { color: getConnectionColor() }
                ]}
              >
                {getConnectionText()}
              </Animated.Text>
            </Animated.View>
          </View>

          {/* User info */}
          {user && (
            <Animated.View 
              style={styles.userInfo}
              entering={SlideInDown.duration(300)}
            >
              <Animated.Text style={styles.userWelcome}>
                ようこそ、{user.profile?.displayName || 'プレイヤー'}さん
              </Animated.Text>
              <Animated.View 
                style={styles.settingsButton}
                onTouchEnd={onNavigateToSettings}
              >
                <Animated.Text style={styles.settingsButtonText}>
                  設定
                </Animated.Text>
              </Animated.View>
            </Animated.View>
          )}
        </Animated.View>

        {/* Main content */}
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Current game status */}
          {currentGame && (
            <Animated.View 
              style={styles.currentGameContainer}
              entering={SlideInDown.duration(300)}
              exiting={SlideOutUp.duration(200)}
            >
              <Animated.Text style={styles.currentGameTitle}>
                現在のゲーム
              </Animated.Text>
              <View style={styles.currentGameContent}>
                <View style={styles.currentGameInfo}>
                  <Animated.Text style={styles.currentGameId}>
                    ゲームID: {currentGame.id.substring(0, 8)}
                  </Animated.Text>
                  <Animated.Text style={styles.currentGameStatus}>
                    ステータス: {
                      currentGame.status === 'waiting_for_players' ? '待機中' :
                      currentGame.status === 'in_progress' ? 'プレイ中' :
                      '終了'
                    }
                  </Animated.Text>
                  <Animated.Text style={styles.currentGamePlayers}>
                    プレイヤー: {currentGame.playerIds?.length || 0}/2
                  </Animated.Text>
                </View>
                
                <View style={styles.currentGameActions}>
                  {currentGame.status === 'in_progress' ? (
                    <Animated.View 
                      style={styles.playButton}
                      onTouchEnd={() => onNavigateToGame?.(currentGame.id)}
                    >
                      <Animated.Text style={styles.playButtonText}>
                        ゲームに戻る
                      </Animated.Text>
                    </Animated.View>
                  ) : (
                    <Animated.View 
                      style={styles.leaveButton}
                      onTouchEnd={handleLeaveGame}
                    >
                      <Animated.Text style={styles.leaveButtonText}>
                        ゲーム退出
                      </Animated.Text>
                    </Animated.View>
                  )}
                </View>
              </View>
            </Animated.View>
          )}

          {/* Game creation */}
          {!currentGame && (
            <Animated.View 
              style={styles.createGameContainer}
              entering={FadeIn.duration(300)}
            >
              <Animated.Text style={styles.sectionTitle}>
                新しいゲームを作成
              </Animated.Text>
              <Animated.View 
                style={[styles.createGameButton, animatedCreateButtonStyle]}
                onTouchEnd={handleCreateGame}
              >
                {isCreatingGame ? (
                  <Animated.Text style={styles.createGameButtonText}>
                    作成中...
                  </Animated.Text>
                ) : (
                  <Animated.Text style={styles.createGameButtonText}>
                    🎮 ゲーム作成
                  </Animated.Text>
                )}
              </Animated.View>
              <Animated.Text style={styles.createGameHint}>
                2人対戦のゲームが作成され、他のプレイヤーが参加するのを待ちます
              </Animated.Text>
            </Animated.View>
          )}

          {/* Available games list */}
          {!currentGame && (
            <Animated.View 
              style={styles.gamesListContainer}
              entering={FadeIn.delay(200)}
            >
              <View style={styles.gamesListHeader}>
                <Animated.Text style={styles.sectionTitle}>
                  参加可能なゲーム
                </Animated.Text>
                <Animated.View 
                  style={[styles.refreshButton, animatedRefreshStyle]}
                  onTouchEnd={handleRefresh}
                >
                  <Animated.Text style={styles.refreshButtonText}>
                    🔄
                  </Animated.Text>
                </Animated.View>
              </View>

              {/* Games list */}
              <View style={styles.gamesList}>
                {games.length === 0 ? (
                  <Animated.View style={styles.emptyGamesContainer}>
                    <Animated.Text style={styles.emptyGamesText}>
                      参加可能なゲームがありません
                    </Animated.Text>
                    <Animated.Text style={styles.emptyGamesHint}>
                      新しいゲームを作成するか、しばらく待ってからリフレッシュしてください
                    </Animated.Text>
                  </Animated.View>
                ) : (
                  games
                    .filter((game: Game) => game.status === 'waiting_for_players')
                    .map((game: Game, index: number) => (
                      <Animated.View
                        key={game.id}
                        style={styles.gameItem}
                        entering={SlideInDown.delay(index * 100)}
                      >
                        <View style={styles.gameItemContent}>
                          <View style={styles.gameItemInfo}>
                            <Animated.Text style={styles.gameItemId}>
                              ゲーム {game.id.substring(0, 8)}
                            </Animated.Text>
                            <Animated.Text style={styles.gameItemPlayers}>
                              プレイヤー: {game.playerIds?.length || 0}/2
                            </Animated.Text>
                            <Animated.Text style={styles.gameItemTime}>
                              作成: {new Date(game.createdAt).toLocaleTimeString('ja-JP')}
                            </Animated.Text>
                          </View>
                          <Animated.View 
                            style={styles.joinButton}
                            onTouchEnd={() => handleJoinGame(game.id)}
                          >
                            <Animated.Text style={styles.joinButtonText}>
                              参加
                            </Animated.Text>
                          </Animated.View>
                        </View>
                      </Animated.View>
                    ))
                )}
              </View>
            </Animated.View>
          )}

          {/* Error display */}
          {error && (
            <Animated.View 
              style={styles.errorContainer}
              entering={SlideInDown.duration(300)}
              exiting={SlideOutUp.duration(200)}
            >
              <Animated.Text style={styles.errorText}>
                {error}
              </Animated.Text>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E3A5F',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loginTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  loginSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 48,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 24,
    minWidth: 200,
    alignItems: 'center',
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
  loginButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  header: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleSection: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  connectionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  userInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userWelcome: {
    fontSize: 16,
    color: '#FFFFFF',
    flex: 1,
  },
  settingsButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  settingsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  currentGameContainer: {
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.3)',
  },
  currentGameTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  currentGameContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currentGameInfo: {
    flex: 1,
  },
  currentGameId: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  currentGameStatus: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  currentGamePlayers: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  currentGameActions: {
    marginLeft: 16,
  },
  playButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  playButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  leaveButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  leaveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  createGameContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  createGameButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 24,
    minWidth: 200,
    alignItems: 'center',
    marginBottom: 12,
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
  createGameButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  createGameHint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 16,
  },
  gamesListContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  gamesListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  refreshButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButtonText: {
    fontSize: 16,
  },
  gamesList: {
    gap: 12,
  },
  emptyGamesContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyGamesText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyGamesHint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    lineHeight: 16,
  },
  gameItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  gameItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gameItemInfo: {
    flex: 1,
  },
  gameItemId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  gameItemPlayers: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 2,
  },
  gameItemTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  joinButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginLeft: 12,
  },
  joinButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorContainer: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.3)',
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    textAlign: 'center',
  },
});

export default LobbyScreen;