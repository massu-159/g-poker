/**
 * Player List Component
 * Displays current players in a game lobby with their status
 */

import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Image,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { LobbyPlayer, VerificationStatus } from '@/types/database';

interface PlayerListProps {
  players: LobbyPlayer[];
  maxPlayers: number;
  currentUserId?: string;
  onPlayerPress?: (player: LobbyPlayer) => void;
  showReadyStatus?: boolean;
  showSeatNumbers?: boolean;
}

interface PlayerItemProps {
  player?: LobbyPlayer;
  seatNumber: number;
  isEmpty: boolean;
  isCurrentUser: boolean;
  onPress?: () => void;
  showReadyStatus: boolean;
  showSeatNumbers: boolean;
}

function PlayerItem({
  player,
  seatNumber,
  isEmpty,
  isCurrentUser,
  onPress,
  showReadyStatus,
  showSeatNumbers,
}: PlayerItemProps) {
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  const getVerificationColor = (status: VerificationStatus) => {
    switch (status) {
      case 'verified':
        return '#27ae60'; // Green
      case 'pending':
        return '#f39c12'; // Orange
      case 'rejected':
        return '#e74c3c'; // Red
      case 'suspended':
        return '#95a5a6'; // Gray
      case 'unverified':
      default:
        return iconColor;
    }
  };

  const getVerificationIcon = (status: VerificationStatus) => {
    switch (status) {
      case 'verified':
        return '✓';
      case 'pending':
        return '⏳';
      case 'rejected':
        return '✕';
      case 'suspended':
        return '⚠';
      case 'unverified':
      default:
        return '?';
    }
  };

  const getConnectionStatusColor = (status: 'connected' | 'disconnected') => {
    return status === 'connected' ? '#27ae60' : '#e74c3c';
  };

  if (isEmpty) {
    return (
      <TouchableOpacity
        style={[styles.playerItem, styles.emptyPlayerItem, { borderColor: iconColor }]}
        onPress={onPress}
        disabled={!onPress}
      >
        {showSeatNumbers && (
          <View style={[styles.seatNumber, { backgroundColor: iconColor }]}>
            <ThemedText style={styles.seatNumberText}>{seatNumber}</ThemedText>
          </View>
        )}
        <View style={styles.emptyPlayerContent}>
          <View style={[styles.emptyAvatar, { backgroundColor: iconColor }]}>
            <ThemedText style={styles.emptyAvatarText}>+</ThemedText>
          </View>
          <ThemedText style={[styles.emptyPlayerText, { color: iconColor }]}>
            Empty Seat
          </ThemedText>
        </View>
      </TouchableOpacity>
    );
  }

  if (!player) return null;

  return (
    <TouchableOpacity
      style={[
        styles.playerItem,
        isCurrentUser && { borderColor: tintColor, borderWidth: 2 },
        !isCurrentUser && { borderColor: iconColor }
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      {showSeatNumbers && (
        <View style={[styles.seatNumber, { backgroundColor: tintColor }]}>
          <ThemedText style={styles.seatNumberText}>{seatNumber}</ThemedText>
        </View>
      )}

      <View style={styles.playerContent}>
        {/* Avatar with connection status */}
        <View style={styles.avatarContainer}>
          {player.avatarUrl ? (
            <Image source={{ uri: player.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.defaultAvatar, { backgroundColor: iconColor }]}>
              <ThemedText style={styles.defaultAvatarText}>
                {player.displayName?.[0]?.toUpperCase() || '?'}
              </ThemedText>
            </View>
          )}

          {/* Connection Status Indicator */}
          <View
            style={[
              styles.connectionIndicator,
              { backgroundColor: getConnectionStatusColor(player.connectionStatus) }
            ]}
          />

          {/* Verification Badge */}
          <View
            style={[
              styles.verificationBadge,
              { backgroundColor: getVerificationColor(player.verificationStatus) }
            ]}
          >
            <ThemedText style={styles.verificationIcon}>
              {getVerificationIcon(player.verificationStatus)}
            </ThemedText>
          </View>
        </View>

        {/* Player Info */}
        <View style={styles.playerInfo}>
          <ThemedText style={styles.playerName} numberOfLines={1}>
            {player.displayName || 'Unknown Player'}
          </ThemedText>

          {isCurrentUser && (
            <ThemedText style={[styles.currentUserLabel, { color: tintColor }]}>
              You
            </ThemedText>
          )}

          {/* Player Stats */}
          <View style={styles.playerStats}>
            <ThemedText style={styles.statsText}>
              {player.gamesPlayed} games
            </ThemedText>
            <ThemedText style={styles.statsSeparator}>•</ThemedText>
            <ThemedText style={styles.statsText}>
              {Math.round(player.winRate * 100)}% win rate
            </ThemedText>
          </View>

          {/* Ready Status */}
          {showReadyStatus && (
            <View style={styles.readyStatusContainer}>
              <View
                style={[
                  styles.readyIndicator,
                  { backgroundColor: player.isReady ? '#27ae60' : '#e74c3c' }
                ]}
              />
              <ThemedText
                style={[
                  styles.readyText,
                  { color: player.isReady ? '#27ae60' : '#e74c3c' }
                ]}
              >
                {player.isReady ? 'Ready' : 'Not Ready'}
              </ThemedText>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function PlayerList({
  players,
  maxPlayers,
  currentUserId,
  onPlayerPress,
  showReadyStatus = true,
  showSeatNumbers = true,
}: PlayerListProps) {
  const backgroundColor = useThemeColor({}, 'background');

  // Create array of seats with players or empty slots
  const seats = Array.from({ length: maxPlayers }, (_, index) => {
    const seatNumber = index + 1;
    const player = players.find(p => p.seatPosition === seatNumber);
    return {
      seatNumber,
      player,
      isEmpty: !player,
      isCurrentUser: player?.id === currentUserId,
    };
  });

  const handlePlayerPress = (seat: typeof seats[0]) => {
    if (seat.player && onPlayerPress) {
      onPlayerPress(seat.player);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="subtitle" style={styles.title}>
          Players ({players.length}/{maxPlayers})
        </ThemedText>

        {showReadyStatus && (
          <View style={styles.readySummary}>
            <ThemedText style={styles.readySummaryText}>
              {players.filter(p => p.isReady).length} ready
            </ThemedText>
          </View>
        )}
      </View>

      <View style={styles.playerGrid}>
        {seats.map(seat => (
          <PlayerItem
            key={seat.seatNumber}
            player={seat.player}
            seatNumber={seat.seatNumber}
            isEmpty={seat.isEmpty}
            isCurrentUser={seat.isCurrentUser}
            onPress={() => handlePlayerPress(seat)}
            showReadyStatus={showReadyStatus}
            showSeatNumbers={showSeatNumbers}
          />
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendIndicator, { backgroundColor: '#27ae60' }]} />
          <ThemedText style={styles.legendText}>Verified</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendIndicator, { backgroundColor: '#f39c12' }]} />
          <ThemedText style={styles.legendText}>Pending</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendIndicator, { backgroundColor: '#e74c3c' }]} />
          <ThemedText style={styles.legendText}>Unverified</ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  readySummary: {
    backgroundColor: '#27ae60',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  readySummaryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  playerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  playerItem: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    width: '48%',
    minHeight: 100,
    position: 'relative',
  },
  emptyPlayerItem: {
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  seatNumber: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  seatNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  playerContent: {
    flex: 1,
  },
  emptyPlayerContent: {
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    alignSelf: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  defaultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  connectionIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  verificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verificationIcon: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  playerInfo: {
    alignItems: 'center',
  },
  playerName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  currentUserLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  playerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  statsText: {
    fontSize: 10,
    opacity: 0.8,
  },
  statsSeparator: {
    fontSize: 10,
    opacity: 0.6,
    marginHorizontal: 4,
  },
  readyStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readyIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  readyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyPlayerText: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    opacity: 0.8,
  },
});