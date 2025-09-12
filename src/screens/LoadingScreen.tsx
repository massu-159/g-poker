/**
 * Loading Screen
 * Shows loading states, connection status, and progress indicators
 */

import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Platform,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  interpolate,
  Extrapolation,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGameStore, useGameActions } from '../stores/gameStore';
import { useAuthState } from '../stores/userStore';

// Animation configurations
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
};

const TIMING_CONFIG = {
  duration: 1000,
};

// Loading states
type LoadingState = 
  | 'initializing'
  | 'connecting'
  | 'authenticating'
  | 'loading_game'
  | 'joining_game'
  | 'waiting_for_players'
  | 'starting_game'
  | 'error';

export interface LoadingScreenProps {
  loadingState?: LoadingState;
  message?: string;
  progress?: number; // 0-100
  showCancel?: boolean;
  onCancel?: () => void;
  testID?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  loadingState = 'initializing',
  message,
  progress,
  showCancel = true,
  onCancel,
  testID,
}) => {
  const insets = useSafeAreaInsets();
  
  // State management
  const { connectionStatus, error } = useGameStore();
  const { isAuthenticated } = useAuthState();

  // Animation values
  const spinnerRotation = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const progressWidth = useSharedValue(0);
  const dotsOpacity = useSharedValue([0, 0, 0]);
  const messageOpacity = useSharedValue(0);
  const cancelButtonScale = useSharedValue(showCancel ? 1 : 0);

  // Get loading message based on state
  const getLoadingMessage = (): string => {
    if (message) return message;
    
    switch (loadingState) {
      case 'initializing':
        return 'アプリを初期化中...';
      case 'connecting':
        return 'サーバーに接続中...';
      case 'authenticating':
        return '認証中...';
      case 'loading_game':
        return 'ゲームデータを読み込み中...';
      case 'joining_game':
        return 'ゲームに参加中...';
      case 'waiting_for_players':
        return 'プレイヤーの参加を待っています...';
      case 'starting_game':
        return 'ゲームを開始しています...';
      case 'error':
        return error || 'エラーが発生しました';
      default:
        return '読み込み中...';
    }
  };

  // Get loading color based on state
  const getLoadingColor = (): string => {
    switch (loadingState) {
      case 'error':
        return '#F44336';
      case 'connecting':
        return connectionStatus === 'connected' ? '#4CAF50' : '#FF9800';
      case 'waiting_for_players':
        return '#2196F3';
      case 'starting_game':
        return '#4CAF50';
      default:
        return '#007AFF';
    }
  };

  // Spinner animation
  useEffect(() => {
    if (loadingState !== 'error') {
      spinnerRotation.value = withRepeat(
        withTiming(360, { duration: 1000 }),
        -1,
        false
      );
    } else {
      spinnerRotation.value = withTiming(0, TIMING_CONFIG);
    }
  }, [loadingState, spinnerRotation]);

  // Pulse animation for certain states
  useEffect(() => {
    if (loadingState === 'waiting_for_players' || loadingState === 'connecting') {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        false
      );
    } else {
      pulseScale.value = withTiming(1, TIMING_CONFIG);
    }
  }, [loadingState, pulseScale]);

  // Progress bar animation
  useEffect(() => {
    if (progress !== undefined) {
      progressWidth.value = withTiming(progress, { duration: 500 });
    }
  }, [progress, progressWidth]);

  // Loading dots animation
  useEffect(() => {
    const animateDots = () => {
      dotsOpacity.value = [
        withDelay(0, withSequence(withTiming(1, { duration: 300 }), withTiming(0.3, { duration: 300 }))),
        withDelay(200, withSequence(withTiming(1, { duration: 300 }), withTiming(0.3, { duration: 300 }))),
        withDelay(400, withSequence(withTiming(1, { duration: 300 }), withTiming(0.3, { duration: 300 })))
      ];
    };

    if (loadingState !== 'error') {
      const interval = setInterval(animateDots, 1200);
      return () => clearInterval(interval);
    }
    
    // Return undefined for error state (satisfies TypeScript)
    return undefined;
  }, [loadingState, dotsOpacity]);

  // Message fade in
  useEffect(() => {
    messageOpacity.value = withTiming(1, { duration: 300 });
  }, [getLoadingMessage(), messageOpacity]);

  // Cancel button animation
  useEffect(() => {
    cancelButtonScale.value = withSpring(showCancel ? 1 : 0, SPRING_CONFIG);
  }, [showCancel, cancelButtonScale]);

  // Animated styles
  const animatedSpinnerStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${spinnerRotation.value}deg` },
      { scale: pulseScale.value },
    ],
  }));

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const animatedMessageStyle = useAnimatedStyle(() => ({
    opacity: messageOpacity.value,
  }));

  const animatedCancelButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cancelButtonScale.value }],
    opacity: cancelButtonScale.value,
  }));

  const animatedDot1Style = useAnimatedStyle(() => ({
    opacity: Array.isArray(dotsOpacity.value) ? dotsOpacity.value[0] : 0.3,
  }));

  const animatedDot2Style = useAnimatedStyle(() => ({
    opacity: Array.isArray(dotsOpacity.value) ? dotsOpacity.value[1] : 0.3,
  }));

  const animatedDot3Style = useAnimatedStyle(() => ({
    opacity: Array.isArray(dotsOpacity.value) ? dotsOpacity.value[2] : 0.3,
  }));

  return (
    <SafeAreaView style={styles.container} testID={testID}>
      <Animated.View 
        style={[
          styles.content,
          { paddingTop: Math.max(insets.top, 40) }
        ]}
        entering={FadeIn.duration(300)}
      >
        {/* Logo/Brand Area */}
        <Animated.View style={styles.logoContainer}>
          <Animated.Text style={styles.logoText}>
            🪳🐭🦇🐸
          </Animated.Text>
          <Animated.Text style={styles.brandText}>
            ごきぶりポーカー
          </Animated.Text>
        </Animated.View>

        {/* Loading Indicator */}
        <Animated.View style={styles.loadingContainer}>
          {loadingState === 'error' ? (
            // Error icon
            <Animated.View 
              style={[styles.errorIcon, { borderColor: getLoadingColor() }]}
              entering={FadeIn.duration(300)}
            >
              <Animated.Text style={[styles.errorIconText, { color: getLoadingColor() }]}>
                ⚠
              </Animated.Text>
            </Animated.View>
          ) : (
            // Spinner
            <Animated.View 
              style={[
                styles.spinner,
                { borderColor: `${getLoadingColor()}33` },
                { borderTopColor: getLoadingColor() },
                animatedSpinnerStyle
              ]}
            />
          )}

          {/* Loading dots */}
          {loadingState !== 'error' && (
            <View style={styles.dotsContainer}>
              <Animated.View style={[styles.dot, animatedDot1Style]} />
              <Animated.View style={[styles.dot, animatedDot2Style]} />
              <Animated.View style={[styles.dot, animatedDot3Style]} />
            </View>
          )}
        </Animated.View>

        {/* Progress Bar */}
        {progress !== undefined && (
          <Animated.View 
            style={styles.progressContainer}
            entering={FadeIn.duration(300)}
          >
            <View style={styles.progressBackground}>
              <Animated.View 
                style={[
                  styles.progressBar,
                  { backgroundColor: getLoadingColor() },
                  animatedProgressStyle
                ]}
              />
            </View>
            <Animated.Text style={styles.progressText}>
              {Math.round(progress)}%
            </Animated.Text>
          </Animated.View>
        )}

        {/* Loading Message */}
        <Animated.View style={[styles.messageContainer, animatedMessageStyle]}>
          <Animated.Text 
            style={[
              styles.messageText,
              loadingState === 'error' && { color: getLoadingColor() }
            ]}
          >
            {getLoadingMessage()}
          </Animated.Text>
        </Animated.View>

        {/* Connection Status */}
        {connectionStatus !== 'connected' && (
          <Animated.View 
            style={styles.connectionContainer}
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(300)}
          >
            <Animated.View 
              style={[
                styles.connectionDot,
                { 
                  backgroundColor: 
                    connectionStatus === 'connecting' ? '#FF9800' :
                    connectionStatus === 'reconnecting' ? '#2196F3' :
                    '#F44336'
                }
              ]}
            />
            <Animated.Text style={styles.connectionText}>
              {connectionStatus === 'connecting' && '接続中...'}
              {connectionStatus === 'reconnecting' && '再接続中...'}
              {connectionStatus === 'disconnected' && '切断されました'}
            </Animated.Text>
          </Animated.View>
        )}

        {/* Additional Info */}
        {loadingState === 'waiting_for_players' && (
          <Animated.View 
            style={styles.infoContainer}
            entering={FadeIn.delay(500).duration(300)}
          >
            <Animated.Text style={styles.infoText}>
              他のプレイヤーがゲームに参加するまでお待ちください
            </Animated.Text>
            <Animated.Text style={styles.infoSubtext}>
              通常30秒以内で他のプレイヤーが参加します
            </Animated.Text>
          </Animated.View>
        )}

        {/* Cancel Button */}
        {showCancel && (
          <Animated.View 
            style={[styles.cancelContainer, animatedCancelButtonStyle]}
          >
            <Animated.View 
              style={styles.cancelButton}
              onTouchEnd={onCancel}
            >
              <Animated.Text style={styles.cancelButtonText}>
                キャンセル
              </Animated.Text>
            </Animated.View>
          </Animated.View>
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 80,
  },
  logoText: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 16,
  },
  brandText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  spinner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    marginBottom: 20,
  },
  errorIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  errorIconText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 32,
  },
  progressBackground: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  messageText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '500',
  },
  connectionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 24,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  connectionText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  infoContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
    padding: 20,
    borderRadius: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.3)',
  },
  infoText: {
    fontSize: 14,
    color: '#2196F3',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 8,
  },
  infoSubtext: {
    fontSize: 12,
    color: 'rgba(33, 150, 243, 0.8)',
    textAlign: 'center',
  },
  cancelContainer: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    paddingHorizontal: 32,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default LoadingScreen;