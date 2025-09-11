/**
 * Hand Component Tests
 * Tests for the ごきぶりポーカー Hand component with React Native Testing Library
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

import { Hand } from '../../../../src/components/cards/Hand';
import { Card as CardEntity, CreatureType } from '../../../../src/lib/entities/Card';

// Mock react-native-reanimated
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
    Extrapolate: {
      CLAMP: 'clamp',
      EXTEND: 'extend',
      IDENTITY: 'identity',
    },
  };
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
  const MockCard = ({ card, testID, onPress, onLongPress }: any) => {
    const MockView = require('react-native').View;
    const MockText = require('react-native').Text;
    const MockTouchableOpacity = require('react-native').TouchableOpacity;
    
    return (
      <MockTouchableOpacity 
        testID={testID}
        onPress={() => onPress?.(card)}
        onLongPress={() => onLongPress?.(card)}
      >
        <MockView>
          <MockText>{card.creatureType}</MockText>
          <MockText>{card.id}</MockText>
        </MockView>
      </MockTouchableOpacity>
    );
  };
  return MockCard;
});

describe('Hand Component', () => {
  // Test data factory
  const createTestCards = (count: number): CardEntity[] => {
    return Array.from({ length: count }, (_, index) => ({
      id: `test-card-${index}`,
      creatureType: Object.values(CreatureType)[index % 4] as CreatureType,
      cardNumber: index + 1,
    }));
  };

  const mockOnCardSelect = jest.fn();
  const mockOnCardLongPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render empty hand correctly', () => {
      const result = render(<Hand cards={[]} />);
      expect(result).toBeTruthy();
    });

    it('should render hand with one card', () => {
      const cards = createTestCards(1);
      const { getByTestId, getByText } = render(
        <Hand cards={cards} testID="test-hand" />
      );

      expect(getByTestId('test-hand')).toBeTruthy();
      expect(getByTestId('hand-card-0')).toBeTruthy();
      expect(getByText('test-card-0')).toBeTruthy();
    });

    it('should render hand with multiple cards', () => {
      const cards = createTestCards(5);
      const { getByTestId } = render(
        <Hand cards={cards} testID="test-hand" />
      );

      expect(getByTestId('test-hand')).toBeTruthy();
      
      // Check all cards are rendered
      for (let i = 0; i < 5; i++) {
        expect(getByTestId(`hand-card-${i}`)).toBeTruthy();
      }
    });

    it('should respect maxVisibleCards limit', () => {
      const cards = createTestCards(10);
      const { queryByTestId } = render(
        <Hand cards={cards} maxVisibleCards={6} />
      );

      // Should only render first 6 cards
      for (let i = 0; i < 6; i++) {
        expect(queryByTestId(`hand-card-${i}`)).toBeTruthy();
      }
      
      // Should not render cards beyond limit
      expect(queryByTestId('hand-card-6')).toBeFalsy();
      expect(queryByTestId('hand-card-7')).toBeFalsy();
    });
  });

  describe('Player Turn Indicators', () => {
    it('should show turn indicator when it is player turn', () => {
      const cards = createTestCards(3);
      const { getByText } = render(
        <Hand cards={cards} isPlayerTurn={true} />
      );

      expect(getByText('あなたの番')).toBeTruthy();
    });

    it('should not show turn indicator when it is not player turn', () => {
      const cards = createTestCards(3);
      const { queryByText } = render(
        <Hand cards={cards} isPlayerTurn={false} />
      );

      expect(queryByText('あなたの番')).toBeFalsy();
    });

    it('should show selection hint when card is selected', () => {
      const cards = createTestCards(3);
      const { getByText } = render(
        <Hand 
          cards={cards} 
          selectedCardId="test-card-1"
          isPlayerTurn={true}
        />
      );

      expect(getByText('カードが選択されました')).toBeTruthy();
    });
  });

  describe('Opponent Hand Features', () => {
    it('should show card count indicator for opponent hand', () => {
      const cards = createTestCards(7);
      const { getByText } = render(
        <Hand cards={cards} isOpponentHand={true} />
      );

      expect(getByText('7')).toBeTruthy();
    });

    it('should not show turn indicator for opponent hand', () => {
      const cards = createTestCards(3);
      const { queryByText } = render(
        <Hand 
          cards={cards} 
          isOpponentHand={true}
          isPlayerTurn={true}
        />
      );

      expect(queryByText('あなたの番')).toBeFalsy();
    });

    it('should not show selection hint for opponent hand', () => {
      const cards = createTestCards(3);
      const { queryByText } = render(
        <Hand 
          cards={cards} 
          isOpponentHand={true}
          selectedCardId="test-card-1"
        />
      );

      expect(queryByText('カードが選択されました')).toBeFalsy();
    });
  });

  describe('Card Interaction', () => {
    it('should call onCardSelect when player card is pressed during their turn', () => {
      const cards = createTestCards(3);
      const { getByTestId } = render(
        <Hand 
          cards={cards}
          isPlayerTurn={true}
          onCardSelect={mockOnCardSelect}
        />
      );

      fireEvent.press(getByTestId('hand-card-1'));
      expect(mockOnCardSelect).toHaveBeenCalledWith(cards[1]);
    });

    it('should not call onCardSelect when not player turn', () => {
      const cards = createTestCards(3);
      const { getByTestId } = render(
        <Hand 
          cards={cards}
          isPlayerTurn={false}
          onCardSelect={mockOnCardSelect}
        />
      );

      fireEvent.press(getByTestId('hand-card-1'));
      expect(mockOnCardSelect).not.toHaveBeenCalled();
    });

    it('should not call onCardSelect for opponent hand', () => {
      const cards = createTestCards(3);
      const { getByTestId } = render(
        <Hand 
          cards={cards}
          isOpponentHand={true}
          isPlayerTurn={true}
          onCardSelect={mockOnCardSelect}
        />
      );

      fireEvent.press(getByTestId('hand-card-1'));
      expect(mockOnCardSelect).not.toHaveBeenCalled();
    });

    it('should call onCardLongPress for player cards', () => {
      const cards = createTestCards(3);
      const { getByTestId } = render(
        <Hand 
          cards={cards}
          onCardLongPress={mockOnCardLongPress}
        />
      );

      fireEvent(getByTestId('hand-card-1'), 'longPress');
      expect(mockOnCardLongPress).toHaveBeenCalledWith(cards[1]);
    });

    it('should not call onCardLongPress for opponent hand', () => {
      const cards = createTestCards(3);
      const { getByTestId } = render(
        <Hand 
          cards={cards}
          isOpponentHand={true}
          onCardLongPress={mockOnCardLongPress}
        />
      );

      fireEvent(getByTestId('hand-card-1'), 'longPress');
      expect(mockOnCardLongPress).not.toHaveBeenCalled();
    });
  });

  describe('Card Selection', () => {
    it('should highlight selected card', () => {
      const cards = createTestCards(3);
      const { getByTestId } = render(
        <Hand 
          cards={cards}
          selectedCardId="test-card-1"
        />
      );

      // Selected card should be present
      expect(getByTestId('hand-card-1')).toBeTruthy();
    });

    it('should handle no selection', () => {
      const cards = createTestCards(3);
      const { getByTestId } = render(
        <Hand cards={cards} />
      );

      // All cards should be present and unselected
      expect(getByTestId('hand-card-0')).toBeTruthy();
      expect(getByTestId('hand-card-1')).toBeTruthy();
      expect(getByTestId('hand-card-2')).toBeTruthy();
    });

    it('should handle invalid selected card ID', () => {
      const cards = createTestCards(3);
      
      expect(() => {
        render(
          <Hand 
            cards={cards}
            selectedCardId="invalid-card-id"
          />
        );
      }).not.toThrow();
    });
  });

  describe('Visibility States', () => {
    it('should render when visible', () => {
      const cards = createTestCards(3);
      const { getByTestId } = render(
        <Hand 
          cards={cards}
          isVisible={true}
          testID="test-hand"
        />
      );

      expect(getByTestId('test-hand')).toBeTruthy();
    });

    it('should handle invisible state', () => {
      const cards = createTestCards(3);
      const { getByTestId } = render(
        <Hand 
          cards={cards}
          isVisible={false}
          testID="test-hand"
        />
      );

      expect(getByTestId('test-hand')).toBeTruthy();
    });
  });

  describe('Layout Calculations', () => {
    it('should handle different hand sizes correctly', () => {
      const testSizes = [1, 3, 6, 9];
      
      testSizes.forEach(size => {
        const cards = createTestCards(size);
        
        expect(() => {
          render(<Hand cards={cards} testID={`hand-${size}`} />);
        }).not.toThrow();
      });
    });

    it('should handle empty cards array', () => {
      const result = render(<Hand cards={[]} />);
      expect(result).toBeTruthy();
    });

    it('should handle single card layout', () => {
      const cards = createTestCards(1);
      const { getByTestId } = render(
        <Hand cards={cards} testID="single-card-hand" />
      );

      expect(getByTestId('single-card-hand')).toBeTruthy();
      expect(getByTestId('hand-card-0')).toBeTruthy();
    });
  });

  describe('Props Validation', () => {
    it('should handle all optional props being undefined', () => {
      const cards = createTestCards(3);
      
      expect(() => {
        render(<Hand cards={cards} />);
      }).not.toThrow();
    });

    it('should apply custom styles', () => {
      const cards = createTestCards(3);
      const customStyle = { margin: 10 };
      
      const { getByTestId } = render(
        <Hand 
          cards={cards}
          style={customStyle}
          testID="styled-hand"
        />
      );

      expect(getByTestId('styled-hand')).toBeTruthy();
    });

    it('should handle boolean props correctly', () => {
      const cards = createTestCards(3);
      
      const { getByTestId } = render(
        <Hand 
          cards={cards}
          isPlayerTurn={true}
          isVisible={true}
          isOpponentHand={false}
          testID="boolean-test-hand"
        />
      );

      expect(getByTestId('boolean-test-hand')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid card selections', () => {
      const cards = createTestCards(5);
      const { getByTestId } = render(
        <Hand 
          cards={cards}
          isPlayerTurn={true}
          onCardSelect={mockOnCardSelect}
        />
      );

      // Rapid selections
      fireEvent.press(getByTestId('hand-card-0'));
      fireEvent.press(getByTestId('hand-card-1'));
      fireEvent.press(getByTestId('hand-card-2'));

      expect(mockOnCardSelect).toHaveBeenCalledTimes(3);
    });

    it('should handle cards with missing properties', () => {
      const incompleteCards = [
        { id: 'incomplete-1', creatureType: CreatureType.COCKROACH, cardNumber: 1 },
        { id: 'incomplete-2', creatureType: CreatureType.MOUSE, cardNumber: 2 },
      ] as CardEntity[];

      expect(() => {
        render(<Hand cards={incompleteCards} />);
      }).not.toThrow();
    });

    it('should maintain stability on re-renders', () => {
      const cards = createTestCards(3);
      const { rerender, getByTestId } = render(
        <Hand cards={cards} testID="stable-hand" />
      );

      expect(getByTestId('stable-hand')).toBeTruthy();
      
      // Re-render with same props
      rerender(<Hand cards={cards} testID="stable-hand" />);
      
      expect(getByTestId('stable-hand')).toBeTruthy();
    });

    it('should handle maximum visible cards correctly', () => {
      const manyCards = createTestCards(15);
      const { queryByTestId } = render(
        <Hand cards={manyCards} maxVisibleCards={9} />
      );

      // Should render up to max
      for (let i = 0; i < 9; i++) {
        expect(queryByTestId(`hand-card-${i}`)).toBeTruthy();
      }
      
      // Should not render beyond max
      expect(queryByTestId('hand-card-9')).toBeFalsy();
      expect(queryByTestId('hand-card-10')).toBeFalsy();
    });
  });

  describe('Accessibility', () => {
    it('should be accessible by testID', () => {
      const cards = createTestCards(3);
      const { getByTestId } = render(
        <Hand cards={cards} testID="accessible-hand" />
      );

      expect(getByTestId('accessible-hand')).toBeTruthy();
    });

    it('should provide accessible card testIDs', () => {
      const cards = createTestCards(3);
      const { getByTestId } = render(
        <Hand cards={cards} />
      );

      expect(getByTestId('hand-card-0')).toBeTruthy();
      expect(getByTestId('hand-card-1')).toBeTruthy();
      expect(getByTestId('hand-card-2')).toBeTruthy();
    });
  });
});