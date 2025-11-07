/**
 * Cockroach Poker Game State Management Hook
 * Handles real-time game state, player actions, and game flow
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { gameService } from '@/services/gameService';
import type {
  Game,
  GameParticipant,
  GameRound,
  GameWithParticipants,
  CreatureType,
} from '@/types/database';
import type { Card } from '@/types/cards';

export interface GameState {
  game: Game | null;
  participants: GameParticipant[];
  currentRound: GameRound | null;
  currentPlayerHand: Card[];
  isMyTurn: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface UseGameStateResult extends GameState {
  // Actions
  joinGame: (gameId: string) => Promise<void>;
  leaveGame: () => Promise<void>;
  startGame: () => Promise<void>;
  makeCardClaim: (cardId: string, claimedType: CreatureType, targetParticipantId: string) => Promise<void>;
  respondToClaim: (roundId: string, response: 'truth' | 'lie' | 'pass_back') => Promise<void>;
  refreshGameState: () => Promise<void>;
}

export function useGameState(gameId?: string): UseGameStateResult {
  const [state, setState] = useState<GameState>({
    game: null,
    participants: [],
    currentRound: null,
    currentPlayerHand: [],
    isMyTurn: false,
    isLoading: false,
    error: null,
  });

  // Get current user participant
  const getCurrentParticipant = useCallback(async () => {
    if (!gameId || !state.game) return null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Get user's public profile
    const { data: profile } = await supabase
      .from('public_profiles')
      .select('id')
      .eq('profile_id', user.id)
      .single();

    if (!profile) return null;

    return state.participants.find(p => p.player_id === profile.id) || null;
  }, [gameId, state.game, state.participants]);

  // Refresh game state from server
  const refreshGameState = useCallback(async () => {
    if (!gameId) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Get game with participants
      const gameResult = await gameService.getGameWithParticipants(gameId);
      if (!gameResult.success || !gameResult.data) {
        throw new Error(gameResult.error || 'Failed to load game');
      }

      const gameData = gameResult.data;

      // Get current round if game is in progress
      let currentRound: GameRound | null = null;
      if (gameData.status === 'in_progress') {
        const { data: rounds } = await supabase
          .from('game_rounds')
          .select('*')
          .eq('game_id', gameId)
          .eq('is_completed', false)
          .order('created_at', { ascending: false })
          .limit(1);

        currentRound = rounds?.[0] || null;
      }

      // Get current user's hand
      const currentParticipant = await getCurrentParticipant();
      const currentPlayerHand = (currentParticipant?.hand_cards as Card[]) || [];

      // Check if it's user's turn
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('public_profiles')
        .select('id')
        .eq('profile_id', user?.id || '')
        .single();

      const isMyTurn = gameData.current_turn_player_id === profile?.id;

      setState(prev => ({
        ...prev,
        game: gameData,
        participants: gameData.participants as any,
        currentRound,
        currentPlayerHand,
        isMyTurn,
        isLoading: false,
      }));

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isLoading: false,
      }));
    }
  }, [gameId, getCurrentParticipant]);

  // Join game
  const joinGame = useCallback(async (targetGameId: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      const result = await gameService.joinGame({
        gameId: targetGameId,
        playerId: user.id,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to join game');
      }

      await refreshGameState();
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isLoading: false,
      }));
    }
  }, [refreshGameState]);

  // Leave game
  const leaveGame = useCallback(async () => {
    if (!gameId) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await gameService.leaveGame(gameId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to leave game');
      }

      // Clear state
      setState({
        game: null,
        participants: [],
        currentRound: null,
        currentPlayerHand: [],
        isMyTurn: false,
        isLoading: false,
        error: null,
      });

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isLoading: false,
      }));
    }
  }, [gameId]);

  // Start game
  const startGame = useCallback(async () => {
    if (!gameId) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await gameService.startGame(gameId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to start game');
      }

      await refreshGameState();
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isLoading: false,
      }));
    }
  }, [gameId, refreshGameState]);

  // Make card claim
  const makeCardClaim = useCallback(async (
    cardId: string,
    claimedType: CreatureType,
    targetParticipantId: string
  ) => {
    if (!gameId) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await gameService.makeCardClaim(
        gameId,
        cardId,
        claimedType,
        targetParticipantId
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to make claim');
      }

      await refreshGameState();
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isLoading: false,
      }));
    }
  }, [gameId, refreshGameState]);

  // Respond to claim
  const respondToClaim = useCallback(async (
    roundId: string,
    response: 'truth' | 'lie' | 'pass_back'
  ) => {
    if (!gameId) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await gameService.respondToCardClaim(gameId, roundId, response);

      if (!result.success) {
        throw new Error(result.error || 'Failed to respond to claim');
      }

      // Check if game ended
      if (result.data?.gameEnded) {
        // Game ended, winner determined
        console.log('Game ended, winner:', result.data.winner);
      }

      await refreshGameState();
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isLoading: false,
      }));
    }
  }, [gameId, refreshGameState]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!gameId) return;

    // Subscribe to game changes
    const gameSubscription = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        () => {
          refreshGameState();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_participants',
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          refreshGameState();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rounds',
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          refreshGameState();
        }
      )
      .subscribe();

    // Initial load
    refreshGameState();

    return () => {
      supabase.removeChannel(gameSubscription);
    };
  }, [gameId, refreshGameState]);

  return {
    ...state,
    joinGame,
    leaveGame,
    startGame,
    makeCardClaim,
    respondToClaim,
    refreshGameState,
  };
}