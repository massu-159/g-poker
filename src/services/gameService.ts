/**
 * Game Service for G-Poker (Cockroach Poker)
 * Handles all Cockroach Poker game operations with enterprise security
 */

import { supabase, authManager, type CreatureType as SupabaseCreatureType } from './supabase';
import { securityService, type SecurityValidationResult } from './securityService';
import {
  createCockroachPokerDeck,
  shuffleDeck,
  createEmptyPenaltyPile,
  type Card,
  type CreatureType,
} from '@/types/cards';
import type {
  Game,
  GameInsert,
  GameUpdate,
  GameParticipant,
  GameParticipantInsert,
  GameParticipantUpdate,
  Profile,
  GameWithParticipants,
  CockroachPokerSettings,
  GameStatus,
  PlayerStatus,
  LobbyPlayer,
  PenaltyPile,
} from '@/types/database';

export interface CreateGameParams {
  settings?: CockroachPokerSettings;
}

export interface JoinGameParams {
  gameId: string;
  playerId: string;
}

export interface GameListFilters {
  status?: GameStatus[];
  hasSpace?: boolean;
  limit?: number;
  offset?: number;
}

export interface GameOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export class GameService {
  /**
   * Create a new game
   */
  async createGame(params: CreateGameParams = {}): Promise<GameOperationResult<Game>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: 'Authentication required' };
      }

      // Get player's public profile (fixed: use public_profiles instead of profiles)
      const { data: profile, error: profileError } = await supabase
        .from('public_profiles')
        .select('*')
        .eq('profile_id', user.id)
        .single();

      if (profileError || !profile) {
        return { success: false, error: 'Player profile not found' };
      }

      // Create and shuffle the Cockroach Poker deck
      const deck = shuffleDeck(createCockroachPokerDeck());

      // Create the game (exactly 2 players for Cockroach Poker)
      const gameData: GameInsert = {
        creator_id: profile.id, // Use public_profiles.id instead of auth.user.id
        status: 'waiting',
        max_players: 2, // Fixed for Cockroach Poker
        current_player_count: 0,
        current_turn_player_id: null,
        round_number: 0,
        time_limit_seconds: params.settings?.timeLimit || 30,
        hidden_card_count: 6, // 6 cards remain hidden
        game_deck: deck,
      };

      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert(gameData)
        .select()
        .single();

      if (gameError || !game) {
        return { success: false, error: gameError?.message || 'Failed to create game' };
      }

      // Add creator as first participant (Player 1)
      const participantData: GameParticipantInsert = {
        game_id: game.id,
        player_id: profile.id, // Use public_profiles.id
        status: 'joined',
        position: 1, // Player 1
        hand_cards: [], // Will be dealt when game starts
        penalty_cockroach: [],
        penalty_mouse: [],
        penalty_bat: [],
        penalty_frog: [],
        cards_remaining: 9, // Each player starts with 9 cards
        has_lost: false,
        losing_creature_type: null,
      };

      const { error: participantError } = await supabase
        .from('game_participants')
        .insert(participantData);

      if (participantError) {
        // Rollback: delete the game if participant creation fails
        await supabase.from('games').delete().eq('id', game.id);
        return { success: false, error: 'Failed to join game as creator' };
      }

      // Update game current_player_count
      const { error: updateError } = await supabase
        .from('games')
        .update({ current_player_count: 1 })
        .eq('id', game.id);

      if (updateError) {
        console.warn('Failed to update current_player_count:', updateError);
      }

      return { success: true, data: game };
    } catch (error) {
      console.error('Game creation error:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Join an existing game
   */
  async joinGame(params: JoinGameParams): Promise<GameOperationResult<GameParticipant>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: 'Authentication required' };
      }

      // Get player's public profile (fixed: use public_profiles instead of profiles)
      const { data: profile, error: profileError } = await supabase
        .from('public_profiles')
        .select('*')
        .eq('profile_id', user.id)
        .single();

      if (profileError || !profile) {
        return { success: false, error: 'Player profile not found' };
      }

      // Check if game exists and has space
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', params.gameId)
        .single();

      if (gameError || !game) {
        return { success: false, error: 'Game not found' };
      }

      if (game.status !== 'waiting') {
        return { success: false, error: 'Game is not accepting new players' };
      }

      if (game.current_player_count >= game.max_players) {
        return { success: false, error: 'Game is full' };
      }

      // Check if player is already in this game
      const { data: existingParticipant } = await supabase
        .from('game_participants')
        .select('*')
        .eq('game_id', params.gameId)
        .eq('player_id', profile.id) // Use public_profiles.id
        .single();

      if (existingParticipant) {
        return { success: false, error: 'Already joined this game' };
      }

      // Add participant as Player 2 (since creator is Player 1)
      const participantData: GameParticipantInsert = {
        game_id: params.gameId,
        player_id: profile.id, // Use public_profiles.id
        status: 'joined',
        position: 2, // Player 2
        hand_cards: [], // Will be dealt when game starts
        penalty_cockroach: [],
        penalty_mouse: [],
        penalty_bat: [],
        penalty_frog: [],
        cards_remaining: 9, // Each player starts with 9 cards
        has_lost: false,
        losing_creature_type: null,
      };

      const { data: participant, error: participantError } = await supabase
        .from('game_participants')
        .insert(participantData)
        .select()
        .single();

      if (participantError || !participant) {
        return { success: false, error: participantError?.message || 'Failed to join game' };
      }

      // Update game current_player_count
      const { error: updateError } = await supabase
        .from('games')
        .update({ current_player_count: game.current_player_count + 1 })
        .eq('id', params.gameId);

      if (updateError) {
        console.warn('Failed to update current_player_count:', updateError);
      }

      return { success: true, data: participant };
    } catch (error) {
      console.error('Join game error:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Leave a game
   */
  async leaveGame(gameId: string): Promise<GameOperationResult> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: 'Authentication required' };
      }

      // Get player's public profile
      const { data: profile, error: profileError } = await supabase
        .from('public_profiles')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (profileError || !profile) {
        return { success: false, error: 'Player profile not found' };
      }

      // Update participant status
      const { error: participantError } = await supabase
        .from('game_participants')
        .update({
          status: 'left',
        })
        .eq('game_id', gameId)
        .eq('player_id', profile.id); // Use public_profiles.id

      if (participantError) {
        return { success: false, error: participantError.message };
      }

      // Update game current_player_count
      const { data: game } = await supabase
        .from('games')
        .select('current_player_count')
        .eq('id', gameId)
        .single();

      if (game) {
        const { error: updateError } = await supabase
          .from('games')
          .update({ current_player_count: Math.max(0, game.current_player_count - 1) })
          .eq('id', gameId);

        if (updateError) {
          console.warn('Failed to update current_player_count:', updateError);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Leave game error:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Update player ready status
   */
  async updateReadyStatus(gameId: string, isReady: boolean): Promise<GameOperationResult> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: 'Authentication required' };
      }

      // Get player's public profile
      const { data: profile, error: profileError } = await supabase
        .from('public_profiles')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (profileError || !profile) {
        return { success: false, error: 'Player profile not found' };
      }

      // For Cockroach Poker, we can mark ready in the participant status
      // This is simpler than the poker version since we don't have separate ready states
      if (isReady) {
        const { error } = await supabase
          .from('game_participants')
          .update({ status: 'joined' }) // Ready to play
          .eq('game_id', gameId)
          .eq('player_id', profile.id); // Use public_profiles.id

        if (error) {
          return { success: false, error: error.message };
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Update ready status error:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Get available games list
   */
  async getGamesList(filters: GameListFilters = {}): Promise<GameOperationResult<Game[]>> {
    try {
      let query = supabase
        .from('games')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.status?.length) {
        query = query.in('status', filters.status);
      }

      if (filters.hasSpace) {
        query = query.lt('current_player_count', 2); // Cockroach Poker is always 2 players
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
      }

      const { data: games, error } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: games || [] };
    } catch (error) {
      console.error('Get games list error:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Get game details with participants
   */
  async getGameWithParticipants(gameId: string): Promise<GameOperationResult<GameWithParticipants>> {
    try {
      // Get game details
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (gameError || !game) {
        return { success: false, error: 'Game not found' };
      }

      // Get participants with player details
      const { data: participants, error: participantsError } = await supabase
        .from('game_participants')
        .select(`
          *,
          player:public_profiles(*)
        `)
        .eq('game_id', gameId)
        .neq('status', 'left')
        .order('position');

      if (participantsError) {
        return { success: false, error: participantsError.message };
      }

      const gameWithParticipants: GameWithParticipants = {
        ...game,
        participants: participants || [],
      };

      return { success: true, data: gameWithParticipants };
    } catch (error) {
      console.error('Get game with participants error:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Get lobby players for a game
   */
  async getLobbyPlayers(gameId: string): Promise<GameOperationResult<LobbyPlayer[]>> {
    try {
      const { data: participants, error } = await supabase
        .from('game_participants')
        .select(`
          *,
          player:public_profiles(*)
        `)
        .eq('game_id', gameId)
        .neq('status', 'left')
        .order('position');

      if (error) {
        return { success: false, error: error.message };
      }

      const lobbyPlayers: LobbyPlayer[] = (participants || []).map(participant => ({
        id: participant.player.id,
        displayName: participant.player.display_name,
        avatarUrl: participant.player.avatar_url,
        verificationStatus: participant.player.verification_status as any,
        gamesPlayed: participant.player.games_played,
        winRate: participant.player.win_rate,
        isReady: participant.status === 'joined', // In Cockroach Poker, joined = ready
        position: participant.position,
        connectionStatus: 'connected', // TODO: Implement real connection status
      }));

      return { success: true, data: lobbyPlayers };
    } catch (error) {
      console.error('Get lobby players error:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Start a game (for game creator)
   */
  async startGame(gameId: string): Promise<GameOperationResult> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: 'Authentication required' };
      }

      // Check if we have exactly 2 players
      const { data: participants, error: participantsError } = await supabase
        .from('game_participants')
        .select('status, player_id, position')
        .eq('game_id', gameId)
        .neq('status', 'left')
        .order('position');

      if (participantsError) {
        return { success: false, error: participantsError.message };
      }

      if (participants?.length !== 2) {
        return { success: false, error: 'Need exactly 2 players to start Cockroach Poker' };
      }

      const allReady = participants?.every(p => p.status === 'joined') || false;
      if (!allReady) {
        return { success: false, error: 'All players must be ready before starting the game' };
      }

      // Deal cards to players and update game status
      const dealResult = await this.dealCards(gameId);
      if (!dealResult.success) {
        return dealResult;
      }

      // Update game status and set first player's turn
      const { error } = await supabase
        .from('games')
        .update({
          status: 'in_progress',
          round_number: 1,
          current_turn_player_id: participants[0].player_id, // Player 1 starts (position 1)
        })
        .eq('id', gameId);

      if (error) {
        return { success: false, error: error.message };
      }

      // Update all participants to playing status
      const { error: updateParticipantsError } = await supabase
        .from('game_participants')
        .update({ status: 'playing' })
        .eq('game_id', gameId)
        .neq('status', 'left');

      if (updateParticipantsError) {
        console.warn('Failed to update participants status:', updateParticipantsError);
      }

      if (updateParticipantsError) {
        console.warn('Failed to update participants status:', updateParticipantsError);
      }

      return { success: true };
    } catch (error) {
      console.error('Start game error:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Check if current user can start a game (is creator)
   */
  async canStartGame(gameId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return false;
      }

      // Check if user is the game creator
      const { data: game } = await supabase
        .from('games')
        .select('creator_id')
        .eq('id', gameId)
        .single();

      return game?.creator_id === user.id;
    } catch (error) {
      console.error('Can start game check error:', error);
      return false;
    }
  }

  /**
   * Deal cards to players at game start
   */
  private async dealCards(gameId: string): Promise<GameOperationResult> {
    try {
      // Get the game deck
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('game_deck')
        .eq('id', gameId)
        .single();

      if (gameError || !game || !game.game_deck) {
        return { success: false, error: 'Game deck not found' };
      }

      const deck = game.game_deck as Card[];

      // Deal 9 cards to each player (18 total, 6 remain hidden)
      const player1Cards = deck.slice(0, 9);
      const player2Cards = deck.slice(9, 18);
      // Cards 18-23 remain hidden (6 cards)

      // Update both players' hands
      const { error: player1Error } = await supabase
        .from('game_participants')
        .update({ hand_cards: player1Cards })
        .eq('game_id', gameId)
        .eq('position', 1);

      if (player1Error) {
        return { success: false, error: 'Failed to deal cards to Player 1' };
      }

      const { error: player2Error } = await supabase
        .from('game_participants')
        .update({ hand_cards: player2Cards })
        .eq('game_id', gameId)
        .eq('position', 2);

      if (player2Error) {
        return { success: false, error: 'Failed to deal cards to Player 2' };
      }

      return { success: true };
    } catch (error) {
      console.error('Deal cards error:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Make a card claim (pass card with creature type claim)
   */
  async makeCardClaim(
    gameId: string,
    cardId: string,
    claimedCreatureType: CreatureType,
    targetParticipantId: string
  ): Promise<GameOperationResult> {
    try {
      // Security validation: Check game access
      const accessResult = await securityService.validateGameAccess(gameId);
      if (!accessResult.isValid) {
        return { success: false, error: accessResult.error };
      }

      // Security validation: Check turn permission
      const turnResult = await securityService.validateTurnPermission(gameId);
      if (!turnResult.isValid) {
        return { success: false, error: turnResult.error };
      }

      // Security validation: Validate ENUM types
      const enumResult = securityService.validateEnums({ creatureType: claimedCreatureType });
      if (!enumResult.isValid) {
        return { success: false, error: enumResult.error };
      }

      // Security validation: Rate limiting
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Authentication required' };
      }

      const rateLimitResult = securityService.checkRateLimit(user.id, 'make_claim', 5, 30000);
      if (!rateLimitResult.isValid) {
        return { success: false, error: rateLimitResult.error };
      }

      // Get current player's participant record (secure)
      const participantResult = await securityService.getParticipantId(gameId);
      if (!participantResult.isValid) {
        return { success: false, error: participantResult.error };
      }

      const participantId = participantResult.data;

      // Get participant details including hand
      const { data: participant, error: participantError } = await supabase
        .from('game_participants')
        .select('id, hand_cards')
        .eq('id', participantId)
        .eq('game_id', gameId)
        .single();

      if (participantError || !participant) {
        return { success: false, error: 'Player not found in game' };
      }

      const handCards = participant.hand_cards as Card[];
      const cardIndex = handCards.findIndex(card => card.id === cardId);

      if (cardIndex === -1) {
        return { success: false, error: 'Card not in hand' };
      }

      const claimedCard = handCards[cardIndex];

      // Remove card from player's hand
      const updatedHand = handCards.filter(card => card.id !== cardId);

      const { error: updateHandError } = await supabase
        .from('game_participants')
        .update({
          hand_cards: updatedHand,
          cards_remaining: updatedHand.length
        })
        .eq('id', participantId);

      if (updateHandError) {
        return { success: false, error: 'Failed to update hand' };
      }

      // Get current round number
      const { data: game } = await supabase
        .from('games')
        .select('round_number')
        .eq('id', gameId)
        .single();

      const roundNumber = (game?.round_number || 0) + 1;

      // Create new round (using participant IDs for game-scoped security)
      const { error: roundError } = await supabase
        .from('game_rounds')
        .insert({
          game_id: gameId,
          round_number: roundNumber,
          current_card: claimedCard,
          claiming_player_id: participant.id, // Use participant.id for security
          claimed_creature_type: claimedCreatureType,
          target_player_id: targetParticipantId, // Use participant.id for security
          pass_count: 0,
          is_completed: false,
        });

      if (roundError) {
        return { success: false, error: 'Failed to create round' };
      }

      // Get target participant's player_id for game turn update
      const { data: targetParticipant } = await supabase
        .from('game_participants')
        .select('player_id')
        .eq('id', targetParticipantId)
        .single();

      // Update game turn
      const { error: gameUpdateError } = await supabase
        .from('games')
        .update({
          current_turn_player_id: targetParticipant?.player_id,
          round_number: roundNumber,
        })
        .eq('id', gameId);

      if (gameUpdateError) {
        return { success: false, error: 'Failed to update game state' };
      }

      return { success: true };
    } catch (error) {
      console.error('Make card claim error:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Respond to a card claim (guess truth/lie or pass back)
   */
  async respondToCardClaim(
    gameId: string,
    roundId: string,
    response: 'truth' | 'lie' | 'pass_back'
  ): Promise<GameOperationResult> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: 'Authentication required' };
      }

      // Get player's public profile
      const { data: profile, error: profileError } = await supabase
        .from('public_profiles')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (profileError || !profile) {
        return { success: false, error: 'Player profile not found' };
      }

      // Get current player's participant record
      const { data: participant, error: participantError } = await supabase
        .from('game_participants')
        .select('id')
        .eq('game_id', gameId)
        .eq('player_id', profile.id)
        .single();

      if (participantError || !participant) {
        return { success: false, error: 'Player not found in game' };
      }

      // Get round details
      const { data: round, error: roundError } = await supabase
        .from('game_rounds')
        .select('*')
        .eq('id', roundId)
        .eq('game_id', gameId)
        .single();

      if (roundError || !round) {
        return { success: false, error: 'Round not found' };
      }

      if (response === 'pass_back') {
        // Check pass limit (max 3 passes to prevent infinite loops)
        const MAX_PASSES = 3;
        if (round.pass_count >= MAX_PASSES) {
          return {
            success: false,
            error: `Maximum pass limit (${MAX_PASSES}) reached. You must guess truth or lie.`
          };
        }

        // Pass the card back to the claiming player
        const { error: updateRoundError } = await supabase
          .from('game_rounds')
          .update({
            pass_count: round.pass_count + 1,
            target_player_id: round.claiming_player_id,
          })
          .eq('id', roundId);

        if (updateRoundError) {
          return { success: false, error: 'Failed to pass card back' };
        }

        // Update game turn
        const { error: gameUpdateError } = await supabase
          .from('games')
          .update({ current_turn_player_id: round.claiming_player_id })
          .eq('id', gameId);

        if (gameUpdateError) {
          return { success: false, error: 'Failed to update game turn' };
        }
      } else {
        // Player is guessing truth or lie
        const currentCard = round.current_card as Card;
        const actualIsTrue = currentCard.creatureType === round.claimed_creature_type;
        const guessIsCorrect = (response === 'truth') === actualIsTrue;

        // Determine who gets the penalty card (using participant IDs)
        const penaltyReceiverId = guessIsCorrect ? round.claiming_player_id : participant.id;

        // Complete the round
        const { error: completeRoundError } = await supabase
          .from('game_rounds')
          .update({
            is_completed: true,
            final_guesser_id: participant.id, // Use participant.id for security
            guess_is_truth: response === 'truth',
            actual_is_truth: actualIsTrue,
            penalty_receiver_id: penaltyReceiverId,
            completed_at: new Date().toISOString(),
          })
          .eq('id', roundId);

        if (completeRoundError) {
          return { success: false, error: 'Failed to complete round' };
        }

        // Add penalty card using database function
        const penaltyResult = await this.addPenaltyCard(penaltyReceiverId, currentCard);
        if (!penaltyResult.success) {
          return { success: false, error: 'Failed to add penalty card' };
        }

        // Check if player has lost using database function
        const lossResult = await this.checkPlayerLoss(penaltyReceiverId);
        if (!lossResult.success) {
          return { success: false, error: 'Failed to check game end' };
        }

        if (lossResult.data?.hasLost) {
          // Update participant as having lost
          await supabase
            .from('game_participants')
            .update({
              has_lost: true,
              losing_creature_type: lossResult.data.losingCreature
            })
            .eq('id', penaltyReceiverId);

          // Get winner (the other participant)
          const { data: winner } = await supabase
            .from('game_participants')
            .select('player_id')
            .eq('game_id', gameId)
            .neq('id', penaltyReceiverId)
            .single();

          // Update game as completed
          await supabase
            .from('games')
            .update({
              status: 'completed',
              current_turn_player_id: null
            })
            .eq('id', gameId);

          return { success: true, data: { gameEnded: true, winner: winner?.player_id } };
        }

        // Get penalty receiver's player_id for game turn update
        const { data: penaltyReceiverParticipant } = await supabase
          .from('game_participants')
          .select('player_id')
          .eq('id', penaltyReceiverId)
          .single();

        // Update game turn back to penalty receiver for next round
        const { error: gameUpdateError } = await supabase
          .from('games')
          .update({ current_turn_player_id: penaltyReceiverParticipant?.player_id })
          .eq('id', gameId);

        if (gameUpdateError) {
          return { success: false, error: 'Failed to update game turn' };
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Respond to card claim error:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }


  /**
   * Check if a player has lost using database function
   */
  async checkPlayerLoss(participantId: string): Promise<GameOperationResult<{ hasLost: boolean; losingCreature?: CreatureType }>> {
    try {
      const { data, error } = await supabase.rpc('check_player_loss', {
        participant_id: participantId
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const result = data?.[0];
      return {
        success: true,
        data: {
          hasLost: result?.has_lost || false,
          losingCreature: result?.losing_creature || undefined
        }
      };
    } catch (error) {
      console.error('Check player loss error:', error);
      return { success: false, error: 'Failed to check player loss status' };
    }
  }

  /**
   * Add penalty card to player's penalty pile using database function
   */
  async addPenaltyCard(participantId: string, card: Card): Promise<GameOperationResult> {
    try {
      const { error } = await supabase.rpc('add_penalty_card', {
        participant_id: participantId,
        card_data: card
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Add penalty card error:', error);
      return { success: false, error: 'Failed to add penalty card' };
    }
  }

  /**
   * Process claim resolution with penalty assignment
   */
  async processClaimResolution(
    gameId: string,
    roundId: string,
    guesserParticipantId: string,
    guessIsTruth: boolean
  ): Promise<GameOperationResult<{ gameEnded: boolean; winnerId?: string }>> {
    try {
      // Get round details
      const { data: round, error: roundError } = await supabase
        .from('game_rounds')
        .select('*')
        .eq('id', roundId)
        .single();

      if (roundError || !round) {
        return { success: false, error: 'Round not found' };
      }

      const currentCard = round.current_card as Card;
      const actualIsTruth = currentCard.creatureType === round.claimed_creature_type;
      const guessIsCorrect = guessIsTruth === actualIsTruth;

      // Determine penalty receiver
      const penaltyReceiverId = guessIsCorrect
        ? round.claiming_player_id
        : guesserParticipantId;

      // Add penalty card using database function
      const penaltyResult = await this.addPenaltyCard(penaltyReceiverId, currentCard);
      if (!penaltyResult.success) {
        return penaltyResult;
      }

      // Update round as completed
      const { error: updateRoundError } = await supabase
        .from('game_rounds')
        .update({
          is_completed: true,
          final_guesser_id: guesserParticipantId,
          guess_is_truth: guessIsTruth,
          actual_is_truth: actualIsTruth,
          penalty_receiver_id: penaltyReceiverId,
          completed_at: new Date().toISOString()
        })
        .eq('id', roundId);

      if (updateRoundError) {
        return { success: false, error: 'Failed to update round' };
      }

      // Check if penalty receiver has lost
      const lossResult = await this.checkPlayerLoss(penaltyReceiverId);
      if (!lossResult.success) {
        return lossResult;
      }

      if (lossResult.data?.hasLost) {
        // Update participant as having lost
        await supabase
          .from('game_participants')
          .update({
            has_lost: true,
            losing_creature_type: lossResult.data.losingCreature
          })
          .eq('id', penaltyReceiverId);

        // Get winner (the other participant)
        const { data: winner } = await supabase
          .from('game_participants')
          .select('player_id')
          .eq('game_id', gameId)
          .neq('id', penaltyReceiverId)
          .single();

        // Update game as completed
        await supabase
          .from('games')
          .update({
            status: 'completed',
            current_turn_player_id: null
          })
          .eq('id', gameId);

        return {
          success: true,
          data: { gameEnded: true, winnerId: winner?.player_id }
        };
      }

      // Game continues - set turn to penalty receiver for next round
      const { data: nextPlayer } = await supabase
        .from('game_participants')
        .select('player_id')
        .eq('id', penaltyReceiverId)
        .single();

      await supabase
        .from('games')
        .update({
          current_turn_player_id: nextPlayer?.player_id
        })
        .eq('id', gameId);

      return {
        success: true,
        data: { gameEnded: false }
      };

    } catch (error) {
      console.error('Process claim resolution error:', error);
      return { success: false, error: 'Failed to process claim resolution' };
    }
  }

  /**
   * Check if player has lost using database function
   */
  async checkGameEndCondition(playerId: string): Promise<GameOperationResult<{ hasLost: boolean; lostBy?: CreatureType; penaltyCount?: number }>> {
    try {
      console.log('🔍 Checking game end condition for player:', playerId);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Authentication required' };
      }

      // Use database function for loss check
      const result = await authManager.checkPlayerLoss(playerId);

      if (result.error) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        data: {
          hasLost: result.hasLost,
          lostBy: result.lostBy,
          penaltyCount: result.penaltyCount
        }
      };
    } catch (error) {
      console.error('Game end condition check error:', error);
      return { success: false, error: 'Failed to check game end condition' };
    }
  }

  /**
   * Apply penalty to player using database function
   */
  async applyPenaltyCard(playerId: string, creature: CreatureType): Promise<GameOperationResult<{ newCount?: number; hasLost?: boolean }>> {
    try {
      console.log('🔍 Applying penalty card for player:', playerId, 'creature:', creature);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Authentication required' };
      }

      // Use database function for penalty card addition
      const result = await authManager.addPenaltyCard(playerId, creature);

      if (!result.success || result.error) {
        return { success: false, error: result.error || 'Failed to apply penalty card' };
      }

      return {
        success: true,
        data: {
          newCount: result.newCount,
          hasLost: result.hasLost
        }
      };
    } catch (error) {
      console.error('Apply penalty card error:', error);
      return { success: false, error: 'Failed to apply penalty card' };
    }
  }

  /**
   * Get round history for a game
   */
  async getRoundHistory(gameId: string): Promise<GameOperationResult<any[]>> {
    try {
      const { data: rounds, error } = await supabase
        .from('game_rounds')
        .select(`
          *,
          claiming_player:game_participants!claiming_player_id(
            position,
            player:public_profiles(display_name)
          ),
          target_player:game_participants!target_player_id(
            position,
            player:public_profiles(display_name)
          ),
          final_guesser:game_participants!final_guesser_id(
            position,
            player:public_profiles(display_name)
          )
        `)
        .eq('game_id', gameId)
        .order('created_at', { ascending: true });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: rounds || [] };
    } catch (error) {
      console.error('Get round history error:', error);
      return { success: false, error: 'Failed to get round history' };
    }
  }

  /**
   * Get current active round for a game
   */
  async getCurrentRound(gameId: string): Promise<GameOperationResult<any>> {
    try {
      const { data: round, error } = await supabase
        .from('game_rounds')
        .select(`
          *,
          claiming_player:game_participants!claiming_player_id(
            position,
            player:public_profiles(display_name)
          ),
          target_player:game_participants!target_player_id(
            position,
            player:public_profiles(display_name)
          )
        `)
        .eq('game_id', gameId)
        .eq('is_completed', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        return { success: false, error: error.message };
      }

      return { success: true, data: round || null };
    } catch (error) {
      console.error('Get current round error:', error);
      return { success: false, error: 'Failed to get current round' };
    }
  }

  /**
   * Enhanced penalty management with database function integration
   */
  async addPenaltyWithLossCheck(playerId: string, creature: CreatureType): Promise<GameOperationResult<{ hasLost: boolean; newCount?: number; lostBy?: CreatureType }>> {
    try {
      // First apply the penalty using database function
      const penaltyResult = await this.applyPenaltyCard(playerId, creature);
      if (!penaltyResult.success) {
        return penaltyResult;
      }

      // If the database function indicates loss, return that information
      if (penaltyResult.data?.hasLost) {
        return {
          success: true,
          data: {
            hasLost: true,
            lostBy: creature,
            newCount: penaltyResult.data.newCount
          }
        };
      }

      // Otherwise check current status
      const lossCheckResult = await this.checkGameEndCondition(playerId);
      if (!lossCheckResult.success) {
        return lossCheckResult;
      }

      return {
        success: true,
        data: {
          hasLost: lossCheckResult.data?.hasLost || false,
          lostBy: lossCheckResult.data?.lostBy,
          newCount: penaltyResult.data?.newCount || lossCheckResult.data?.penaltyCount
        }
      };
    } catch (error) {
      console.error('Add penalty with loss check error:', error);
      return { success: false, error: 'Failed to add penalty with loss check' };
    }
  }
}

// Export singleton instance
export const gameService = new GameService();
export default gameService;