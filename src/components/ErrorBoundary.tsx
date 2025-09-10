/**
 * Error Boundary
 * Catches and handles React errors gracefully
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { config, logError, APP_CONSTANTS } from '../config/environment';

interface Props {
  children?: ReactNode;
  error?: Error;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logError('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      hasError: true,
      error,
      errorInfo,
    });

    // Send error to crash reporting service in production
    if (config.env === 'production') {
      this.reportError(error, errorInfo);
    }
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // TODO: Send error to crash reporting service (Sentry, Bugsnag, etc.)
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      appVersion: APP_CONSTANTS.APP_VERSION,
      environment: config.env,
    };

    logError('Error report:', errorReport);
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    
    this.props.onRetry?.();
  };

  private handleReportBug = () => {
    // TODO: Open bug report form or email
    const errorMessage = this.state.error?.message || 'Unknown error';
    const subject = `Bug Report: ${errorMessage}`;
    const body = `
App Version: ${APP_CONSTANTS.APP_VERSION}
Environment: ${config.env}
Error: ${errorMessage}
Stack: ${this.state.error?.stack || 'No stack trace'}

Please describe what you were doing when this error occurred:
    `;
    
    console.log('Bug report:', { subject, body });
  };

  public override render() {
    // Use prop error if provided, otherwise use state error
    const hasError = this.props.error || this.state.hasError;
    const error = this.props.error || this.state.error;

    if (hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <Animated.View 
            style={styles.content}
            entering={FadeIn.duration(500)}
          >
            {/* Error Icon */}
            <Animated.View style={styles.iconContainer}>
              <Animated.Text style={styles.errorIcon}>
                ⚠️
              </Animated.Text>
            </Animated.View>

            {/* Error Title */}
            <Animated.Text style={styles.title}>
              問題が発生しました
            </Animated.Text>

            {/* Error Message */}
            <Animated.Text style={styles.message}>
              申し訳ございません。予期しないエラーが発生しました。
              {config.debug.enableLogs && error && (
                `\n\nエラー: ${error.message}`
              )}
            </Animated.Text>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <Animated.View 
                style={[styles.button, styles.retryButton]}
                onTouchEnd={this.handleRetry}
              >
                <Animated.Text style={styles.retryButtonText}>
                  再試行
                </Animated.Text>
              </Animated.View>

              {config.debug.enableLogs && (
                <Animated.View 
                  style={[styles.button, styles.reportButton]}
                  onTouchEnd={this.handleReportBug}
                >
                  <Animated.Text style={styles.reportButtonText}>
                    バグを報告
                  </Animated.Text>
                </Animated.View>
              )}
            </View>

            {/* Debug Information (Development only) */}
            {config.debug.enableLogs && error && (
              <Animated.View style={styles.debugContainer}>
                <Animated.Text style={styles.debugTitle}>
                  デバッグ情報:
                </Animated.Text>
                <Animated.Text style={styles.debugText}>
                  {error.stack}
                </Animated.Text>
              </Animated.View>
            )}
          </Animated.View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_CONSTANTS.COLORS.DARK,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
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
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  reportButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  reportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  debugContainer: {
    marginTop: 32,
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    width: '100%',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
});

export default ErrorBoundary;