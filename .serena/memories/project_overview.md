# G-Poker Project Overview

## Project Purpose
**ごきぶりポーカー (Cockroach Poker)** - Online multiplayer mobile card game application

- Japanese card game "Cockroach Poker" (bluffing/deduction game)
- Real-time multiplayer gameplay for 2 players on separate devices
- Cross-platform mobile app for iOS and Android
- Enterprise-grade security architecture following Discord/Steam patterns

## Core Game Mechanics
- 24 cards: 4 creature types (ゴキブリ, ネズミ, コウモリ, カエル) × 6 each
- Players pass cards with claims (truth/lies), opponent guesses or passes back
- Goal: Avoid collecting 3 cards of same creature type (lose condition)
- Real-time synchronization between players

## Key Features
- **Authentication**: Enterprise auth flow via Supabase Auth
- **Real-time Gameplay**: Supabase Realtime for instant game updates
- **Offline Support**: AsyncStorage caching with offline action queue
- **Performance Monitoring**: Built-in FPS and memory tracking
- **Cross-platform**: iOS, Android, and Web support via Expo
- **Animations**: Smooth card dealing and movement with Reanimated
- **Comprehensive Testing**: 79+ tests (unit, integration, contract)

## Technical Architecture
- **Security**: Secure indirection with game_player_id (not auth.users.id)
- **Database**: Enterprise patterns with RLS policies
- **State Management**: Optimistic updates with Zustand + TanStack Query
- **Event Sourcing**: Immutable game_actions table for audit trail
- **Scalability**: UUID-based keys supporting massive scale

## Development Status
- ✅ Core game logic and entity models
- ✅ Supabase realtime integration
- ✅ Mobile UI components with animations
- ✅ Comprehensive test suite (79+ tests)
- ✅ Performance monitoring and offline storage
- 🚧 Error handling and production readiness
- 🚧 App Store deployment configuration