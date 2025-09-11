/**
 * CardMovement Component Tests
 * Tests for the ごきぶりポーカー CardMovement animation component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

import { CardMovement, CardMovementType } from '../../../../src/components/animations/CardMovement';
import { Card as CardEntity, CreatureType } from '../../../../src/lib/entities/Card';

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  
  Reanimated.default.useSharedValue = jest.fn((initial: any) => ({ value: initial }));
  Reanimated.default.useAnimatedStyle = jest.fn((fn: any) => {
    try {
      return fn();
    } catch {
      return {};
    }
  });
  Reanimated.default.withTiming = jest.fn((value: any, config?: any, callback?: any) => {
    if (callback) callback(true);
    return value;
  });
  Reanimated.default.withSpring = jest.fn((value: any, config?: any, callback?: any) => {
    if (callback) callback(true);
    return value;
  });
  Reanimated.default.withSequence = jest.fn((...values: any[]) => values[values.length - 1]);
  Reanimated.default.runOnJS = jest.fn((fn: any) => fn);
  Reanimated.default.Easing = { bezier: jest.fn() };
  
  return Reanimated;
});

// Mock Dimensions
jest.mock('react-native/Libraries/Utilities/Dimensions', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
  },
}));

// Mock Card component
jest.mock('../../../../src/components/cards/Card', () => {
  const MockCard = ({ card, testID }: any) => {
    const MockView = require('react-native').View;
    const MockText = require('react-native').Text;
    return (
      <MockView testID={testID}>
        <MockText>Card: {card.id}</MockText>
        <MockText>Type: {card.creatureType}</MockText>
      </MockView>
    );
  };
  return { Card: MockCard };
});

describe('CardMovement Component', () => {
  // Test data factory
  const createTestCard = (id: string, creatureType: CreatureType): CardEntity => ({
    id,
    creatureType,
    cardNumber: 1,
  });

  const mockOnAnimationComplete = jest.fn();

  const defaultProps = {
    card: createTestCard('test-card', CreatureType.COCKROACH),
    movementType: 'play-to-center' as CardMovementType,
    fromPosition: { x: 0, y: 0 },
    toPosition: { x: 100, y: 100 },
    isActive: true,
    onAnimationComplete: mockOnAnimationComplete,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the animated card correctly', () => {
      const { getByTestId } = render(
        <CardMovement {...defaultProps} testID="test-movement" />
      );

      expect(getByTestId('test-movement')).toBeTruthy();
    });

    it('should render with different card types', () => {
      const cards = [
        createTestCard('cockroach', CreatureType.COCKROACH),
        createTestCard('mouse', CreatureType.MOUSE),
        createTestCard('bat', CreatureType.BAT),
        createTestCard('frog', CreatureType.FROG),
      ];

      cards.forEach((card, index) => {
        const { getByTestId } = render(
          <CardMovement 
            {...defaultProps} 
            card={card}
            testID={`movement-${index}`} 
          />
        );

        expect(getByTestId(`movement-${index}`)).toBeTruthy();
      });
    });
  });

  describe('Movement Types', () => {
    it('should handle different movement types', () => {
      const movementTypes: CardMovementType[] = [
        'play-to-center',
        'return-to-hand',
        'move-to-penalty',
        'flip-reveal',
        'highlight-select',
        'shake-invalid',
        'slide-in',
        'slide-out'
      ];
      
      movementTypes.forEach(type => {
        const { getByTestId } = render(
          <CardMovement 
            {...defaultProps} 
            movementType={type}
            testID={`movement-${type}`} 
          />
        );

        expect(getByTestId(`movement-${type}`)).toBeTruthy();
      });
    });

    it('should handle animation duration', () => {
      const { getByTestId } = render(
        <CardMovement 
          {...defaultProps} 
          duration={500}
          testID="duration-movement" 
        />
      );

      expect(getByTestId('duration-movement')).toBeTruthy();
    });

    it('should handle animation delays', () => {
      const { getByTestId } = render(
        <CardMovement 
          {...defaultProps} 
          delay={300}
          testID="delayed-movement" 
        />
      );

      expect(getByTestId('delayed-movement')).toBeTruthy();
    });
  });

  describe('Position Handling', () => {
    it('should handle various position coordinates', () => {
      const positions = [
        { from: { x: 0, y: 0 }, to: { x: 50, y: 50 } },
        { from: { x: -10, y: -10 }, to: { x: 200, y: 300 } },
        { from: { x: 100, y: 200 }, to: { x: 0, y: 0 } },
      ];

      positions.forEach((pos, index) => {
        const { getByTestId } = render(
          <CardMovement 
            {...defaultProps} 
            fromPosition={pos.from}
            toPosition={pos.to}
            testID={`position-${index}`} 
          />
        );

        expect(getByTestId(`position-${index}`)).toBeTruthy();
      });
    });

    it('should handle same start and end positions', () => {
      const samePosition = { x: 100, y: 100 };
      
      const { getByTestId } = render(
        <CardMovement 
          {...defaultProps} 
          fromPosition={samePosition}
          toPosition={samePosition}
          testID="same-position-movement" 
        />
      );

      expect(getByTestId('same-position-movement')).toBeTruthy();
    });
  });

  describe('Animation States', () => {
    it('should handle active state', () => {
      const { getByTestId } = render(
        <CardMovement 
          {...defaultProps} 
          isActive={true}
          testID="active-movement" 
        />
      );

      expect(getByTestId('active-movement')).toBeTruthy();
    });

    it('should handle inactive state', () => {
      const { getByTestId } = render(
        <CardMovement 
          {...defaultProps} 
          isActive={false}
          testID="inactive-movement" 
        />
      );

      expect(getByTestId('inactive-movement')).toBeTruthy();
    });

    it('should handle showBack prop', () => {
      const { getByTestId } = render(
        <CardMovement 
          {...defaultProps} 
          showBack={true}
          testID="back-movement" 
        />
      );

      expect(getByTestId('back-movement')).toBeTruthy();
    });
  });

  describe('Callback Handling', () => {
    it('should handle animation complete callback', () => {
      const { getByTestId } = render(
        <CardMovement 
          {...defaultProps} 
          onAnimationComplete={mockOnAnimationComplete}
          testID="callback-movement" 
        />
      );

      expect(getByTestId('callback-movement')).toBeTruthy();
    });

    it('should handle missing callback gracefully', () => {
      const { getByTestId } = render(
        <CardMovement 
          card={defaultProps.card}
          movementType={defaultProps.movementType}
          fromPosition={defaultProps.fromPosition}
          toPosition={defaultProps.toPosition}
          isActive={defaultProps.isActive}
          testID="no-callback-movement" 
        />
      );

      expect(getByTestId('no-callback-movement')).toBeTruthy();
    });
  });

  describe('Props Validation', () => {
    it('should handle all available props', () => {
      const { getByTestId } = render(
        <CardMovement 
          {...defaultProps}
          duration={500}
          delay={100}
          showBack={false}
          testID="full-props-movement" 
        />
      );

      expect(getByTestId('full-props-movement')).toBeTruthy();
    });

    it('should handle missing optional props gracefully', () => {
      const minimalProps = {
        card: defaultProps.card,
        movementType: defaultProps.movementType,
        fromPosition: defaultProps.fromPosition,
        isActive: defaultProps.isActive,
      };

      expect(() => {
        render(<CardMovement {...minimalProps} />);
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid re-renders', () => {
      const { rerender, getByTestId } = render(
        <CardMovement {...defaultProps} testID="rapid-rerender" />
      );

      // Rapid re-renders with different positions
      rerender(
        <CardMovement 
          {...defaultProps} 
          toPosition={{ x: 200, y: 200 }}
          testID="rapid-rerender" 
        />
      );
      
      rerender(
        <CardMovement 
          {...defaultProps} 
          toPosition={{ x: 300, y: 300 }}
          testID="rapid-rerender" 
        />
      );

      expect(getByTestId('rapid-rerender')).toBeTruthy();
    });

    it('should handle extreme position values', () => {
      const { getByTestId } = render(
        <CardMovement 
          {...defaultProps} 
          fromPosition={{ x: -1000, y: -1000 }}
          toPosition={{ x: 9999, y: 9999 }}
          testID="extreme-positions" 
        />
      );

      expect(getByTestId('extreme-positions')).toBeTruthy();
    });

    it('should maintain component stability', () => {
      const { rerender, getByTestId } = render(
        <CardMovement {...defaultProps} testID="stable-movement" />
      );

      expect(getByTestId('stable-movement')).toBeTruthy();
      
      // Re-render with same props
      rerender(<CardMovement {...defaultProps} testID="stable-movement" />);
      
      expect(getByTestId('stable-movement')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should be accessible by testID', () => {
      const { getByTestId } = render(
        <CardMovement {...defaultProps} testID="accessible-movement" />
      );

      expect(getByTestId('accessible-movement')).toBeTruthy();
    });

    it('should work without testID', () => {
      expect(() => {
        render(<CardMovement {...defaultProps} />);
      }).not.toThrow();
    });
  });
});