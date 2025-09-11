/**
 * Error Boundary Component
 * Catches JavaScript errors in React component tree and displays fallback UI
 * Enhanced with performance monitoring and comprehensive error handling
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { performanceMonitor } from '../lib/performance';
import { storageService } from '../services/storageService';

// Error boundary props interface
interface Props {
  children?: ReactNode;
  error?: Error;
  onRetry?: () => void;
  fallback?: (error: Error, errorInfo: ErrorInfo, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
  level?: 'app' | 'screen' | 'component';
}

// Error boundary state interface
interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
}

// Error details for logging and reporting
interface ErrorDetails {
  errorId: string;
  message: string;
  stack?: string;
  componentStack: string;
  timestamp: number;
  userAgent: string;
  url: string;
  retryCount: number;
  level: string;
  performanceMetrics?: any;
}

class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly MAX_RETRY_COUNT = 3;

  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    errorId: null,
    retryCount: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = this.state.errorId || `error_${Date.now()}`;
    const level = this.props.level || 'component';

    // Update state with error info
    this.setState(prevState => ({
      errorInfo,
      retryCount: prevState.retryCount,
    }));

    // Log error with enhanced details
    this.logError(error, errorInfo, errorId, level);

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo, errorId);
    }

    // Log performance event
    performanceMonitor.logEvent('app_start', {
      action: 'error_boundary_triggered',
      errorId,
      errorMessage: error.message,
      componentStack: errorInfo.componentStack || 'No component stack available',
      level,
      retryCount: this.state.retryCount,
    });

    // Report error for monitoring
    this.reportError(error, errorInfo, errorId, level);
  }

  /**
   * Check if component should reset based on prop changes
   */
  public override componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    if (hasError && prevProps.resetKeys !== resetKeys) {
      if (resetKeys?.some((key, idx) => prevProps.resetKeys?.[idx] !== key)) {
        this.resetErrorBoundary();
      }
    }

    if (hasError && resetOnPropsChange && prevProps.children !== this.props.children) {
      this.resetErrorBoundary();
    }
  }

  /**
   * Log error with comprehensive details
   */
  private logError(error: Error, errorInfo: ErrorInfo, errorId: string, level: string) {
    const errorDetails: ErrorDetails = {
      errorId,
      message: error.message,
      stack: error.stack || 'No stack trace available',
      componentStack: errorInfo.componentStack || 'No component stack available',
      timestamp: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'React Native',
      url: Platform.OS === 'web' && typeof window !== 'undefined' && window.location 
        ? window.location.href 
        : `react-native-${Platform.OS}`,
      retryCount: this.state.retryCount,
      level,
      performanceMetrics: performanceMonitor.getPerformanceSummary(),
    };

    // Log to console in development
    if (__DEV__) {
      console.group(`🚨 Error Boundary [${level}] - ${errorId}`);
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Error Details:', errorDetails);
      console.groupEnd();
    }

    // Store error in local storage for analysis
    this.storeErrorLocally(errorDetails);
  }

  /**
   * Store error details locally for analysis and potential retry
   */
  private async storeErrorLocally(errorDetails: ErrorDetails) {
    try {
      const existingActions = await storageService.getOfflineActions();
      await storageService.storeOfflineAction({
        type: 'error_report',
        payload: errorDetails,
        gameId: 'error_boundary',
        playerId: 'system',
      });
    } catch (err) {
      console.error('Failed to store error locally:', err);
    }
  }

  /**
   * Report error to external monitoring service
   */
  private reportError = async (error: Error, errorInfo: ErrorInfo, errorId: string, level: string) => {
    const errorDetails: ErrorDetails = {
      errorId,
      message: error.message,
      stack: error.stack || 'No stack trace available',
      componentStack: errorInfo.componentStack || 'No component stack available',
      timestamp: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'React Native',
      url: Platform.OS === 'web' && typeof window !== 'undefined' && window.location 
        ? window.location.href 
        : `react-native-${Platform.OS}`,
      retryCount: this.state.retryCount,
      level,
      performanceMetrics: performanceMonitor.getPerformanceSummary(),
    };

    // In production, send to error reporting service
    // TODO: Integrate with Sentry, Bugsnag, or similar service
    if (__DEV__) {
      console.log('Error report would be sent in production:', errorDetails);
    }
  };

  /**
   * Reset error boundary state
   */
  private resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
    });
  };

  /**
   * Handle retry with count tracking
   */
  private handleRetry = () => {
    const newRetryCount = this.state.retryCount + 1;

    // Check if max retry count exceeded
    if (newRetryCount > this.MAX_RETRY_COUNT) {
      Alert.alert(
        'エラー',
        '再試行の上限に達しました。アプリを再起動してください。',
        [{ text: 'OK' }]
      );
      return;
    }

    // Log retry attempt
    performanceMonitor.logEvent('app_start', {
      action: 'error_boundary_retry',
      errorId: this.state.errorId,
      retryCount: newRetryCount,
    });

    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: newRetryCount,
    }));
    
    this.props.onRetry?.();
  };

  /**
   * Reset with delay to prevent infinite error loops
   */
  private resetWithDelay = () => {
    this.resetTimeoutId = setTimeout(() => {
      this.resetErrorBoundary();
    }, 2000);
  };

  /**
   * Handle bug reporting
   */
  private handleReportBug = async () => {
    const { error, errorInfo, errorId } = this.state;
    
    if (!error) return;

    try {
      // Prepare bug report data
      const bugReport = {
        errorId,
        message: error.message,
        stack: error.stack || 'No stack trace available',
        componentStack: errorInfo?.componentStack,
        timestamp: new Date().toISOString(),
        retryCount: this.state.retryCount,
        performanceMetrics: performanceMonitor.getPerformanceSummary(),
      };

      // Store locally first
      await storageService.storeOfflineAction({
        type: 'bug_report',
        payload: bugReport,
        gameId: 'error_boundary',
        playerId: 'user',
      });

      Alert.alert(
        'バグレポート',
        'バグレポートが保存されました。ネットワーク接続時に自動的に送信されます。',
        [{ text: 'OK' }]
      );

      console.log('Bug report saved:', bugReport);
    } catch (err) {
      console.error('Failed to save bug report:', err);
      Alert.alert(
        'エラー',
        'バグレポートの保存に失敗しました。',
        [{ text: 'OK' }]
      );
    }
  };

  /**
   * Default fallback UI when an error occurs
   */
  private renderDefaultFallback() {
    const { error, errorInfo, errorId, retryCount } = this.state;
    const canRetry = retryCount < this.MAX_RETRY_COUNT;

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <Animated.View entering={FadeIn.duration(500)} style={styles.content}>
            {/* Error Icon */}
            <View style={styles.iconContainer}>
              <Animated.Text style={styles.errorIcon}>
                ⚠️
              </Animated.Text>
            </View>

            {/* Error Title */}
            <Animated.Text style={styles.title}>
              予期しないエラーが発生しました
            </Animated.Text>

            {/* Error Message */}
            <Animated.Text style={styles.message}>
              申し訳ございません。アプリでエラーが発生しました。
              {retryCount > 0 && (
                `\n\n再試行回数: ${retryCount}/${this.MAX_RETRY_COUNT}`
              )}
              {__DEV__ && error && (
                `\n\nエラー: ${error.message}`
              )}
            </Animated.Text>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              {canRetry && (
                <TouchableOpacity 
                  style={[styles.button, styles.retryButton]}
                  onPress={this.handleRetry}
                >
                  <Animated.Text style={styles.retryButtonText}>
                    再試行 {retryCount > 0 && `(${this.MAX_RETRY_COUNT - retryCount} 回残り)`}
                  </Animated.Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={[styles.button, styles.resetButton]}
                onPress={this.resetWithDelay}
              >
                <Animated.Text style={styles.resetButtonText}>
                  少し待ってからリセット
                </Animated.Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.button, styles.reportButton]}
                onPress={this.handleReportBug}
              >
                <Animated.Text style={styles.reportButtonText}>
                  バグを報告
                </Animated.Text>
              </TouchableOpacity>
            </View>

            {/* Debug Information (Development only) */}
            {__DEV__ && error && (
              <View style={styles.debugContainer}>
                <Animated.Text style={styles.debugTitle}>
                  デバッグ情報 (ID: {errorId}):
                </Animated.Text>
                <Animated.Text style={styles.debugText}>
                  Message: {error.message}
                </Animated.Text>
                <Animated.Text style={styles.debugText}>
                  Stack: {error.stack}
                </Animated.Text>
                {errorInfo && (
                  <Animated.Text style={styles.debugText}>
                    Component Stack: {errorInfo.componentStack}
                  </Animated.Text>
                )}
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  public override render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, isolate } = this.props;

    // Use prop error if provided, otherwise use state error
    const shouldShowError = this.props.error || hasError;
    const currentError = this.props.error || error;

    if (shouldShowError && currentError && errorInfo) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback(currentError, errorInfo, this.resetErrorBoundary);
      }

      // Use default fallback
      return this.renderDefaultFallback();
    }

    // If isolate is true, wrap children to prevent error propagation
    if (isolate) {
      return <View style={styles.isolatedContainer}>{children}</View>;
    }

    return children;
  }
}

/**
 * Hook-based Error Boundary wrapper for functional components
 */
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

/**
 * Error Boundary for game-specific components
 */
export const GameErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    level="screen"
    fallback={(error, errorInfo, retry) => (
      <View style={styles.gameErrorContainer}>
        <Animated.View entering={FadeIn.duration(300)}>
          <Animated.Text style={styles.gameErrorIcon}>🎮</Animated.Text>
          <Animated.Text style={styles.gameErrorTitle}>ゲームエラー</Animated.Text>
          <Animated.Text style={styles.gameErrorMessage}>
            ゲーム中にエラーが発生しました。{'\n'}
            ゲームを再開しますか？
          </Animated.Text>
          <TouchableOpacity style={styles.gameErrorButton} onPress={retry}>
            <Animated.Text style={styles.gameErrorButtonText}>ゲームを再開</Animated.Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    )}
    resetOnPropsChange={true}
  >
    {children}
  </ErrorBoundary>
);

/**
 * Error Boundary for network-related components
 */
export const NetworkErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    level="component"
    fallback={(error, errorInfo, retry) => (
      <View style={styles.networkErrorContainer}>
        <Animated.View entering={FadeIn.duration(300)}>
          <Animated.Text style={styles.networkErrorIcon}>📡</Animated.Text>
          <Animated.Text style={styles.networkErrorTitle}>接続エラー</Animated.Text>
          <Animated.Text style={styles.networkErrorMessage}>
            ネットワーク接続に問題があります。{'\n'}
            再接続を試してください。
          </Animated.Text>
          <TouchableOpacity style={styles.networkErrorButton} onPress={retry}>
            <Animated.Text style={styles.networkErrorButtonText}>再接続</Animated.Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    )}
    isolate={true}
  >
    {children}
  </ErrorBoundary>
);

/**
 * Error Boundary for UI components that should fail gracefully
 */
export const UIErrorBoundary: React.FC<{ children: ReactNode; componentName?: string }> = ({ 
  children, 
  componentName = 'コンポーネント' 
}) => (
  <ErrorBoundary
    level="component"
    fallback={(error, errorInfo, retry) => (
      <View style={styles.uiErrorContainer}>
        <Animated.Text style={styles.uiErrorText}>
          {componentName}の読み込みに失敗しました
        </Animated.Text>
        <TouchableOpacity style={styles.uiErrorButton} onPress={retry}>
          <Animated.Text style={styles.uiErrorButtonText}>再読み込み</Animated.Text>
        </TouchableOpacity>
      </View>
    )}
    isolate={true}
    resetOnPropsChange={true}
  >
    {children}
  </ErrorBoundary>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  iconContainer: {
    marginBottom: 24,
  },
  errorIcon: {
    fontSize: 64,
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  buttonContainer: {
    width: '100%',
    gap: 15,
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#007bff',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  resetButton: {
    backgroundColor: '#6c757d',
  },
  resetButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  reportButton: {
    backgroundColor: '#28a745',
  },
  reportButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  debugContainer: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    width: '100%',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: 10,
  },
  debugText: {
    fontSize: 12,
    color: '#6c757d',
    fontFamily: 'monospace',
    marginBottom: 5,
  },
  isolatedContainer: {
    flex: 1,
  },
  
  // Game Error Boundary Styles
  gameErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff3cd',
  },
  gameErrorIcon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 16,
  },
  gameErrorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#856404',
    textAlign: 'center',
    marginBottom: 10,
  },
  gameErrorMessage: {
    fontSize: 16,
    color: '#856404',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  gameErrorButton: {
    backgroundColor: '#ffc107',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
  },
  gameErrorButtonText: {
    color: '#212529',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Network Error Boundary Styles
  networkErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8d7da',
  },
  networkErrorIcon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 16,
  },
  networkErrorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#721c24',
    textAlign: 'center',
    marginBottom: 10,
  },
  networkErrorMessage: {
    fontSize: 16,
    color: '#721c24',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  networkErrorButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
  },
  networkErrorButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // UI Error Boundary Styles
  uiErrorContainer: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  uiErrorText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 12,
  },
  uiErrorButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  uiErrorButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ErrorBoundary;