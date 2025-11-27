/**
 * Registration Screen Component for G-Poker
 * Provides secure user registration with validation and verification
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
import {
  useFieldValidation,
  usePasswordValidation,
  validateEmail,
  validateDisplayName,
  validateUsername,
  validatePasswordConfirmation,
} from '@/hooks/use-form-validation';

export function RegisterScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  // Form validation
  const emailValidation = useFieldValidation(email, validateEmail, 300);
  const displayNameValidation = useFieldValidation(displayName, validateDisplayName, 300);
  const usernameValidation = useFieldValidation(username, validateUsername, 300);
  const passwordValidation = usePasswordValidation(password, 300);
  const confirmPasswordValidation = useFieldValidation(
    confirmPassword,
    (confirm: string) => validatePasswordConfirmation(password, confirm),
    300
  );

  const getPasswordStrengthColor = (score: number) => {
    switch (score) {
      case 0:
      case 1:
        return '#e74c3c'; // Red
      case 2:
        return '#f39c12'; // Orange
      case 3:
        return '#f1c40f'; // Yellow
      case 4:
        return '#27ae60'; // Green
      default:
        return iconColor;
    }
  };

  const getPasswordStrengthText = (score: number) => {
    switch (score) {
      case 0:
      case 1:
        return 'Weak';
      case 2:
        return 'Fair';
      case 3:
        return 'Good';
      case 4:
        return 'Strong';
      default:
        return '';
    }
  };

  const handleSignUp = async () => {
    // Mark fields as touched for validation
    emailValidation.markTouched();
    displayNameValidation.markTouched();
    usernameValidation.markTouched();
    passwordValidation.markTouched();
    confirmPasswordValidation.markTouched();

    // Validate form
    const emailResult = validateEmail(email);
    const displayNameResult = validateDisplayName(displayName);
    const usernameResult = validateUsername(username);
    const passwordResult = passwordValidation.strength;
    const confirmPasswordResult = validatePasswordConfirmation(password, confirmPassword);

    if (!emailResult.isValid) {
      Alert.alert('Validation Error', emailResult.error);
      return;
    }

    if (!displayNameResult.isValid) {
      Alert.alert('Validation Error', displayNameResult.error);
      return;
    }

    if (!usernameResult.isValid) {
      Alert.alert('Validation Error', usernameResult.error);
      return;
    }

    if (!passwordResult.isValid) {
      Alert.alert('Password Requirements', passwordResult.feedback.join('\n'));
      return;
    }

    if (!confirmPasswordResult.isValid) {
      Alert.alert('Validation Error', confirmPasswordResult.error);
      return;
    }

    if (!acceptedTerms) {
      Alert.alert('Terms of Service', 'Please accept the Terms of Service to continue.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signUp(email.trim(), password, displayName.trim(), username.trim());

      if (result.success) {
        Alert.alert(
          'Registration Successful',
          'Please check your email and click the verification link to complete your registration.',
          [
            {
              text: 'OK',
              onPress: () => router.push('/auth/login'),
            },
          ]
        );
      } else {
        let errorMessage = result.error || 'Registration failed';

        // Handle specific error cases
        if (errorMessage.includes('already registered') || errorMessage.includes('already exists')) {
          errorMessage = 'An account with this email already exists. Please try signing in instead.';
        } else if (errorMessage.includes('weak password')) {
          errorMessage = 'Password is too weak. Please choose a stronger password.';
        } else if (errorMessage.includes('invalid email')) {
          errorMessage = 'Please enter a valid email address.';
        }

        Alert.alert('Registration Failed', errorMessage);
      }
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid =
    emailValidation.validation.isValid &&
    displayNameValidation.validation.isValid &&
    usernameValidation.validation.isValid &&
    passwordValidation.strength.isValid &&
    confirmPasswordValidation.validation.isValid &&
    acceptedTerms &&
    email &&
    displayName &&
    username &&
    password &&
    confirmPassword;

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
              Join G-Poker
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Create your account to start playing
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

            {/* Display Name Input */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Display Name</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: displayNameValidation.touched && !displayNameValidation.validation.isValid ? '#e74c3c' : iconColor,
                    color: textColor,
                  }
                ]}
                value={displayName}
                onChangeText={setDisplayName}
                onBlur={displayNameValidation.markTouched}
                placeholder="Choose a display name (3-20 characters)"
                placeholderTextColor={iconColor}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!isLoading}
                maxLength={20}
              />
              {displayNameValidation.touched && displayNameValidation.validation.error && (
                <ThemedText style={styles.errorText}>
                  {displayNameValidation.validation.error}
                </ThemedText>
              )}
            </View>

            {/* Username Input */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Username</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: usernameValidation.touched && !usernameValidation.validation.isValid ? '#e74c3c' : iconColor,
                    color: textColor,
                  }
                ]}
                value={username}
                onChangeText={setUsername}
                onBlur={usernameValidation.markTouched}
                placeholder="Choose a username (3-30 characters, alphanumeric + _)"
                placeholderTextColor={iconColor}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                maxLength={30}
              />
              {usernameValidation.touched && usernameValidation.validation.error && (
                <ThemedText style={styles.errorText}>
                  {usernameValidation.validation.error}
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
                      borderColor: passwordValidation.touched && !passwordValidation.strength.isValid ? '#e74c3c' : iconColor,
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

              {/* Password Strength Indicator */}
              {passwordValidation.touched && password.length > 0 && (
                <View style={styles.passwordStrengthContainer}>
                  <View style={styles.passwordStrengthBar}>
                    <View
                      style={[
                        styles.passwordStrengthFill,
                        {
                          width: `${(passwordValidation.strength.score / 4) * 100}%`,
                          backgroundColor: getPasswordStrengthColor(passwordValidation.strength.score),
                        }
                      ]}
                    />
                  </View>
                  <ThemedText
                    style={[
                      styles.passwordStrengthText,
                      { color: getPasswordStrengthColor(passwordValidation.strength.score) }
                    ]}
                  >
                    {getPasswordStrengthText(passwordValidation.strength.score)}
                  </ThemedText>
                </View>
              )}

              {passwordValidation.touched && passwordValidation.strength.feedback.length > 0 && (
                <View style={styles.passwordFeedback}>
                  {passwordValidation.strength.feedback.map((feedback, index) => (
                    <ThemedText key={index} style={styles.feedbackText}>
                      • {feedback}
                    </ThemedText>
                  ))}
                </View>
              )}
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Confirm Password</ThemedText>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[
                    styles.passwordInput,
                    {
                      borderColor: confirmPasswordValidation.touched && !confirmPasswordValidation.validation.isValid ? '#e74c3c' : iconColor,
                      color: textColor,
                    }
                  ]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onBlur={confirmPasswordValidation.markTouched}
                  placeholder="Confirm your password"
                  placeholderTextColor={iconColor}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.showPasswordButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}
                >
                  <ThemedText style={styles.showPasswordText}>
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
              {confirmPasswordValidation.touched && confirmPasswordValidation.validation.error && (
                <ThemedText style={styles.errorText}>
                  {confirmPasswordValidation.validation.error}
                </ThemedText>
              )}
            </View>

            {/* Terms of Service */}
            <View style={styles.termsContainer}>
              <TouchableOpacity
                style={styles.checkboxTouchable}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
                disabled={isLoading}
              >
                <View style={[styles.checkbox, { borderColor: iconColor }]}>
                  {acceptedTerms && (
                    <View style={[styles.checkboxFill, { backgroundColor: tintColor }]} />
                  )}
                </View>
              </TouchableOpacity>
              <View style={styles.termsText}>
                <ThemedText style={styles.termsTextContent}>
                  I agree to the{' '}
                  <ThemedText
                    type="link"
                    style={styles.termsLink}
                    onPress={() => {
                      // Navigate to terms - implement as needed
                      console.log('Navigate to Terms of Service');
                    }}
                  >
                    Terms of Service
                  </ThemedText>
                  {' '}and{' '}
                  <ThemedText
                    type="link"
                    style={styles.termsLink}
                    onPress={() => {
                      // Navigate to privacy - implement as needed
                      console.log('Navigate to Privacy Policy');
                    }}
                  >
                    Privacy Policy
                  </ThemedText>
                </ThemedText>
              </View>
            </View>

            {/* Sign Up Button */}
            <TouchableOpacity
              style={[
                styles.signUpButton,
                {
                  backgroundColor: isFormValid && !isLoading ? tintColor : iconColor,
                  opacity: isFormValid && !isLoading ? 1 : 0.6,
                }
              ]}
              onPress={handleSignUp}
              disabled={!isFormValid || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <ThemedText style={styles.signUpButtonText}>
                  Create Account
                </ThemedText>
              )}
            </TouchableOpacity>

            {/* Sign In Link */}
            <View style={styles.signInContainer}>
              <ThemedText style={styles.signInText}>
                Already have an account?{' '}
              </ThemedText>
              <Link href="/auth/login" asChild>
                <TouchableOpacity style={styles.signInLinkTouchable} disabled={isLoading}>
                  <ThemedText type="link" style={styles.signInLink}>
                    Sign in here
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
  passwordStrengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  passwordStrengthBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
    marginRight: 12,
  },
  passwordStrengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  passwordStrengthText: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 50,
  },
  passwordFeedback: {
    marginTop: 8,
  },
  feedbackText: {
    fontSize: 12,
    color: '#e74c3c',
    marginBottom: 2,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  checkboxTouchable: {
    padding: 4, // Increase touch area for checkbox
    marginRight: 8,
    marginTop: -2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxFill: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  termsText: {
    flex: 1,
    paddingLeft: 4,
  },
  termsTextContent: {
    fontSize: 14,
    lineHeight: 22,
    flexWrap: 'wrap',
  },
  termsLink: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  signUpButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  signUpButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  signInLinkTouchable: {
    alignSelf: 'flex-start',
  },
  signInText: {
    fontSize: 14,
  },
  signInLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});