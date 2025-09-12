/**
 * Card Entity Model
 * Represents cards in ごきぶりポーカー with creature types and game logic
 */

// The four creature types in ごきぶりポーカー
export enum CreatureType {
  COCKROACH = 'cockroach',  // ゴキブリ
  MOUSE = 'mouse',          // ネズミ  
  BAT = 'bat',              // コウモリ
  FROG = 'frog'             // カエル
}

// Japanese names mapping
export const CREATURE_NAMES_JP: Record<CreatureType, string> = {
  [CreatureType.COCKROACH]: 'ゴキブリ',
  [CreatureType.MOUSE]: 'ネズミ', 
  [CreatureType.BAT]: 'コウモリ',
  [CreatureType.FROG]: 'カエル'
};

// English names mapping
export const CREATURE_NAMES_EN: Record<CreatureType, string> = {
  [CreatureType.COCKROACH]: 'Cockroach',
  [CreatureType.MOUSE]: 'Mouse',
  [CreatureType.BAT]: 'Bat', 
  [CreatureType.FROG]: 'Frog'
};

export interface Card {
  id: string;
  creatureType: CreatureType;
  cardNumber: number; // 1-6 for each creature type (6 cards per creature)
  artVariant?: number; // Optional art variant for same creature type
}

export interface CardInPlay extends Card {
  playedBy: string; // Player ID who played the card
  playedAt: string; // ISO timestamp
  claim: CreatureType; // What the player claims this card is (may be false)
  targetPlayerId: string; // Who the card is being passed to
}

// Database row interface
export interface CardRow {
  id: string;
  creature_type: CreatureType;
  card_number: number;
  art_variant: number | null;
  created_at: string;
}

// Card deck configuration
export const CARDS_PER_CREATURE = 6;
export const TOTAL_CARDS = Object.keys(CreatureType).length * CARDS_PER_CREATURE; // 24 cards
export const CARDS_PER_PLAYER = 9; // In 2-player game
export const CARDS_HIDDEN = TOTAL_CARDS - (CARDS_PER_PLAYER * 2); // 6 cards remain hidden

// Card validation functions
export const isValidCreatureType = (type: string): type is CreatureType => {
  return Object.values(CreatureType).includes(type as CreatureType);
};

export const isValidCardNumber = (num: number): boolean => {
  return Number.isInteger(num) && num >= 1 && num <= CARDS_PER_CREATURE;
};

export const validateCard = (card: Card): boolean => {
  return (
    typeof card.id === 'string' &&
    card.id.length > 0 &&
    isValidCreatureType(card.creatureType) &&
    isValidCardNumber(card.cardNumber)
  );
};

// Card utility functions
export const getCreatureName = (type: CreatureType, language: 'jp' | 'en' = 'en'): string => {
  return language === 'jp' ? CREATURE_NAMES_JP[type] : CREATURE_NAMES_EN[type];
};

export const getAllCreatureTypes = (): CreatureType[] => {
  return Object.values(CreatureType);
};

export const getRandomCreatureType = (): CreatureType => {
  const types = getAllCreatureTypes();
  return types[Math.floor(Math.random() * types.length)]!;
};

export const isSameCreatureType = (card1: Card, card2: Card): boolean => {
  return card1.creatureType === card2.creatureType;
};

export const isClaimTruthful = (card: CardInPlay): boolean => {
  return card.creatureType === card.claim;
};

// Card generation functions
export const generateCardId = (creatureType: CreatureType, cardNumber: number): string => {
  return `${creatureType}_${cardNumber}`;
};

export const createCard = (creatureType: CreatureType, cardNumber: number): Card => {
  if (!isValidCreatureType(creatureType)) {
    throw new Error(`Invalid creature type: ${creatureType}`);
  }
  if (!isValidCardNumber(cardNumber)) {
    throw new Error(`Invalid card number: ${cardNumber}`);
  }
  
  return {
    id: generateCardId(creatureType, cardNumber),
    creatureType,
    cardNumber
  };
};

// Generate complete deck of cards
export const createFullDeck = (): Card[] => {
  const deck: Card[] = [];
  
  for (const creatureType of getAllCreatureTypes()) {
    for (let cardNumber = 1; cardNumber <= CARDS_PER_CREATURE; cardNumber++) {
      deck.push(createCard(creatureType, cardNumber));
    }
  }
  
  return deck;
};

// Shuffle deck using Fisher-Yates algorithm
export const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp!;
  }
  
  return shuffled;
};

// Deal cards for 2-player game
export const dealCards = (deck: Card[]): { 
  player1Hand: Card[], 
  player2Hand: Card[], 
  remainingCards: Card[] 
} => {
  if (deck.length !== TOTAL_CARDS) {
    throw new Error(`Deck must contain exactly ${TOTAL_CARDS} cards`);
  }
  
  const shuffled = shuffleDeck(deck);
  
  return {
    player1Hand: shuffled.slice(0, CARDS_PER_PLAYER),
    player2Hand: shuffled.slice(CARDS_PER_PLAYER, CARDS_PER_PLAYER * 2),
    remainingCards: shuffled.slice(CARDS_PER_PLAYER * 2)
  };
};

// Card search and filtering
export const findCardById = (cards: Card[], cardId: string): Card | undefined => {
  return cards.find(card => card.id === cardId);
};

export const findCardsByCreatureType = (cards: Card[], creatureType: CreatureType): Card[] => {
  return cards.filter(card => card.creatureType === creatureType);
};

export const countCardsByCreatureType = (cards: Card[]): Record<CreatureType, number> => {
  const counts: Record<CreatureType, number> = {
    [CreatureType.COCKROACH]: 0,
    [CreatureType.MOUSE]: 0,
    [CreatureType.BAT]: 0,
    [CreatureType.FROG]: 0
  };
  
  cards.forEach(card => {
    counts[card.creatureType]++;
  });
  
  return counts;
};

export const getCreatureTypeWithMostCards = (cards: Card[]): CreatureType | null => {
  const counts = countCardsByCreatureType(cards);
  let maxCount = 0;
  let maxCreatureType: CreatureType | null = null;
  
  Object.entries(counts).forEach(([type, count]) => {
    if (count > maxCount) {
      maxCount = count;
      maxCreatureType = type as CreatureType;
    }
  });
  
  return maxCreatureType;
};

// Check win/lose conditions
export const hasLostWithCreatureType = (
  cards: Card[], 
  creatureType: CreatureType, 
  winCondition: number = 3
): boolean => {
  const count = findCardsByCreatureType(cards, creatureType).length;
  return count >= winCondition;
};

export const checkLoseCondition = (cards: Card[], winCondition: number = 3): CreatureType | null => {
  for (const creatureType of getAllCreatureTypes()) {
    if (hasLostWithCreatureType(cards, creatureType, winCondition)) {
      return creatureType;
    }
  }
  return null;
};

// Transformation helpers
export const cardRowToCard = (row: CardRow): Card => ({
  id: row.id,
  creatureType: row.creature_type,
  cardNumber: row.card_number,
  ...(row.art_variant !== null && { artVariant: row.art_variant })
});

export const cardToCardRow = (card: Card): Omit<CardRow, 'created_at'> => ({
  id: card.id,
  creature_type: card.creatureType,
  card_number: card.cardNumber,
  art_variant: card.artVariant || null
});

// Card display helpers
export const getCardDisplayName = (card: Card, language: 'jp' | 'en' = 'en'): string => {
  const creatureName = getCreatureName(card.creatureType, language);
  return `${creatureName} ${card.cardNumber}`;
};

export const getCardEmoji = (creatureType: CreatureType): string => {
  const emojiMap: Record<CreatureType, string> = {
    [CreatureType.COCKROACH]: '🪳',
    [CreatureType.MOUSE]: '🐭',
    [CreatureType.BAT]: '🦇',
    [CreatureType.FROG]: '🐸'
  };
  
  return emojiMap[creatureType];
};

export const formatCardForDisplay = (card: Card, language: 'jp' | 'en' = 'en'): string => {
  const emoji = getCardEmoji(card.creatureType);
  const name = getCardDisplayName(card, language);
  return `${emoji} ${name}`;
};

// Game action helpers for cards
export const createCardInPlay = (
  card: Card,
  playedBy: string,
  claim: CreatureType,
  targetPlayerId: string
): CardInPlay => ({
  ...card,
  playedBy,
  playedAt: new Date().toISOString(),
  claim,
  targetPlayerId
});

export const isValidClaim = (claim: string): claim is CreatureType => {
  return isValidCreatureType(claim);
};