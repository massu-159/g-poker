/**
 * API Type Definitions
 * Centralized type definitions for backend API responses
 * Based on backend/io.md API specification v2.1.0
 */

// ============================================================================
// Common Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ============================================================================
// Authentication Types
// ============================================================================

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthResponse {
  message: string;
  user: AuthUser;
  tokens: AuthTokens;
}

export interface RefreshTokenResponse {
  message: string;
  access_token: string;
  expires_in: number;
}

export interface LogoutResponse {
  message: string;
}

export interface MeResponse {
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
    lastSeenAt: string;
    preferences: {
      theme: string;
      language: string;
      sound_enabled: boolean;
    };
  };
}

// ============================================================================
// User Profile Types
// ============================================================================

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  soundEnabled: boolean;
  soundVolume: number;
  mobileCardSize?: 'small' | 'medium' | 'large';
  mobileVibrationEnabled?: boolean;
  mobileNotificationsEnabled?: boolean;
  privacyShowOnlineStatus?: boolean;
  privacyShowGameStats?: boolean;
  privacyAllowSpectators?: boolean;
}

export interface FullUserProfile {
  id: string;
  email: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  lastSeenAt: string;
  tutorialCompleted: boolean;
  isActive: boolean;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface PublicUserProfile {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  lastSeenAt?: string;
  statistics?: {
    gamesPlayed?: number;
    gamesWon?: number;
    winRate?: number;
  };
  achievements?: string[];
  createdAt: string;
}

export interface ProfileUpdateRequest {
  displayName?: string;
  avatarUrl?: string;
}

export interface PreferencesUpdateRequest {
  theme?: 'light' | 'dark' | 'auto';
  language?: string;
  soundEnabled?: boolean;
  soundVolume?: number;
  mobileCardSize?: 'small' | 'medium' | 'large';
  mobileVibrationEnabled?: boolean;
  mobileNotificationsEnabled?: boolean;
  privacyShowOnlineStatus?: boolean;
  privacyShowGameStats?: boolean;
  privacyAllowSpectators?: boolean;
}

// ============================================================================
// Statistics Types
// ============================================================================

export interface ActivitySummary {
  total_games_played: number;
  total_games_won: number;
  win_rate: number;
  period_days: number;
}

export interface GameStatEntry {
  date: string;
  games_played: number;
  games_won: number;
  win_rate: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  player_id: string;
  player_name: string;
  score: number;
  games_played: number;
}

export interface UserStatistics {
  statistics: {
    activitySummary: ActivitySummary;
    gameStats: GameStatEntry[];
    achievements: Achievement[];
    leaderboardPositions: LeaderboardEntry[];
    period: string;
  };
}

// ============================================================================
// Game History Types
// ============================================================================

export interface GameHistoryEntry {
  id: string;
  gameId: string;
  opponentId: string;
  opponentName: string;
  opponentAvatarUrl?: string;
  result: 'win' | 'loss';
  won: boolean;
  duration: number;
  completedAt: string;
  roundsPlayed: number;
  endReason: string;
  created_at: string;
}

export interface GameHistoryResponse {
  games: GameHistoryEntry[];
  pagination: PaginationInfo;
}

// ============================================================================
// Room/Game Types
// ============================================================================

export interface CreateRoomRequest {
  timeLimitSeconds?: number;
}

export interface CreateRoomResponse {
  message: string;
  game: {
    id: string;
    maxPlayers: number;
    currentPlayers: number;
    status: string;
    timeLimitSeconds: number;
    createdAt: string;
  };
}

export interface RoomListEntry {
  id: string;
  maxPlayers: number;
  currentPlayers: number;
  status: string;
  timeLimitSeconds: number;
  creatorName: string;
  creatorAvatarUrl?: string;
  createdAt: string;
}

export interface RoomListResponse {
  games: RoomListEntry[];
}

export interface JoinRoomRequest {
  gameId: string;
}

export interface JoinRoomResponse {
  message: string;
  position: number;
}

export interface StartGameResponse {
  message: string;
  currentTurnPlayer: string;
}

export interface RoomParticipant {
  id: string;
  displayName: string;
  avatarUrl?: string;
  role: 'player' | 'spectator';
  seatPosition: number;
  readyStatus: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  joinedAt: string;
}

export interface CurrentRound {
  id: string;
  roundNumber: number;
  claimedCreature: string;
  claimingPlayerId: string;
  targetPlayerId: string;
  passCount: number;
  canRespond: boolean;
  canPass: boolean;
}

export interface GameCard {
  creature: string;
  id: string;
}

export interface PenaltyCards {
  cockroach: GameCard[];
  mouse: GameCard[];
  bat: GameCard[];
  frog: GameCard[];
}

export interface RoomDetailsResponse {
  game: {
    id: string;
    status: string;
    maxPlayers: number;
    currentPlayers: number;
    currentTurnPlayer: string | null;
    roundNumber: number;
    timeLimitSeconds: number;
    creatorName: string;
    creatorAvatarUrl?: string;
    createdAt: string;
    participants: RoomParticipant[];
    currentRound: CurrentRound | null;
    playerHand: GameCard[];
  };
}

export interface LeaveRoomResponse {
  message: string;
}

// ============================================================================
// Game Action Types
// ============================================================================

export interface ClaimCardRequest {
  cardId: string;
  claimedCreature: 'cockroach' | 'mouse' | 'bat' | 'frog';
  targetPlayerId: string;
}

export interface ClaimCardResponse {
  message: string;
  round: {
    id: string;
    roundNumber: number;
    claimedCreature: string;
    targetPlayer: string;
    awaitingResponse: boolean;
  };
}

export interface RespondToClaimRequest {
  roundId: string;
  believeClaim: boolean;
}

export interface RoundResult {
  correct: boolean;
  penaltyReceiver: string;
  penaltyCard: {
    creature: string;
    id: string;
  };
  gameOver: boolean;
  winner: string | null;
  nextTurnPlayer: string;
}

export interface RespondToClaimResponse {
  message: string;
  roundResult: RoundResult;
}

export interface PassCardRequest {
  roundId: string;
  targetPlayerId: string;
  newClaim: 'cockroach' | 'mouse' | 'bat' | 'frog';
}

export interface PassCardResponse {
  message: string;
  nextTurnPlayer: string;
  newClaim: string;
  passCount: number;
}

export interface PlayerState {
  player_id: string;
  display_name: string;
  seat_position: number;
  hand_count: number;
  penalty_cards: {
    cockroach: number;
    mouse: number;
    bat: number;
    frog: number;
    total: number;
  };
  is_current_turn: boolean;
  connection_status: string;
  has_lost: boolean;
}

export interface GameStateResponse {
  gameState: {
    gameId: string;
    status: string;
    currentTurnPlayer: string;
    roundNumber: number;
    isYourTurn: boolean;
    playerHand: GameCard[];
    cardsRemaining: number;
    hasLost: boolean;
    penaltyCards: PenaltyCards;
    currentRound: CurrentRound | null;
    allPlayers: PlayerState[];
  };
}

// ============================================================================
// Tutorial & Misc Types
// ============================================================================

export interface TutorialCompleteResponse {
  message: string;
}

export interface ErrorResponse {
  error: string;
  message?: string;
  code?: string;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isApiError(response: any): response is ErrorResponse {
  return response && typeof response.error === 'string';
}

export function isSuccessResponse<T>(response: ApiResponse<T>): response is ApiResponse<T> & { success: true; data: T } {
  return response.success === true && response.data !== undefined;
}
