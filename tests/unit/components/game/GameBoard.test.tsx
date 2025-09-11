/**
 * GameBoard Component Tests
 * Tests for the ごきぶりポーカー GameBoard component with React Native Testing Library
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

import { GameBoard } from '../../../../src/components/game/GameBoard';
import { Player } from '../../../../src/lib/entities/Player';
import { Card as CardEntity, CreatureType } from '../../../../src/lib/entities/Card';

// Mock dependencies
jest.mock('react-native-reanimated', () => {
  const View = require('react-native').View;
  const Text = require('react-native').Text;
  
  const mockAnimated = {
    View,
    Text,
  };
  
  return {
    default: mockAnimated,
    View,
    Text,
    useSharedValue: jest.fn((initial: any) => ({ value: initial })),
    useAnimatedStyle: jest.fn((fn: any) => {
      try {
        return fn();
      } catch {
        return {};
      }
    }),
    withSpring: jest.fn((value: any, config?: any, callback?: any) => {
      if (callback) callback(true);
      return value;
    }),
    withTiming: jest.fn((value: any) => value),
    interpolate: jest.fn((value: any, input: any, output: any) => output[0]),
    runOnJS: jest.fn((fn: any) => fn),
    FadeIn: { duration: jest.fn(() => ({})) },
    FadeOut: { duration: jest.fn(() => ({})) },
    Extrapolate: {
      CLAMP: 'clamp',
      EXTEND: 'extend',
      IDENTITY: 'identity',
    },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}));

jest.mock('react-native/Libraries/Utilities/Dimensions', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
  },
}));

// Mock child components
jest.mock('../../../../src/components/cards/Card', () => {
  const MockCard = ({ testID }: any) => {
    const MockView = require('react-native').View;
    const MockText = require('react-native').Text;
    return (
      <MockView testID={testID}>
        <MockText>Mock Card</MockText>
      </MockView>
    );
  };
  return MockCard;
});

jest.mock('../../../../src/components/game/PenaltyPile', () => {
  const MockPenaltyPile = ({ testID }: any) => {
    const MockView = require('react-native').View;
    const MockText = require('react-native').Text;
    return (
      <MockView testID={testID}>
        <MockText>Mock PenaltyPile</MockText>
      </MockView>
    );
  };
  return MockPenaltyPile;
});

jest.mock('../../../../src/components/game/PlayerArea', () => {
  const MockPlayerArea = ({ testID }: any) => {
    const MockView = require('react-native').View;
    const MockText = require('react-native').Text;
    return (
      <MockView testID={testID}>
        <MockText>Mock PlayerArea</MockText>
      </MockView>
    );
  };
  return MockPlayerArea;
});

jest.mock('../../../../src/components/game/GameStatus', () => {
  const MockGameStatus = ({ testID }: any) => {
    const MockView = require('react-native').View;
    const MockText = require('react-native').Text;
    return (
      <MockView testID={testID}>
        <MockText>Mock GameStatus</MockText>
      </MockView>
    );
  };
  return MockGameStatus;
});

describe('GameBoard Component', () => {
  // Test data factories
  const createTestPlayer = (id: string, displayName: string = `Player ${id}`): Player => ({
    id,
    deviceId: `device_${id}`,
    profile: {
      displayName,
    },
    connection: {
      isConnected: true,
      lastSeen: '2023-01-01T00:00:00.000Z',
    },
    statistics: {
      totalGames: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      averageGameDuration: 0,
      fastestWin: 0,
      longestGame: 0,
      creaturePreferences: {
        cockroach: { played: 0, won: 0 },
        mouse: { played: 0, won: 0 },
        bat: { played: 0, won: 0 },
        frog: { played: 0, won: 0 },
      },
    },
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z',
  });

  const createTestCard = (id: string, creatureType: CreatureType): CardEntity => ({
    id,
    creatureType,
    cardNumber: 1,
  });

  const mockOnCardSelect = jest.fn();
  const mockOnCardPlay = jest.fn();
  const mockOnCardResponse = jest.fn();
  const mockOnGameAction = jest.fn();

  const defaultProps = {
    currentPlayer: createTestPlayer('1', 'Player 1'),
    opponentPlayer: createTestPlayer('2', 'Player 2'),
    isCurrentPlayerTurn: true,
    gameStatus: 'in_progress' as const,
    onCardSelect: mockOnCardSelect,
    onCardPlay: mockOnCardPlay,
    onCardResponse: mockOnCardResponse,
    onGameAction: mockOnGameAction,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the game board correctly', () => {
      const { getByTestId } = render(
        <GameBoard {...defaultProps} testID="test-gameboard" />
      );

      expect(getByTestId('test-gameboard')).toBeTruthy();
    });

    it('should render with waiting game status', () => {
      const { getByTestId } = render(
        <GameBoard 
          {...defaultProps} 
          gameStatus="waiting"
          testID="waiting-gameboard" 
        />
      );

      expect(getByTestId('waiting-gameboard')).toBeTruthy();
    });

    it('should render with ended game status', () => {
      const { getByTestId } = render(
        <GameBoard 
          {...defaultProps} 
          gameStatus="ended"
          winnerId="1"
          testID="ended-gameboard" 
        />
      );

      expect(getByTestId('ended-gameboard')).toBeTruthy();
    });

    it('should render with card in play', () => {
      const cardInPlay = createTestCard('test-card', CreatureType.COCKROACH);
      const { getByTestId } = render(
        <GameBoard 
          {...defaultProps} 
          cardInPlay={cardInPlay}
          testID="card-in-play-gameboard" 
        />
      );

      expect(getByTestId('card-in-play-gameboard')).toBeTruthy();
    });
  });

  describe('Game States', () => {
    it('should handle current player turn correctly', () => {
      const { getByTestId } = render(
        <GameBoard 
          {...defaultProps} 
          isCurrentPlayerTurn={true}
          testID="current-turn-board" 
        />
      );

      expect(getByTestId('current-turn-board')).toBeTruthy();
    });

    it('should handle opponent turn correctly', () => {
      const { getByTestId } = render(
        <GameBoard 
          {...defaultProps} 
          isCurrentPlayerTurn={false}
          testID="opponent-turn-board" 
        />
      );

      expect(getByTestId('opponent-turn-board')).toBeTruthy();
    });

    it('should handle selected card state', () => {
      const { getByTestId } = render(
        <GameBoard 
          {...defaultProps} 
          selectedCardId="test-card-1"
          testID="selected-card-board" 
        />
      );

      expect(getByTestId('selected-card-board')).toBeTruthy();
    });
  });

  describe('Props Validation', () => {
    it('should handle optional props correctly', () => {
      const { getByTestId } = render(
        <GameBoard 
          {...defaultProps}
          showDebugInfo={true}
          isAnimationEnabled={false}
          cardAnimationSpeed="fast"
          testID="optional-props-board" 
        />
      );

      expect(getByTestId('optional-props-board')).toBeTruthy();
    });

    it('should apply custom styles', () => {
      const customStyle = { backgroundColor: 'red' };
      const { getByTestId } = render(
        <GameBoard 
          {...defaultProps} 
          style={customStyle}
          testID="styled-board" 
        />
      );

      expect(getByTestId('styled-board')).toBeTruthy();
    });

    it('should handle missing optional props gracefully', () => {
      expect(() => {
        render(<GameBoard {...defaultProps} />);
      }).not.toThrow();
    });
  });

  describe('Animation Speed Settings', () => {
    it('should handle slow animation speed', () => {
      const { getByTestId } = render(
        <GameBoard 
          {...defaultProps} 
          cardAnimationSpeed="slow"
          testID="slow-animation-board" 
        />
      );

      expect(getByTestId('slow-animation-board')).toBeTruthy();
    });

    it('should handle fast animation speed', () => {
      const { getByTestId } = render(
        <GameBoard 
          {...defaultProps} 
          cardAnimationSpeed="fast"
          testID="fast-animation-board" 
        />
      );

      expect(getByTestId('fast-animation-board')).toBeTruthy();
    });

    it('should handle normal animation speed (default)', () => {
      const { getByTestId } = render(
        <GameBoard 
          {...defaultProps} 
          cardAnimationSpeed="normal"
          testID="normal-animation-board" 
        />
      );

      expect(getByTestId('normal-animation-board')).toBeTruthy();
    });
  });

  describe('Component Integration', () => {
    it('should integrate with all child components', () => {
      const { getByTestId } = render(
        <GameBoard {...defaultProps} testID="integration-board" />
      );

      expect(getByTestId('integration-board')).toBeTruthy();
    });

    it('should handle complex game state', () => {
      const cardInPlay = createTestCard('complex-card', CreatureType.BAT);
      
      const { getByTestId } = render(
        <GameBoard 
          {...defaultProps} 
          cardInPlay={cardInPlay}
          selectedCardId="selected-card"
          gameStatus="in_progress"
          isCurrentPlayerTurn={true}
          testID="complex-state-board" 
        />
      );

      expect(getByTestId('complex-state-board')).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid game status gracefully', () => {
      expect(() => {
        render(
          <GameBoard 
            {...defaultProps} 
            gameStatus={'invalid' as any}
          />
        );
      }).not.toThrow();
    });

    it('should handle missing player properties', () => {
      const incompletePlayer = {
        ...defaultProps.currentPlayer,
        profile: undefined,
      } as any;

      expect(() => {
        render(
          <GameBoard 
            {...defaultProps} 
            currentPlayer={incompletePlayer}
          />
        );
      }).not.toThrow();
    });

    it('should maintain stability on re-renders', () => {
      const { rerender, getByTestId } = render(
        <GameBoard {...defaultProps} testID="stable-board" />
      );

      expect(getByTestId('stable-board')).toBeTruthy();
      
      // Re-render with different props
      rerender(
        <GameBoard 
          {...defaultProps} 
          isCurrentPlayerTurn={false}
          testID="stable-board" 
        />
      );
      
      expect(getByTestId('stable-board')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should be accessible by testID', () => {
      const { getByTestId } = render(
        <GameBoard {...defaultProps} testID="accessible-board" />
      );

      expect(getByTestId('accessible-board')).toBeTruthy();
    });

    it('should work without testID', () => {
      expect(() => {
        render(<GameBoard {...defaultProps} />);
      }).not.toThrow();
    });
  });
});