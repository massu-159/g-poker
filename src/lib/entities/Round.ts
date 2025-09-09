/**
 * Round Entity Model
 * Represents a round of gameplay in ごきぶりポーカー with response types and resolution logic
 */

import { Card, CardInPlay, CreatureType } from './Card';

export type RoundResponse = 'believe' | 'disbelieve' | 'pass_back';

export type RoundStatus = 
  | 'active'        // Waiting for target player response
  | 'resolved'      // Round completed with believe/disbelieve
  | 'passed_back'   // Card passed back, new round starts
  | 'cancelled';    // Round cancelled due to disconnection/error

export interface RoundResolution {
  type: 'believe' | 'disbelieve';
  wasClaimTruthful: boolean;
  winner: string; // Player ID who won the round
  loser: string; // Player ID who receives penalty card
  penaltyCard: Card; // The card that goes to penalty pile
  resolvedAt: string; // ISO timestamp
}

export interface Round {
  id: string;
  gameId: string;
  roundNumber: number; // Sequential round number in the game
  
  // Card and claim information
  cardInPlay: CardInPlay;
  
  // Player responses
  targetPlayerId: string; // Who needs to respond
  response?: {
    type: RoundResponse;
    respondedBy: string; // Player ID who responded
    respondedAt: string; // ISO timestamp
  };
  
  // Round status and resolution
  status: RoundStatus;
  resolution?: RoundResolution;
  
  // Timing information
  createdAt: string;
  expiresAt?: string; // When turn timer expires
  resolvedAt?: string;
}

// Database row interface
export interface RoundRow {
  id: string;
  game_id: string;
  round_number: number;
  card_in_play: any; // JSON CardInPlay object
  target_player_id: string;
  response: any | null; // JSON response object
  status: RoundStatus;
  resolution: any | null; // JSON RoundResolution object
  created_at: string;
  expires_at: string | null;
  resolved_at: string | null;
}

// Round creation request
export interface CreateRoundRequest {
  gameId: string;
  cardInPlay: CardInPlay;
  targetPlayerId: string;
  turnTimeLimit?: number; // Seconds until expiry
}

// Round response request
export interface RoundResponseRequest {
  roundId: string;
  gameId: string;
  playerId: string; // Who is responding
  response: RoundResponse;
}

// Round query interface
export interface RoundQuery {
  gameId?: string;
  status?: RoundStatus;
  playerId?: string;
  limit?: number;
  offset?: number;
}

// Validation functions
export const isValidRoundResponse = (response: string): response is RoundResponse => {
  const validResponses: RoundResponse[] = ['believe', 'disbelieve', 'pass_back'];
  return validResponses.includes(response as RoundResponse);
};

export const isValidRoundStatus = (status: string): status is RoundStatus => {
  const validStatuses: RoundStatus[] = ['active', 'resolved', 'passed_back', 'cancelled'];
  return validStatuses.includes(status as RoundStatus);
};

export const validateRound = (round: Round): boolean => {
  return (
    typeof round.id === 'string' &&
    typeof round.gameId === 'string' &&
    typeof round.cardInPlay === 'object' &&
    typeof round.targetPlayerId === 'string' &&
    isValidRoundStatus(round.status)
  );
};

// Round state helpers
export const isRoundActive = (round: Round): boolean => {
  return round.status === 'active';
};

export const isRoundResolved = (round: Round): boolean => {
  return round.status === 'resolved';
};

export const isRoundPassedBack = (round: Round): boolean => {
  return round.status === 'passed_back';
};

export const hasRoundExpired = (round: Round): boolean => {
  if (!round.expiresAt) return false;
  return new Date() > new Date(round.expiresAt);
};

export const canPlayerRespond = (round: Round, playerId: string): boolean => {
  return (
    round.status === 'active' &&
    round.targetPlayerId === playerId &&
    !round.response &&
    !hasRoundExpired(round)
  );
};

export const getRoundTimeRemaining = (round: Round): number => {
  if (!round.expiresAt) return 0;
  const remaining = new Date(round.expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(remaining / 1000));
};

// Round resolution logic
export const resolveRound = (
  round: Round,
  response: RoundResponse
): RoundResolution | null => {
  if (response === 'pass_back') {
    return null; // Pass back creates new round
  }
  
  const { cardInPlay } = round;
  const wasClaimTruthful = cardInPlay.creatureType === cardInPlay.claim;
  
  let winner: string;
  let loser: string;
  
  if (response === 'believe') {
    // Target player believes the claim
    winner = cardInPlay.playedBy; // Original player wins
    loser = round.targetPlayerId; // Target player gets penalty
  } else { // 'disbelieve'
    // Target player disbelieves the claim
    if (wasClaimTruthful) {
      // Claim was true, disbeliever was wrong
      winner = cardInPlay.playedBy; // Original player wins
      loser = round.targetPlayerId; // Target player gets penalty
    } else {
      // Claim was false, disbeliever was right
      winner = round.targetPlayerId; // Target player wins
      loser = cardInPlay.playedBy; // Original player gets penalty
    }
  }
  
  return {
    type: response,
    wasClaimTruthful,
    winner,
    loser,
    penaltyCard: {
      id: cardInPlay.id,
      creatureType: cardInPlay.creatureType,
      cardNumber: cardInPlay.cardNumber,
      ...(cardInPlay.artVariant !== undefined && { artVariant: cardInPlay.artVariant })
    },
    resolvedAt: new Date().toISOString()
  };
};

// Round creation helpers
export const createRound = (request: CreateRoundRequest): Round => {
  const roundId = `round_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  let expiresAt: string | undefined;
  if (request.turnTimeLimit) {
    const expiry = new Date(Date.now() + (request.turnTimeLimit * 1000));
    expiresAt = expiry.toISOString();
  }
  
  return {
    id: roundId,
    gameId: request.gameId,
    roundNumber: 1, // This should be calculated based on game history
    cardInPlay: request.cardInPlay,
    targetPlayerId: request.targetPlayerId,
    status: 'active',
    createdAt: now,
    ...(expiresAt && { expiresAt })
  };
};

export const createPassBackRound = (
  originalRound: Round,
  newRoundNumber: number
): Round => {
  // When passing back, the target becomes the new player, original player becomes target
  const newCardInPlay: CardInPlay = {
    ...originalRound.cardInPlay,
    playedBy: originalRound.targetPlayerId,
    targetPlayerId: originalRound.cardInPlay.playedBy,
    playedAt: new Date().toISOString()
    // Claim remains the same when passing back
  };
  
  return {
    id: `round_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    gameId: originalRound.gameId,
    roundNumber: newRoundNumber,
    cardInPlay: newCardInPlay,
    targetPlayerId: newCardInPlay.targetPlayerId,
    status: 'active',
    createdAt: new Date().toISOString(),
    ...(originalRound.expiresAt && { expiresAt: originalRound.expiresAt })
  };
};

// Round response handling
export const addResponseToRound = (round: Round, response: {
  type: RoundResponse;
  respondedBy: string;
}): Round => {
  const updatedRound: Round = {
    ...round,
    response: {
      ...response,
      respondedAt: new Date().toISOString()
    }
  };
  
  if (response.type === 'pass_back') {
    updatedRound.status = 'passed_back';
  } else {
    updatedRound.status = 'resolved';
    const resolution = resolveRound(round, response.type);
    if (resolution) {
      updatedRound.resolution = resolution;
    }
    updatedRound.resolvedAt = new Date().toISOString();
  }
  
  return updatedRound;
};

// Round statistics and analysis
export const getRoundDuration = (round: Round): number => {
  if (!round.resolvedAt) return 0;
  
  const start = new Date(round.createdAt).getTime();
  const end = new Date(round.resolvedAt).getTime();
  
  return Math.ceil((end - start) / 1000); // Duration in seconds
};

export const wasRoundClaimTruthful = (round: Round): boolean | null => {
  if (!round.resolution) return null;
  return round.resolution.wasClaimTruthful;
};

export const getRoundWinner = (round: Round): string | null => {
  return round.resolution?.winner || null;
};

export const getRoundLoser = (round: Round): string | null => {
  return round.resolution?.loser || null;
};

// Transformation helpers
export const roundRowToRound = (row: RoundRow): Round => ({
  id: row.id,
  gameId: row.game_id,
  roundNumber: row.round_number,
  cardInPlay: row.card_in_play,
  targetPlayerId: row.target_player_id,
  ...(row.response !== null && { response: row.response }),
  status: row.status,
  ...(row.resolution !== null && { resolution: row.resolution }),
  createdAt: row.created_at,
  ...(row.expires_at !== null && { expiresAt: row.expires_at }),
  ...(row.resolved_at !== null && { resolvedAt: row.resolved_at })
});

export const roundToRoundRow = (round: Round): Omit<RoundRow, 'created_at'> => ({
  id: round.id,
  game_id: round.gameId,
  round_number: round.roundNumber,
  card_in_play: round.cardInPlay,
  target_player_id: round.targetPlayerId,
  response: round.response || null,
  status: round.status,
  resolution: round.resolution || null,
  expires_at: round.expiresAt || null,
  resolved_at: round.resolvedAt || null
});

// Round display helpers
export const formatRoundForDisplay = (round: Round, language: 'jp' | 'en' = 'en'): string => {
  const { cardInPlay } = round;
  const claim = language === 'jp' ? 
    getCreatureNameJP(cardInPlay.claim) : 
    cardInPlay.claim;
  
  if (round.status === 'active') {
    return `Round ${round.roundNumber}: Claiming ${claim}`;
  } else if (round.resolution) {
    const truthful = round.resolution.wasClaimTruthful ? 'true' : 'false';
    return `Round ${round.roundNumber}: ${claim} claim was ${truthful}`;
  }
  
  return `Round ${round.roundNumber}`;
};

// Helper function for Japanese creature names (imported from Card.ts)
const getCreatureNameJP = (creatureType: CreatureType): string => {
  const names = {
    [CreatureType.COCKROACH]: 'ゴキブリ',
    [CreatureType.MOUSE]: 'ネズミ',
    [CreatureType.BAT]: 'コウモリ', 
    [CreatureType.FROG]: 'カエル'
  };
  return names[creatureType];
};

// Default values and constants
export const DEFAULT_TURN_TIME_LIMIT = 60; // seconds
export const MAX_TURN_TIME_LIMIT = 300; // 5 minutes
export const MIN_TURN_TIME_LIMIT = 10; // 10 seconds