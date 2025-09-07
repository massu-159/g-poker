# Claude Code Context: ごきぶりポーカー React Native App

## Project Overview
Online multiplayer ごきぶりポーカー (Cockroach Poker) mobile app built with React Native + Expo. Two players on separate devices play the bluffing card game with real-time synchronization.

## Current Architecture
- **Mobile**: React Native 0.73+ with Expo SDK 50+
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Database**: Supabase (server) + SQLite (client cache)
- **State Management**: Zustand + TanStack Query
- **Styling**: Shopify Restyle
- **Animations**: React Native Reanimated 3
- **Testing**: Jest + React Native Testing Library, Supabase local dev

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
# Supabase
npx supabase start          # Start local Supabase stack
npx supabase db reset       # Reset local database
npx supabase db push        # Push schema changes

# Mobile App
npx expo start              # Start Expo dev server
npm run test                # Run component tests
npm run lint                # ESLint + TypeScript checks
```

## Testing Strategy
- **Contract Tests**: Database schema validation, RLS policy testing
- **Integration Tests**: Full game flow with Supabase local instance
- **Component Tests**: React Native components with Testing Library
- **E2E Tests**: Complete user journeys across multiple devices

## Performance Requirements
- <100ms card action response time
- <50ms Supabase realtime event delivery  
- 60fps animations (card dealing, playing, transitions)
- <50MB mobile app memory usage
- Support 1k concurrent games

## Common Debugging
1. **Supabase Issues**: Check connection status, monitor realtime subscriptions, verify RLS policies
2. **State Sync**: Use Zustand DevTools, check optimistic update reconciliation
3. **Animation Performance**: Monitor FPS, check native driver usage, profile memory
4. **Network Resilience**: Test disconnect scenarios, verify offline SQLite cache

## Recent Changes (Last 3)
1. 2025-09-07: **MAJOR**: Migrated from Socket.io to Supabase realtime architecture
2. 2025-09-07: Updated database schema for Supabase integration 
3. 2025-09-07: Simplified project structure (eliminated custom API server)

## Next Major Milestones
- [ ] Complete TDD implementation of core game logic library
- [ ] Supabase realtime integration with database subscriptions
- [ ] Mobile UI components with Reanimated animations
- [ ] App Store build configuration and deployment setup

## Claude Code Specific Notes
- Use `npx expo install` instead of `npm install` for Expo-compatible packages
- Supabase debugging: Use Supabase Dashboard for realtime monitoring, check RLS policies
- React Native performance: Always check `useNativeDriver: true` for animations  
- Zustand DevTools: Enable only in development builds
- TypeScript strict mode enabled - handle all type errors before implementation
- TDD required: Write failing tests first, then implement features
- Constitution compliance: Keep architecture simple, avoid unnecessary abstractions
- Supabase local dev: Always test with `npx supabase start` before deployment

---
*Auto-updated by /plan command - Do not edit manually above this line*

## Manual Context (Preserved)
<!-- Add any manual context below this line -->

## Troubleshooting Tips
- For iOS build issues, clean derived data: `rm -rf ~/Library/Developer/Xcode/DerivedData`
- Android builds: Ensure Java 11 and Android SDK properly configured
- Metro bundler cache issues: `npx expo start --clear`
- Database connection: Check PostgreSQL is running and credentials in .env match