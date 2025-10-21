/**
 * Game State Broadcast Handler (T045)
 * Handles game action events and broadcasts state updates
 */

import { randomUUID } from 'crypto'
import { Server } from 'socket.io'
import type {
  AuthenticatedSocket,
  ClaimCardEvent,
  RespondToClaimEvent,
  PassCardEvent,
  GameStateUpdateEvent,
  CardClaimedEvent,
  ClaimRespondedEvent,
  CardPassedEvent,
  RoundCompletedEvent,
  GameEndedEvent,
  GameActionErrorEvent,
  PlayerGameState,
  CurrentRound,
  PlayerHand,
} from './types.js'
import { isAuthenticated } from './AuthHandler.js'
import { getSupabase } from '../lib/supabase.js'

/**
 * Setup game action handlers
 */
export function setupGameHandlers(io: Server) {
  io.on('connection', (socket: AuthenticatedSocket) => {
    // Handle claim card event
    socket.on('claim_card', async (data: ClaimCardEvent) => {
      await handleClaimCard(io, socket, data)
    })

    // Handle respond to claim event
    socket.on('respond_to_claim', async (data: RespondToClaimEvent) => {
      await handleRespondToClaim(io, socket, data)
    })

    // Handle pass card event
    socket.on('pass_card', async (data: PassCardEvent) => {
      await handlePassCard(io, socket, data)
    })

    // Handle get game state request
    socket.on('get_game_state', async (data: { room_id: string }) => {
      await handleGetGameState(socket, data.room_id)
    })
  })
}

/**
 * Handle claim card action
 */
async function handleClaimCard(
  io: Server,
  socket: AuthenticatedSocket,
  data: ClaimCardEvent
) {
  try {
    if (!isAuthenticated(socket) || !socket.userId) {
      emitGameActionError(socket, {
        error_code: 'PLAYER_NOT_IN_GAME',
        message: 'Not authenticated',
        action_attempted: 'claim_card',
      })
      return
    }

    const supabase = getSupabase()
    const userId = socket.userId

    // Verify user is in the room
    const { data: participation } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', data.room_id)
      .eq('player_id', userId)
      .single()

    if (!participation) {
      emitGameActionError(socket, {
        error_code: 'PLAYER_NOT_IN_GAME',
        message: 'You are not a participant in this game',
        action_attempted: 'claim_card',
      })
      return
    }

    // Get game state
    const { data: room } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('id', data.room_id)
      .single()

    if (!room) {
      emitGameActionError(socket, {
        error_code: 'GAME_NOT_ACTIVE',
        message: 'Game not found',
        action_attempted: 'claim_card',
      })
      return
    }

    if (room.status !== 'active') {
      emitGameActionError(socket, {
        error_code: 'GAME_NOT_ACTIVE',
        message: 'Game is not active',
        action_attempted: 'claim_card',
      })
      return
    }

    // Verify it's player's turn (simplified - in real game, check turn order)
    const { data: gameSession } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('room_id', data.room_id)
      .eq('status', 'active')
      .single()

    if (!gameSession) {
      emitGameActionError(socket, {
        error_code: 'GAME_NOT_ACTIVE',
        message: 'No active game session',
        action_attempted: 'claim_card',
      })
      return
    }

    // Create a new game round
    const roundId = randomUUID()
    const { error: roundError } = await supabase.from('game_rounds').insert({
      id: roundId,
      game_id: gameSession.id,
      round_number: (gameSession.current_round_number || 0) + 1,
      claiming_player_id: userId,
      claimed_creature_type: data.claimed_creature,
      target_player_id: data.target_player_id,
      pass_count: 0,
      is_completed: false,
    })

    if (roundError) {
      console.error('[Game] Failed to create round:', roundError)
      emitGameActionError(socket, {
        error_code: 'INVALID_ACTION',
        message: 'Failed to create game round',
        action_attempted: 'claim_card',
      })
      return
    }

    // Broadcast card claimed event
    const claimedEvent: CardClaimedEvent = {
      room_id: data.room_id,
      claiming_player_id: userId,
      claimed_creature: data.claimed_creature,
      target_player_id: data.target_player_id,
      round_id: roundId,
      timestamp: new Date().toISOString(),
    }
    io.to(data.room_id).emit('card_claimed', claimedEvent)

    // Broadcast updated game state
    await broadcastGameState(io, data.room_id)

    console.log(
      `[Game] User ${userId} claimed ${data.claimed_creature} to ${data.target_player_id}`
    )
  } catch (error) {
    console.error('[Game] Claim card error:', error)
    emitGameActionError(socket, {
      error_code: 'INVALID_ACTION',
      message: 'Failed to process claim',
      action_attempted: 'claim_card',
    })
  }
}

/**
 * Handle respond to claim action
 */
async function handleRespondToClaim(
  io: Server,
  socket: AuthenticatedSocket,
  data: RespondToClaimEvent
) {
  try {
    if (!isAuthenticated(socket) || !socket.userId) {
      emitGameActionError(socket, {
        error_code: 'PLAYER_NOT_IN_GAME',
        message: 'Not authenticated',
        action_attempted: 'respond_to_claim',
      })
      return
    }

    const supabase = getSupabase()
    const userId = socket.userId

    // Get the round
    const { data: round } = await supabase
      .from('game_rounds')
      .select('*')
      .eq('id', data.round_id)
      .single()

    if (!round) {
      emitGameActionError(socket, {
        error_code: 'INVALID_ACTION',
        message: 'Round not found',
        action_attempted: 'respond_to_claim',
      })
      return
    }

    // Verify it's the target player responding
    if (round.target_player_id !== userId) {
      emitGameActionError(socket, {
        error_code: 'NOT_YOUR_TURN',
        message: 'You are not the target of this claim',
        action_attempted: 'respond_to_claim',
      })
      return
    }

    // Determine outcome (simplified logic - in real game, check actual card)
    const wasCorrect = data.believe_claim // Simplified for now
    const penaltyReceiverId = wasCorrect
      ? round.claiming_player_id
      : round.target_player_id

    // Update round
    await supabase
      .from('game_rounds')
      .update({
        is_completed: true,
        believed_claim: data.believe_claim,
        penalty_receiver_id: penaltyReceiverId,
        completed_at: new Date().toISOString(),
      })
      .eq('id', data.round_id)

    // Broadcast claim responded event
    const respondedEvent: ClaimRespondedEvent = {
      room_id: data.room_id,
      responder_id: userId,
      believed_claim: data.believe_claim,
      actual_creature: round.claimed_creature_type, // Simplified
      was_correct: wasCorrect,
      penalty_receiver_id: penaltyReceiverId,
      timestamp: new Date().toISOString(),
    }
    io.to(data.room_id).emit('claim_responded', respondedEvent)

    // Check if game ended (simplified - check if player has 4 penalty cards)
    const { data: participant } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', data.room_id)
      .eq('player_id', penaltyReceiverId)
      .single()

    const totalPenalties = (participant?.penalty_cards as any)?.total || 0
    if (totalPenalties >= 4) {
      // Game ended
      const gameEndedEvent: GameEndedEvent = {
        room_id: data.room_id,
        winner_id:
          penaltyReceiverId === userId ? round.claiming_player_id : userId,
        losers: [
          {
            player_id: penaltyReceiverId,
            penalty_cards: {
              cockroach: 0,
              mouse: 0,
              bat: 0,
              frog: 0,
              total: totalPenalties,
            },
          },
        ],
        game_duration_seconds: 0, // Calculate from game start
        timestamp: new Date().toISOString(),
      }
      io.to(data.room_id).emit('game_ended', gameEndedEvent)
    } else {
      // Round completed
      const roundCompletedEvent: RoundCompletedEvent = {
        room_id: data.room_id,
        round_number: round.round_number,
        loser_id: penaltyReceiverId,
        penalty_creature: round.claimed_creature_type,
        next_turn_player_id: penaltyReceiverId, // Loser starts next round
        timestamp: new Date().toISOString(),
      }
      io.to(data.room_id).emit('round_completed', roundCompletedEvent)
    }

    // Broadcast updated game state
    await broadcastGameState(io, data.room_id)

    console.log(
      `[Game] User ${userId} responded to claim: ${data.believe_claim}`
    )
  } catch (error) {
    console.error('[Game] Respond to claim error:', error)
    emitGameActionError(socket, {
      error_code: 'INVALID_ACTION',
      message: 'Failed to process response',
      action_attempted: 'respond_to_claim',
    })
  }
}

/**
 * Handle pass card action
 */
async function handlePassCard(
  io: Server,
  socket: AuthenticatedSocket,
  data: PassCardEvent
) {
  try {
    if (!isAuthenticated(socket) || !socket.userId) {
      emitGameActionError(socket, {
        error_code: 'PLAYER_NOT_IN_GAME',
        message: 'Not authenticated',
        action_attempted: 'pass_card',
      })
      return
    }

    const supabase = getSupabase()
    const userId = socket.userId

    // Get the round
    const { data: round } = await supabase
      .from('game_rounds')
      .select('*')
      .eq('id', data.round_id)
      .single()

    if (!round) {
      emitGameActionError(socket, {
        error_code: 'INVALID_ACTION',
        message: 'Round not found',
        action_attempted: 'pass_card',
      })
      return
    }

    // Update round with new claim and target
    const newPassCount = (round.pass_count || 0) + 1
    await supabase
      .from('game_rounds')
      .update({
        claimed_creature_type: data.new_claim,
        target_player_id: data.target_player_id,
        pass_count: newPassCount,
      })
      .eq('id', data.round_id)

    // Broadcast card passed event
    const passedEvent: CardPassedEvent = {
      room_id: data.room_id,
      from_player_id: userId,
      to_player_id: data.target_player_id,
      new_claimed_creature: data.new_claim,
      pass_count: newPassCount,
      timestamp: new Date().toISOString(),
    }
    io.to(data.room_id).emit('card_passed', passedEvent)

    // Broadcast updated game state
    await broadcastGameState(io, data.room_id)

    console.log(`[Game] User ${userId} passed card to ${data.target_player_id}`)
  } catch (error) {
    console.error('[Game] Pass card error:', error)
    emitGameActionError(socket, {
      error_code: 'INVALID_ACTION',
      message: 'Failed to process pass',
      action_attempted: 'pass_card',
    })
  }
}

/**
 * Handle get game state request
 */
async function handleGetGameState(socket: AuthenticatedSocket, roomId: string) {
  try {
    if (!isAuthenticated(socket) || !socket.userId) {
      return
    }

    await broadcastGameStateToSocket(socket, roomId, socket.userId)
  } catch (error) {
    console.error('[Game] Get game state error:', error)
  }
}

/**
 * Broadcast game state to entire room
 */
async function broadcastGameState(io: Server, roomId: string) {
  try {
    const gameState = await getGameState(roomId)
    if (!gameState) {
      return
    }

    io.to(roomId).emit('game_state_update', gameState)
  } catch (error) {
    console.error('[Game] Broadcast game state error:', error)
  }
}

/**
 * Broadcast game state to specific socket
 */
async function broadcastGameStateToSocket(
  socket: AuthenticatedSocket,
  roomId: string,
  userId: string
) {
  try {
    const gameState = await getGameState(roomId, userId)
    if (!gameState) {
      return
    }

    socket.emit('game_state_update', gameState)
  } catch (error) {
    console.error('[Game] Broadcast game state to socket error:', error)
  }
}

/**
 * Get complete game state
 */
async function getGameState(
  roomId: string,
  userId?: string
): Promise<GameStateUpdateEvent | null> {
  try {
    const supabase = getSupabase()

    // Get room
    const { data: room } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('id', roomId)
      .single()

    if (!room) {
      return null
    }

    // Get game session
    const { data: session } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('room_id', roomId)
      .eq('status', 'active')
      .single()

    // Get current round
    const { data: currentRound } = await supabase
      .from('game_rounds')
      .select('*')
      .eq('game_id', session?.id || '')
      .eq('is_completed', false)
      .single()

    // Get all participants
    const { data: participants } = await supabase
      .from('room_participants')
      .select(
        `
        *,
        profiles (
          public_profiles (
            display_name
          )
        )
      `
      )
      .eq('room_id', roomId)
      .order('seat_position')

    // Build player states
    const players: PlayerGameState[] =
      participants?.map(p => ({
        player_id: p.player_id,
        display_name:
          (p.profiles as any)?.public_profiles?.[0]?.display_name ||
          'Anonymous',
        seat_position: p.seat_position || 0,
        hand_count: (p.hand_cards as any[])?.length || 0,
        penalty_cards: {
          cockroach: 0,
          mouse: 0,
          bat: 0,
          frog: 0,
          total: (p.penalty_cards as any)?.total || 0,
        },
        is_current_turn: currentRound
          ? currentRound.target_player_id === p.player_id
          : false,
        connection_status: p.connection_status || 'disconnected',
        has_lost: p.has_lost || false,
      })) || []

    // Build current round info
    let roundInfo: CurrentRound | null = null
    if (currentRound) {
      roundInfo = {
        id: currentRound.id,
        claiming_player_id: currentRound.claiming_player_id,
        claimed_creature: currentRound.claimed_creature_type,
        target_player_id: currentRound.target_player_id,
        pass_count: currentRound.pass_count || 0,
        can_respond: userId ? currentRound.target_player_id === userId : false,
        can_pass: userId ? currentRound.target_player_id === userId : false,
      }
    }

    // Get user's hand if userId provided
    let yourHand: PlayerHand | null = null
    if (userId) {
      const userParticipant = participants?.find(p => p.player_id === userId)
      if (userParticipant) {
        const handCards = (userParticipant.hand_cards as any[]) || []
        yourHand = {
          cards: handCards.map(card => ({
            type: card.type,
            id: card.id,
          })),
          count: handCards.length,
        }
      }
    }

    return {
      room_id: roomId,
      game_state: {
        status: room.status,
        current_turn_player_id: currentRound?.target_player_id || null,
        round_number: session?.current_round_number || 0,
        current_round: roundInfo,
        players: players,
        your_hand: yourHand,
        last_action: null, // TODO: Track last action
      },
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    console.error('[Game] Get game state error:', error)
    return null
  }
}

/**
 * Emit game action error
 */
function emitGameActionError(
  socket: AuthenticatedSocket,
  error: GameActionErrorEvent
) {
  socket.emit('game_action_error', error)
}
