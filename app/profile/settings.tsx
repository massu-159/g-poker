/**
 * Profile Settings Screen
 * Game preferences, notifications, and account settings
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { profileService } from '@/services/profileService';
import type { UserSettings } from '@/services/profileService';

export default function ProfileSettingsScreen() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');
  const cardBackground = useThemeColor({ light: '#f8f9fa', dark: '#1a1a1a' }, 'background');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const result = await profileService.getUserSettings();
      setSettings(result.settings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;

    try {
      setIsSaving(true);
      const result = await profileService.updateSettings(settings);

      if (result.success) {
        Alert.alert('Success', 'Settings saved successfully');
      } else {
        Alert.alert('Error', result.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const updateGamePreference = (key: keyof UserSettings['gamePreferences'], value: any) => {
    if (!settings) return;

    setSettings(prev => ({
      ...prev!,
      gamePreferences: {
        ...prev!.gamePreferences,
        [key]: value,
      },
    }));
  };

  const updateNotificationSetting = (key: keyof UserSettings['notifications'], value: boolean) => {
    if (!settings) return;

    setSettings(prev => ({
      ...prev!,
      notifications: {
        ...prev!.notifications,
        [key]: value,
      },
    }));
  };

  const updatePrivacySetting = (key: keyof UserSettings['privacy'], value: boolean) => {
    if (!settings) return;

    setSettings(prev => ({
      ...prev!,
      privacy: {
        ...prev!.privacy,
        [key]: value,
      },
    }));
  };

  const TimeSelector = ({ value, onValueChange }: { value: number; onValueChange: (value: number) => void }) => {
    const timeOptions = [15, 30, 45, 60, 90, 120];

    return (
      <View style={styles.timeSelector}>
        {timeOptions.map((time) => (
          <TouchableOpacity
            key={time}
            style={[
              styles.timeOption,
              {
                backgroundColor: value === time ? tintColor : cardBackground,
                borderColor: value === time ? tintColor : iconColor,
              }
            ]}
            onPress={() => onValueChange(time)}
          >
            <ThemedText style={[
              styles.timeOptionText,
              { color: value === time ? 'white' : textColor }
            ]}>
              {time}s
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const SettingItem = ({
    icon,
    title,
    subtitle,
    children,
    onPress,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    children?: React.ReactNode;
    onPress?: () => void;
  }) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingLeft}>
        <IconSymbol name={icon} size={24} color={iconColor} />
        <View style={styles.settingText}>
          <ThemedText style={styles.settingTitle}>{title}</ThemedText>
          {subtitle && (
            <ThemedText style={styles.settingSubtitle}>{subtitle}</ThemedText>
          )}
        </View>
      </View>
      <View style={styles.settingRight}>
        {children}
        {onPress && (
          <IconSymbol name="chevron.right" size={16} color={iconColor} />
        )}
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <ThemedView style={styles.loadingContainer}>
          <ThemedText>Loading settings...</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <ThemedView style={[styles.header, { backgroundColor: cardBackground }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color={iconColor} />
        </TouchableOpacity>
        <ThemedText type="subtitle" style={styles.headerTitle}>
          Settings
        </ThemedText>
        <TouchableOpacity
          style={[styles.saveButton, { opacity: isSaving ? 0.6 : 1 }]}
          onPress={saveSettings}
          disabled={isSaving}
        >
          <ThemedText style={[styles.saveButtonText, { color: tintColor }]}>
            {isSaving ? 'Saving...' : 'Save'}
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>

      <ScrollView style={styles.scrollView}>
        {/* Game Preferences */}
        <ThemedView style={[styles.section, { backgroundColor: cardBackground }]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Game Preferences
          </ThemedText>

          <SettingItem
            icon="clock.fill"
            title="Preferred Time Limit"
            subtitle="Default time limit for new games"
          >
            <TimeSelector
              value={settings?.gamePreferences.preferredTimeLimit || 30}
              onValueChange={(value) => updateGamePreference('preferredTimeLimit', value)}
            />
          </SettingItem>

          <SettingItem
            icon="eye.fill"
            title="Allow Spectators"
            subtitle="Let others watch your games"
          >
            <Switch
              value={settings?.gamePreferences.allowSpectators || false}
              onValueChange={(value) => updateGamePreference('allowSpectators', value)}
              trackColor={{ false: iconColor, true: tintColor }}
              thumbColor="white"
            />
          </SettingItem>

          <SettingItem
            icon="play.circle.fill"
            title="Auto-Join Games"
            subtitle="Automatically join available games"
          >
            <Switch
              value={settings?.gamePreferences.autoJoinGames || false}
              onValueChange={(value) => updateGamePreference('autoJoinGames', value)}
              trackColor={{ false: iconColor, true: tintColor }}
              thumbColor="white"
            />
          </SettingItem>
        </ThemedView>

        {/* Audio & Haptics */}
        <ThemedView style={[styles.section, { backgroundColor: cardBackground }]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Audio & Haptics
          </ThemedText>

          <SettingItem
            icon="speaker.wave.2.fill"
            title="Sound Effects"
            subtitle="Play sounds during games"
          >
            <Switch
              value={settings?.gamePreferences.soundEnabled || false}
              onValueChange={(value) => updateGamePreference('soundEnabled', value)}
              trackColor={{ false: iconColor, true: tintColor }}
              thumbColor="white"
            />
          </SettingItem>

          <SettingItem
            icon="iphone.radiowaves.left.and.right"
            title="Haptic Feedback"
            subtitle="Vibrate on interactions"
          >
            <Switch
              value={settings?.gamePreferences.hapticFeedback || false}
              onValueChange={(value) => updateGamePreference('hapticFeedback', value)}
              trackColor={{ false: iconColor, true: tintColor }}
              thumbColor="white"
            />
          </SettingItem>

          <SettingItem
            icon="sparkles"
            title="Animations"
            subtitle="Enable card animations"
          >
            <Switch
              value={settings?.gamePreferences.animationsEnabled || false}
              onValueChange={(value) => updateGamePreference('animationsEnabled', value)}
              trackColor={{ false: iconColor, true: tintColor }}
              thumbColor="white"
            />
          </SettingItem>
        </ThemedView>

        {/* Notifications */}
        <ThemedView style={[styles.section, { backgroundColor: cardBackground }]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Notifications
          </ThemedText>

          <SettingItem
            icon="envelope.fill"
            title="Game Invites"
            subtitle="Notifications for game invitations"
          >
            <Switch
              value={settings?.notifications.gameInvites || false}
              onValueChange={(value) => updateNotificationSetting('gameInvites', value)}
              trackColor={{ false: iconColor, true: tintColor }}
              thumbColor="white"
            />
          </SettingItem>

          <SettingItem
            icon="bell.fill"
            title="Turn Reminders"
            subtitle="Reminders when it's your turn"
          >
            <Switch
              value={settings?.notifications.turnReminders || false}
              onValueChange={(value) => updateNotificationSetting('turnReminders', value)}
              trackColor={{ false: iconColor, true: tintColor }}
              thumbColor="white"
            />
          </SettingItem>

          <SettingItem
            icon="trophy.fill"
            title="Game Results"
            subtitle="Notifications for game outcomes"
          >
            <Switch
              value={settings?.notifications.gameResults || false}
              onValueChange={(value) => updateNotificationSetting('gameResults', value)}
              trackColor={{ false: iconColor, true: tintColor }}
              thumbColor="white"
            />
          </SettingItem>

          <SettingItem
            icon="star.fill"
            title="Achievements"
            subtitle="Notifications for achievements"
          >
            <Switch
              value={settings?.notifications.achievements || false}
              onValueChange={(value) => updateNotificationSetting('achievements', value)}
              trackColor={{ false: iconColor, true: tintColor }}
              thumbColor="white"
            />
          </SettingItem>

          <SettingItem
            icon="megaphone.fill"
            title="Marketing"
            subtitle="News and promotional messages"
          >
            <Switch
              value={settings?.notifications.marketing || false}
              onValueChange={(value) => updateNotificationSetting('marketing', value)}
              trackColor={{ false: iconColor, true: tintColor }}
              thumbColor="white"
            />
          </SettingItem>
        </ThemedView>

        {/* Privacy */}
        <ThemedView style={[styles.section, { backgroundColor: cardBackground }]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Privacy
          </ThemedText>

          <SettingItem
            icon="circle.fill"
            title="Show Online Status"
            subtitle="Let others see when you're online"
          >
            <Switch
              value={settings?.privacy.showOnlineStatus || false}
              onValueChange={(value) => updatePrivacySetting('showOnlineStatus', value)}
              trackColor={{ false: iconColor, true: tintColor }}
              thumbColor="white"
            />
          </SettingItem>

          <SettingItem
            icon="person.badge.plus.fill"
            title="Allow Friend Requests"
            subtitle="Let others send you friend requests"
          >
            <Switch
              value={settings?.privacy.allowFriendRequests || false}
              onValueChange={(value) => updatePrivacySetting('allowFriendRequests', value)}
              trackColor={{ false: iconColor, true: tintColor }}
              thumbColor="white"
            />
          </SettingItem>

          <SettingItem
            icon="chart.bar.fill"
            title="Show Statistics"
            subtitle="Make your statistics visible to others"
          >
            <Switch
              value={settings?.privacy.showStatistics || false}
              onValueChange={(value) => updatePrivacySetting('showStatistics', value)}
              trackColor={{ false: iconColor, true: tintColor }}
              thumbColor="white"
            />
          </SettingItem>
        </ThemedView>

        {/* Account Actions */}
        <ThemedView style={[styles.section, { backgroundColor: cardBackground }]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Account
          </ThemedText>

          <SettingItem
            icon="key.fill"
            title="Change Password"
            subtitle="Update your account password"
            onPress={() => {
              Alert.alert(
                'Change Password',
                'Password changes are handled through the authentication system. Please use the forgot password feature on the login screen.'
              );
            }}
          />

          <SettingItem
            icon="arrow.down.circle.fill"
            title="Export Data"
            subtitle="Download your game data"
            onPress={() => {
              Alert.alert(
                'Export Data',
                'This feature will be available soon. You will be able to export your game history and statistics.'
              );
            }}
          />

          <SettingItem
            icon="trash.fill"
            title="Delete Account"
            subtitle="Permanently delete your account"
            onPress={() => {
              Alert.alert(
                'Delete Account',
                'Are you sure you want to permanently delete your account? This action cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      Alert.alert(
                        'Account Deletion',
                        'Account deletion is currently handled by our support team. Please contact support for assistance.'
                      );
                    },
                  },
                ]
              );
            }}
          />
        </ThemedView>

        {/* App Info */}
        <ThemedView style={[styles.section, { backgroundColor: cardBackground }]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            About
          </ThemedText>

          <SettingItem
            icon="info.circle.fill"
            title="App Version"
            subtitle="1.0.0"
          />

          <SettingItem
            icon="book.fill"
            title="Privacy Policy"
            onPress={() => {
              Alert.alert('Privacy Policy', 'Privacy policy will be available soon.');
            }}
          />

          <SettingItem
            icon="doc.text.fill"
            title="Terms of Service"
            onPress={() => {
              Alert.alert('Terms of Service', 'Terms of service will be available soon.');
            }}
          />
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    padding: 8,
    minWidth: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  saveButton: {
    padding: 8,
    minWidth: 60,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    margin: 16,
    borderRadius: 12,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 8,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 8,
  },
  timeOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  timeOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
});