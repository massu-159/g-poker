/**
 * Game Play Screen Route
 * Real-time Cockroach Poker gameplay with Socket.io
 * Uses new server-authoritative architecture
 */

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { GamePlayScreen } from '@/src/components/game/GamePlayScreen';

export default function GamePlayRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return null;
  }

  return <GamePlayScreen gameId={id} />;
}