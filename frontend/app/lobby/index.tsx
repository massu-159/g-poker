/**
 * Main Lobby Route
 * Entry point for game lobby system
 * Uses new ApiClient + SocketClient architecture
 */

import { LobbyScreen } from '@/src/components/lobby/LobbyScreen';

export default function Lobby() {
  return <LobbyScreen />;
}