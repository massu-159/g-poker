/**
 * Room management service
 * Handles game room creation, joining, and lifecycle management
 */

import { getSupabase } from '../lib/supabase.js'

export interface CreateRoomResult {
  success: boolean
  error?: string
  gameId?: string
  status?: string
  createdAt?: string
}

export interface JoinRoomResult {
  success: boolean
  error?: string
  errorCode?: string
  position?: number
}

export interface StartGameResult {
  success: boolean
  error?: string
  message?: string
  currentTurnPlayerId?: string
}

/**
 * Create a new game room with the creator as first participant
 */
export async function createRoomWithCreator(
  creatorId: string,
  timeLimitSeconds: number,
  gameDeck: unknown[]
): Promise<CreateRoomResult> {
  try {
    const supabase = getSupabase()

    const { data: result, error: rpcError } = await supabase.rpc(
      'create_game_with_participant',
      {
        p_creator_id: creatorId,
        p_time_limit_seconds: timeLimitSeconds,
        p_game_deck: gameDeck,
      }
    )

    if (rpcError || !result || result.length === 0) {
      console.error('[RoomService] Create room error:', rpcError)
      return { success: false, error: 'Failed to create game' }
    }

    const gameResult = result[0]

    // Fetch complete game data for response
    const { data: game } = await supabase
      .from('games')
      .select('created_at')
      .eq('id', gameResult.game_id)
      .single()

    return {
      success: true,
      gameId: gameResult.game_id,
      status: gameResult.game_status,
      createdAt: game?.created_at || new Date().toISOString(),
    }
  } catch (error) {
    console.error('[RoomService] Create room error:', error)
    return { success: false, error: 'Internal server error' }
  }
}

/**
 * Join an existing game room safely (prevents race conditions)
 */
export async function joinRoomSafely(
  gameId: string,
  playerId: string
): Promise<JoinRoomResult> {
  try {
    const supabase = getSupabase()

    const { data: result, error: rpcError } = await supabase.rpc(
      'join_game_safe',
      {
        p_game_id: gameId,
        p_player_id: playerId,
      }
    )

    if (rpcError || !result || result.length === 0) {
      console.error('[RoomService] Join room error:', rpcError)
      return { success: false, error: 'Failed to join game' }
    }

    const joinResult = result[0]

    if (!joinResult.success) {
      return {
        success: false,
        error: joinResult.message,
        errorCode: joinResult.error_code,
      }
    }

    return {
      success: true,
      position: joinResult.participant_position,
    }
  } catch (error) {
    console.error('[RoomService] Join room error:', error)
    return { success: false, error: 'Internal server error' }
  }
}

/**
 * Start a game and deal cards atomically
 */
export async function startGameWithDeal(
  gameId: string,
  cardsPerPlayer: number,
  gameDeck: unknown[]
): Promise<StartGameResult> {
  try {
    const supabase = getSupabase()

    const { data: result, error: rpcError } = await supabase.rpc(
      'start_game_and_deal_cards',
      {
        p_game_id: gameId,
        p_cards_per_player: cardsPerPlayer,
        p_game_deck: gameDeck,
      }
    )

    if (rpcError || !result || result.length === 0 || !result[0].success) {
      console.error(
        '[RoomService] Start game error:',
        rpcError || result?.[0]?.message
      )
      return {
        success: false,
        error: result?.[0]?.message || 'Failed to start game',
      }
    }

    return {
      success: true,
      message: 'Game started successfully',
      currentTurnPlayerId: result[0].current_turn_player_id,
    }
  } catch (error) {
    console.error('[RoomService] Start game error:', error)
    return { success: false, error: 'Internal server error' }
  }
}
