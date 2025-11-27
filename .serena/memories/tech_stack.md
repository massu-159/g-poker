# Tech Stack and Dependencies

## Frontend Framework
- **React Native**: 0.81.4 (core mobile framework)
- **Expo**: ~54.0.2 (development platform)
- **React**: 19.1.0 (UI library)
- **TypeScript**: ~5.9.2 (type safety)
- **React Native Web**: ^0.21.0 (web support)

## Navigation & UI
- **@react-navigation/native**: ^7.1.17 (navigation system)
- **@react-navigation/stack**: ^7.4.8 (stack navigator)
- **@react-navigation/bottom-tabs**: ^7.4.7 (tab navigator)
- **@shopify/restyle**: ^2.4.5 (styling system)
- **react-native-reanimated**: ~4.1.0 (animations)
- **react-native-gesture-handler**: ~2.28.0 (gesture handling)
- **react-native-safe-area-context**: ~5.6.0 (safe areas)
- **react-native-screens**: ~4.16.0 (native screen optimization)

## Backend & Database
- **Supabase**: ^2.57.2 (BaaS - auth, database, realtime)
- **PostgreSQL**: via Supabase Cloud (enterprise database)
- **Row Level Security**: Database-level security
- **Realtime Subscriptions**: Live data synchronization

## State Management
- **Zustand**: ^5.0.8 (state management)
- **@tanstack/react-query**: ^5.87.1 (server state)
- **@react-native-async-storage/async-storage**: 2.2.0 (persistence)

## Authentication & Security
- **Supabase Auth**: Built-in authentication
- **expo-apple-authentication**: ~8.0.7 (Apple Sign In)
- **expo-auth-session**: ~7.0.8 (OAuth flows)
- **expo-crypto**: ~15.0.7 (cryptographic functions)

## Development Tools
- **ESLint**: ^8.57.1 (code linting)
- **Prettier**: ^3.6.2 (code formatting)
- **Jest**: ^29.4.0 (testing framework)
- **@testing-library/react-native**: ^13.3.3 (component testing)
- **@testing-library/jest-native**: ^5.4.3 (native testing matchers)
- **react-test-renderer**: 19.1.0 (test renderer)

## Build & Deployment
- **EAS CLI**: Expo Application Services
- **Metro**: React Native bundler
- **Babel**: JavaScript transpiler

## Utilities
- **@react-native-community/netinfo**: 11.4.1 (network status)
- **expo-status-bar**: ~3.0.8 (status bar control)

## Platform Support
- **iOS**: 13.0+ (deployment target)
- **Android**: API 21+ (minSdkVersion), API 34 (targetSdkVersion)
- **Web**: React Native Web support
- **Development**: iOS Simulator, Android Emulator, Web browser