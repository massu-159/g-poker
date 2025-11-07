/**
 * Cockroach Poker gameplay API routes
 */

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import { z } from 'zod'
import { validator } from 'hono/validator'
import { getSupabase } from '../lib/supabase.js'
import {
  processCardClaim,
  processClaimResponse,
  processCardPass,
} from '../services/gameService.js'

const games = new Hono()

// Validation schemas
const makeClaimSchema = z.object({
  cardId: z.string().min(1, 'Card ID is required'),
  claimedCreature: z.enum(['cockroach', 'mouse', 'bat', 'frog']),
  targetPlayerId: z.string().uuid('Invalid target player ID'),
})

const respondToClaimSchema = z.object({
  roundId: z.string().uuid('Invalid round ID'),
  believeClaim: z.boolean(),
})

const passCardSchema = z.object({
  roundId: z.string().uuid('Invalid round ID'),
  targetPlayerId: z.string().uuid('Invalid target player ID'),
  newClaim: z.enum(['cockroach', 'mouse', 'bat', 'frog']),
})

/**
 * POST /api/games/:id/claim
 * Make a card claim (start a new round)
 */
games.post(
  '/:id/claim',
  authMiddleware,
  validator('json', (value, c) => {
    const parsed = makeClaimSchema.safeParse(value)
    if (!parsed.success) {
      return c.json(
        { error: 'Validation failed', details: parsed.error.issues },
        400
      )
    }
    return parsed.data
  }),
  async c => {
    const gameId = c.req.param('id')
    const user = c.get('user')
    const { cardId, claimedCreature, targetPlayerId } = c.req.valid('json')

    const result = await processCardClaim(gameId, user.userId, {
      cardId,
      claimedCreature,
      targetPlayerId,
    })

    if (!result.success) {
      return c.json({ error: result.error }, 400)
    }

    return c.json({
      message: 'Claim made successfully',
      round: {
        id: result.data.roundId,
        roundNumber: result.data.roundNumber,
        claimedCreature: result.data.claimedCreature,
        targetPlayer: result.data.targetPlayer,
        awaitingResponse: true,
      },
    })
  }
)

/**
 * POST /api/games/:id/respond
 * Respond to a card claim (believe/doubt)
 */
games.post(
  '/:id/respond',
  authMiddleware,
  validator('json', (value, c) => {
    const parsed = respondToClaimSchema.safeParse(value)
    if (!parsed.success) {
      return c.json(
        { error: 'Validation failed', details: parsed.error.issues },
        400
      )
    }
    return parsed.data
  }),
  async c => {
    const gameId = c.req.param('id')
    const user = c.get('user')
    const { roundId, believeClaim } = c.req.valid('json')

    const result = await processClaimResponse(gameId, user.userId, {
      roundId,
      believeClaim,
    })

    if (!result.success) {
      return c.json({ error: result.error }, 400)
    }

    const { roundResult } = result.data

    return c.json({
      message: roundResult.gameOver ? 'Game completed' : 'Response recorded',
      roundResult: roundResult,
    })
  }
)

/**
 * POST /api/games/:id/pass
 * Pass the card to another player with a new claim
 */
games.post(
  '/:id/pass',
  authMiddleware,
  validator('json', (value, c) => {
    const parsed = passCardSchema.safeParse(value)
    if (!parsed.success) {
      return c.json(
        { error: 'Validation failed', details: parsed.error.issues },
        400
      )
    }
    return parsed.data
  }),
  async c => {
    const gameId = c.req.param('id')
    const user = c.get('user')
    const { roundId, targetPlayerId, newClaim } = c.req.valid('json')

    const result = await processCardPass(gameId, user.userId, {
      roundId,
      targetPlayerId,
      newClaim,
    })

    if (!result.success) {
      return c.json({ error: result.error }, 400)
    }

    return c.json({
      message: 'Card passed successfully',
      nextTurnPlayer: result.data.nextTurnPlayer,
      newClaim: result.data.newClaim,
      passCount: result.data.passCount,
    })
  }
)

/**
 * GET /api/games/:id/state
 * Get current game state for player
 */
games.get('/:id/state', authMiddleware, async c => {
  try {
    const supabase = getSupabase()
    const gameId = c.req.param('id')
    const user = c.get('user')

    // Verify player is in game
    const { data: participant } = await supabase
      .from('game_participants')
      .select('*')
      .eq('game_id', gameId)
      .eq('player_id', user.userId)
      .single()

    if (!participant) {
      return c.json({ error: 'Not a participant in this game' }, 403)
    }

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
    const { data: allParticipants } = await supabase
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

    return c.json({
      gameState: {
        gameId: game?.id,
        status: game?.status,
        currentTurnPlayer: game?.current_turn_player_id,
        roundNumber: game?.round_number,
        isYourTurn: game?.current_turn_player_id === user.userId,
        playerHand: participant.hand_cards,
        cardsRemaining: participant.cards_remaining,
        hasLost: participant.has_lost,
        penaltyCards: {
          cockroach: participant.penalty_cockroach,
          mouse: participant.penalty_mouse,
          bat: participant.penalty_bat,
          frog: participant.penalty_frog,
        },
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
          allParticipants?.map(p => ({
            playerId: p.player_id,
            displayName: p.profiles?.public_profiles?.[0]?.display_name,
            avatarUrl: p.profiles?.public_profiles?.[0]?.avatar_url,
            position: p.position,
            cardsRemaining: p.cards_remaining,
            hasLost: p.has_lost,
            penaltyCards: {
              cockroach: p.penalty_cockroach?.length || 0,
              mouse: p.penalty_mouse?.length || 0,
              bat: p.penalty_bat?.length || 0,
              frog: p.penalty_frog?.length || 0,
            },
          })) || [],
      },
    })
  } catch (error) {
    console.error('Get game state error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default games
