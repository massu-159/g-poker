/**
 * Forgot Password Screen Component for G-Poker
 * Provides secure password reset functionality
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
import { Link, router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/use-auth';
import { useFieldValidation, validateEmail } from '@/hooks/use-form-validation';

export function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  // Form validation
  const emailValidation = useFieldValidation(email, validateEmail, 300);

  const handleResetPassword = async () => {
    // Mark field as touched for validation
    emailValidation.markTouched();

    // Validate email
    const emailResult = validateEmail(email);

    if (!emailResult.isValid) {
      Alert.alert('Validation Error', emailResult.error || 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const result = await resetPassword(email.trim());

      if (result.success) {
        setIsSuccess(true);
        Alert.alert(
          'Password Reset Sent',
          'Please check your email for instructions to reset your password.',
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        let errorMessage = result.error || 'Password reset failed';

        // Handle specific error cases
        if (errorMessage.includes('rate limit') || errorMessage.includes('Too many')) {
          errorMessage = 'Too many reset attempts. Please try again later.';
        } else if (errorMessage.includes('not found')) {
          errorMessage = 'No account found with this email address.';
        }

        Alert.alert('Reset Failed', errorMessage);
      }
    } catch (error) {
      console.error('Password reset error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = emailValidation.validation.isValid && email;

  if (isSuccess) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.successContainer}>
          <ThemedText type="title" style={styles.successTitle}>
            Check Your Email
          </ThemedText>
          <ThemedText style={styles.successMessage}>
            We've sent password reset instructions to {email}
          </ThemedText>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: tintColor }]}
            onPress={() => router.back()}
          >
            <ThemedText style={[styles.buttonText, { color: backgroundColor }]}>
              Back to Login
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Reset Password
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Enter your email address and we'll send you instructions to reset your password
            </ThemedText>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Email Input */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Email Address</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: emailValidation.touched && !emailValidation.validation.isValid ? '#e74c3c' : iconColor,
                    color: textColor,
                  }
                ]}
                value={email}
                onChangeText={setEmail}
                onBlur={emailValidation.markTouched}
                placeholder="Enter your email address"
                placeholderTextColor={iconColor}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              {emailValidation.touched && emailValidation.validation.error && (
                <ThemedText style={styles.errorText}>
                  {emailValidation.validation.error}
                </ThemedText>
              )}
            </View>

            {/* Reset Button */}
            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: isFormValid && !isLoading ? tintColor : iconColor,
                  opacity: isFormValid && !isLoading ? 1 : 0.6,
                }
              ]}
              onPress={handleResetPassword}
              disabled={!isFormValid || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <ThemedText style={[styles.buttonText, { color: backgroundColor }]}>
                  Send Reset Instructions
                </ThemedText>
              )}
            </TouchableOpacity>

            {/* Back to Login */}
            <View style={styles.backContainer}>
              <ThemedText style={styles.backText}>
                Remember your password?{' '}
              </ThemedText>
              <Link href="/auth/login" asChild>
                <TouchableOpacity disabled={isLoading}>
                  <ThemedText type="link" style={styles.backLink}>
                    Back to Login
                  </ThemedText>
                </TouchableOpacity>
              </Link>
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
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 22,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  inputContainer: {
    marginBottom: 24,
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
  errorText: {
    color: '#e74c3c',
    fontSize: 14,
    marginTop: 4,
  },
  button: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  backContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 14,
  },
  backLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successTitle: {
    marginBottom: 16,
    textAlign: 'center',
  },
  successMessage: {
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 22,
    marginBottom: 32,
  },
});