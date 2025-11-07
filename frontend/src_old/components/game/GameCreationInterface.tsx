/**
 * Game Creation Interface Component
 * Allows players to create new Cockroach Poker games with custom settings
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
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useFieldValidation } from '@/hooks/use-form-validation';
import { gameService } from '@/services/gameService';
import type { CockroachPokerSettings } from '@/types/database';

interface GameCreationProps {
  onGameCreated?: (gameId: string) => void;
  onCancel?: () => void;
}

export function GameCreationInterface({ onGameCreated, onCancel }: GameCreationProps) {
  // Game settings state (simplified for Cockroach Poker)
  const [timeLimit, setTimeLimit] = useState(30);
  const [allowSpectators, setAllowSpectators] = useState(false); // Default off for 2-player game
  const [isLoading, setIsLoading] = useState(false);

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  // Validation functions for Cockroach Poker
  const validatePositiveNumber = (value: number, min: number = 1) => ({
    isValid: value >= min,
    error: value < min ? `Must be at least ${min}` : null,
  });

  // Form validation (simplified for Cockroach Poker)
  const timeLimitValidation = useFieldValidation(timeLimit, (val: number) =>
    validatePositiveNumber(val, 10) && val <= 120
      ? { isValid: true, error: null }
      : { isValid: false, error: 'Must be between 10 and 120 seconds' }
  );

  const handleCreateGame = async () => {
    // Mark all fields as touched for validation
    timeLimitValidation.markTouched();

    // Validate all fields
    const validations = [
      timeLimitValidation.validation,
    ];

    const isFormValid = validations.every(v => v.isValid);

    if (!isFormValid) {
      const firstError = validations.find(v => !v.isValid)?.error;
      Alert.alert('Validation Error', firstError || 'Please fix the errors above');
      return;
    }

    setIsLoading(true);

    try {
      const gameSettings: CockroachPokerSettings = {
        timeLimit,
        allowSpectators,
      };

      const result = await gameService.createGame({
        settings: gameSettings,
      });

      if (result.success && result.data) {
        Alert.alert(
          'Game Created!',
          'Your Cockroach Poker game has been created successfully. Waiting for another player to join.',
          [
            {
              text: 'Join Game',
              onPress: () => {
                if (onGameCreated) {
                  onGameCreated(result.data.id);
                } else {
                  router.push(`/game/lobby/${result.data.id}`);
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Game Creation Failed', result.error || 'Failed to create game');
      }
    } catch (error) {
      console.error('Game creation error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = timeLimitValidation.validation.isValid;

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
              Create Cockroach Poker Game
            </ThemedText>
            <ThemedText style={styles.subtitle}>
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
                <ThemedText style={styles.infoText}>Exactly 2 players (you + 1 opponent)</ThemedText>
              </View>

              <View style={styles.infoContainer}>
                <ThemedText style={styles.label}>Game Type</ThemedText>
                <ThemedText style={styles.infoText}>Cockroach Poker (ごきぶりポーカー)</ThemedText>
              </View>

              <View style={styles.infoContainer}>
                <ThemedText style={styles.label}>Objective</ThemedText>
                <ThemedText style={styles.infoText}>Avoid collecting 3 cards of the same creature type</ThemedText>
              </View>
            </View>

            {/* Game Settings */}
            <View style={styles.section}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Game Settings
              </ThemedText>

              {/* Time Limit */}
              <View style={styles.inputContainer}>
                <ThemedText style={styles.label}>Action Time Limit (seconds)</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      borderColor: timeLimitValidation.touched && !timeLimitValidation.validation.isValid ? '#e74c3c' : iconColor,
                      color: textColor,
                    }
                  ]}
                  value={timeLimit.toString()}
                  onChangeText={(text) => setTimeLimit(parseInt(text) || 0)}
                  onBlur={timeLimitValidation.markTouched}
                  placeholder="30"
                  placeholderTextColor={iconColor}
                  keyboardType="numeric"
                  editable={!isLoading}
                />
                {timeLimitValidation.touched && timeLimitValidation.validation.error && (
                  <ThemedText style={styles.errorText}>
                    {timeLimitValidation.validation.error}
                  </ThemedText>
                )}
              </View>

              {/* Game Options */}
              <View style={styles.switchContainer}>
                <ThemedText style={styles.switchLabel}>Allow Spectators</ThemedText>
                <Switch
                  value={allowSpectators}
                  onValueChange={setAllowSpectators}
                  trackColor={{ false: iconColor, true: tintColor }}
                  disabled={isLoading}
                />
              </View>

              <View style={styles.infoContainer}>
                <ThemedText style={styles.infoNote}>
                  ℹ️ Your game will be visible to other players looking for a match. The first player to join will become your opponent.
                </ThemedText>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[
                  styles.createButton,
                  {
                    backgroundColor: isFormValid && !isLoading ? tintColor : iconColor,
                    opacity: isFormValid && !isLoading ? 1 : 0.6,
                  }
                ]}
                onPress={handleCreateGame}
                disabled={!isFormValid || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <ThemedText style={styles.createButtonText}>
                    Create Cockroach Poker Game
                  </ThemedText>
                )}
              </TouchableOpacity>

              {onCancel && (
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: iconColor }]}
                  onPress={onCancel}
                  disabled={isLoading}
                >
                  <ThemedText style={[styles.cancelButtonText, { color: textColor }]}>
                    Cancel
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>
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
    flexGrow: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.8,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  inputContainer: {
    marginBottom: 20,
  },
  infoContainer: {
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 4,
  },
  infoNote: {
    fontSize: 14,
    opacity: 0.7,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'transparent',
  },
  numberInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberButton: {
    borderWidth: 1,
    borderRadius: 8,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  numberDisplay: {
    fontSize: 18,
    fontWeight: '600',
    marginHorizontal: 24,
    minWidth: 40,
    textAlign: 'center',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 14,
    marginTop: 4,
  },
  buttonContainer: {
    marginTop: 32,
  },
  createButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});