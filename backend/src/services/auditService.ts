/**
 * Audit logging service for game actions
 * Provides centralized, type-safe logging for all game events
 */

import { getSupabase } from '../lib/supabase.js'

// DB制約と一致する定数定義
export const ActionType = {
  JOIN_GAME: 'join_game',
  LEAVE_GAME: 'leave_game',
  START_GAME: 'start_game',
  MAKE_CLAIM: 'make_claim',
  GUESS_TRUTH: 'guess_truth',
  GUESS_LIE: 'guess_lie',
  PASS_CARD: 'pass_card',
  PASS_BACK: 'pass_back',
  RECEIVE_PENALTY: 'receive_penalty',
  GAME_END: 'game_end',
} as const

export type ActionTypeValue = (typeof ActionType)[keyof typeof ActionType]

export interface LogActionParams {
  gameId: string
  roundId?: string | null
  playerId: string
  actionType: ActionTypeValue
  actionData: unknown
}

/**
 * Log a game action to the audit trail
 * @param params - Action logging parameters
 */
export async function logAction(params: LogActionParams): Promise<void> {
  const supabase = getSupabase()

  const { error } = await supabase.from('game_actions').insert({
    game_id: params.gameId,
    round_id: params.roundId || null,
    player_id: params.playerId,
    action_type: params.actionType,
    action_data: params.actionData,
  })

  if (error) {
    console.error('[AuditService] Failed to log action:', error)
    // ログ記録失敗は致命的ではないので throw しない
  }
}
