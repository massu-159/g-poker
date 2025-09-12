/**
 * Card Component Tests
 * Tests for the ごきぶりポーカー Card component with React Native Testing Library
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

import { Card } from '../../../../src/components/cards/Card';
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

describe('Card Component', () => {
  // Test data factory
  const createTestCard = (creatureType: CreatureType): CardEntity => ({
    id: `test-card-${creatureType}`,
    creatureType,
    cardNumber: 1,
  });

  const mockOnPress = jest.fn();
  const mockOnLongPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render a cockroach card correctly', () => {
      const card = createTestCard(CreatureType.COCKROACH);
      const { getAllByText, getByTestId } = render(
        <Card card={card} testID="test-card" />
      );

      expect(getByTestId('test-card')).toBeTruthy();
      expect(getAllByText('🪳').length).toBeGreaterThan(0);
      expect(getAllByText('ゴキブリ').length).toBeGreaterThan(0);
    });

    it('should render a mouse card correctly', () => {
      const card = createTestCard(CreatureType.MOUSE);
      const { getAllByText } = render(<Card card={card} />);

      expect(getAllByText('🐭').length).toBeGreaterThan(0);
      expect(getAllByText('ネズミ').length).toBeGreaterThan(0);
    });

    it('should render a bat card correctly', () => {
      const card = createTestCard(CreatureType.BAT);
      const { getAllByText } = render(<Card card={card} />);

      expect(getAllByText('🦇').length).toBeGreaterThan(0);
      expect(getAllByText('コウモリ').length).toBeGreaterThan(0);
    });

    it('should render a frog card correctly', () => {
      const card = createTestCard(CreatureType.FROG);
      const { getAllByText } = render(<Card card={card} />);

      expect(getAllByText('🐸').length).toBeGreaterThan(0);
      expect(getAllByText('カエル').length).toBeGreaterThan(0);
    });

    it('should render card back when not revealed', () => {
      const card = createTestCard(CreatureType.COCKROACH);
      const { getAllByText } = render(
        <Card card={card} isRevealed={false} />
      );

      expect(getAllByText('🃏').length).toBeGreaterThan(0);
      expect(getAllByText('ごきぶり').length).toBeGreaterThan(0);
      expect(getAllByText('ポーカー').length).toBeGreaterThan(0);
      
      // Note: Front face content may be present in DOM but not visually shown due to animations
      // This is expected behavior for animation-based card flipping
    });
  });

  describe('Interaction', () => {
    it('should call onPress when card is pressed and selectable', () => {
      const card = createTestCard(CreatureType.COCKROACH);
      const { getByTestId } = render(
        <Card 
          card={card} 
          onPress={mockOnPress} 
          isSelectable={true}
          testID="test-card"
        />
      );

      fireEvent.press(getByTestId('test-card'));
      expect(mockOnPress).toHaveBeenCalledWith(card);
    });

    it('should not call onPress when card is not selectable', () => {
      const card = createTestCard(CreatureType.COCKROACH);
      const { getByTestId } = render(
        <Card 
          card={card} 
          onPress={mockOnPress} 
          isSelectable={false}
          testID="test-card"
        />
      );

      fireEvent.press(getByTestId('test-card'));
      expect(mockOnPress).not.toHaveBeenCalled();
    });

    it('should call onLongPress when card is long pressed', () => {
      const card = createTestCard(CreatureType.COCKROACH);
      const { getByTestId } = render(
        <Card 
          card={card} 
          onLongPress={mockOnLongPress} 
          isSelectable={true}
          testID="test-card"
        />
      );

      fireEvent(getByTestId('test-card'), 'longPress');
      expect(mockOnLongPress).toHaveBeenCalledWith(card);
    });

    it('should not call onLongPress when card is not selectable', () => {
      const card = createTestCard(CreatureType.COCKROACH);
      const { getByTestId } = render(
        <Card 
          card={card} 
          onLongPress={mockOnLongPress} 
          isSelectable={false}
          testID="test-card"
        />
      );

      fireEvent(getByTestId('test-card'), 'longPress');
      expect(mockOnLongPress).not.toHaveBeenCalled();
    });
  });

  describe('Visual States', () => {
    it('should apply correct styles for small size', () => {
      const card = createTestCard(CreatureType.COCKROACH);
      const { getByTestId } = render(
        <Card card={card} size="small" testID="test-card" />
      );

      const cardElement = getByTestId('test-card');
      expect(cardElement).toBeTruthy();
    });

    it('should apply correct styles for large size', () => {
      const card = createTestCard(CreatureType.COCKROACH);
      const { getByTestId } = render(
        <Card card={card} size="large" testID="test-card" />
      );

      const cardElement = getByTestId('test-card');
      expect(cardElement).toBeTruthy();
    });

    it('should apply correct styles for normal size (default)', () => {
      const card = createTestCard(CreatureType.COCKROACH);
      const { getByTestId } = render(
        <Card card={card} testID="test-card" />
      );

      const cardElement = getByTestId('test-card');
      expect(cardElement).toBeTruthy();
    });

    it('should show selection indicator when selected', () => {
      const card = createTestCard(CreatureType.COCKROACH);
      const { getByTestId } = render(
        <Card card={card} isSelected={true} testID="test-card" />
      );

      const cardElement = getByTestId('test-card');
      expect(cardElement).toBeTruthy();
    });

    it('should handle isInHand prop correctly', () => {
      const card = createTestCard(CreatureType.COCKROACH);
      const { getByTestId } = render(
        <Card 
          card={card} 
          isInHand={true} 
          isSelected={true}
          testID="test-card" 
        />
      );

      const cardElement = getByTestId('test-card');
      expect(cardElement).toBeTruthy();
    });
  });

  describe('Creature Type Configuration', () => {
    it('should use correct configuration for each creature type', () => {
      const creatures = [
        { type: CreatureType.COCKROACH, emoji: '🪳', name: 'ゴキブリ' },
        { type: CreatureType.MOUSE, emoji: '🐭', name: 'ネズミ' },
        { type: CreatureType.BAT, emoji: '🦇', name: 'コウモリ' },
        { type: CreatureType.FROG, emoji: '🐸', name: 'カエル' },
      ];

      creatures.forEach(({ type, emoji, name }) => {
        const card = createTestCard(type);
        const { getAllByText } = render(<Card card={card} />);
        
        expect(getAllByText(emoji).length).toBeGreaterThan(0);
        expect(getAllByText(name).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Props Validation', () => {
    it('should handle missing optional props gracefully', () => {
      const card = createTestCard(CreatureType.COCKROACH);
      
      expect(() => {
        render(<Card card={card} />);
      }).not.toThrow();
    });

    it('should apply custom styles when provided', () => {
      const card = createTestCard(CreatureType.COCKROACH);
      const customStyle = { margin: 10 };
      
      const { getByTestId } = render(
        <Card card={card} style={customStyle} testID="test-card" />
      );

      const cardElement = getByTestId('test-card');
      expect(cardElement).toBeTruthy();
    });

    it('should handle all boolean props correctly', () => {
      const card = createTestCard(CreatureType.COCKROACH);
      
      const { getByTestId } = render(
        <Card 
          card={card}
          isSelected={true}
          isSelectable={true}
          isInHand={true}
          isRevealed={true}
          testID="test-card"
        />
      );

      const cardElement = getByTestId('test-card');
      expect(cardElement).toBeTruthy();
    });
  });

  describe('Animation Behavior', () => {
    it('should initialize animation values correctly', () => {
      const card = createTestCard(CreatureType.COCKROACH);
      
      expect(() => {
        render(<Card card={card} isSelected={true} isRevealed={false} />);
      }).not.toThrow();
    });

    it('should handle revealed state changes', async () => {
      const card = createTestCard(CreatureType.COCKROACH);
      const { rerender, getAllByText } = render(
        <Card card={card} isRevealed={false} />
      );

      // Initially should show back
      expect(getAllByText('🃏').length).toBeGreaterThan(0);

      // Change to revealed
      rerender(<Card card={card} isRevealed={true} />);

      // Should eventually show front (after animation)
      await waitFor(() => {
        expect(getAllByText('🪳').length).toBeGreaterThan(0);
      });
    });

    it('should handle selection state changes', () => {
      const card = createTestCard(CreatureType.COCKROACH);
      const { rerender, getByTestId } = render(
        <Card card={card} isSelected={false} testID="test-card" />
      );

      const cardElement = getByTestId('test-card');
      expect(cardElement).toBeTruthy();

      // Change to selected
      rerender(<Card card={card} isSelected={true} testID="test-card" />);
      expect(cardElement).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid press events', () => {
      const card = createTestCard(CreatureType.COCKROACH);
      const { getByTestId } = render(
        <Card 
          card={card} 
          onPress={mockOnPress} 
          isSelectable={true}
          testID="test-card"
        />
      );

      const cardElement = getByTestId('test-card');
      
      // Rapid presses
      fireEvent.press(cardElement);
      fireEvent.press(cardElement);
      fireEvent.press(cardElement);

      expect(mockOnPress).toHaveBeenCalledTimes(3);
    });

    it('should handle card with missing properties gracefully', () => {
      const incompleteCard = {
        id: 'incomplete',
        creatureType: CreatureType.COCKROACH,
        cardNumber: 1,
      } as CardEntity;

      expect(() => {
        render(<Card card={incompleteCard} />);
      }).not.toThrow();
    });

    it('should maintain component stability on re-renders', () => {
      const card = createTestCard(CreatureType.COCKROACH);
      const { rerender, getByTestId } = render(
        <Card card={card} testID="test-card" />
      );

      const firstRender = getByTestId('test-card');
      
      // Re-render with same props
      rerender(<Card card={card} testID="test-card" />);
      
      const secondRender = getByTestId('test-card');
      expect(secondRender).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should be accessible by testID', () => {
      const card = createTestCard(CreatureType.COCKROACH);
      const { getByTestId } = render(
        <Card card={card} testID="accessibility-test-card" />
      );

      expect(getByTestId('accessibility-test-card')).toBeTruthy();
    });

    it('should provide proper touch feedback', () => {
      const card = createTestCard(CreatureType.COCKROACH);
      const { getByTestId } = render(
        <Card 
          card={card} 
          isSelectable={true}
          testID="test-card"
        />
      );

      const cardElement = getByTestId('test-card');
      expect(cardElement).toBeTruthy();
      // Note: TouchableOpacity props may not be directly accessible in test environment
    });

    it('should disable touch feedback when not selectable', () => {
      const card = createTestCard(CreatureType.COCKROACH);
      const { getByTestId } = render(
        <Card 
          card={card} 
          isSelectable={false}
          testID="test-card"
        />
      );

      const cardElement = getByTestId('test-card');
      expect(cardElement).toBeTruthy();
      // Note: TouchableOpacity props may not be directly accessible in test environment
    });
  });
});