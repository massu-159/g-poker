# Claude Code Context: ごきぶりポーカー React Native App

## Project Overview
Online multiplayer ごきぶりポーカー (Cockroach Poker) mobile app built with React Native + Expo. Two players on separate devices play the bluffing card game with real-time synchronization.

## Current Architecture
- **Mobile**: React Native 0.81+ with Expo SDK 54+
- **Backend**: Supabase Cloud (PostgreSQL + Auth + Realtime)
- **Authentication**: Traditional OAuth + Email Auth (Apple Sign-In, Google Sign-In, Email/Password)
- **Database**: Supabase Cloud (remote) + AsyncStorage (client cache)
- **State Management**: Zustand + TanStack Query
- **Styling**: Shopify Restyle
- **Animations**: React Native Reanimated 3
- **Testing**: Jest + React Native Testing Library
- **Performance**: Real-time monitoring with frame rate tracking and memory optimization
- **Offline Storage**: AsyncStorage with SQLite-compatible interface for caching

## Database Configuration
**IMPORTANT**: This project connects directly to Supabase Cloud, NOT local Supabase.
- **Environment**: Production Supabase project (vwrkmlgziauzchqpxemq)
- **Connection**: Direct HTTPS API calls to cloud.supabase.com
- **Local Development**: Uses remote database for consistency
- **Migration**: Applied directly to cloud database via Supabase Dashboard

## Key Technical Decisions
1. **Supabase over Custom Server**: Built-in realtime, auth, and database in one service
2. **Traditional Authentication**: Secure user accounts with Apple/Google OAuth and Email auth for data persistence
3. **Optimistic Updates**: Immediate UI response, database sync follows  
4. **Event Sourcing**: All game actions stored as immutable database records
5. **Battery Optimization**: Supabase handles connection lifecycle automatically
6. **Network Resilience**: Built-in reconnection, offline SQLite caching

## Game Rules Summary
- 24 cards: 4 creature types (ゴキブリ, ネズミ, コウモリ, カエル) × 6 each
- Deal: 9 cards per player, 6 cards hidden for randomness
- Goal: Avoid collecting 3 cards of same creature type (lose condition)
- Gameplay: Players pass cards with claims (truth/lies), opponent guesses or passes back
- Penalty: Wrong guesser or caught liar receives the card

## Directory Structure
```
# Product Code
src/
├── components/      # Reusable UI (cards, game board) - COMPLETED
│   ├── cards/       # Card, Hand components with animations
│   ├── game/        # GameBoard, PlayerArea, GameStatus
│   └── animations/  # Reanimated 3 animations
├── screens/         # Lobby, Game, Results screens - COMPLETED
├── services/        # Supabase client, realtime, storage - COMPLETED
├── stores/          # Zustand stores for game state - COMPLETED
└── lib/            # Shared utilities and game logic - COMPLETED
    ├── entities/    # TypeScript entity models
    ├── gameLogic/   # Core game mechanics
    └── performance.ts # Real-time performance monitoring

supabase/
├── migrations/      # Database schema migrations - APPLIED
├── functions/       # Edge functions (optional)
└── config.toml     # Supabase project configuration

tests/               # 79+ TESTS IMPLEMENTED
├── integration/     # Supabase integration tests
├── unit/           # Component and service unit tests
│   ├── components/  # React Native Testing Library tests
│   ├── gameLogic/   # Game mechanics unit tests
│   └── utils/       # Utility function tests
└── contract/       # API contract tests

# Design & Development Documentation
docs/
├── specs/          # Feature specifications and design documents
│   └── 001-reactnative-web/
├── memory/         # Claude Code memory files
├── templates/      # Task and document templates
├── scripts/        # Development and deployment scripts
└── .claude/        # Claude Code configuration
```

## Core Data Models
```typescript
interface Game {
  id: string;
  status: 'waiting_for_players' | 'in_progress' | 'ended' | 'abandoned';
  players: Player[];
  currentTurn: string; // Player ID
  currentRound?: Round;
}

interface Player {
  id: string;
  userId: string; // Supabase auth.users(id)
  displayName: string;
  email?: string;
  avatar?: string;
  hand: Card[];
  penaltyPile: { [CreatureType]: Card[] };
  isConnected: boolean;
}

interface Round {
  cardInPlay: Card;
  claim: CreatureType; // May be false
  response?: 'believe' | 'disbelieve' | 'pass_back';
}
```

## Supabase Realtime
**Database Tables**: games, game_players, game_actions, cards  
**Realtime Channels**: game-specific subscriptions with Row Level Security  
**Operations**: INSERT/UPDATE triggers automatic client notifications

## Authentication Pattern
```typescript
// Traditional OAuth + Email authentication
const handleAppleSignIn = async () => {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
};

const handleEmailSignIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
};

// RLS policies check authenticated user ID
CREATE POLICY "Authenticated users read own records" ON players 
FOR SELECT USING (
  auth.uid() IS NOT NULL AND user_id = auth.uid()
);
```

## State Management Pattern
```typescript
const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  connectionStatus: 'connected',
  
  // Optimistic updates for responsive UX
  playCard: async (cardId, claim, targetPlayer) => {
    // Update UI immediately
    set(state => ({ 
      gameState: updateGameStateOptimistically(state.gameState, action) 
    }));
    
    // Insert to database (triggers realtime update)
    await supabase.from('game_actions').insert({
      game_id: get().gameState.id,
      action_type: 'play_card',
      action_data: { cardId, claim, targetPlayerId: targetPlayer }
    });
  }
}));
```

## Development Commands
```bash
# Mobile App Development
npx expo start              # Start Expo dev server
npx expo start --ios        # iOS Simulator
npx expo start --android    # Android Emulator
npx expo start --web        # Web browser
npx expo start --clear      # Clear cache and start

# Database (Supabase Cloud)
# Apply migrations via Supabase Dashboard: https://supabase.com/dashboard
# No local Supabase setup required - connects directly to cloud

# Code Quality
npm run test                # Run component tests (79+ tests passing)
npm run test:watch          # Run tests in watch mode
npm run lint                # ESLint + TypeScript checks
npm run lint:fix            # Fix ESLint issues automatically
npm run typecheck           # TypeScript type checking
```

## Testing Strategy
- **Contract Tests**: Database schema validation, RLS policy testing with Supabase Cloud
- **Integration Tests**: Full game flow with Supabase Cloud API
- **Component Tests**: React Native components with Testing Library (79+ tests implemented)
  - Card, Hand, GameBoard components fully tested
  - React Native Reanimated mocking for animation testing
  - TouchableOpacity interaction testing
- **Unit Tests**: Game logic, utility functions, and service layer
- **E2E Tests**: Complete user journeys across multiple devices
- **Database Testing**: Uses Supabase Cloud test data, not local instance
- **Performance Tests**: Frame rate monitoring and memory usage validation

## Performance Requirements
- <100ms card action response time
- <50ms Supabase realtime event delivery  
- 60fps animations (card dealing, playing, transitions)
- <50MB mobile app memory usage
- Support 1k concurrent games

## Common Debugging
1. **Supabase Issues**: Check cloud connection status, monitor realtime subscriptions via Supabase Dashboard, verify RLS policies
2. **State Sync**: Use Zustand DevTools, check optimistic update reconciliation
3. **Animation Performance**: Monitor FPS with built-in performance monitor, check native driver usage, profile memory
4. **Network Resilience**: Test disconnect scenarios, verify offline AsyncStorage cache
5. **Database Access**: Use Supabase Dashboard SQL Editor for direct database queries
6. **Component Testing**: Use React Native Testing Library with React Native Reanimated mocks
7. **Performance Monitoring**: Use built-in performance monitor at `src/lib/performance.ts` for real-time metrics
8. **Offline Storage**: Check AsyncStorage cache via storage service at `src/services/storageService.ts`

## Recent Changes (Last 3)
1. 2025-09-12: **MAJOR**: Switched to Traditional Authentication (Apple/Google/Email) - secure user accounts with OAuth and email auth
2. 2025-09-12: Updated database schema and RLS policies from device_id to user_id based access control
3. 2025-09-12: Redesigned LoginScreen with Apple Sign-In, Google Sign-In, and email authentication forms

## Next Major Milestones
- [x] Complete TDD implementation of core game logic library
- [x] Supabase realtime integration with database subscriptions
- [x] Mobile UI components with Reanimated animations
- [x] Component testing infrastructure with React Native Testing Library
- [x] Traditional authentication system with Apple/Google/Email
- [ ] Error boundary and error handling implementation
- [ ] App Store build configuration for iOS and Android
- [ ] Performance optimization and production readiness

## Claude Code Specific Notes
- Use `npx expo install` instead of `npm install` for Expo-compatible packages
- **Supabase Cloud Connection**: Connect directly to Supabase Cloud (vwrkmlgziauzchqpxemq), no local setup required
- **Authentication**: Traditional OAuth (Apple, Google) and Email authentication with secure user accounts
- **RLS Security**: Policies use `auth.uid()` for authenticated user-based access control
- Supabase debugging: Use Supabase Dashboard for realtime monitoring, check RLS policies, SQL Editor for queries
- React Native performance: Always check `useNativeDriver: true` for animations, use built-in performance monitor
- Zustand DevTools: Enable only in development builds
- TypeScript strict mode enabled - handle all type errors before implementation
- TDD implemented: 79+ component tests with React Native Testing Library
- **Testing Mocks**: Use consistent React Native Reanimated mocks for animation testing
- **Offline Storage**: AsyncStorage-based service with SQLite-compatible interface
- **Performance Monitoring**: Real-time frame rate and memory tracking available
- **Database Migrations**: Apply via Supabase Dashboard or MCP tools, not local migration files

---
*Auto-updated by /plan command - Do not edit manually above this line*

## Manual Context (Preserved)
<!-- Add any manual context below this line -->

## Troubleshooting Tips
- For iOS build issues, clean derived data: `rm -rf ~/Library/Developer/Xcode/DerivedData`
- Android builds: Ensure Java 11 and Android SDK properly configured
- Metro bundler cache issues: `npx expo start --clear`
- Database connection: Check PostgreSQL is running and credentials in .env match