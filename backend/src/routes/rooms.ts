/**
 * Cockroach Poker game room management API routes
 */

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { z } from 'zod'
import { validator } from 'hono/validator'
import { getSupabase } from '../lib/supabase.js'
import { logAction, ActionType } from '../services/auditService.js'
import {
  createRoomWithCreator,
  joinRoomSafely,
  startGameWithDeal,
} from '../services/roomService.js'

const rooms = new Hono()

// Rate limit configurations
const createRoomRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5,
  message: 'Too many room creation attempts, please try again later',
})

const joinRoomRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: 'Too many room join attempts, please try again later',
})

// Validation schemas
const createGameSchema = z.object({
  timeLimitSeconds: z.number().min(30).max(300).default(60),
  // maxPlayers removed - always exactly 2 players for simplified mobile version
})

const joinGameSchema = z.object({
  gameId: z.string().uuid('Invalid game ID'),
})

/**
 * POST /api/rooms/create
 * Create a new Cockroach Poker game
 */
rooms.post(
  '/create',
  createRoomRateLimit,
  authMiddleware,
  validator('json', (value, c) => {
    const parsed = createGameSchema.safeParse(value)
    if (!parsed.success) {
      return c.json(
        { error: 'Validation failed', details: parsed.error.issues },
        400
      )
    }
    return parsed.data
  }),
  async c => {
    try {
      const user = c.get('user')
      const { timeLimitSeconds } = c.req.valid('json')

      // Create game deck (6 cards each of 4 creatures = 24 cards total)
      const creatures = ['cockroach', 'mouse', 'bat', 'frog']
      const gameDeck = []
      for (const creature of creatures) {
        for (let i = 0; i < 6; i++) {
          gameDeck.push({ creature, id: `${creature}_${i}` })
        }
      }

      // Shuffle deck
      for (let i = gameDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[gameDeck[i], gameDeck[j]] = [gameDeck[j], gameDeck[i]]
      }

      // Create room via service
      const result = await createRoomWithCreator(
        user.userId,
        timeLimitSeconds,
        gameDeck
      )

      if (!result.success) {
        return c.json({ error: result.error }, 500)
      }

      return c.json(
        {
          message: 'Game created successfully',
          game: {
            id: result.gameId,
            maxPlayers: 2,
            currentPlayers: 1,
            status: result.status,
            timeLimitSeconds: timeLimitSeconds,
            createdAt: result.createdAt,
          },
        },
        201
      )
    } catch (error) {
      console.error('Create game error:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
  }
)

/**
 * GET /api/rooms/list
 * Get list of available games
 */
rooms.get('/list', authMiddleware, async c => {
  try {
    const supabase = getSupabase()
    const { data: games, error } = await supabase
      .from('games')
      .select(
        `
        id,
        status,
        time_limit_seconds,
        created_at,
        profiles!creator_id (
          id,
          public_profiles (
            display_name,
            avatar_url
          )
        ),
        game_participants(id)
      `
      )
      .in('status', ['waiting', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('List games error:', error)
      return c.json({ error: 'Failed to fetch games' }, 500)
    }

    return c.json({
      games:
        games?.map(game => ({
          id: game.id,
          maxPlayers: 2,
          currentPlayers: (game.game_participants as any[])?.length || 0,
          status: game.status,
          timeLimitSeconds: game.time_limit_seconds,
          creatorName:
            (game.profiles as any)?.public_profiles?.[0]?.display_name ||
            'Unknown',
          creatorAvatarUrl: (game.profiles as any)?.public_profiles?.[0]
            ?.avatar_url,
          createdAt: game.created_at,
        })) || [],
    })
  } catch (error) {
    console.error('List games error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /api/rooms/join
 * Join an existing game
 */
rooms.post(
  '/join',
  joinRoomRateLimit,
  authMiddleware,
  validator('json', (value, c) => {
    const parsed = joinGameSchema.safeParse(value)
    if (!parsed.success) {
      return c.json(
        { error: 'Validation failed', details: parsed.error.issues },
        400
      )
    }
    return parsed.data
  }),
  async c => {
    try {
      const user = c.get('user')
      const { gameId } = c.req.valid('json')

      // Join room via service
      const result = await joinRoomSafely(gameId, user.userId)

      if (!result.success) {
        const statusCode =
          result.errorCode === 'GAME_NOT_FOUND'
            ? 404
            : result.errorCode === 'ALREADY_JOINED'
              ? 409
              : 400

        return c.json({ error: result.error }, statusCode)
      }

      // Log join_game action
      await logAction({
        gameId,
        roundId: null,
        playerId: user.userId,
        actionType: ActionType.JOIN_GAME,
        actionData: {
          position: result.position,
          joined_at: new Date().toISOString(),
        },
      })

      return c.json({
        message: 'Successfully joined game',
        position: result.position,
      })
    } catch (error) {
      console.error('Join game error:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
  }
)

/**
 * POST /api/rooms/:id/start
 * Start a game (only creator can start)
 */
rooms.post('/:id/start', authMiddleware, async c => {
  try {
    const gameId = c.req.param('id')
    const user = c.get('user')
    const supabase = getSupabase()

    // Verify user is creator and game can be started
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (gameError || !game) {
      return c.json({ error: 'Game not found' }, 404)
    }

    if (game.creator_id !== user.userId) {
      return c.json({ error: 'Only game creator can start the game' }, 403)
    }

    if (game.status !== 'waiting') {
      return c.json({ error: 'Game already started or completed' }, 400)
    }

    // Check if exactly 2 players
    const { data: participants } = await supabase
      .from('game_participants')
      .select('id')
      .eq('game_id', gameId)

    if (!participants || participants.length !== 2) {
      return c.json({ error: 'Exactly 2 players required to start' }, 400)
    }

    // Deal cards atomically using stored function (9 cards each, 6 cards remain hidden)
    const cardsPerPlayer = 9
    const gameDeck = [...game.game_deck]

    // Start game via service
    const result = await startGameWithDeal(gameId, cardsPerPlayer, gameDeck)

    if (!result.success) {
      return c.json({ error: result.error }, 500)
    }

    // Log start_game action
    await logAction({
      gameId,
      roundId: null,
      playerId: user.userId,
      actionType: ActionType.START_GAME,
      actionData: {
        participant_count: 2,
        cards_per_player: cardsPerPlayer,
        first_player: result.currentTurnPlayerId,
        started_at: new Date().toISOString(),
      },
    })

    return c.json({
      message: 'Game started successfully',
      currentTurnPlayer: result.currentTurnPlayerId,
    })
  } catch (error) {
    console.error('Start game error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * GET /api/rooms/:id
 * Get game details
 */
rooms.get('/:id', authMiddleware, async c => {
  try {
    const gameId = c.req.param('id')
    const user = c.get('user')
    const supabase = getSupabase()

    // Check if user is participant
    const { data: participant } = await supabase
      .from('game_participants')
      .select('*')
      .eq('game_id', gameId)
      .eq('player_id', user.userId)
      .single()

    if (!participant) {
      return c.json({ error: 'Access denied - not a participant' }, 403)
    }

    // Get game details
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select(
        `
        *,
        profiles!creator_id (
          public_profiles (
            display_name,
            avatar_url
          )
        )
      `
      )
      .eq('id', gameId)
      .single()

    if (gameError || !game) {
      return c.json({ error: 'Game not found' }, 404)
    }

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

    // Get current round if in progress
    let currentRound = null
    if (game.status === 'in_progress') {
      const { data: round } = await supabase
        .from('game_rounds')
        .select('*')
        .eq('game_id', gameId)
        .eq('is_completed', false)
        .single()

      currentRound = round
    }

    return c.json({
      game: {
        id: game.id,
        status: game.status,
        maxPlayers: 2,
        currentPlayers: participants?.length || 0,
        currentTurnPlayer: game.current_turn_player_id,
        roundNumber: game.round_number,
        timeLimitSeconds: game.time_limit_seconds,
        creatorName: game.profiles?.public_profiles?.[0]?.display_name,
        creatorAvatarUrl: game.profiles?.public_profiles?.[0]?.avatar_url,
        createdAt: game.created_at,
        participants:
          participants?.map(p => ({
            playerId: p.player_id,
            position: p.position,
            displayName: p.profiles?.public_profiles?.[0]?.display_name,
            avatarUrl: p.profiles?.public_profiles?.[0]?.avatar_url,
            cardsRemaining: p.cards_remaining,
            hasLost: p.has_lost,
            losingCreatureType: p.losing_creature_type,
            penaltyCards: {
              cockroach: p.penalty_cockroach,
              mouse: p.penalty_mouse,
              bat: p.penalty_bat,
              frog: p.penalty_frog,
            },
          })) || [],
        currentRound: currentRound,
        playerHand: participant.hand_cards, // Only show this player's hand
      },
    })
  } catch (error) {
    console.error('Get game details error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /api/rooms/:id/leave
 * Leave a game (only allowed before game starts)
 */
rooms.post('/:id/leave', authMiddleware, async c => {
  try {
    const gameId = c.req.param('id')
    const user = c.get('user')
    const supabase = getSupabase()

    // Check game status
    const { data: game } = await supabase
      .from('games')
      .select('status')
      .eq('id', gameId)
      .single()

    if (!game) {
      return c.json({ error: 'Game not found' }, 404)
    }

    // Cannot leave game in progress
    if (game.status === 'in_progress') {
      return c.json({ error: 'Cannot leave game in progress' }, 400)
    }

    // Cannot leave completed game
    if (game.status === 'completed') {
      return c.json({ error: 'Game already completed' }, 400)
    }

    // Verify user is participant
    const { data: participant } = await supabase
      .from('game_participants')
      .select('id')
      .eq('game_id', gameId)
      .eq('player_id', user.userId)
      .single()

    if (!participant) {
      return c.json({ error: 'You are not a participant in this game' }, 403)
    }

    // Remove participant
    const { error: deleteError } = await supabase
      .from('game_participants')
      .delete()
      .eq('game_id', gameId)
      .eq('player_id', user.userId)

    if (deleteError) {
      console.error('Leave game error:', deleteError)
      return c.json({ error: 'Failed to leave game' }, 500)
    }

    // Log leave_game action
    await logAction({
      gameId,
      roundId: null,
      playerId: user.userId,
      actionType: ActionType.LEAVE_GAME,
      actionData: {
        left_at: new Date().toISOString(),
      },
    })

    return c.json({ message: 'Successfully left game' })
  } catch (error) {
    console.error('Leave game error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default rooms
