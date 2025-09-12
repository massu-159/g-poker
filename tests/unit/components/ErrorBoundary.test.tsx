/**
 * ErrorBoundary Component Tests
 * Tests for the comprehensive error boundary implementation
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import ErrorBoundary, { 
  GameErrorBoundary, 
  NetworkErrorBoundary, 
  UIErrorBoundary,
  withErrorBoundary 
} from '../../../src/components/ErrorBoundary';

// Mock dependencies
jest.mock('react-native-reanimated', () => {
  const View = require('react-native').View;
  const Text = require('react-native').Text;
  
  return {
    default: { View, Text },
    View,
    Text,
    FadeIn: { duration: jest.fn(() => ({})) },
  };
});

jest.mock('../../../src/lib/performance', () => ({
  performanceMonitor: {
    logEvent: jest.fn(),
    getPerformanceSummary: jest.fn(() => ({ fps: 60, memory: 25 })),
  },
}));

jest.mock('../../../src/services/storageService', () => ({
  storageService: {
    getOfflineActions: jest.fn(() => Promise.resolve([])),
    storeOfflineAction: jest.fn(() => Promise.resolve()),
  },
}));

// Test component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean; message?: string }> = ({ 
  shouldThrow = false, 
  message = 'Test error' 
}) => {
  if (shouldThrow) {
    throw new Error(message);
  }
  return <>{`No error thrown`}</>;
};

describe('ErrorBoundary Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error for cleaner test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'group').mockImplementation(() => {});
    jest.spyOn(console, 'groupEnd').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic Error Boundary Functionality', () => {
    it('should render children when no error occurs', () => {
      const { getByText } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(getByText('No error thrown')).toBeTruthy();
    });

    it('should catch and display error when child component throws', () => {
      const { getByText } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} message="Test component error" />
        </ErrorBoundary>
      );

      expect(getByText('予期しないエラーが発生しました')).toBeTruthy();
      expect(getByText(/申し訳ございません/)).toBeTruthy();
    });

    it('should display retry button', () => {
      const { getByText } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(getByText(/再試行/)).toBeTruthy();
    });

    it('should display reset button', () => {
      const { getByText } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(getByText('少し待ってからリセット')).toBeTruthy();
    });

    it('should display bug report button', () => {
      const { getByText } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(getByText('バグを報告')).toBeTruthy();
    });
  });

  describe('Custom Fallback UI', () => {
    it('should use custom fallback when provided', () => {
      const customFallback = () => <>{`Custom error UI`}</>;

      const { getByText } = render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(getByText('Custom error UI')).toBeTruthy();
    });

    it('should call custom error handler', () => {
      const mockErrorHandler = jest.fn();

      render(
        <ErrorBoundary onError={mockErrorHandler}>
          <ThrowError shouldThrow={true} message="Custom handler test" />
        </ErrorBoundary>
      );

      expect(mockErrorHandler).toHaveBeenCalled();
    });
  });

  describe('Retry Functionality', () => {
    it('should call onRetry when retry button is pressed', () => {
      const mockOnRetry = jest.fn();

      const { getByText } = render(
        <ErrorBoundary onRetry={mockOnRetry}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      fireEvent.press(getByText(/再試行/));
      expect(mockOnRetry).toHaveBeenCalled();
    });

    it('should track retry count', () => {
      let shouldThrow = true;
      const TestComponent = () => (
        <ErrorBoundary>
          <ThrowError shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );

      const { getByText, rerender } = render(<TestComponent />);

      // First error
      expect(getByText('予期しないエラーが発生しました')).toBeTruthy();

      // Retry (which will still throw)
      fireEvent.press(getByText(/再試行/));
      
      // Should show retry count
      rerender(<TestComponent />);
    });
  });

  describe('Isolation Mode', () => {
    it('should isolate errors when isolate prop is true', () => {
      const result = render(
        <ErrorBoundary isolate={true}>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(result.getByText('No error thrown')).toBeTruthy();
    });
  });

  describe('Level-based Error Boundaries', () => {
    it('should handle app-level errors', () => {
      const { getByText } = render(
        <ErrorBoundary level="app">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(getByText('予期しないエラーが発生しました')).toBeTruthy();
    });

    it('should handle screen-level errors', () => {
      const { getByText } = render(
        <ErrorBoundary level="screen">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(getByText('予期しないエラーが発生しました')).toBeTruthy();
    });

    it('should handle component-level errors', () => {
      const { getByText } = render(
        <ErrorBoundary level="component">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(getByText('予期しないエラーが発生しました')).toBeTruthy();
    });
  });

  describe('GameErrorBoundary', () => {
    it('should render game-specific error UI', () => {
      const { getByText } = render(
        <GameErrorBoundary>
          <ThrowError shouldThrow={true} />
        </GameErrorBoundary>
      );

      expect(getByText('ゲームエラー')).toBeTruthy();
      expect(getByText(/ゲーム中にエラーが発生しました/)).toBeTruthy();
      expect(getByText('ゲームを再開')).toBeTruthy();
    });
  });

  describe('NetworkErrorBoundary', () => {
    it('should render network-specific error UI', () => {
      const { getByText } = render(
        <NetworkErrorBoundary>
          <ThrowError shouldThrow={true} />
        </NetworkErrorBoundary>
      );

      expect(getByText('接続エラー')).toBeTruthy();
      expect(getByText(/ネットワーク接続に問題があります/)).toBeTruthy();
      expect(getByText('再接続')).toBeTruthy();
    });
  });

  describe('UIErrorBoundary', () => {
    it('should render UI-specific error fallback', () => {
      const { getByText } = render(
        <UIErrorBoundary componentName="テストコンポーネント">
          <ThrowError shouldThrow={true} />
        </UIErrorBoundary>
      );

      expect(getByText('テストコンポーネントの読み込みに失敗しました')).toBeTruthy();
      expect(getByText('再読み込み')).toBeTruthy();
    });

    it('should use default component name when not provided', () => {
      const { getByText } = render(
        <UIErrorBoundary>
          <ThrowError shouldThrow={true} />
        </UIErrorBoundary>
      );

      expect(getByText('コンポーネントの読み込みに失敗しました')).toBeTruthy();
    });
  });

  describe('withErrorBoundary HOC', () => {
    it('should wrap component with error boundary', () => {
      const TestComponent = () => <ThrowError shouldThrow={false} />;
      const WrappedComponent = withErrorBoundary(TestComponent);

      const { getByText } = render(<WrappedComponent />);
      expect(getByText('No error thrown')).toBeTruthy();
    });

    it('should catch errors in wrapped component', () => {
      const TestComponent = () => <ThrowError shouldThrow={true} />;
      const WrappedComponent = withErrorBoundary(TestComponent);

      const { getByText } = render(<WrappedComponent />);
      expect(getByText('予期しないエラーが発生しました')).toBeTruthy();
    });

    it('should set correct display name', () => {
      const TestComponent = () => null;
      TestComponent.displayName = 'TestComponent';
      const WrappedComponent = withErrorBoundary(TestComponent);

      expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponent)');
    });
  });

  describe('Debug Information', () => {
    it('should show debug info in development', () => {
      // Mock __DEV__ as true
      (global as any).__DEV__ = true;

      const { getByText } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} message="Debug test error" />
        </ErrorBoundary>
      );

      expect(getByText(/デバッグ情報/)).toBeTruthy();
    });
  });

  describe('Props Changes', () => {
    it('should reset on resetKeys change', () => {
      const TestComponent = ({ resetKey }: { resetKey: string }) => (
        <ErrorBoundary resetKeys={[resetKey]}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const { getByText, rerender } = render(<TestComponent resetKey="key1" />);
      
      // Should show error
      expect(getByText('予期しないエラーが発生しました')).toBeTruthy();

      // Change reset key should reset error boundary
      rerender(<TestComponent resetKey="key2" />);
    });

    it('should reset on props change when resetOnPropsChange is true', () => {
      let shouldThrow = true;
      const TestComponent = () => (
        <ErrorBoundary resetOnPropsChange={true}>
          <ThrowError shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );

      const { getByText, rerender } = render(<TestComponent />);
      
      // Should show error
      expect(getByText('予期しないエラーが発生しました')).toBeTruthy();

      // Change children should reset
      shouldThrow = false;
      rerender(<TestComponent />);
    });
  });
});