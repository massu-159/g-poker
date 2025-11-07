/**
 * Profile Edit Screen
 * Form interface for editing user profile information
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/src/hooks/useAuth';
import { profileService } from '@/services/profileService';
import type { PublicProfile } from '@/services/profileService';

interface FormData {
  displayName: string;
  avatarUrl: string;
}

interface FormErrors {
  displayName?: string;
  avatarUrl?: string;
}

export default function ProfileEditScreen() {
  const { authState } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [formData, setFormData] = useState<FormData>({
    displayName: '',
    avatarUrl: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');
  const cardBackground = useThemeColor({ light: '#f8f9fa', dark: '#1a1a1a' }, 'background');
  const inputBackground = useThemeColor({ light: '#ffffff', dark: '#2a2a2a' }, 'background');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const result = await profileService.getCurrentProfile();

      if (result.profile) {
        setProfile(result.profile);
        setFormData({
          displayName: result.profile.display_name || '',
          avatarUrl: result.profile.avatar_url || '',
        });
      } else if (result.error) {
        Alert.alert('Error', result.error);
        router.back();
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      Alert.alert('Error', 'Failed to load profile');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validate display name
    const displayNameValidation = profileService.validateDisplayName(formData.displayName);
    if (!displayNameValidation.valid) {
      newErrors.displayName = displayNameValidation.error;
    }

    // Validate avatar URL (basic check)
    if (formData.avatarUrl && !isValidUrl(formData.avatarUrl)) {
      newErrors.avatarUrl = 'Please enter a valid URL';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (string: string): boolean => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsSaving(true);

      const updates: any = {};

      // Check what has changed
      if (formData.displayName !== profile?.display_name) {
        updates.display_name = formData.displayName;
      }

      if (formData.avatarUrl !== profile?.avatar_url) {
        updates.avatar_url = formData.avatarUrl || null;
      }

      // Only update if there are changes
      if (Object.keys(updates).length === 0) {
        Alert.alert('No Changes', 'No changes were made to your profile.');
        router.back();
        return;
      }

      const result = await profileService.updateProfile(updates);

      if (result.success) {
        Alert.alert(
          'Success',
          'Your profile has been updated successfully.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Check if there are unsaved changes
    const hasChanges =
      formData.displayName !== (profile?.display_name || '') ||
      formData.avatarUrl !== (profile?.avatar_url || '');

    if (hasChanges) {
      Alert.alert(
        'Discard Changes',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  const handleAvatarChange = () => {
    Alert.alert(
      'Avatar Options',
      'Choose how you would like to update your avatar',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Enter URL', onPress: promptForAvatarUrl },
        { text: 'Remove Avatar', style: 'destructive', onPress: () => setFormData(prev => ({ ...prev, avatarUrl: '' })) },
      ]
    );
  };

  const promptForAvatarUrl = () => {
    Alert.prompt(
      'Avatar URL',
      'Enter the URL of your avatar image',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: (url) => {
            if (url) {
              setFormData(prev => ({ ...prev, avatarUrl: url }));
            }
          },
        },
      ],
      'plain-text',
      formData.avatarUrl
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <ThemedView style={styles.loadingContainer}>
          <ThemedText>Loading profile...</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <ThemedView style={[styles.header, { backgroundColor: cardBackground }]}>
          <TouchableOpacity style={styles.headerButton} onPress={handleCancel}>
            <IconSymbol name="xmark" size={24} color={iconColor} />
          </TouchableOpacity>

          <ThemedText type="subtitle" style={styles.headerTitle}>
            Edit Profile
          </ThemedText>

          <TouchableOpacity
            style={[styles.headerButton, { opacity: isSaving ? 0.6 : 1 }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <ThemedText style={[styles.saveButtonText, { color: tintColor }]}>
              {isSaving ? 'Saving...' : 'Save'}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
          {/* Avatar Section */}
          <ThemedView style={[styles.section, { backgroundColor: cardBackground }]}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Profile Picture
            </ThemedText>

            <View style={styles.avatarSection}>
              <TouchableOpacity style={styles.avatarContainer} onPress={handleAvatarChange}>
                {formData.avatarUrl ? (
                  <Image source={{ uri: formData.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: tintColor }]}>
                    <ThemedText style={styles.avatarText}>
                      {formData.displayName?.charAt(0).toUpperCase() || 'U'}
                    </ThemedText>
                  </View>
                )}

                <View style={[styles.avatarEditBadge, { backgroundColor: tintColor }]}>
                  <IconSymbol name="pencil" size={12} color="white" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.changeAvatarButton} onPress={handleAvatarChange}>
                <ThemedText style={[styles.changeAvatarText, { color: tintColor }]}>
                  Change Photo
                </ThemedText>
              </TouchableOpacity>
            </View>

            {errors.avatarUrl && (
              <ThemedText style={styles.errorText}>{errors.avatarUrl}</ThemedText>
            )}
          </ThemedView>

          {/* Profile Information */}
          <ThemedView style={[styles.section, { backgroundColor: cardBackground }]}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Profile Information
            </ThemedText>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Display Name</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: inputBackground, color: textColor, borderColor: errors.displayName ? '#e74c3c' : iconColor }
                ]}
                value={formData.displayName}
                onChangeText={(text) => {
                  setFormData(prev => ({ ...prev, displayName: text }));
                  if (errors.displayName) {
                    setErrors(prev => ({ ...prev, displayName: undefined }));
                  }
                }}
                placeholder="Enter your display name"
                placeholderTextColor={iconColor}
                maxLength={20}
                autoCapitalize="words"
                autoCorrect={false}
              />
              {errors.displayName && (
                <ThemedText style={styles.errorText}>{errors.displayName}</ThemedText>
              )}
              <ThemedText style={styles.helperText}>
                This is how other players will see your name
              </ThemedText>
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Email</ThemedText>
              <View style={[styles.input, styles.disabledInput, { backgroundColor: inputBackground, borderColor: iconColor }]}>
                <ThemedText style={[styles.disabledText, { color: iconColor }]}>
                  {authState.user?.email || 'No email'}
                </ThemedText>
              </View>
              <ThemedText style={styles.helperText}>
                Email cannot be changed here
              </ThemedText>
            </View>
          </ThemedView>

          {/* Account Status */}
          <ThemedView style={[styles.section, { backgroundColor: cardBackground }]}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Account Status
            </ThemedText>

            <View style={styles.statusItem}>
              <View style={styles.statusLeft}>
                <IconSymbol
                  name={profile?.verification_status === 'verified' ? 'checkmark.seal.fill' : 'person.fill'}
                  size={24}
                  color={profile?.verification_status === 'verified' ? '#27ae60' : iconColor}
                />
                <View>
                  <ThemedText style={styles.statusLabel}>Verification Status</ThemedText>
                  <ThemedText style={[
                    styles.statusValue,
                    { color: profile?.verification_status === 'verified' ? '#27ae60' : iconColor }
                  ]}>
                    {profile?.verification_status === 'verified' ? 'Verified' :
                     profile?.verification_status === 'pending' ? 'Pending' : 'Unverified'}
                  </ThemedText>
                </View>
              </View>

              {profile?.verification_status !== 'verified' && profile?.verification_status !== 'pending' && (
                <TouchableOpacity
                  style={[styles.verifyButton, { borderColor: tintColor }]}
                  onPress={() => {
                    Alert.alert(
                      'Request Verification',
                      'Verification helps other players trust you and gives you access to special features. Request verification now?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Request',
                          onPress: async () => {
                            const result = await profileService.requestVerification();
                            if (result.success) {
                              Alert.alert('Success', 'Verification request submitted!');
                              loadProfile(); // Reload to show pending status
                            } else {
                              Alert.alert('Error', result.error || 'Failed to request verification');
                            }
                          },
                        },
                      ]
                    );
                  }}
                >
                  <ThemedText style={[styles.verifyButtonText, { color: tintColor }]}>
                    Request Verification
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
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
  headerButton: {
    padding: 8,
    minWidth: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
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
  avatarSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  changeAvatarButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  changeAvatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 48,
  },
  disabledInput: {
    opacity: 0.6,
  },
  disabledText: {
    fontSize: 16,
  },
  helperText: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginTop: 4,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 14,
    marginTop: 2,
  },
  verifyButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  verifyButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});