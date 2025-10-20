/**
 * Cockroach Poker game room management API routes
 */

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import { z } from 'zod'
import { validator } from 'hono/validator'
import { getSupabase } from '../lib/supabase.js'

const rooms = new Hono()

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
      const supabase = getSupabase()
      // const maxPlayers = 2 // Fixed to 2 players for simplified mobile version

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

      // Create game
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert({
          creator_id: user.userId,
          status: 'waiting',
          time_limit_seconds: timeLimitSeconds,
          game_deck: gameDeck,
          round_number: 0,
        })
        .select()
        .single()

      if (gameError || !game) {
        console.error('Game creation error:', gameError)
        return c.json({ error: 'Failed to create game' }, 500)
      }

      // Add creator as first participant
      const { error: participantError } = await supabase
        .from('game_participants')
        .insert({
          game_id: game.id,
          player_id: user.userId,
          position: 1,
          hand_cards: [],
          penalty_cockroach: [],
          penalty_mouse: [],
          penalty_bat: [],
          penalty_frog: [],
          cards_remaining: 0,
          has_lost: false,
          status: 'joined',
        })

      if (participantError) {
        console.error('Participant creation error:', participantError)
        return c.json({ error: 'Failed to add creator to game' }, 500)
      }

      return c.json(
        {
          message: 'Game created successfully',
          game: {
            id: game.id,
            maxPlayers: 2,
            currentPlayers: 1,
            status: game.status,
            timeLimitSeconds: game.time_limit_seconds,
            createdAt: game.created_at,
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
        )
      `
      )
      .in('status', ['waiting', 'active'])
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
          currentPlayers: 1, // TODO: calculate from game_participants
          status: game.status,
          timeLimitSeconds: game.time_limit_seconds,
          creatorName:
            (game.profiles as any)?.public_profiles?.[0]?.display_name ||
            'Unknown',
          creatorAvatarUrl:
            (game.profiles as any)?.public_profiles?.[0]?.avatar_url,
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
      const supabase = getSupabase()

      // Check if game exists and can be joined
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single()

      if (gameError || !game) {
        return c.json({ error: 'Game not found' }, 404)
      }

      if (game.status !== 'waiting') {
        return c.json({ error: 'Game already started or completed' }, 400)
      }

      // Check if game is full (calculate from participants)
      const { data: participants } = await supabase
        .from('game_participants')
        .select('id')
        .eq('game_id', gameId)

      if (participants && participants.length >= 2) {
        return c.json({ error: 'Game is full' }, 400)
      }

      // Check if user already joined
      const { data: existingParticipant } = await supabase
        .from('game_participants')
        .select('id')
        .eq('game_id', gameId)
        .eq('player_id', user.userId)
        .single()

      if (existingParticipant) {
        return c.json({ error: 'Already joined this game' }, 409)
      }

      // Add player to game
      const newPosition = participants ? participants.length + 1 : 2
      const { error: participantError } = await supabase
        .from('game_participants')
        .insert({
          game_id: gameId,
          player_id: user.userId,
          position: newPosition,
          hand_cards: [],
          penalty_cockroach: [],
          penalty_mouse: [],
          penalty_bat: [],
          penalty_frog: [],
          cards_remaining: 0,
          has_lost: false,
          status: 'joined',
        })

      if (participantError) {
        console.error('Join game error:', participantError)
        return c.json({ error: 'Failed to join game' }, 500)
      }

      // Update game player count
      await supabase
        .from('games')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('id', gameId)

      return c.json({
        message: 'Successfully joined game',
        position: newPosition,
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

    // Deal cards to players (9 cards each, 6 cards remain hidden)
    const cardsPerPlayer = 9
    const gameDeck = [...game.game_deck]

    const { data: allParticipants } = await supabase
      .from('game_participants')
      .select('*')
      .eq('game_id', gameId)
      .order('position')

    // Deal cards
    if (allParticipants) {
      for (let i = 0; i < allParticipants.length; i++) {
        const playerCards = gameDeck.splice(0, cardsPerPlayer)
        await supabase
          .from('game_participants')
          .update({
            hand_cards: playerCards,
            cards_remaining: playerCards.length,
          })
          .eq('id', allParticipants[i].id)
      }
    }

    // Update game status
    const { error: updateError } = await supabase
      .from('games')
      .update({
        status: 'active',
        current_turn_player_id: allParticipants?.[0]?.player_id || null,
        round_number: 1,
        game_deck: gameDeck,
        updated_at: new Date().toISOString(),
      })
      .eq('id', gameId)

    if (updateError) {
      console.error('Start game error:', updateError)
      return c.json({ error: 'Failed to start game' }, 500)
    }

    return c.json({
      message: 'Game started successfully',
      currentTurnPlayer: allParticipants?.[0]?.player_id || null,
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

    // Get current round if active
    let currentRound = null
    if (game.status === 'active') {
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
        currentPlayers: 2,
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

export default rooms
