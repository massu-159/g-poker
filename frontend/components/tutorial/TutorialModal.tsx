/**
 * Tutorial Modal Component for G-Poker
 * Displays tutorial content in a modal format with completion option
 */

import {
  Modal,
  StyleSheet,
  View,
  StatusBar,
} from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';
import { TutorialScreen } from './TutorialScreen';

interface TutorialModalProps {
  visible: boolean;
  onComplete: () => void;
}

export function TutorialModal({ visible, onComplete }: TutorialModalProps) {
  const backgroundColor = useThemeColor({}, 'background');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      statusBarTranslucent={true}
    >
      <StatusBar barStyle="default" />
      <View style={[styles.container, { backgroundColor }]}>
        {/* Tutorial Content */}
        <TutorialScreen
          isModal={true}
          onComplete={onComplete}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});