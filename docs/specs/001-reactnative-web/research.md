# Research Findings: ごきぶりポーカー React Native App

## Technology Stack Validation

### Real-Time Communication Protocol
**Decision**: Supabase Realtime over Socket.io/WebSocket  
**Rationale**: Database-integrated real-time subscriptions eliminate need for separate WebSocket server. Built-in reconnection, authentication, and Row Level Security. Perfect for turn-based games where state persistence is critical.  
**Alternatives considered**: Socket.io (requires custom server), raw WebSocket (lacks integration), Firebase Firestore (vendor lock-in concerns)

### State Management
**Decision**: Zustand for global game state  
**Rationale**: Lightweight (~2KB), minimal re-renders optimal for real-time updates, excellent performance characteristics for frequent state changes in multiplayer games.  
**Alternatives considered**: Redux Toolkit (unnecessary complexity for this scope), Context API (causes excessive re-renders)

### Animation Framework
**Decision**: React Native Reanimated 3  
**Rationale**: 60fps animations running on UI thread, worklet support for complex card animations, perfect for smooth card dealing/playing animations.  
**Alternatives considered**: React Native Animated (runs on JS thread, potential performance issues), Lottie (overkill for simple card movements)

### Expo Compatibility
**Decision**: Expo SDK 50+ with EAS Build  
**Rationale**: Excellent Supabase integration via @supabase/supabase-js, no native module requirements, streamlined App Store publishing workflow.  
**Alternatives considered**: Expo development build (unnecessary), bare React Native (loses Expo tooling benefits)

## Architecture Decisions

### Project Structure
**Decision**: Single React Native project with Supabase backend  
**Rationale**: Eliminates server complexity, reduces operational overhead, faster development cycles. Supabase provides all backend services as managed infrastructure.  
**Alternatives considered**: Custom API server (high complexity), Firebase (concerns about pricing changes)

### Database Strategy
**Decision**: Supabase (managed PostgreSQL) + SQLite (client cache)  
**Rationale**: Supabase provides managed PostgreSQL with built-in realtime, auth, and API generation. SQLite handles offline caching and game history. Monthly cost: $25 vs $100+ for custom server.  
**Alternatives considered**: Self-hosted PostgreSQL (operational complexity), MongoDB (unnecessary for structured game data)

### Authentication Strategy
**Decision**: Supabase Auth with anonymous sessions  
**Rationale**: Built-in authentication system, supports anonymous users for casual gaming, easily upgradeable to social auth later. Row Level Security integration.  
**Alternatives considered**: Custom auth (complex implementation), device-only identification (no cross-device support)

## Performance Optimizations

### Battery Efficiency
- **Connection Management**: Supabase handles connection lifecycle automatically
- **Subscription Optimization**: Subscribe only to relevant channels, unsubscribe on cleanup
- **Realtime Throttling**: Built-in rate limiting prevents excessive updates

### Animation Performance
- **Native Driver**: All transform-based animations use native driver
- **Worklets**: Card dealing/playing animations run on UI thread
- **List Optimization**: FlatList with getItemLayout for card collections

### Network Resilience
- **Automatic Reconnection**: Supabase client handles reconnection with exponential backoff
- **Offline Support**: SQLite cache enables offline gameplay review and statistics
- **Optimistic Updates**: Local state updates immediately, Supabase sync follows

## Implementation Guidelines

### Supabase Realtime Architecture
```typescript
// Database Tables (automatically generate realtime events)
interface GameTable {
  id: string;
  status: 'waiting' | 'active' | 'ended';
  players: string[]; // Player IDs
  current_turn: string;
  updated_at: string;
}

interface GameActionTable {
  id: string;
  game_id: string;
  player_id: string;
  action_type: 'play_card' | 'respond_claim' | 'join_game';
  action_data: any;
  created_at: string;
}

// Realtime Subscriptions
const gameChannel = supabase
  .channel(`game-${gameId}`)
  .on('postgres_changes', {
    event: '*', // INSERT, UPDATE, DELETE
    schema: 'public',
    table: 'games',
    filter: `id=eq.${gameId}`
  }, handleGameStateChange)
  .subscribe();
```

### State Management Pattern
```typescript
interface GameState {
  gameId: string;
  players: Player[];
  currentTurn: string; // playerId
  phase: 'waiting' | 'playing' | 'ended';
  lastAction?: GameAction;
}

// Zustand store with Supabase integration
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
      player_id: currentPlayerId,
      action_type: 'play_card',
      action_data: { cardId, claim, targetPlayerId: targetPlayer }
    });
  }
}));
```

### Directory Structure Recommendations
```
src/
├── components/
│   ├── cards/           # Card-related UI components
│   ├── game/            # Game board, player areas
│   └── common/          # Shared UI components
├── screens/
│   ├── LobbyScreen.tsx  # Matchmaking, join game
│   ├── GameScreen.tsx   # Main game interface
│   └── ResultScreen.tsx # Game results, rematch
├── services/
│   ├── supabase.ts      # Supabase client configuration
│   ├── game.ts          # Game-related database operations
│   ├── realtime.ts      # Realtime subscription management
│   └── storage.ts       # SQLite local storage
├── stores/
│   ├── gameStore.ts     # Zustand game state
│   └── userStore.ts     # Player profile, settings
└── lib/
    ├── gameLogic.ts     # Pure game rule functions
    └── utils.ts         # Shared utilities

supabase/
├── migrations/          # Database schema migrations
├── functions/           # Edge functions (optional)
└── config.toml         # Supabase project configuration
```

## Cost Benefits

**Monthly Operational Costs**:
- **Previous Architecture**: ~$100/month (VPS + PostgreSQL + Redis + monitoring)
- **Supabase Architecture**: $25/month (Supabase Pro tier)
- **Cost Savings**: 75% reduction in operational costs

**Development Time Savings**:
- No server setup/maintenance required
- Built-in authentication and authorization  
- Automatic API generation from database schema
- Real-time subscriptions without custom WebSocket server
- Estimated 40% faster time-to-market

This architecture provides a solid foundation for building a performant, scalable, and maintainable React Native multiplayer card game with excellent user experience, network resilience, and significantly reduced operational complexity.