/**
 * Room List Component
 * Displays available rooms with real-time updates via Socket.io
 * Uses ApiClient for data fetching and SocketClient for real-time sync
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { apiClient, Room } from '@/src/services/ApiClient';
import { socketClient } from '@/src/services/SocketClient';

interface RoomListProps {
  onRoomJoined?: (roomId: string) => void;
  onCreateRoom?: () => void;
}

interface RoomListItem extends Room {
  canJoin: boolean;
  isFull: boolean;
}

export function RoomList({ onRoomJoined, onCreateRoom }: RoomListProps) {
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  /**
   * Load rooms from API
   */
  const loadRooms = useCallback(async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) {
      setIsLoading(true);
    }

    try {
      console.log('[RoomList] Loading rooms...');

      const response = await apiClient.listRooms({
        status: 'waiting',
        limit: 50,
      });

      if (response.success && response.data) {
        const roomListItems: RoomListItem[] = response.data.map(room => ({
          ...room,
          canJoin: room.status === 'waiting' && room.currentPlayerCount < room.maxPlayers,
          isFull: room.currentPlayerCount >= room.maxPlayers,
        }));

        setRooms(roomListItems);
        console.log('[RoomList] Loaded rooms:', roomListItems.length);
      } else {
        console.error('[RoomList] Failed to load rooms:', response.error);
        Alert.alert('Error', response.error || 'Failed to load rooms');
      }
    } catch (error) {
      console.error('[RoomList] Load rooms error:', error);
      Alert.alert('Error', 'Failed to load rooms');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadRooms(false);
  }, [loadRooms]);

  /**
   * Join room via API + Socket.io
   */
  const handleJoinRoom = async (roomId: string) => {
    setJoiningRoomId(roomId);

    try {
      console.log('[RoomList] Joining room:', roomId);

      // Step 1: Join via REST API
      const response = await apiClient.joinRoom(roomId);

      if (response.success) {
        console.log('[RoomList] Successfully joined room via API');

        // Step 2: Join via Socket.io
        if (socketClient.isConnected()) {
          socketClient.joinRoom(roomId);
        }

        Alert.alert(
          'Joined Room!',
          'You have successfully joined the room.',
          [
            {
              text: 'Go to Room',
              onPress: () => {
                if (onRoomJoined) {
                  onRoomJoined(roomId);
                } else {
                  router.push(`/game/lobby/${roomId}`);
                }
              },
            },
          ]
        );
      } else {
        console.error('[RoomList] Failed to join room:', response.error);
        Alert.alert('Join Failed', response.error || 'Failed to join room');
      }
    } catch (error) {
      console.error('[RoomList] Join room error:', error);
      Alert.alert('Error', 'Failed to join room');
    } finally {
      setJoiningRoomId(null);
    }
  };

  /**
   * Get status color
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting':
        return '#27ae60'; // Green
      case 'in_progress':
        return '#f39c12'; // Orange
      case 'completed':
        return '#95a5a6'; // Gray
      default:
        return iconColor;
    }
  };

  /**
   * Get status text
   */
  const getStatusText = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'Waiting for Players';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      default:
        return status;
    }
  };

  /**
   * Filter rooms by search text
   */
  const filteredRooms = rooms.filter(room => {
    if (!searchText) return true;

    const searchLower = searchText.toLowerCase();
    const statusText = getStatusText(room.status).toLowerCase();

    const searchableTerms = [
      statusText,
      'cockroach poker',
      'ごきぶりポーカー',
      '2 player',
    ].join(' ').toLowerCase();

    return searchableTerms.includes(searchLower);
  });

  /**
   * Setup Socket.io event listeners for real-time updates
   */
  useEffect(() => {
    // Listen for room updates
    const unsubscribeParticipantJoined = socketClient.on('participant_joined', (data) => {
      console.log('[RoomList] Participant joined:', data.room_id);
      // Refresh room list to show updated player count
      loadRooms(false);
    });

    const unsubscribeParticipantLeft = socketClient.on('participant_left', (data) => {
      console.log('[RoomList] Participant left:', data.room_id);
      // Refresh room list to show updated player count
      loadRooms(false);
    });

    return () => {
      unsubscribeParticipantJoined();
      unsubscribeParticipantLeft();
    };
  }, [loadRooms]);

  /**
   * Load rooms on mount
   */
  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  /**
   * Render room item
   */
  const renderRoomItem = ({ item }: { item: RoomListItem }) => {
    const isJoining = joiningRoomId === item.id;

    return (
      <TouchableOpacity
        style={[styles.roomItem, { borderColor: iconColor }]}
        onPress={() => item.canJoin ? handleJoinRoom(item.id) : undefined}
        disabled={!item.canJoin || isJoining}
      >
        <View style={styles.roomHeader}>
          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: getStatusColor(item.status) }
              ]}
            />
            <ThemedText style={[styles.statusText, { color: textColor }]}>
              {getStatusText(item.status)}
            </ThemedText>
          </View>

          {item.canJoin && !isJoining && (
            <View style={[styles.joinBadge, { backgroundColor: tintColor }]}>
              <ThemedText style={styles.joinBadgeText}>
                Available
              </ThemedText>
            </View>
          )}

          {isJoining && (
            <ActivityIndicator size="small" color={tintColor} />
          )}
        </View>

        <View style={styles.roomBody}>
          <ThemedText type="defaultSemiBold" style={{ color: textColor }}>
            🪳🐭🦇🐸 Cockroach Poker (ごきぶりポーカー)
          </ThemedText>

          <View style={styles.roomInfo}>
            <ThemedText style={[styles.roomInfoText, { color: iconColor }]}>
              Players: {item.currentPlayerCount} / {item.maxPlayers}
            </ThemedText>
            <ThemedText style={[styles.roomInfoText, { color: iconColor }]}>
              Time Limit: {item.settings.timeLimitSeconds}s
            </ThemedText>
          </View>

          {item.isFull && (
            <ThemedText style={[styles.fullText, { color: '#e74c3c' }]}>
              Room Full
            </ThemedText>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  /**
   * Render empty state
   */
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <ThemedText type="subtitle" style={[styles.emptyTitle, { color: textColor }]}>
        No Rooms Available
      </ThemedText>
      <ThemedText style={[styles.emptyText, { color: iconColor }]}>
        Be the first to create a new game room!
      </ThemedText>
      {onCreateRoom && (
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: tintColor }]}
          onPress={onCreateRoom}
        >
          <ThemedText style={styles.createButtonText}>
            Create Room
          </ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={[
            styles.searchInput,
            {
              borderColor: iconColor,
              color: textColor,
              backgroundColor: backgroundColor,
            }
          ]}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search rooms..."
          placeholderTextColor={iconColor}
        />
      </View>

      {/* Room List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tintColor} />
          <ThemedText style={[styles.loadingText, { color: iconColor }]}>
            Loading rooms...
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={filteredRooms}
          renderItem={renderRoomItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={tintColor}
            />
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
  },
  searchInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  roomItem: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  joinBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  joinBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  roomBody: {
    gap: 8,
  },
  roomInfo: {
    flexDirection: 'row',
    gap: 16,
  },
  roomInfoText: {
    fontSize: 13,
  },
  fullText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
