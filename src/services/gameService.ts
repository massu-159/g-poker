/**
 * Game Service for G-Poker (Cockroach Poker)
 * Handles all Cockroach Poker game operations with enterprise security
 */

import { supabase } from './supabase';
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

      // Get player's profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        return { success: false, error: 'Player profile not found' };
      }

      // Create and shuffle the Cockroach Poker deck
      const deck = shuffleDeck(createCockroachPokerDeck());

      // Create the game (exactly 2 players for Cockroach Poker)
      const gameData: GameInsert = {
        creator_id: user.id,
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
        player_id: user.id,
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

      // Get player's profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
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
        .eq('player_id', user.id)
        .single();

      if (existingParticipant) {
        return { success: false, error: 'Already joined this game' };
      }

      // Add participant as Player 2 (since creator is Player 1)
      const participantData: GameParticipantInsert = {
        game_id: params.gameId,
        player_id: user.id,
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

      // Update participant status
      const { error: participantError } = await supabase
        .from('game_participants')
        .update({
          status: 'left',
        })
        .eq('game_id', gameId)
        .eq('player_id', user.id);

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

      // For Cockroach Poker, we can mark ready in the participant status
      // This is simpler than the poker version since we don't have separate ready states
      if (isReady) {
        const { error } = await supabase
          .from('game_participants')
          .update({ status: 'joined' }) // Ready to play
          .eq('game_id', gameId)
          .eq('player_id', user.id);

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
          player:profiles(*)
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
          player:profiles(*)
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
    targetPlayerId: string
  ): Promise<GameOperationResult> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: 'Authentication required' };
      }

      // Get current player's hand
      const { data: participant, error: participantError } = await supabase
        .from('game_participants')
        .select('hand_cards')
        .eq('game_id', gameId)
        .eq('player_id', user.id)
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
        .eq('game_id', gameId)
        .eq('player_id', user.id);

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

      // Create new round
      const { error: roundError } = await supabase
        .from('game_rounds')
        .insert({
          game_id: gameId,
          round_number: roundNumber,
          current_card: claimedCard,
          claiming_player_id: user.id,
          claimed_creature_type: claimedCreatureType,
          target_player_id: targetPlayerId,
          pass_count: 0,
          is_completed: false,
        });

      if (roundError) {
        return { success: false, error: 'Failed to create round' };
      }

      // Update game turn
      const { error: gameUpdateError } = await supabase
        .from('games')
        .update({
          current_turn_player_id: targetPlayerId,
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

        // Determine who gets the penalty card
        const penaltyReceiverId = guessIsCorrect ? round.claiming_player_id : user.id;

        // Complete the round
        const { error: completeRoundError } = await supabase
          .from('game_rounds')
          .update({
            is_completed: true,
            final_guesser_id: user.id,
            guess_is_truth: response === 'truth',
            actual_is_truth: actualIsTrue,
            penalty_receiver_id: penaltyReceiverId,
            completed_at: new Date().toISOString(),
          })
          .eq('id', roundId);

        if (completeRoundError) {
          return { success: false, error: 'Failed to complete round' };
        }

        // Add penalty card to the appropriate pile
        await this.addPenaltyCard(gameId, penaltyReceiverId, currentCard);

        // Check if player has lost
        const lossCheck = await this.checkForGameEnd(gameId, penaltyReceiverId);
        if (lossCheck.gameEnded) {
          return { success: true, data: { gameEnded: true, winner: lossCheck.winnerId } };
        }

        // Update game turn back to penalty receiver for next round
        const { error: gameUpdateError } = await supabase
          .from('games')
          .update({ current_turn_player_id: penaltyReceiverId })
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
   * Add penalty card to player's penalty pile
   */
  private async addPenaltyCard(gameId: string, playerId: string, card: Card): Promise<void> {
    const { data: participant } = await supabase
      .from('game_participants')
      .select('penalty_cockroach, penalty_mouse, penalty_bat, penalty_frog')
      .eq('game_id', gameId)
      .eq('player_id', playerId)
      .single();

    if (!participant) return;

    const updateData: any = {};

    switch (card.creatureType) {
      case 'cockroach':
        updateData.penalty_cockroach = [...(participant.penalty_cockroach as Card[]), card];
        break;
      case 'mouse':
        updateData.penalty_mouse = [...(participant.penalty_mouse as Card[]), card];
        break;
      case 'bat':
        updateData.penalty_bat = [...(participant.penalty_bat as Card[]), card];
        break;
      case 'frog':
        updateData.penalty_frog = [...(participant.penalty_frog as Card[]), card];
        break;
    }

    await supabase
      .from('game_participants')
      .update(updateData)
      .eq('game_id', gameId)
      .eq('player_id', playerId);
  }

  /**
   * Check if game has ended (player has 3 of same creature type)
   */
  private async checkForGameEnd(gameId: string, playerId: string): Promise<{ gameEnded: boolean; winnerId?: string }> {
    const { data: participant } = await supabase
      .from('game_participants')
      .select('penalty_cockroach, penalty_mouse, penalty_bat, penalty_frog, player_id')
      .eq('game_id', gameId)
      .eq('player_id', playerId)
      .single();

    if (!participant) return { gameEnded: false };

    const penaltyCounts = {
      cockroach: (participant.penalty_cockroach as Card[]).length,
      mouse: (participant.penalty_mouse as Card[]).length,
      bat: (participant.penalty_bat as Card[]).length,
      frog: (participant.penalty_frog as Card[]).length,
    };

    // Check if player has lost (3 of same type)
    for (const [creatureType, count] of Object.entries(penaltyCounts)) {
      if (count >= 3) {
        // Player has lost - update game status
        await supabase
          .from('game_participants')
          .update({
            has_lost: true,
            losing_creature_type: creatureType,
          })
          .eq('game_id', gameId)
          .eq('player_id', playerId);

        // Get the other player as winner
        const { data: allParticipants } = await supabase
          .from('game_participants')
          .select('player_id')
          .eq('game_id', gameId)
          .neq('player_id', playerId);

        const winnerId = allParticipants?.[0]?.player_id;

        // Update game status to completed
        await supabase
          .from('games')
          .update({
            status: 'completed',
            current_turn_player_id: null,
          })
          .eq('id', gameId);

        return { gameEnded: true, winnerId };
      }
    }

    return { gameEnded: false };
  }
}

// Export singleton instance
export const gameService = new GameService();
export default gameService;