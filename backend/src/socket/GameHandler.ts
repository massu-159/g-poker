/**
 * Game State Broadcast Handler (T045)
 * Handles game action events and broadcasts state updates
 */

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
import {
  processCardClaim,
  processClaimResponse,
  processCardPass,
} from '../services/gameService.js'

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

    const userId = socket.userId

    // Call gameService to process the claim
    const result = await processCardClaim(data.room_id, userId, {
      cardId: data.card_id,
      claimedCreature: data.claimed_creature,
      targetPlayerId: data.target_player_id,
    })

    if (!result.success) {
      emitGameActionError(socket, {
        error_code: 'INVALID_ACTION',
        message: result.error || 'Failed to process claim',
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
      round_id: result.data.roundId,
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

    const userId = socket.userId

    // Call gameService to process the response
    const result = await processClaimResponse(data.room_id, userId, {
      roundId: data.round_id,
      believeClaim: data.believe_claim,
    })

    if (!result.success) {
      emitGameActionError(socket, {
        error_code: 'INVALID_ACTION',
        message: result.error || 'Failed to process response',
        action_attempted: 'respond_to_claim',
      })
      return
    }

    const roundResult = result.data.roundResult

    // Broadcast claim responded event
    const respondedEvent: ClaimRespondedEvent = {
      room_id: data.room_id,
      responder_id: userId,
      believed_claim: data.believe_claim,
      actual_creature: roundResult.actualCard.creature,
      was_correct: roundResult.claimWasTruthful === roundResult.playerGuess,
      penalty_receiver_id: roundResult.penaltyReceiver,
      timestamp: new Date().toISOString(),
    }
    io.to(data.room_id).emit('claim_responded', respondedEvent)

    // Check if game ended
    if (roundResult.gameOver) {
      const gameEndedEvent: GameEndedEvent = {
        room_id: data.room_id,
        winner_id: roundResult.winner,
        losers: [
          {
            player_id: roundResult.penaltyReceiver,
            penalty_cards: {
              cockroach: 0,
              mouse: 0,
              bat: 0,
              frog: 0,
              total: 0,
            },
          },
        ],
        game_duration_seconds: 0,
        timestamp: new Date().toISOString(),
      }
      io.to(data.room_id).emit('game_ended', gameEndedEvent)
    } else {
      const roundCompletedEvent: RoundCompletedEvent = {
        room_id: data.room_id,
        round_number: 0,
        loser_id: roundResult.penaltyReceiver,
        penalty_creature: roundResult.actualCard.creature,
        next_turn_player_id: roundResult.nextTurnPlayer,
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

    const userId = socket.userId

    // Call gameService to process the pass
    const result = await processCardPass(data.room_id, userId, {
      roundId: data.round_id,
      targetPlayerId: data.target_player_id,
      newClaim: data.new_claim,
    })

    if (!result.success) {
      emitGameActionError(socket, {
        error_code: 'INVALID_ACTION',
        message: result.error || 'Failed to process pass',
        action_attempted: 'pass_card',
      })
      return
    }

    // Broadcast card passed event
    const passedEvent: CardPassedEvent = {
      room_id: data.room_id,
      from_player_id: userId,
      to_player_id: data.target_player_id,
      new_claimed_creature: data.new_claim,
      pass_count: result.data.passCount,
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

    // Get room (games table)
    const { data: room } = await supabase
      .from('games')
      .select('*')
      .eq('id', roomId)
      .single()

    if (!room) {
      return null
    }

    // Get current round (no game_sessions table - use game_id directly)
    const { data: currentRound } = await supabase
      .from('game_rounds')
      .select('*')
      .eq('game_id', roomId)
      .eq('is_completed', false)
      .single()

    // Get all participants
    const { data: participants } = await supabase
      .from('game_participants')
      .select(
        `
        *,
        profiles!inner (
          public_profiles (
            display_name
          )
        )
      `
      )
      .eq('game_id', roomId)
      .order('position')

    // Build player states
    const players: PlayerGameState[] =
      participants?.map(p => ({
        player_id: p.player_id,
        display_name:
          (p.profiles as any)?.public_profiles?.[0]?.display_name ||
          'Anonymous',
        seat_position: p.position || 0,
        hand_count: (p.hand_cards as any[])?.length || 0,
        penalty_cards: {
          cockroach: (p.penalty_cockroach as any[])?.length || 0,
          mouse: (p.penalty_mouse as any[])?.length || 0,
          bat: (p.penalty_bat as any[])?.length || 0,
          frog: (p.penalty_frog as any[])?.length || 0,
          total:
            ((p.penalty_cockroach as any[])?.length || 0) +
            ((p.penalty_mouse as any[])?.length || 0) +
            ((p.penalty_bat as any[])?.length || 0) +
            ((p.penalty_frog as any[])?.length || 0),
        },
        is_current_turn: currentRound
          ? currentRound.target_player_id === p.player_id
          : false,
        connection_status:
          p.status === 'playing' ? 'connected' : 'disconnected',
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
        round_number: room.round_number || 0,
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
