/**
 * Player Area Component
 * Displays player information, hand cards, and status for 2-player Cockroach Poker
 */

import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Image,
  Animated,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Card } from './Card';
import type { PlayerHand } from '@/types/cards';

interface PlayerAreaProps {
  playerData: PlayerHand | null;
  isOpponent: boolean;
  isCurrentPlayer: boolean;
  position: 'top' | 'bottom';
  screenWidth: number;
  playerInfo?: {
    displayName: string;
    avatarUrl?: string | null;
    connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
    latency?: number | null;
    lastConnected?: Date | null;
  };
  selectedCardId?: string | null;
  onCardSelect?: (cardId: string) => void;
  style?: any;
}

export function PlayerArea({
  playerData,
  isOpponent,
  isCurrentPlayer,
  position,
  screenWidth,
  playerInfo,
  selectedCardId,
  onCardSelect,
  style,
}: PlayerAreaProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  // Pulsing animation for reconnecting state
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (playerInfo?.connectionStatus === 'reconnecting') {
      // Start pulsing animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      return () => {
        pulse.stop();
        pulseAnim.setValue(1);
      };
    } else {
      // Reset animation
      pulseAnim.setValue(1);
    }
  }, [playerInfo?.connectionStatus, pulseAnim]);

  if (!playerData) {
    return (
      <View style={[styles.container, style]}>
        <ThemedText style={styles.playerName}>Player Loading...</ThemedText>
      </View>
    );
  }

  const cardSize = screenWidth < 600 ? 'small' : 'medium';
  const cardSpacing = screenWidth < 400 ? 4 : 6;

  // Calculate card overlap for hand display
  const cardWidth = cardSize === 'small' ? 50 : 60;
  const maxHandWidth = screenWidth - 60; // Leave margins
  const cardOverlap = Math.max(
    10,
    Math.min(cardWidth * 0.7, (maxHandWidth - cardWidth) / (playerData.cards.length - 1))
  );

  return (
    <View style={[styles.container, style]}>

      {/* Player info */}
      <View style={styles.playerInfo}>
        <View style={styles.playerInfoRow}>
          {/* Player avatar */}
          <View style={styles.avatarContainer}>
            {playerInfo?.avatarUrl ? (
              <Image
                source={{ uri: playerInfo.avatarUrl }}
                style={[
                  styles.avatar,
                  playerInfo.connectionStatus === 'disconnected' && styles.avatarDisconnected
                ]}
                onError={() => {
                  // Fallback to placeholder if image fails to load
                }}
              />
            ) : (
              <View style={[
                styles.avatarPlaceholder,
                { backgroundColor: isOpponent ? '#e74c3c' : tintColor },
                playerInfo?.connectionStatus === 'disconnected' && styles.avatarDisconnected
              ]}>
                <ThemedText style={styles.avatarText}>
                  {(playerInfo?.displayName || (isOpponent ? 'Opponent' : 'You')).charAt(0).toUpperCase()}
                </ThemedText>
              </View>
            )}

            {/* Connection status indicator */}
            <Animated.View style={[
              styles.connectionIndicator,
              {
                backgroundColor: playerInfo?.connectionStatus === 'connected' ? '#27ae60' :
                                 playerInfo?.connectionStatus === 'reconnecting' ? '#f39c12' : '#e74c3c',
                opacity: playerInfo?.connectionStatus === 'reconnecting' ? pulseAnim : 1,
              }
            ]} />
          </View>

          <View style={[
            styles.playerNameContainer,
            isCurrentPlayer && { backgroundColor: tintColor },
            { borderColor: isCurrentPlayer ? tintColor : iconColor }
          ]}>
            <ThemedText style={[
              styles.playerName,
              isCurrentPlayer && { color: '#fff' }
            ]}>
              {playerInfo?.displayName || (isOpponent ? 'Opponent' : 'You')}
            </ThemedText>

            <View style={styles.playerStats}>
              <ThemedText style={[
                styles.handCount,
                isCurrentPlayer && { color: '#fff' }
              ]}>
                {playerData.cards.length} cards
              </ThemedText>

              {/* Connection status text */}
              {playerInfo?.connectionStatus !== 'connected' && (
                <ThemedText style={[
                  styles.connectionStatus,
                  { color: playerInfo.connectionStatus === 'reconnecting' ? '#f39c12' : '#e74c3c' }
                ]}>
                  {playerInfo.connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Disconnected'}
                </ThemedText>
              )}

              {/* Connection latency for connected users */}
              {playerInfo?.connectionStatus === 'connected' && playerInfo.latency && (
                <ThemedText style={[
                  styles.latencyText,
                  { color: playerInfo.latency < 100 ? '#27ae60' : playerInfo.latency < 300 ? '#f39c12' : '#e74c3c' }
                ]}>
                  {playerInfo.latency}ms
                </ThemedText>
              )}
            </View>
          </View>
        </View>

        {/* Turn indicator */}
        {isCurrentPlayer && (
          <View style={[styles.turnIndicator, { backgroundColor: tintColor }]}>
            <ThemedText style={styles.turnIndicatorText}>
              {isOpponent ? "Opponent's Turn" : "Your Turn"}
            </ThemedText>
          </View>
        )}
      </View>

      {/* Hand cards */}
      <View style={[
        styles.handContainer,
        position === 'top' && styles.handContainerTop
      ]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.handScrollContent,
            { paddingHorizontal: Math.max(0, (screenWidth - (cardWidth + cardOverlap * (playerData.cards.length - 1))) / 2) }
          ]}
        >
          {playerData.cards.map((card, index) => {
            const isLastCard = index === playerData.cards.length - 1;
            return (
              <View
                key={card.id}
                style={[
                  styles.cardContainer,
                  !isLastCard && { marginRight: -cardOverlap },
                  { zIndex: index }
                ]}
              >
                <Card
                  card={card}
                  visibility={isOpponent ? 'back' : 'face'}
                  size={cardSize as 'small' | 'medium' | 'large'}
                  onPress={isOpponent ? undefined : () => onCardSelect?.(card.id)}
                  disabled={isOpponent || !isCurrentPlayer}
                  highlighted={!isOpponent && selectedCardId === card.id}
                  style={[
                    styles.handCard,
                    isCurrentPlayer && !isOpponent && styles.selectableCard,
                    !isOpponent && selectedCardId === card.id && [
                      styles.selectedCard,
                      { borderColor: tintColor }
                    ]
                  ]}
                />
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    minWidth: '100%',
  },
  playerInfo: {
    alignItems: 'center',
    marginBottom: 12,
  },
  playerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  avatarDisconnected: {
    opacity: 0.5,
    borderColor: '#e74c3c',
  },
  connectionIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  playerNameContainer: {
    borderWidth: 2,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 120,
  },
  playerName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  playerStats: {
    alignItems: 'center',
    marginTop: 2,
  },
  handCount: {
    fontSize: 12,
    opacity: 0.8,
  },
  connectionStatus: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  latencyText: {
    fontSize: 9,
    fontWeight: '500',
    marginTop: 1,
  },
  turnIndicator: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 6,
  },
  turnIndicatorText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  handContainer: {
    width: '100%',
    height: 80,
  },
  handContainerTop: {
    // Opponent cards at top might need different styling
  },
  handScrollContent: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cardContainer: {
    alignItems: 'center',
  },
  handCard: {
    // Base card styling
  },
  selectableCard: {
    // Add subtle highlight or shadow to show cards are selectable
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedCard: {
    borderWidth: 3,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    transform: [{ translateY: -8 }], // Lift selected card slightly
  },
});