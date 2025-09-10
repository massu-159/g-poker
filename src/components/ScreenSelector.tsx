/**
 * Screen Selector Component
 * Temporary component for testing different screens
 */

import React from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import Animated, {
  FadeIn,
  SlideInDown,
} from 'react-native-reanimated';

type Screen = 'selector' | 'lobby' | 'game' | 'result' | 'loading';

export interface ScreenSelectorProps {
  onSelectScreen: (screen: Screen) => void;
  testID?: string;
}

export const ScreenSelector: React.FC<ScreenSelectorProps> = ({
  onSelectScreen,
  testID,
}) => {
  const screens = [
    {
      key: 'lobby' as Screen,
      title: 'Lobby Screen',
      description: 'マッチメイキング画面',
      emoji: '🏠',
    },
    {
      key: 'loading' as Screen,
      title: 'Loading Screen',
      description: 'ローディング画面',
      emoji: '⏳',
    },
    {
      key: 'game' as Screen,
      title: 'Game Screen',
      description: 'ゲーム画面',
      emoji: '🎮',
    },
    {
      key: 'result' as Screen,
      title: 'Result Screen',
      description: '結果画面',
      emoji: '🏆',
    },
  ];

  return (
    <SafeAreaView style={styles.container} testID={testID}>
      <Animated.View 
        style={styles.header}
        entering={FadeIn.duration(300)}
      >
        <Animated.Text style={styles.title}>
          🪳🐭🦇🐸
        </Animated.Text>
        <Animated.Text style={styles.subtitle}>
          スクリーン確認モード
        </Animated.Text>
        <Animated.Text style={styles.description}>
          確認したいスクリーンを選択してください
        </Animated.Text>
      </Animated.View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {screens.map((screen, index) => (
          <Animated.View
            key={screen.key}
            style={styles.screenOption}
            entering={SlideInDown.delay(index * 100).duration(300)}
            onTouchEnd={() => onSelectScreen(screen.key)}
          >
            <View style={styles.screenIcon}>
              <Animated.Text style={styles.screenEmoji}>
                {screen.emoji}
              </Animated.Text>
            </View>
            <View style={styles.screenInfo}>
              <Animated.Text style={styles.screenTitle}>
                {screen.title}
              </Animated.Text>
              <Animated.Text style={styles.screenDescription}>
                {screen.description}
              </Animated.Text>
            </View>
            <View style={styles.chevron}>
              <Animated.Text style={styles.chevronText}>
                →
              </Animated.Text>
            </View>
          </Animated.View>
        ))}
      </ScrollView>

      <Animated.View style={styles.footer}>
        <Animated.Text style={styles.footerText}>
          本番ではナビゲーションが自動で管理されます
        </Animated.Text>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E3A5F',
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  title: {
    fontSize: 48,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  screenOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  screenIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  screenEmoji: {
    fontSize: 24,
  },
  screenInfo: {
    flex: 1,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  screenDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  chevron: {
    width: 24,
    alignItems: 'center',
  },
  chevronText: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
});

export default ScreenSelector;