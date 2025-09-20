/**
 * Individual Game Lobby Route
 * Specific lobby for a single game
 */

import { useLocalSearchParams } from 'expo-router';
import { GameLobbyScreen } from '@/components/game/GameLobbyScreen';

export default function GameLobby() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    throw new Error('Game ID is required');
  }

  return <GameLobbyScreen gameId={id} />;
}