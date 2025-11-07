/**
 * Login Screen Component for G-Poker
 * Provides secure authentication with validation and rate limiting
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
import { useAuth } from '@/src/hooks/useAuth';
import { useFieldValidation, validateEmail } from '@/hooks/use-form-validation';

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  // Form validation
  const emailValidation = useFieldValidation(email, validateEmail, 300);
  const passwordValidation = useFieldValidation(
    password,
    (pwd: string) => ({
      isValid: pwd.length >= 8,
      error: pwd.length === 0 ? 'Password is required' : pwd.length < 8 ? 'Password must be at least 8 characters' : null,
    }),
    300
  );

  const handleSignIn = async () => {
    // Mark fields as touched for validation
    emailValidation.markTouched();
    passwordValidation.markTouched();

    // Validate form
    const emailResult = validateEmail(email);
    const passwordResult = password.length >= 8 ? { isValid: true, error: null } : { isValid: false, error: 'Password must be at least 8 characters' };

    if (!emailResult.isValid || !passwordResult.isValid) {
      Alert.alert('Validation Error', emailResult.error || passwordResult.error || 'Please fix the errors above');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn(email.trim(), password);

      if (result.success) {
        console.log('Login successful - redirecting to lobby');
        router.replace('/lobby');
      } else {
        let errorMessage = result.error || 'Login failed';

        // Handle specific error cases
        if (errorMessage.includes('rate limit') || errorMessage.includes('Too many')) {
          errorMessage = 'Too many login attempts. Please try again later.';
        } else if (errorMessage.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please try again.';
        } else if (errorMessage.includes('Email not confirmed')) {
          errorMessage = 'Please check your email and confirm your account before signing in.';
        }

        Alert.alert('Login Failed', errorMessage);
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = emailValidation.validation.isValid && passwordValidation.validation.isValid && email && password;

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
              Welcome to G-Poker
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Sign in to your account
            </ThemedText>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Email Input */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Email</ThemedText>
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
                placeholder="Enter your email"
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

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Password</ThemedText>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[
                    styles.passwordInput,
                    {
                      borderColor: passwordValidation.touched && !passwordValidation.validation.isValid ? '#e74c3c' : iconColor,
                      color: textColor,
                    }
                  ]}
                  value={password}
                  onChangeText={setPassword}
                  onBlur={passwordValidation.markTouched}
                  placeholder="Enter your password"
                  placeholderTextColor={iconColor}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.showPasswordButton}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  <ThemedText style={styles.showPasswordText}>
                    {showPassword ? 'Hide' : 'Show'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
              {passwordValidation.touched && passwordValidation.validation.error && (
                <ThemedText style={styles.errorText}>
                  {passwordValidation.validation.error}
                </ThemedText>
              )}
            </View>

            {/* Forgot Password Link */}
            <View style={styles.forgotPasswordContainer}>
              <Link href="/auth/forgot-password" asChild>
                <TouchableOpacity style={styles.forgotPasswordTouchable} disabled={isLoading}>
                  <ThemedText type="link" style={styles.forgotPasswordText}>
                    Forgot your password?
                  </ThemedText>
                </TouchableOpacity>
              </Link>
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[
                styles.signInButton,
                {
                  backgroundColor: isFormValid && !isLoading ? tintColor : iconColor,
                  opacity: isFormValid && !isLoading ? 1 : 0.6,
                }
              ]}
              onPress={handleSignIn}
              disabled={!isFormValid || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <ThemedText style={styles.signInButtonText}>
                  Sign In
                </ThemedText>
              )}
            </TouchableOpacity>

            {/* Sign Up Link */}
            <View style={styles.signUpContainer}>
              <ThemedText style={styles.signUpText}>
                Don't have an account?{' '}
              </ThemedText>
              <Link href="/auth/register" asChild>
                <TouchableOpacity style={styles.signUpLinkTouchable} disabled={isLoading}>
                  <ThemedText type="link" style={styles.signUpLink}>
                    Sign up here
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
  inputContainer: {
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
    padding: 16,
    fontSize: 16,
    backgroundColor: 'transparent',
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    paddingRight: 60,
    fontSize: 16,
    backgroundColor: 'transparent',
  },
  showPasswordButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    bottom: 16,
    justifyContent: 'center',
  },
  showPasswordText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 14,
    marginTop: 4,
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordTouchable: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    fontSize: 14,
  },
  signInButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  signUpLinkTouchable: {
    alignSelf: 'flex-start',
  },
  signUpText: {
    fontSize: 14,
  },
  signUpLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});