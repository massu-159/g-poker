/**
 * Room Creation Component
 * Allows players to create new game rooms
 * Uses ApiClient to create rooms on server
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { apiClient } from '@/src/services/ApiClient';
import { socketClient } from '@/src/services/SocketClient';

interface RoomCreationProps {
  onRoomCreated?: (roomId: string) => void;
  onCancel?: () => void;
}

export function RoomCreation({ onRoomCreated, onCancel }: RoomCreationProps) {
  // Room settings state
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(30);
  const [isLoading, setIsLoading] = useState(false);

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  /**
   * Validate time limit
   */
  const isTimeLimitValid = timeLimitSeconds >= 10 && timeLimitSeconds <= 120;

  /**
   * Handle create room
   */
  const handleCreateRoom = async () => {
    // Validate form
    if (!isTimeLimitValid) {
      Alert.alert('Validation Error', 'Time limit must be between 10 and 120 seconds');
      return;
    }

    setIsLoading(true);

    try {
      console.log('[RoomCreation] Creating room...');

      // Create room via API
      const response = await apiClient.createRoom({
        timeLimitSeconds,
      });

      if (response.success && response.data) {
        const roomId = response.data.id;
        console.log('[RoomCreation] Room created successfully:', roomId);

        // Join the room via Socket.io
        if (socketClient.isConnected()) {
          socketClient.joinRoom(roomId);
        }

        Alert.alert(
          'Room Created!',
          'Your Cockroach Poker room has been created successfully. Waiting for another player to join.',
          [
            {
              text: 'Go to Room',
              onPress: () => {
                if (onRoomCreated) {
                  onRoomCreated(roomId);
                } else {
                  router.push(`/game/lobby/${roomId}`);
                }
              },
            },
          ]
        );
      } else {
        console.error('[RoomCreation] Failed to create room:', response.error);
        Alert.alert('Room Creation Failed', response.error || 'Failed to create room');
      }
    } catch (error) {
      console.error('[RoomCreation] Create room error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Time limit presets
   */
  const timeLimitPresets = [
    { label: '10s', value: 10 },
    { label: '20s', value: 20 },
    { label: '30s', value: 30 },
    { label: '60s', value: 60 },
    { label: '90s', value: 90 },
  ];

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Create Cockroach Poker Room
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: iconColor }]}>
              Configure your ごきぶりポーカー game settings
            </ThemedText>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Game Information */}
            <View style={styles.section}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Game Information
              </ThemedText>

              {/* Players Info */}
              <View style={styles.infoContainer}>
                <ThemedText style={styles.label}>Players</ThemedText>
                <ThemedText style={[styles.infoText, { color: iconColor }]}>
                  Exactly 2 players (you + 1 opponent)
                </ThemedText>
              </View>

              {/* Game Type Info */}
              <View style={styles.infoContainer}>
                <ThemedText style={styles.label}>Game Type</ThemedText>
                <ThemedText style={[styles.infoText, { color: iconColor }]}>
                  🪳🐭🦇🐸 Cockroach Poker (ごきぶりポーカー)
                </ThemedText>
              </View>
            </View>

            {/* Time Limit Setting */}
            <View style={styles.section}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Time Limit per Turn
              </ThemedText>

              <ThemedText style={[styles.label, { marginBottom: 8 }]}>
                Select Time Limit (seconds)
              </ThemedText>

              {/* Preset Buttons */}
              <View style={styles.presetsContainer}>
                {timeLimitPresets.map((preset) => (
                  <TouchableOpacity
                    key={preset.value}
                    style={[
                      styles.presetButton,
                      {
                        borderColor: tintColor,
                        backgroundColor: timeLimitSeconds === preset.value ? tintColor : 'transparent',
                      }
                    ]}
                    onPress={() => setTimeLimitSeconds(preset.value)}
                  >
                    <ThemedText
                      style={[
                        styles.presetButtonText,
                        {
                          color: timeLimitSeconds === preset.value ? '#fff' : tintColor,
                        }
                      ]}
                    >
                      {preset.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom Time Input */}
              <View style={styles.customInputContainer}>
                <ThemedText style={styles.label}>Custom Time Limit</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      borderColor: !isTimeLimitValid ? '#e74c3c' : iconColor,
                      color: textColor,
                      backgroundColor: backgroundColor,
                    }
                  ]}
                  value={String(timeLimitSeconds)}
                  onChangeText={(text) => {
                    const value = parseInt(text) || 10;
                    setTimeLimitSeconds(value);
                  }}
                  keyboardType="number-pad"
                  placeholder="Enter seconds (10-120)"
                  placeholderTextColor={iconColor}
                />
                {!isTimeLimitValid && (
                  <ThemedText style={styles.errorText}>
                    Must be between 10 and 120 seconds
                  </ThemedText>
                )}
              </View>
            </View>

            {/* Game Rules Info */}
            <View style={styles.section}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Game Rules
              </ThemedText>
              <ThemedText style={[styles.rulesText, { color: iconColor }]}>
                • 2 players take turns passing cards{'\n'}
                • Claim what creature is on the card (truth or lie){'\n'}
                • Opponent can accept, challenge, or pass{'\n'}
                • Wrong guesses result in penalty cards{'\n'}
                • Collect 4 penalty cards of any type = you lose
              </ThemedText>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { borderColor: iconColor }]}
              onPress={onCancel}
              disabled={isLoading}
            >
              <ThemedText style={[styles.cancelButtonText, { color: textColor }]}>
                Cancel
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.createButton,
                {
                  backgroundColor: isTimeLimitValid && !isLoading ? tintColor : '#95a5a6',
                }
              ]}
              onPress={handleCreateRoom}
              disabled={!isTimeLimitValid || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.createButtonText}>
                  Create Room
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
  },
  form: {
    gap: 24,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 4,
  },
  infoContainer: {
    gap: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
  },
  presetButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  customInputContainer: {
    marginTop: 8,
    gap: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  errorText: {
    fontSize: 12,
    color: '#e74c3c',
  },
  rulesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {},
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
