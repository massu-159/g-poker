/**
 * UI Transition Animations
 * Handles screen transitions, modal animations, and UI state changes with React Native Reanimated 3
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Animation configurations
const TIMING_CONFIG = {
  duration: 300,
  easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
};

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
};

const QUICK_SPRING = {
  damping: 20,
  stiffness: 200,
};

export type TransitionType = 
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'fade'
  | 'scale'
  | 'bounce'
  | 'flip'
  | 'rotate'
  | 'elastic'
  | 'modal'
  | 'drawer'
  | 'page-curl';

export interface TransitionWrapperProps {
  children: React.ReactNode;
  transitionType: TransitionType;
  isVisible: boolean;
  onAnimationComplete?: ((isVisible: boolean) => void) | undefined;
  duration?: number;
  delay?: number;
  style?: ViewStyle;
  testID?: string | undefined;
}

export const TransitionWrapper: React.FC<TransitionWrapperProps> = ({
  children,
  transitionType,
  isVisible,
  onAnimationComplete,
  duration = 300,
  delay = 0,
  style,
  testID,
}) => {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const flipRotation = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      showAnimation();
    } else {
      hideAnimation();
    }
  }, [isVisible, transitionType]);

  const showAnimation = () => {
    setTimeout(() => {
      switch (transitionType) {
        case 'slide-up':
          translateY.value = SCREEN_HEIGHT;
          opacity.value = 1;
          translateY.value = withSpring(0, SPRING_CONFIG, () => {
            runOnJS(() => onAnimationComplete?.(true))();
          });
          break;
          
        case 'slide-down':
          translateY.value = -SCREEN_HEIGHT;
          opacity.value = 1;
          translateY.value = withSpring(0, SPRING_CONFIG, () => {
            runOnJS(() => onAnimationComplete?.(true))();
          });
          break;
          
        case 'slide-left':
          translateX.value = SCREEN_WIDTH;
          opacity.value = 1;
          translateX.value = withSpring(0, SPRING_CONFIG, () => {
            runOnJS(() => onAnimationComplete?.(true))();
          });
          break;
          
        case 'slide-right':
          translateX.value = -SCREEN_WIDTH;
          opacity.value = 1;
          translateX.value = withSpring(0, SPRING_CONFIG, () => {
            runOnJS(() => onAnimationComplete?.(true))();
          });
          break;
          
        case 'fade':
          opacity.value = withTiming(1, { duration }, () => {
            runOnJS(() => onAnimationComplete?.(true))();
          });
          break;
          
        case 'scale':
          scale.value = 0;
          opacity.value = 1;
          scale.value = withSpring(1, SPRING_CONFIG, () => {
            runOnJS(() => onAnimationComplete?.(true))();
          });
          break;
          
        case 'bounce':
          scale.value = 0;
          opacity.value = 1;
          scale.value = withSequence(
            withTiming(1.2, { duration: duration * 0.6 }),
            withSpring(1, QUICK_SPRING)
          );
          setTimeout(() => {
            runOnJS(() => onAnimationComplete?.(true))();
          }, duration);
          break;
          
        case 'flip':
          flipRotation.value = 90;
          opacity.value = 1;
          flipRotation.value = withTiming(0, { duration }, () => {
            runOnJS(() => onAnimationComplete?.(true))();
          });
          break;
          
        case 'rotate':
          rotation.value = 180;
          opacity.value = 1;
          rotation.value = withSpring(0, SPRING_CONFIG, () => {
            runOnJS(() => onAnimationComplete?.(true))();
          });
          break;
          
        case 'elastic':
          scale.value = 0;
          opacity.value = 1;
          scale.value = withSequence(
            withTiming(1.3, { duration: duration * 0.4 }),
            withTiming(0.9, { duration: duration * 0.3 }),
            withSpring(1, QUICK_SPRING)
          );
          setTimeout(() => {
            runOnJS(() => onAnimationComplete?.(true))();
          }, duration);
          break;
          
        case 'modal':
          scale.value = 0.8;
          opacity.value = 0;
          translateY.value = 50;
          
          opacity.value = withTiming(1, { duration: duration * 0.5 });
          scale.value = withSpring(1, SPRING_CONFIG);
          translateY.value = withSpring(0, SPRING_CONFIG, () => {
            runOnJS(() => onAnimationComplete?.(true))();
          });
          break;
          
        case 'drawer':
          translateX.value = -SCREEN_WIDTH * 0.8;
          opacity.value = withTiming(1, { duration: 200 });
          translateX.value = withSpring(0, SPRING_CONFIG, () => {
            runOnJS(() => onAnimationComplete?.(true))();
          });
          break;
          
        case 'page-curl':
          rotation.value = -15;
          scale.value = 0.9;
          translateX.value = 30;
          opacity.value = 0;
          
          opacity.value = withTiming(1, { duration: duration * 0.3 });
          rotation.value = withTiming(0, { duration });
          scale.value = withSpring(1, SPRING_CONFIG);
          translateX.value = withSpring(0, SPRING_CONFIG, () => {
            runOnJS(() => onAnimationComplete?.(true))();
          });
          break;
      }
    }, delay);
  };

  const hideAnimation = () => {
    switch (transitionType) {
      case 'slide-up':
        translateY.value = withSpring(-SCREEN_HEIGHT, SPRING_CONFIG, () => {
          opacity.value = 0;
          runOnJS(() => onAnimationComplete?.(false))();
        });
        break;
        
      case 'slide-down':
        translateY.value = withSpring(SCREEN_HEIGHT, SPRING_CONFIG, () => {
          opacity.value = 0;
          runOnJS(() => onAnimationComplete?.(false))();
        });
        break;
        
      case 'slide-left':
        translateX.value = withSpring(-SCREEN_WIDTH, SPRING_CONFIG, () => {
          opacity.value = 0;
          runOnJS(() => onAnimationComplete?.(false))();
        });
        break;
        
      case 'slide-right':
        translateX.value = withSpring(SCREEN_WIDTH, SPRING_CONFIG, () => {
          opacity.value = 0;
          runOnJS(() => onAnimationComplete?.(false))();
        });
        break;
        
      case 'fade':
        opacity.value = withTiming(0, { duration }, () => {
          runOnJS(() => onAnimationComplete?.(false))();
        });
        break;
        
      case 'scale':
        scale.value = withTiming(0, { duration }, () => {
          opacity.value = 0;
          runOnJS(() => onAnimationComplete?.(false))();
        });
        break;
        
      case 'bounce':
        scale.value = withSequence(
          withTiming(1.1, { duration: duration * 0.3 }),
          withTiming(0, { duration: duration * 0.7 })
        );
        setTimeout(() => {
          opacity.value = 0;
          runOnJS(() => onAnimationComplete?.(false))();
        }, duration);
        break;
        
      case 'flip':
        flipRotation.value = withTiming(90, { duration }, () => {
          opacity.value = 0;
          runOnJS(() => onAnimationComplete?.(false))();
        });
        break;
        
      case 'rotate':
        rotation.value = withTiming(180, { duration }, () => {
          opacity.value = 0;
          runOnJS(() => onAnimationComplete?.(false))();
        });
        break;
        
      case 'elastic':
        scale.value = withSequence(
          withTiming(1.1, { duration: duration * 0.2 }),
          withTiming(0, { duration: duration * 0.8 })
        );
        setTimeout(() => {
          opacity.value = 0;
          runOnJS(() => onAnimationComplete?.(false))();
        }, duration);
        break;
        
      case 'modal':
        opacity.value = withTiming(0, { duration: duration * 0.7 });
        scale.value = withTiming(0.8, { duration });
        translateY.value = withTiming(50, { duration }, () => {
          runOnJS(() => onAnimationComplete?.(false))();
        });
        break;
        
      case 'drawer':
        translateX.value = withSpring(-SCREEN_WIDTH * 0.8, SPRING_CONFIG, () => {
          opacity.value = 0;
          runOnJS(() => onAnimationComplete?.(false))();
        });
        break;
        
      case 'page-curl':
        opacity.value = withTiming(0, { duration: duration * 0.7 });
        rotation.value = withTiming(-15, { duration });
        scale.value = withTiming(0.9, { duration });
        translateX.value = withTiming(30, { duration }, () => {
          runOnJS(() => onAnimationComplete?.(false))();
        });
        break;
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
      { rotateY: `${flipRotation.value}deg` },
    ],
  }));

  if (!isVisible && opacity.value === 0) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, animatedStyle, style]} testID={testID}>
      {children}
    </Animated.View>
  );
};

// Screen transition component for navigation
export interface ScreenTransitionProps {
  children: React.ReactNode;
  transitionType: TransitionType;
  isEntering: boolean;
  onTransitionComplete?: () => void;
  testID?: string;
}

export const ScreenTransition: React.FC<ScreenTransitionProps> = ({
  children,
  transitionType,
  isEntering,
  onTransitionComplete,
  testID,
}) => {
  return (
    <TransitionWrapper
      transitionType={transitionType}
      isVisible={isEntering}
      {...(onTransitionComplete && { onAnimationComplete: onTransitionComplete })}
      {...(testID && { testID })}
      style={styles.fullScreen}
    >
      {children}
    </TransitionWrapper>
  );
};

// Modal overlay with backdrop
export interface ModalTransitionProps {
  children: React.ReactNode;
  isVisible: boolean;
  onBackdropPress?: () => void;
  onAnimationComplete?: (isVisible: boolean) => void;
  backdropOpacity?: number;
  testID?: string;
}

export const ModalTransition: React.FC<ModalTransitionProps> = ({
  children,
  isVisible,
  onBackdropPress,
  onAnimationComplete,
  backdropOpacity = 0.5,
  testID,
}) => {
  const backdropOpacityValue = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      backdropOpacityValue.value = withTiming(backdropOpacity, TIMING_CONFIG);
    } else {
      backdropOpacityValue.value = withTiming(0, TIMING_CONFIG);
    }
  }, [isVisible]);

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacityValue.value,
  }));

  if (!isVisible && backdropOpacityValue.value === 0) {
    return null;
  }

  return (
    <View style={styles.modalContainer} testID={testID}>
      <Animated.View 
        style={[styles.backdrop, backdropAnimatedStyle]}
        onTouchEnd={onBackdropPress}
      />
      <TransitionWrapper
        transitionType="modal"
        isVisible={isVisible}
        {...(onAnimationComplete && { onAnimationComplete: onAnimationComplete })}
        style={styles.modalContent}
      >
        {children}
      </TransitionWrapper>
    </View>
  );
};

// Toast notification component
export interface ToastTransitionProps {
  children: React.ReactNode;
  isVisible: boolean;
  position?: 'top' | 'bottom' | 'center';
  onAnimationComplete?: (isVisible: boolean) => void;
  duration?: number;
  testID?: string;
}

export const ToastTransition: React.FC<ToastTransitionProps> = ({
  children,
  isVisible,
  position = 'top',
  onAnimationComplete,
  duration = 3000,
  testID,
}) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onAnimationComplete?.(false);
      }, duration);
      
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isVisible, duration]);

  const getTransitionType = (): TransitionType => {
    switch (position) {
      case 'bottom':
        return 'slide-up';
      case 'center':
        return 'fade';
      case 'top':
      default:
        return 'slide-down';
    }
  };

  const getPositionStyle = (): ViewStyle => {
    switch (position) {
      case 'bottom':
        return styles.toastBottom;
      case 'center':
        return styles.toastCenter;
      case 'top':
      default:
        return styles.toastTop;
    }
  };

  return (
    <TransitionWrapper
      transitionType={getTransitionType()}
      isVisible={isVisible}
      onAnimationComplete={onAnimationComplete}
      style={StyleSheet.flatten([styles.toast, getPositionStyle()])}
      {...(testID && { testID })}
    >
      {children}
    </TransitionWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  modalContent: {
    maxWidth: SCREEN_WIDTH * 0.9,
    maxHeight: SCREEN_HEIGHT * 0.8,
  },
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    padding: 16,
  },
  toastTop: {
    top: 100,
  },
  toastBottom: {
    bottom: 100,
  },
  toastCenter: {
    top: SCREEN_HEIGHT / 2 - 40,
  },
});

export default TransitionWrapper;