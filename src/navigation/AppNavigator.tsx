/**
 * App Navigator
 * Main navigation structure for the ごきぶりポーカー app
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';

// Screens
import LobbyScreen from '../screens/LobbyScreen';
import GameScreen from '../screens/GameScreen';
import ResultScreen from '../screens/ResultScreen';
import LoadingScreen from '../screens/LoadingScreen';

// Types
export type RootStackParamList = {
  Lobby: undefined;
  Game: {
    gameId: string;
  };
  Result: {
    winnerId: string;
    gameId: string;
  };
  Loading: {
    loadingState?: 'initializing' | 'connecting' | 'authenticating' | 'loading_game' | 'joining_game' | 'waiting_for_players' | 'starting_game';
    message?: string;
    progress?: number;
  };
};

const Stack = createStackNavigator<RootStackParamList>();

// Navigation theme
const navigationTheme = {
  dark: true,
  colors: {
    primary: '#007AFF',
    background: '#1E3A5F',
    card: '#2C5282',
    text: '#FFFFFF',
    border: '#4A5568',
    notification: '#F56565',
  },
  fonts: {
    regular: {
      fontFamily: 'System',
      fontWeight: '400' as const,
    },
    medium: {
      fontFamily: 'System',
      fontWeight: '500' as const,
    },
    bold: {
      fontFamily: 'System',
      fontWeight: '700' as const,
    },
    heavy: {
      fontFamily: 'System',
      fontWeight: '900' as const,
    },
  },
};

// Screen options
const screenOptions = {
  headerShown: false,
  gestureEnabled: true,
  cardStyleInterpolator: ({ current, layouts }: any) => ({
    cardStyle: {
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [0, 1],
            outputRange: [layouts.screen.width, 0],
          }),
        },
      ],
    },
  }),
};

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style="light" backgroundColor="#1E3A5F" />
      
      <Stack.Navigator
        initialRouteName="Lobby"
        screenOptions={screenOptions}
      >
        {/* Lobby Screen - Main menu and matchmaking */}
        <Stack.Screen 
          name="Lobby" 
          component={LobbyScreen}
          options={{
            title: 'ごきぶりポーカー',
          }}
        />

        {/* Loading Screen - For various loading states */}
        <Stack.Screen 
          name="Loading" 
          component={LoadingScreen}
          options={{
            title: '読み込み中',
            gestureEnabled: false, // Prevent back gesture during loading
          }}
        />

        {/* Game Screen - Main gameplay */}
        <Stack.Screen 
          name="Game" 
          component={GameScreen}
          options={{
            title: 'ゲーム中',
            gestureEnabled: false, // Prevent accidental back navigation during game
          }}
        />

        {/* Result Screen - Game results and statistics */}
        <Stack.Screen 
          name="Result" 
          component={ResultScreen}
          options={{
            title: '結果',
            gestureEnabled: true,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;