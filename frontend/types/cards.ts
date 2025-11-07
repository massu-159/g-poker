/**
 * Card Types and Enums for G-Poker
 * Defines all card-related types for Cockroach Poker (ごきぶりポーカー)
 */

// Creature types for Cockroach Poker
export enum CreatureType {
  COCKROACH = 'cockroach', // ゴキブリ
  MOUSE = 'mouse',         // ネズミ
  BAT = 'bat',             // コウモリ
  FROG = 'frog',           // カエル
}

// Card interface for creature cards
export interface Card {
  creatureType: CreatureType;
  id: string; // Unique identifier for each card
  faceUp?: boolean; // For cards that may be face down during claims
}

// Player hand for Cockroach Poker
export interface PlayerHand {
  cards: Card[]; // Cards in player's hand
  penaltyPile: PenaltyPile; // Player's penalty cards
}

// Penalty pile tracking by creature type
export interface PenaltyPile {
  cockroach: Card[];
  mouse: Card[];
  bat: Card[];
  frog: Card[];
}

// Game round state for card passing
export interface RoundState {
  currentCard: Card;
  claim: CreatureType;
  claimingPlayer: string;
  targetPlayer: string;
  passCount: number; // How many times the card has been passed back
}

// Card visibility states
export type CardVisibility = 'hidden' | 'back' | 'face';

// Card animation states
export interface CardAnimation {
  isAnimating: boolean;
  animationType: 'deal' | 'flip' | 'move' | 'collect';
  duration?: number;
  delay?: number;
}

// Utility functions for Cockroach Poker
export const getCreatureTypeSymbol = (creatureType: CreatureType): string => {
  switch (creatureType) {
    case CreatureType.COCKROACH:
      return '🪳'; // Cockroach emoji
    case CreatureType.MOUSE:
      return '🐭'; // Mouse emoji
    case CreatureType.BAT:
      return '🦇'; // Bat emoji
    case CreatureType.FROG:
      return '🐸'; // Frog emoji
    default:
      return '?';
  }
};

export const getCreatureTypeName = (creatureType: CreatureType): string => {
  switch (creatureType) {
    case CreatureType.COCKROACH:
      return 'ゴキブリ';
    case CreatureType.MOUSE:
      return 'ネズミ';
    case CreatureType.BAT:
      return 'コウモリ';
    case CreatureType.FROG:
      return 'カエル';
    default:
      return 'Unknown';
  }
};

export const getCreatureTypeColor = (creatureType: CreatureType): string => {
  switch (creatureType) {
    case CreatureType.COCKROACH:
      return '#8B4513'; // Brown
    case CreatureType.MOUSE:
      return '#696969'; // Gray
    case CreatureType.BAT:
      return '#2F4F4F'; // Dark slate gray
    case CreatureType.FROG:
      return '#228B22'; // Forest green
    default:
      return '#000000';
  }
};

// Check if a player has lost (3 of same creature type)
export const checkPlayerLoss = (penaltyPile: PenaltyPile): CreatureType | null => {
  if (penaltyPile.cockroach.length >= 3) return CreatureType.COCKROACH;
  if (penaltyPile.mouse.length >= 3) return CreatureType.MOUSE;
  if (penaltyPile.bat.length >= 3) return CreatureType.BAT;
  if (penaltyPile.frog.length >= 3) return CreatureType.FROG;
  return null;
};

// Get penalty count for a specific creature type
export const getPenaltyCount = (penaltyPile: PenaltyPile, creatureType: CreatureType): number => {
  switch (creatureType) {
    case CreatureType.COCKROACH:
      return penaltyPile.cockroach.length;
    case CreatureType.MOUSE:
      return penaltyPile.mouse.length;
    case CreatureType.BAT:
      return penaltyPile.bat.length;
    case CreatureType.FROG:
      return penaltyPile.frog.length;
    default:
      return 0;
  }
};

// Add a penalty card to the appropriate pile
export const addPenaltyCard = (penaltyPile: PenaltyPile, card: Card): PenaltyPile => {
  const newPile = { ...penaltyPile };
  switch (card.creatureType) {
    case CreatureType.COCKROACH:
      newPile.cockroach = [...newPile.cockroach, card];
      break;
    case CreatureType.MOUSE:
      newPile.mouse = [...newPile.mouse, card];
      break;
    case CreatureType.BAT:
      newPile.bat = [...newPile.bat, card];
      break;
    case CreatureType.FROG:
      newPile.frog = [...newPile.frog, card];
      break;
  }
  return newPile;
};

// Create a Cockroach Poker deck (24 cards: 6 of each creature type)
export const createCockroachPokerDeck = (): Card[] => {
  const deck: Card[] = [];
  let cardId = 1;

  Object.values(CreatureType).forEach(creatureType => {
    // 6 cards of each creature type
    for (let i = 0; i < 6; i++) {
      deck.push({
        creatureType,
        id: `${creatureType}-${i + 1}`,
        faceUp: true
      });
      cardId++;
    }
  });

  return deck;
};

// Create an empty penalty pile
export const createEmptyPenaltyPile = (): PenaltyPile => ({
  cockroach: [],
  mouse: [],
  bat: [],
  frog: [],
});

// Shuffle a deck of cards (same algorithm, works for any card type)
export const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
};

// Create a card string representation for debugging
export const cardToString = (card: Card): string => {
  return `${card.id}-${getCreatureTypeSymbol(card.creatureType)}`;
};

// Check if a claim is truthful
export const isClaimTruthful = (card: Card, claim: CreatureType): boolean => {
  return card.creatureType === claim;
};

export default {
  CreatureType,
  getCreatureTypeSymbol,
  getCreatureTypeName,
  getCreatureTypeColor,
  checkPlayerLoss,
  getPenaltyCount,
  addPenaltyCard,
  createCockroachPokerDeck,
  createEmptyPenaltyPile,
  shuffleDeck,
  cardToString,
  isClaimTruthful,
};