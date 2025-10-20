/**
 * Cockroach Poker gameplay API routes
 */

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import { z } from 'zod'
import { validator } from 'hono/validator'
import { getSupabase } from '../lib/supabase.js'

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
    try {
      const supabase = getSupabase()
      const gameId = c.req.param('id')
      const user = c.get('user')
      const { cardId, claimedCreature, targetPlayerId } = c.req.valid('json')

      // Verify it's the player's turn
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single()

      if (gameError || !game) {
        return c.json({ error: 'Game not found' }, 404)
      }

      if (game.status !== 'active') {
        return c.json({ error: 'Game is not active' }, 400)
      }

      if (game.current_turn_player_id !== user.userId) {
        return c.json({ error: 'Not your turn' }, 400)
      }

      // Verify player has the card
      const { data: participant, error: participantError } = await supabase
        .from('game_participants')
        .select('*')
        .eq('game_id', gameId)
        .eq('player_id', user.userId)
        .single()

      if (participantError || !participant) {
        return c.json({ error: 'Player not found in game' }, 404)
      }

      const playerCards = participant.hand_cards || []
      const cardIndex = playerCards.findIndex((card: any) => card.id === cardId)

      if (cardIndex === -1) {
        return c.json({ error: 'Card not found in your hand' }, 400)
      }

      const claimedCard = playerCards[cardIndex]

      // Verify target player exists and is active
      const { data: targetParticipant, error: targetError } = await supabase
        .from('game_participants')
        .select('*')
        .eq('game_id', gameId)
        .eq('player_id', targetPlayerId)
        .single()

      if (targetError || !targetParticipant) {
        return c.json({ error: 'Target player not found' }, 404)
      }

      if (targetParticipant.has_lost) {
        return c.json(
          { error: 'Cannot target a player who has already lost' },
          400
        )
      }

      // Create new round
      const { data: newRound, error: roundError } = await supabase
        .from('game_rounds')
        .insert({
          game_id: gameId,
          round_number: game.round_number + 1,
          current_card: claimedCard,
          claiming_player_id: user.userId,
          claimed_creature_type: claimedCreature,
          target_player_id: targetPlayerId,
          pass_count: 0,
          is_completed: false,
        })
        .select()
        .single()

      if (roundError || !newRound) {
        console.error('Round creation error:', roundError)
        return c.json({ error: 'Failed to create round' }, 500)
      }

      // Remove card from player's hand
      const updatedCards = playerCards.filter((card: any) => card.id !== cardId)
      await supabase
        .from('game_participants')
        .update({
          hand_cards: updatedCards,
          cards_remaining: updatedCards.length,
        })
        .eq('id', participant.id)

      // Update game state
      await supabase
        .from('games')
        .update({
          round_number: newRound.round_number,
          current_turn_player_id: targetPlayerId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', gameId)

      // Log action
      await supabase.from('game_actions').insert({
        game_id: gameId,
        round_id: newRound.id,
        player_id: user.userId,
        action_type: 'claim',
        action_data: {
          card: claimedCard,
          claimed_creature: claimedCreature,
          target_player: targetPlayerId,
        },
      })

      return c.json({
        message: 'Claim made successfully',
        round: {
          id: newRound.id,
          roundNumber: newRound.round_number,
          claimedCreature: claimedCreature,
          targetPlayer: targetPlayerId,
          awaitingResponse: true,
        },
      })
    } catch (error) {
      console.error('Make claim error:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
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
    try {
      const supabase = getSupabase()
      const gameId = c.req.param('id')
      const user = c.get('user')
      const { roundId, believeClaim } = c.req.valid('json')

      // Get round details
      const { data: round, error: roundError } = await supabase
        .from('game_rounds')
        .select('*')
        .eq('id', roundId)
        .eq('game_id', gameId)
        .single()

      if (roundError || !round) {
        return c.json({ error: 'Round not found' }, 404)
      }

      if (round.is_completed) {
        return c.json({ error: 'Round already completed' }, 400)
      }

      // Verify it's the target player's turn to respond
      const { data: game } = await supabase
        .from('games')
        .select('current_turn_player_id')
        .eq('id', gameId)
        .single()

      if (game?.current_turn_player_id !== user.userId) {
        return c.json({ error: 'Not your turn to respond' }, 400)
      }

      // Determine if the claim was truthful
      const actualCard = round.current_card
      const claimedCreature = round.claimed_creature_type
      const actualCreature = actualCard.creature
      const claimIsTruthful = actualCreature === claimedCreature

      // Determine who gets the penalty card
      let penaltyReceiverId
      if (believeClaim) {
        // Player believes the claim
        if (claimIsTruthful) {
          // Claim was true, responder gets penalty
          penaltyReceiverId = user.userId
        } else {
          // Claim was false, claimer gets penalty
          penaltyReceiverId = round.claiming_player_id
        }
      } else {
        // Player doubts the claim
        if (claimIsTruthful) {
          // Claim was true, doubter gets penalty
          penaltyReceiverId = user.userId
        } else {
          // Claim was false, claimer gets penalty
          penaltyReceiverId = round.claiming_player_id
        }
      }

      // Update round with results
      await supabase
        .from('game_rounds')
        .update({
          final_guesser_id: user.userId,
          guess_is_truth: believeClaim,
          actual_is_truth: claimIsTruthful,
          penalty_receiver_id: penaltyReceiverId,
          is_completed: true,
          completed_at: new Date().toISOString(),
        })
        .eq('id', roundId)

      // Add penalty card to the appropriate player
      const { data: penaltyParticipant } = await supabase
        .from('game_participants')
        .select('*')
        .eq('game_id', gameId)
        .eq('player_id', penaltyReceiverId)
        .single()

      if (penaltyParticipant) {
        const creatureKey =
          `penalty_${actualCreature}` as keyof typeof penaltyParticipant
        const currentPenalties = penaltyParticipant[creatureKey] || []
        const updatedPenalties = [...currentPenalties, actualCard]

        // Check if player has lost (3 of same creature for simplified mobile version)
        const hasLost = updatedPenalties.length >= 3

        await supabase
          .from('game_participants')
          .update({
            [creatureKey]: updatedPenalties,
            has_lost: hasLost,
            losing_creature_type: hasLost ? actualCreature : null,
          })
          .eq('id', penaltyParticipant.id)

        // Check if game is over
        const { data: remainingPlayers } = await supabase
          .from('game_participants')
          .select('player_id')
          .eq('game_id', gameId)
          .eq('has_lost', false)

        if (remainingPlayers && remainingPlayers.length <= 1) {
          // Game over
          const winnerId = remainingPlayers[0]?.player_id || null
          await supabase
            .from('games')
            .update({
              status: 'completed',
              current_turn_player_id: winnerId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', gameId)

          return c.json({
            message: 'Game completed',
            roundResult: {
              penaltyReceiver: penaltyReceiverId,
              actualCard: actualCard,
              claimWasTruthful: claimIsTruthful,
              playerGuess: believeClaim,
              gameOver: true,
              winner: winnerId,
            },
          })
        }
      }

      // Continue game - penalty receiver gets next turn
      await supabase
        .from('games')
        .update({
          current_turn_player_id: penaltyReceiverId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', gameId)

      // Log action
      await supabase.from('game_actions').insert({
        game_id: gameId,
        round_id: roundId,
        player_id: user.userId,
        action_type: 'respond',
        action_data: {
          believed_claim: believeClaim,
          claim_was_truthful: claimIsTruthful,
          penalty_receiver: penaltyReceiverId,
        },
      })

      return c.json({
        message: 'Response recorded',
        roundResult: {
          penaltyReceiver: penaltyReceiverId,
          actualCard: actualCard,
          claimWasTruthful: claimIsTruthful,
          playerGuess: believeClaim,
          nextTurnPlayer: penaltyReceiverId,
          gameOver: false,
        },
      })
    } catch (error) {
      console.error('Respond to claim error:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
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
    try {
      const supabase = getSupabase()
      const gameId = c.req.param('id')
      const user = c.get('user')
      const { roundId, targetPlayerId, newClaim } = c.req.valid('json')

      // Get current round
      const { data: round, error: roundError } = await supabase
        .from('game_rounds')
        .select('*')
        .eq('id', roundId)
        .eq('game_id', gameId)
        .single()

      if (roundError || !round) {
        return c.json({ error: 'Round not found' }, 404)
      }

      if (round.is_completed) {
        return c.json({ error: 'Round already completed' }, 400)
      }

      // Verify it's the player's turn
      const { data: game } = await supabase
        .from('games')
        .select('current_turn_player_id')
        .eq('id', gameId)
        .single()

      if (game?.current_turn_player_id !== user.userId) {
        return c.json({ error: 'Not your turn' }, 400)
      }

      // Verify target player is valid
      const { data: targetParticipant, error: targetError } = await supabase
        .from('game_participants')
        .select('*')
        .eq('game_id', gameId)
        .eq('player_id', targetPlayerId)
        .single()

      if (targetError || !targetParticipant || targetParticipant.has_lost) {
        return c.json({ error: 'Invalid target player' }, 400)
      }

      // Update round with pass
      await supabase
        .from('game_rounds')
        .update({
          target_player_id: targetPlayerId,
          claimed_creature_type: newClaim,
          pass_count: round.pass_count + 1,
        })
        .eq('id', roundId)

      // Update game turn
      await supabase
        .from('games')
        .update({
          current_turn_player_id: targetPlayerId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', gameId)

      // Log action
      await supabase.from('game_actions').insert({
        game_id: gameId,
        round_id: roundId,
        player_id: user.userId,
        action_type: 'pass',
        action_data: {
          target_player: targetPlayerId,
          new_claim: newClaim,
          pass_count: round.pass_count + 1,
        },
      })

      return c.json({
        message: 'Card passed successfully',
        nextTurnPlayer: targetPlayerId,
        newClaim: newClaim,
        passCount: round.pass_count + 1,
      })
    } catch (error) {
      console.error('Pass card error:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
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
