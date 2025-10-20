/**
 * Shared game logic for Cockroach Poker
 * Used by both REST API and Socket.io handlers
 */

import { getSupabase } from '../lib/supabase.js'

export interface CardClaimData {
  cardId: string
  claimedCreature: string
  targetPlayerId: string
}

export interface ClaimResponseData {
  roundId: string
  believeClaim: boolean
}

export interface CardPassData {
  roundId: string
  targetPlayerId: string
  newClaim: string
}

export interface GameLogicResult {
  success: boolean
  error?: string
  data?: any
}

/**
 * Process a card claim - creates a new round and updates game state
 */
export async function processCardClaim(
  gameId: string,
  userId: string,
  data: CardClaimData
): Promise<GameLogicResult> {
  try {
    const { cardId, claimedCreature, targetPlayerId } = data
    const supabase = getSupabase()

    // Verify it's the player's turn
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (gameError || !game) {
      return { success: false, error: 'Game not found' }
    }

    if (game.status !== 'active') {
      return { success: false, error: 'Game is not active' }
    }

    if (game.current_turn_player_id !== userId) {
      return { success: false, error: 'Not your turn' }
    }

    // Verify player has the card
    const { data: participant, error: participantError } = await supabase
      .from('game_participants')
      .select('*')
      .eq('game_id', gameId)
      .eq('player_id', userId)
      .single()

    if (participantError || !participant) {
      return { success: false, error: 'Player not found in game' }
    }

    const playerCards = participant.hand_cards || []
    const cardIndex = playerCards.findIndex((card: any) => card.id === cardId)

    if (cardIndex === -1) {
      return { success: false, error: 'Card not found in your hand' }
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
      return { success: false, error: 'Target player not found' }
    }

    if (targetParticipant.has_lost) {
      return {
        success: false,
        error: 'Cannot target a player who has already lost',
      }
    }

    // Create new round
    const { data: newRound, error: roundError } = await supabase
      .from('game_rounds')
      .insert({
        game_id: gameId,
        round_number: game.round_number + 1,
        current_card: claimedCard,
        claiming_player_id: userId,
        claimed_creature_type: claimedCreature,
        target_player_id: targetPlayerId,
        pass_count: 0,
        is_completed: false,
      })
      .select()
      .single()

    if (roundError || !newRound) {
      console.error('Round creation error:', roundError)
      return { success: false, error: 'Failed to create round' }
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
      player_id: userId,
      action_type: 'claim',
      action_data: {
        card: claimedCard,
        claimed_creature: claimedCreature,
        target_player: targetPlayerId,
      },
    })

    return {
      success: true,
      data: {
        roundId: newRound.id,
        roundNumber: newRound.round_number,
        claimedCreature: claimedCreature,
        targetPlayer: targetPlayerId,
      },
    }
  } catch (error) {
    console.error('Process card claim error:', error)
    return { success: false, error: 'Internal server error' }
  }
}

/**
 * Process a response to a card claim
 */
export async function processClaimResponse(
  gameId: string,
  userId: string,
  data: ClaimResponseData
): Promise<GameLogicResult> {
  try {
    const { roundId, believeClaim } = data
    const supabase = getSupabase()

    // Get round details
    const { data: round, error: roundError } = await supabase
      .from('game_rounds')
      .select('*')
      .eq('id', roundId)
      .eq('game_id', gameId)
      .single()

    if (roundError || !round) {
      return { success: false, error: 'Round not found' }
    }

    if (round.is_completed) {
      return { success: false, error: 'Round already completed' }
    }

    // Verify it's the target player's turn to respond
    const { data: game } = await supabase
      .from('games')
      .select('current_turn_player_id')
      .eq('id', gameId)
      .single()

    if (game?.current_turn_player_id !== userId) {
      return { success: false, error: 'Not your turn to respond' }
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
        penaltyReceiverId = userId
      } else {
        // Claim was false, claimer gets penalty
        penaltyReceiverId = round.claiming_player_id
      }
    } else {
      // Player doubts the claim
      if (claimIsTruthful) {
        // Claim was true, doubter gets penalty
        penaltyReceiverId = userId
      } else {
        // Claim was false, claimer gets penalty
        penaltyReceiverId = round.claiming_player_id
      }
    }

    // Update round with results
    await supabase
      .from('game_rounds')
      .update({
        final_guesser_id: userId,
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

    let gameOver = false
    let winnerId = null

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
        winnerId = remainingPlayers[0]?.player_id || null
        gameOver = true
        await supabase
          .from('games')
          .update({
            status: 'completed',
            current_turn_player_id: winnerId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', gameId)
      }
    }

    // Continue game - penalty receiver gets next turn (if not game over)
    if (!gameOver) {
      await supabase
        .from('games')
        .update({
          current_turn_player_id: penaltyReceiverId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', gameId)
    }

    // Log action
    await supabase.from('game_actions').insert({
      game_id: gameId,
      round_id: roundId,
      player_id: userId,
      action_type: 'respond',
      action_data: {
        believed_claim: believeClaim,
        claim_was_truthful: claimIsTruthful,
        penalty_receiver: penaltyReceiverId,
      },
    })

    const roundResult = {
      penaltyReceiver: penaltyReceiverId,
      actualCard: actualCard,
      claimWasTruthful: claimIsTruthful,
      playerGuess: believeClaim,
      nextTurnPlayer: gameOver ? winnerId : penaltyReceiverId,
      gameOver: gameOver,
      winner: winnerId,
    }

    return {
      success: true,
      data: { roundResult },
    }
  } catch (error) {
    console.error('Process claim response error:', error)
    return { success: false, error: 'Internal server error' }
  }
}

/**
 * Process a card pass
 */
export async function processCardPass(
  gameId: string,
  userId: string,
  data: CardPassData
): Promise<GameLogicResult> {
  try {
    const { roundId, targetPlayerId, newClaim } = data
    const supabase = getSupabase()

    // Get current round
    const { data: round, error: roundError } = await supabase
      .from('game_rounds')
      .select('*')
      .eq('id', roundId)
      .eq('game_id', gameId)
      .single()

    if (roundError || !round) {
      return { success: false, error: 'Round not found' }
    }

    if (round.is_completed) {
      return { success: false, error: 'Round already completed' }
    }

    // Verify it's the player's turn
    const { data: game } = await supabase
      .from('games')
      .select('current_turn_player_id')
      .eq('id', gameId)
      .single()

    if (game?.current_turn_player_id !== userId) {
      return { success: false, error: 'Not your turn' }
    }

    // Verify target player is valid
    const { data: targetParticipant, error: targetError } = await supabase
      .from('game_participants')
      .select('*')
      .eq('game_id', gameId)
      .eq('player_id', targetPlayerId)
      .single()

    if (targetError || !targetParticipant || targetParticipant.has_lost) {
      return { success: false, error: 'Invalid target player' }
    }

    // Update round with pass
    const newPassCount = round.pass_count + 1
    await supabase
      .from('game_rounds')
      .update({
        target_player_id: targetPlayerId,
        claimed_creature_type: newClaim,
        pass_count: newPassCount,
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
      player_id: userId,
      action_type: 'pass',
      action_data: {
        target_player: targetPlayerId,
        new_claim: newClaim,
        pass_count: newPassCount,
      },
    })

    return {
      success: true,
      data: {
        nextTurnPlayer: targetPlayerId,
        newClaim: newClaim,
        passCount: newPassCount,
      },
    }
  } catch (error) {
    console.error('Process card pass error:', error)
    return { success: false, error: 'Internal server error' }
  }
}
