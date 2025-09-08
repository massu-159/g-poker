# Claude Code Context: ごきぶりポーカー React Native App

## Project Overview
Online multiplayer ごきぶりポーカー (Cockroach Poker) mobile app built with React Native + Expo. Two players on separate devices play the bluffing card game with real-time synchronization.

## Current Architecture
- **Mobile**: React Native 0.79.5 with Expo SDK 53+
- **Backend**: Supabase Cloud (PostgreSQL + Auth + Realtime)
- **Database**: Supabase Cloud (remote) + SQLite (client cache)
- **State Management**: Zustand + TanStack Query
- **Styling**: Shopify Restyle
- **Animations**: React Native Reanimated 3
- **Testing**: Jest + React Native Testing Library

## Database Configuration
**IMPORTANT**: This project connects directly to Supabase Cloud, NOT local Supabase.
- **Environment**: Production Supabase project (vwrkmlgziauzchqpxemq)
- **Connection**: Direct HTTPS API calls to cloud.supabase.com
- **Local Development**: Uses remote database for consistency
- **Migration**: Applied directly to cloud database via Supabase Dashboard

## Key Technical Decisions
1. **Supabase over Custom Server**: Built-in realtime, auth, and database in one service
2. **Optimistic Updates**: Immediate UI response, database sync follows  
3. **Event Sourcing**: All game actions stored as immutable database records
4. **Battery Optimization**: Supabase handles connection lifecycle automatically
5. **Network Resilience**: Built-in reconnection, offline SQLite caching

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
├── components/      # Reusable UI (cards, game board)
├── screens/         # Lobby, Game, Results screens
├── services/        # Supabase client, realtime subscriptions
├── stores/          # Zustand stores for game state
└── lib/            # Shared utilities and game logic

supabase/
├── migrations/      # Database schema migrations
├── functions/       # Edge functions (optional)
└── config.toml     # Supabase project configuration

tests/
├── integration/     # Supabase integration tests
├── unit/           # Component and service unit tests
└── e2e/            # End-to-end game flow tests

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
npm run test                # Run component tests
npm run lint                # ESLint + TypeScript checks
npm run typecheck           # TypeScript type checking
```

## Testing Strategy
- **Contract Tests**: Database schema validation, RLS policy testing with Supabase Cloud
- **Integration Tests**: Full game flow with Supabase Cloud API
- **Component Tests**: React Native components with Testing Library
- **E2E Tests**: Complete user journeys across multiple devices
- **Database Testing**: Uses Supabase Cloud test data, not local instance

## Performance Requirements
- <100ms card action response time
- <50ms Supabase realtime event delivery  
- 60fps animations (card dealing, playing, transitions)
- <50MB mobile app memory usage
- Support 1k concurrent games

## Common Debugging
1. **Supabase Issues**: Check cloud connection status, monitor realtime subscriptions via Supabase Dashboard, verify RLS policies
2. **State Sync**: Use Zustand DevTools, check optimistic update reconciliation
3. **Animation Performance**: Monitor FPS, check native driver usage, profile memory
4. **Network Resilience**: Test disconnect scenarios, verify offline SQLite cache
5. **Database Access**: Use Supabase Dashboard SQL Editor for direct database queries

## Recent Changes (Last 3)
1. 2025-09-08: **MAJOR**: Updated to Expo SDK 53 + React Native 0.79.5 + React 19.0.0
2. 2025-09-08: **MAJOR**: Migrated to Supabase Cloud direct connection (no local Supabase)
3. 2025-09-08: Reorganized directory structure: docs/ for specifications, src/ for code

## Next Major Milestones
- [ ] Complete TDD implementation of core game logic library
- [ ] Supabase realtime integration with database subscriptions
- [ ] Mobile UI components with Reanimated animations
- [ ] App Store build configuration and deployment setup

## Claude Code Specific Notes
- Use `npx expo install` instead of `npm install` for Expo-compatible packages
- **Supabase Cloud Connection**: Connect directly to Supabase Cloud (vwrkmlgziauzchqpxemq), no local setup required
- Supabase debugging: Use Supabase Dashboard for realtime monitoring, check RLS policies, SQL Editor for queries
- React Native performance: Always check `useNativeDriver: true` for animations  
- Zustand DevTools: Enable only in development builds
- TypeScript strict mode enabled - handle all type errors before implementation
- TDD required: Write failing tests first, then implement features
- Constitution compliance: Keep architecture simple, avoid unnecessary abstractions
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