# Codebase Structure and Architecture

## Project Structure Overview
```
g-poker/
├── src/                     # Main application source code
├── tests/                   # Test suite (79+ tests)
├── docs/                    # Documentation and specifications
├── supabase/               # Database migrations and config
├── scripts/                # Build and deployment scripts
├── assets/                 # Static assets (icons, images)
├── .expo/                  # Expo configuration cache
└── .claude/                # Claude Code configuration
```

## Source Code Architecture (`src/`)

### Components (`src/components/`)
- **UI Components**: `ui/` - Basic reusable components (SkeletonLoader)
- **Authentication**: `auth/` - Login and auth-related components
- **Card System**: `cards/` - Card, Hand components with touch interactions
- **Game Components**: `game/` - GameBoard, PlayerArea, GameStatus, PenaltyPile
- **Animations**: `animations/` - CardDealing, CardMovement, Transitions (Reanimated)
- **Core Components**: ErrorBoundary, ScreenSelector, MockProviders

### Screens (`src/screens/`)
- **LoadingScreen.tsx** - App initialization screen
- **LobbyScreen.tsx** - Game lobby and matchmaking
- **GameScreen.tsx** - Main gameplay interface
- **ResultScreen.tsx** - Game completion results
- **TutorialScreen.tsx** - Game rules and tutorial
- **GameRulesScreen.tsx** - Detailed game rules

### Services (`src/services/`)
- **supabase.ts** - Supabase client configuration
- **authService.ts** - Authentication logic (enterprise patterns)
- **gameService.ts** - Game operations and state management
- **realtimeService.ts** - Real-time subscriptions and events
- **matchmakingService.ts** - Player matching and lobby management
- **storageService.ts** - Offline storage and caching (AsyncStorage)

### State Management (`src/stores/`)
- **gameStore.ts** - Game state (Zustand + optimistic updates)
- **userStore.ts** - User authentication and profile state

### Core Library (`src/lib/`)
- **entities/** - TypeScript entity models
  - `Player.ts` - Player entity (enterprise architecture)
  - `Game.ts` - Game state and metadata
  - `Card.ts` - Card entity and game mechanics
  - `Round.ts` - Round logic and resolution
- **gameLogic/** - Pure game mechanics and rules
- **performance.ts** - Real-time performance monitoring
- **queryClient.ts** - TanStack Query configuration

### Hooks (`src/hooks/`)
- **useGameState.ts** - Game state management hook
- **useRealtimeSubscription.ts** - Supabase realtime integration

### Configuration (`src/config/`, `src/types/`)
- **environment.ts** - Environment configuration
- **database.ts** - TypeScript types from Supabase schema

### Navigation (`src/navigation/`)
- **AppNavigator.tsx** - React Navigation setup with stack/tab navigators

## Testing Architecture (`tests/`)

### Unit Tests (`tests/unit/`)
- **Component tests**: React Native Testing Library
- **Game logic tests**: Pure function testing
- **Service tests**: Mocked Supabase integration
- **Utility tests**: Helper function validation

### Integration Tests (`tests/integration/`)
- **Complete game flow**: End-to-end scenarios
- **Connection handling**: Network resilience
- **State synchronization**: Real-time data sync
- **Matchmaking flow**: Player pairing logic

### Contract Tests (`tests/contract/`)
- **Supabase API**: Database schema validation
- **Realtime operations**: Live subscription testing
- **Game operations**: CRUD operations validation
- **Player operations**: Authentication and profile tests

## Database Architecture (Supabase Cloud)

### Enterprise Security Pattern
```
auth.users → profiles → public_profiles → players → public_players (view)
```

### Key Tables
- **games** - Game sessions and metadata
- **players** - Game participation (uses game_player_id)
- **public_profiles** - Public player information
- **profiles** - Private user data
- **game_actions** - Event sourcing (immutable audit trail)
- **cards** - Card state and ownership
- **rounds** - Round history and outcomes

### Security Features
- **Row Level Security (RLS)** - Database-level access control
- **Secure indirection** - game_player_id prevents auth.users.id exposure
- **Event sourcing** - Complete audit trail via game_actions
- **Real-time subscriptions** - Live data synchronization

## Build and Deployment

### Development Scripts (`scripts/`)
- **build.sh** - Unified build script for all platforms

### EAS Configuration (`eas.json`)
- **Development builds** - Internal testing
- **Preview builds** - External testing
- **Production builds** - App store submission

### Expo Configuration (`app.json`)
- **Multi-platform** - iOS, Android, Web support
- **Localization** - Japanese and English support
- **Security** - Minimal permissions, no exempt encryption

## Key Architecture Decisions

### Security
- **Enterprise patterns** - Discord/Steam-style security architecture
- **Secure indirection** - UUID-based player identification
- **Domain separation** - Public vs private data boundaries

### Performance
- **Optimistic updates** - Immediate UI response
- **Real-time monitoring** - FPS and memory tracking
- **Offline support** - AsyncStorage caching with sync

### Scalability
- **Event sourcing** - Immutable game action history
- **UUID primary keys** - Massive scale support
- **Stateless architecture** - Supabase handles scaling

### Development
- **TypeScript strict mode** - Maximum type safety
- **Comprehensive testing** - 79+ tests across all layers
- **Hot reloading** - Expo development server