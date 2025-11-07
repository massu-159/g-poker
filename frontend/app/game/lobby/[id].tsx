/**
 * Individual Game Lobby Route (Waiting Room)
 * Players wait here before game starts
 * Uses new server-authoritative architecture with Socket.io
 */

import { useLocalSearchParams } from 'expo-router';
import { GameWaitingRoom } from '@/src/components/game/GameWaitingRoom';

export default function GameLobby() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    throw new Error('Room ID is required');
  }

  return <GameWaitingRoom roomId={id} />;
}