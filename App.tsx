/**
 * Temporary App.tsx for Screen Testing
 * Switch between different screens by changing the activeScreen variable
 */

import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Import screens for testing
import LobbyScreen from './src/screens/LobbyScreen';
import GameScreen from './src/screens/GameScreen';
import ResultScreen from './src/screens/ResultScreen';
import LoadingScreen from './src/screens/LoadingScreen';

// Screen selector component
import ScreenSelector from './src/components/ScreenSelector';

// Mock providers
import { MockGameStoreProvider, MockUserStoreProvider } from './src/components/MockProviders';

type Screen = 'selector' | 'lobby' | 'game' | 'result' | 'loading';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<Screen>('selector');

  const renderScreen = () => {
    switch (activeScreen) {
      case 'lobby':
        return (
          <LobbyScreen
            onNavigateToGame={(gameId) => {
              console.log('Navigate to game:', gameId);
              setActiveScreen('game');
            }}
            onNavigateToSettings={() => {
              console.log('Navigate to settings');
            }}
            testID="lobby-screen"
          />
        );
      
      case 'game':
        return (
          <GameScreen
            gameId="test-game-123"
            onNavigateToLobby={() => setActiveScreen('lobby')}
            onNavigateToResults={(winnerId) => {
              console.log('Navigate to results, winner:', winnerId);
              setActiveScreen('result');
            }}
            testID="game-screen"
          />
        );
      
      case 'result':
        return (
          <ResultScreen
            winnerId="user-123"
            onNavigateToLobby={() => setActiveScreen('lobby')}
            onNavigateToNewGame={() => setActiveScreen('lobby')}
            testID="result-screen"
          />
        );
      
      case 'loading':
        return (
          <LoadingScreen
            loadingState="waiting_for_players"
            message="プレイヤーの参加を待っています..."
            progress={65}
            showCancel={true}
            onCancel={() => setActiveScreen('lobby')}
            testID="loading-screen"
          />
        );
      
      default:
        return (
          <ScreenSelector
            onSelectScreen={setActiveScreen}
            testID="screen-selector"
          />
        );
    }
  };

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.container}>
        <MockUserStoreProvider>
          <MockGameStoreProvider>
            <StatusBar style="light" backgroundColor="#1E3A5F" />
            {renderScreen()}
          </MockGameStoreProvider>
        </MockUserStoreProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});