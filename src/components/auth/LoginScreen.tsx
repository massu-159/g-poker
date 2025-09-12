/**
 * Login Screen Component
 * Traditional authentication with Apple, Google, and Email options
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  FadeIn,
  SlideInUp,
} from 'react-native-reanimated';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';

import { authService } from '../../services/authService';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Auth'>;

type AuthMode = 'signin' | 'signup';
type LoadingState = 'idle' | 'apple' | 'email';

export interface LoginScreenProps {
  onAuthSuccess?: () => void;
  testID?: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onAuthSuccess,
  testID,
}) => {
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  
  const navigation = useNavigation<LoginScreenNavigationProp>();

  // Animation values
  const buttonScale = useSharedValue(1);
  const formOpacity = useSharedValue(1);

  // Animated styles
  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const animatedFormStyle = useAnimatedStyle(() => ({
    opacity: formOpacity.value,
  }));

  // Handle Apple Sign-In
  const handleAppleSignIn = async () => {
    if (loadingState !== 'idle') return;
    
    setLoadingState('apple');
    buttonScale.value = withSpring(0.95);

    try {
      const result = await authService.signInWithApple();
      
      if (result.success) {
        onAuthSuccess?.();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Lobby' }],
        });
      } else {
        Alert.alert(
          'Apple Sign-Inエラー',
          typeof result.error === 'string' ? result.error : 'Apple Sign-Inに失敗しました。',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Apple Sign-Inエラー',
        'Apple Sign-Inに失敗しました。もう一度お試しください。',
        [{ text: 'OK' }]
      );
    } finally {
      setLoadingState('idle');
      buttonScale.value = withSpring(1);
    }
  };


  // Handle Email Authentication
  const handleEmailAuth = async () => {
    if (loadingState !== 'idle' || !email.trim() || !password.trim()) return;
    
    setLoadingState('email');
    buttonScale.value = withSpring(0.95);
    formOpacity.value = withTiming(0.7);

    try {
      const result = authMode === 'signup' 
        ? await authService.signUpWithEmail(email.trim(), password, 'プレイヤー')
        : await authService.signInWithEmail(email.trim(), password);
      
      if (result.success) {
        if (authMode === 'signup') {
          Alert.alert(
            '確認メール送信',
            'メールアドレスに確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。',
            [{ text: 'OK' }]
          );
        } else {
          onAuthSuccess?.();
          navigation.reset({
            index: 0,
            routes: [{ name: 'Lobby' }],
          });
        }
      } else {
        Alert.alert(
          authMode === 'signup' ? '新規登録エラー' : 'ログインエラー',
          typeof result.error === 'string' ? result.error : (authMode === 'signup' ? '新規登録に失敗しました。' : 'ログインに失敗しました。'),
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        authMode === 'signup' ? '新規登録エラー' : 'ログインエラー',
        authMode === 'signup' ? '新規登録に失敗しました。もう一度お試しください。' : 'ログインに失敗しました。もう一度お試しください。',
        [{ text: 'OK' }]
      );
    } finally {
      setLoadingState('idle');
      buttonScale.value = withSpring(1);
      formOpacity.value = withTiming(1);
    }
  };

  const toggleAuthMode = () => {
    setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
  };

  return (
    <SafeAreaView style={styles.container} testID={testID}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View 
            entering={FadeIn.duration(1000)}
            style={styles.content}
          >
            {/* Header */}
            <Animated.View 
              entering={SlideInUp.delay(200).duration(800)}
              style={styles.header}
            >
              <Text style={styles.title}>ごきぶりポーカー</Text>
              <Text style={styles.subtitle}>
                アカウントでログインしてゲームを始めよう
              </Text>
            </Animated.View>

            {/* Social Auth Buttons */}
            <Animated.View 
              entering={SlideInUp.delay(400).duration(800)}
              style={styles.socialAuth}
            >
              {/* Apple Sign-In (iOS only) */}
              {Platform.OS === 'ios' && (
                <Animated.View style={[styles.buttonContainer, animatedButtonStyle]}>
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={12}
                    style={styles.appleButton}
                    onPress={handleAppleSignIn}
                  />
                </Animated.View>
              )}

            </Animated.View>

            {/* Divider */}
            <Animated.View 
              entering={SlideInUp.delay(500).duration(800)}
              style={styles.divider}
            >
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>または</Text>
              <View style={styles.dividerLine} />
            </Animated.View>

            {/* Email Form */}
            <Animated.View 
              entering={SlideInUp.delay(600).duration(800)}
              style={[styles.emailForm, animatedFormStyle]}
            >
              <Text style={styles.label}>メールアドレス</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="example@email.com"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={loadingState === 'idle'}
              />

              <Text style={styles.label}>パスワード</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={authMode === 'signup' ? '6文字以上' : 'パスワード'}
                placeholderTextColor="#999"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={loadingState === 'idle'}
              />

              {/* Email Auth Button */}
              <Animated.View style={[styles.buttonContainer, animatedButtonStyle]}>
                <TouchableOpacity
                  style={[
                    styles.emailButton, 
                    (loadingState !== 'idle' || !email.trim() || !password.trim()) && styles.buttonDisabled
                  ]}
                  onPress={handleEmailAuth}
                  disabled={loadingState !== 'idle' || !email.trim() || !password.trim()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emailButtonText}>
                    {loadingState === 'email' 
                      ? (authMode === 'signup' ? '新規登録中...' : 'ログイン中...') 
                      : (authMode === 'signup' ? '新規登録' : 'ログイン')
                    }
                  </Text>
                </TouchableOpacity>
              </Animated.View>

              {/* Toggle Auth Mode */}
              <TouchableOpacity
                style={styles.toggleButton}
                onPress={toggleAuthMode}
                disabled={loadingState !== 'idle'}
                activeOpacity={0.8}
              >
                <Text style={styles.toggleButtonText}>
                  {authMode === 'signup' 
                    ? 'すでにアカウントをお持ちですか？ ログイン' 
                    : 'アカウントをお持ちでない方は新規登録'
                  }
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Info */}
            <Animated.View 
              entering={SlideInUp.delay(700).duration(800)}
              style={styles.info}
            >
              <Text style={styles.infoText}>
                • 安全な認証でアカウントを保護{'\n'}
                • ゲームデータはクラウドに自動保存{'\n'}
                • 複数デバイス間でのデータ同期
              </Text>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: 'center',
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  socialAuth: {
    marginBottom: 24,
  },
  buttonContainer: {
    marginBottom: 16,
  },
  appleButton: {
    height: 50,
    borderRadius: 12,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e1e8ed',
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#95a5a6',
    fontWeight: '500',
  },
  emailForm: {
    marginBottom: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 2,
    borderColor: '#e1e8ed',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emailButton: {
    backgroundColor: '#3498db',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#3498db',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  emailButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  toggleButton: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  toggleButtonText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  info: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  infoText: {
    fontSize: 14,
    color: '#7f8c8d',
    lineHeight: 22,
    textAlign: 'center',
  },
});