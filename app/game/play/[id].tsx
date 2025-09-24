/**
 * Game Play Screen Route
 * 2-Player Cockroach Poker gameplay interface
 */

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { GamePlayScreen } from '@/components/game/GamePlayScreen';

export default function GamePlayRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return null;
  }

  return <GamePlayScreen gameId={id} />;
}