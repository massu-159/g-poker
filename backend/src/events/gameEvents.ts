/**
 * Socket.io event handlers for Cockroach Poker real-time gameplay
 */

import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { getSupabase } from '../lib/supabase.js'
import { getJWTSecret } from '../middleware/auth.js'

// Store active game rooms and player connections
const activeRooms = new Map<string, Set<string>>() // gameId -> Set of socketIds
const playerSockets = new Map<string, string>() // userId -> socketId
const socketPlayers = new Map<string, string>() // socketId -> userId

interface AuthenticatedSocket extends Socket {
  userId?: string
  gameId?: string
}

// Authenticate socket connection
async function authenticateSocket(
  socket: AuthenticatedSocket,
  token: string
): Promise<boolean> {
  try {
    const decoded = jwt.verify(token, getJWTSecret()) as any
    if (decoded.userId) {
      socket.userId = decoded.userId
      playerSockets.set(decoded.userId, socket.id)
      socketPlayers.set(socket.id, decoded.userId)
      return true
    }
  } catch (error) {
    console.error('Socket authentication failed:', error)
  }
  return false
}

// Join game room
async function joinGameRoom(
  io: Server,
  socket: AuthenticatedSocket,
  gameId: string
) {
  try {
    if (!socket.userId) {
      socket.emit('error', { message: 'Not authenticated' })
      return
    }
    const supabase = getSupabase()

    // Verify user is participant in this game
    const { data: participant } = await supabase
      .from('game_participants')
      .select('*')
      .eq('game_id', gameId)
      .eq('player_id', socket.userId)
      .single()

    if (!participant) {
      socket.emit('error', { message: 'Not authorized to join this game' })
      return
    }

    // Join socket room
    socket.join(gameId)
    socket.gameId = gameId

    // Track active connections
    if (!activeRooms.has(gameId)) {
      activeRooms.set(gameId, new Set())
    }
    activeRooms.get(gameId)!.add(socket.id)

    // Get current game state
    const gameState = await getCurrentGameState(gameId, socket.userId)

    // Send current state to joined player
    socket.emit('game-state-update', gameState)

    // Notify other players
    socket.to(gameId).emit('player-connected', {
      playerId: socket.userId,
      message: 'Player reconnected',
    })

    console.log(`Player ${socket.userId} joined game ${gameId}`)
  } catch (error) {
    console.error('Join game room error:', error)
    socket.emit('error', { message: 'Failed to join game room' })
  }
}

// Leave game room
function leaveGameRoom(io: Server, socket: AuthenticatedSocket) {
  if (socket.gameId && socket.userId) {
    socket.leave(socket.gameId)

    // Remove from active rooms
    const roomSockets = activeRooms.get(socket.gameId)
    if (roomSockets) {
      roomSockets.delete(socket.id)
      if (roomSockets.size === 0) {
        activeRooms.delete(socket.gameId)
      }
    }

    // Notify other players
    socket.to(socket.gameId).emit('player-disconnected', {
      playerId: socket.userId,
      message: 'Player disconnected',
    })

    console.log(`Player ${socket.userId} left game ${socket.gameId}`)
    socket.gameId = undefined
  }
}

// Handle card claim
async function handleCardClaim(
  io: Server,
  socket: AuthenticatedSocket,
  data: {
    cardId: string
    claimedCreature: string
    targetPlayerId: string
  }
) {
  try {
    if (!socket.userId || !socket.gameId) {
      socket.emit('error', { message: 'Invalid session' })
      return
    }
    const supabase = getSupabase()

    // Verify it's player's turn
    const { data: game } = await supabase
      .from('games')
      .select('current_turn_player_id, status')
      .eq('id', socket.gameId)
      .single()

    if (!game || game.current_turn_player_id !== socket.userId) {
      socket.emit('error', { message: 'Not your turn' })
      return
    }

    if (game.status !== 'in_progress') {
      socket.emit('error', { message: 'Game is not in progress' })
      return
    }

    // Process the claim (reuse API logic)
    const result = await processCardClaim(socket.gameId, socket.userId, data)

    if (result.success) {
      // Broadcast to all players in the game
      const gameState = await getCurrentGameState(socket.gameId)
      io.to(socket.gameId).emit('game-state-update', gameState)
      io.to(socket.gameId).emit('card-claimed', {
        playerId: socket.userId,
        claimedCreature: data.claimedCreature,
        targetPlayerId: data.targetPlayerId,
        roundId: result.data?.roundId,
      })
    } else {
      socket.emit('error', { message: result.error })
    }
  } catch (error) {
    console.error('Handle card claim error:', error)
    socket.emit('error', { message: 'Failed to process claim' })
  }
}

// Handle response to claim
async function handleClaimResponse(
  io: Server,
  socket: AuthenticatedSocket,
  data: {
    roundId: string
    believeClaim: boolean
  }
) {
  try {
    if (!socket.userId || !socket.gameId) {
      socket.emit('error', { message: 'Invalid session' })
      return
    }

    // Process the response
    const result = await processClaimResponse(
      socket.gameId,
      socket.userId,
      data
    )

    if (result.success) {
      // Broadcast to all players in the game
      const gameState = await getCurrentGameState(socket.gameId)
      io.to(socket.gameId).emit('game-state-update', gameState)
      io.to(socket.gameId).emit('claim-responded', {
        playerId: socket.userId,
        believeClaim: data.believeClaim,
        result: result.data?.roundResult,
      })

      // Check if game ended
      if (result.data?.roundResult?.gameOver) {
        io.to(socket.gameId).emit('game-ended', {
          winner: result.data.roundResult.winner,
          reason: 'Player collected 3 cards of same type',
        })
      }
    } else {
      socket.emit('error', { message: result.error })
    }
  } catch (error) {
    console.error('Handle claim response error:', error)
    socket.emit('error', { message: 'Failed to process response' })
  }
}

// Handle card pass
async function handleCardPass(
  io: Server,
  socket: AuthenticatedSocket,
  data: {
    roundId: string
    targetPlayerId: string
    newClaim: string
  }
) {
  try {
    if (!socket.userId || !socket.gameId) {
      socket.emit('error', { message: 'Invalid session' })
      return
    }

    // Process the pass
    const result = await processCardPass(socket.gameId, socket.userId, data)

    if (result.success) {
      // Broadcast to all players in the game
      const gameState = await getCurrentGameState(socket.gameId)
      io.to(socket.gameId).emit('game-state-update', gameState)
      io.to(socket.gameId).emit('card-passed', {
        playerId: socket.userId,
        targetPlayerId: data.targetPlayerId,
        newClaim: data.newClaim,
        passCount: result.data?.passCount,
      })
    } else {
      socket.emit('error', { message: result.error })
    }
  } catch (error) {
    console.error('Handle card pass error:', error)
    socket.emit('error', { message: 'Failed to process pass' })
  }
}

// Get current game state
async function getCurrentGameState(gameId: string, userId?: string) {
  try {
    const supabase = getSupabase()
    // Get game details
    const { data: game } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    // Get current round if active
    const { data: currentRound } = await supabase
      .from('game_rounds')
      .select('*')
      .eq('game_id', gameId)
      .eq('is_completed', false)
      .single()

    // Get all participants
    const { data: participants } = await supabase
      .from('game_participants')
      .select(
        `
        *,
        profiles (
          public_profiles (
            display_name,
            avatar_url
          )
        )
      `
      )
      .eq('game_id', gameId)
      .order('position')

    // Get player-specific data if userId provided
    let playerHand = null
    if (userId) {
      const participant = participants?.find(p => p.player_id === userId)
      playerHand = participant?.hand_cards || []
    }

    return {
      gameId: game?.id,
      status: game?.status,
      currentTurnPlayer: game?.current_turn_player_id,
      roundNumber: game?.round_number,
      isYourTurn: userId ? game?.current_turn_player_id === userId : false,
      playerHand,
      currentRound: currentRound
        ? {
            id: currentRound.id,
            claimingPlayer: currentRound.claiming_player_id,
            claimedCreature: currentRound.claimed_creature_type,
            targetPlayer: currentRound.target_player_id,
            passCount: currentRound.pass_count,
            isCompleted: currentRound.is_completed,
          }
        : null,
      allPlayers:
        participants?.map(p => ({
          playerId: p.player_id,
          displayName: p.profiles?.public_profiles?.[0]?.display_name,
          avatarUrl: p.profiles?.public_profiles?.[0]?.avatar_url,
          position: p.position,
          cardsRemaining: p.cards_remaining,
          hasLost: p.has_lost,
          isConnected: playerSockets.has(p.player_id),
          penaltyCards: {
            cockroach: p.penalty_cockroach?.length || 0,
            mouse: p.penalty_mouse?.length || 0,
            bat: p.penalty_bat?.length || 0,
            frog: p.penalty_frog?.length || 0,
          },
        })) || [],
    }
  } catch (error) {
    console.error('Get game state error:', error)
    return null
  }
}

// Import shared game logic
import {
  processCardClaim as gameLogicCardClaim,
  processClaimResponse as gameLogicClaimResponse,
  processCardPass as gameLogicCardPass,
  type CardClaimData,
  type ClaimResponseData,
  type CardPassData,
} from '../services/gameService.js'

// Helper functions that use shared game logic
async function processCardClaim(
  gameId: string,
  userId: string,
  data: CardClaimData
) {
  return await gameLogicCardClaim(gameId, userId, data)
}

async function processClaimResponse(
  gameId: string,
  userId: string,
  data: ClaimResponseData
) {
  return await gameLogicClaimResponse(gameId, userId, data)
}

async function processCardPass(
  gameId: string,
  userId: string,
  data: CardPassData
) {
  return await gameLogicCardPass(gameId, userId, data)
}

// Setup Socket.io event handlers
export function setupGameEvents(io: Server) {
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`Client connected: ${socket.id}`)

    // Authentication
    socket.on('authenticate', async (token: string) => {
      const authenticated = await authenticateSocket(socket, token)
      socket.emit('authenticated', { success: authenticated })
    })

    // Room management
    socket.on('join-game', (gameId: string) => {
      joinGameRoom(io, socket, gameId)
    })

    socket.on('leave-game', () => {
      leaveGameRoom(io, socket)
    })

    // Game actions
    socket.on('make-claim', data => {
      handleCardClaim(io, socket, data)
    })

    socket.on('respond-to-claim', data => {
      handleClaimResponse(io, socket, data)
    })

    socket.on('pass-card', data => {
      handleCardPass(io, socket, data)
    })

    socket.on('get-game-state', async () => {
      if (socket.gameId && socket.userId) {
        const gameState = await getCurrentGameState(
          socket.gameId,
          socket.userId
        )
        socket.emit('game-state-update', gameState)
      }
    })

    // Connection management
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`)
      leaveGameRoom(io, socket)

      if (socket.userId) {
        playerSockets.delete(socket.userId)
        socketPlayers.delete(socket.id)
      }
    })
  })
}
