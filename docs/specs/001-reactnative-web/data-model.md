# Data Model: ごきぶりポーカー React Native App

## Core Entities

### Game Entity
Represents a single multiplayer game session between 2 players.

```typescript
interface Game {
  id: string;                    // Unique game identifier
  status: GameStatus;            // Current game state
  players: Player[];             // Array of 2 players
  deck: Card[];                  // Hidden cards (6 cards not dealt)
  currentTurn: string;           // Player ID whose turn it is
  currentRound?: Round;          // Active card exchange round
  createdAt: Date;              // Game creation timestamp
  startedAt?: Date;             // Game start timestamp
  endedAt?: Date;               // Game completion timestamp
  winnerId?: string;            // Winner player ID (when ended)
  gameSettings: GameSettings;   // Configuration for this game
}

enum GameStatus {
  WAITING_FOR_PLAYERS = 'waiting_for_players',
  IN_PROGRESS = 'in_progress',
  ENDED = 'ended',
  ABANDONED = 'abandoned'
}

interface GameSettings {
  winCondition: number;         // Number of same-type cards to lose (default: 3)
  turnTimeLimit: number;        // Turn timeout in seconds (default: 60)
  reconnectionGracePeriod: number; // Seconds to wait for reconnection
}
```

**Validation Rules**:
- Game must have exactly 2 players when status is IN_PROGRESS
- currentTurn must reference valid player ID
- Deck must contain exactly 6 cards when game starts
- winnerId can only be set when status is ENDED

**State Transitions**:
```
WAITING_FOR_PLAYERS → IN_PROGRESS (when 2 players joined)
IN_PROGRESS → ENDED (when player reaches win condition)
IN_PROGRESS → ABANDONED (on player disconnect timeout)
ENDED → [terminal state]
ABANDONED → [terminal state]
```

### Player Entity
Represents a player in a game session with their cards and connection state.

```typescript
interface Player {
  id: string;                   // Unique player identifier
  gameId: string;              // Reference to current game
  deviceId: string;            // Device-based authentication
  displayName: string;         // Player display name
  hand: Card[];                // Private cards in hand (max 9 initially)
  penaltyPile: PenaltyPile;    // Public penalty cards by creature type
  isConnected: boolean;        // WebSocket connection status
  lastSeen: Date;              // Last activity timestamp
  joinedAt: Date;              // When player joined this game
}

interface PenaltyPile {
  [CreatureType.COCKROACH]: Card[];
  [CreatureType.MOUSE]: Card[];
  [CreatureType.BAT]: Card[];
  [CreatureType.FROG]: Card[];
}
```

**Validation Rules**:
- Player hand cannot exceed 9 cards initially
- Player cannot have more than 2 penalty cards of same creature type
- displayName must be 1-20 characters, alphanumeric + spaces
- deviceId must be unique per active game

### Card Entity
Represents individual cards in the game deck.

```typescript
interface Card {
  id: string;                   // Unique card identifier
  creatureType: CreatureType;   // Type of creature on card
  imageUrl: string;            // Card artwork URL
  location: CardLocation;       // Current card location
  ownerId?: string;            // Player ID if in hand/penalty pile
}

enum CreatureType {
  COCKROACH = 'cockroach',     // ゴキブリ
  MOUSE = 'mouse',             // ネズミ  
  BAT = 'bat',                 // コウモリ
  FROG = 'frog'                // カエル
}

enum CardLocation {
  DECK = 'deck',               // Hidden in deck (6 cards)
  HAND = 'hand',               // In player's private hand
  PENALTY = 'penalty',         // In player's public penalty pile
  IN_PLAY = 'in_play'          // Currently being exchanged
}
```

**Validation Rules**:
- Exactly 6 cards of each CreatureType (24 total)
- ownerId required when location is HAND or PENALTY
- ownerId must be null when location is DECK
- Only one card can have location IN_PLAY at a time per game

### Round Entity
Represents a single card exchange interaction between players.

```typescript
interface Round {
  id: string;                   // Unique round identifier
  gameId: string;              // Reference to parent game
  cardInPlay: Card;            // Card being passed
  initiatingPlayerId: string;   // Player who started the round
  targetPlayerId: string;      // Player receiving the card
  claim: CreatureType;         // Claimed creature type (may be false)
  response?: RoundResponse;    // Target player's response
  outcome?: RoundOutcome;      // Final resolution
  createdAt: Date;             // Round start time
  completedAt?: Date;          // Round completion time
}

interface RoundResponse {
  type: ResponseType;
  timestamp: Date;
  playerId: string;
}

enum ResponseType {
  BELIEVE = 'believe',         // Player believes the claim
  DISBELIEVE = 'disbelieve',   // Player thinks claim is false
  PASS_BACK = 'pass_back'      // Player passes card back
}

interface RoundOutcome {
  penaltyReceiver: string;     // Player ID who receives penalty card
  correctGuess: boolean;       // Whether guess was correct (if applicable)
  gameEnding: boolean;         // Whether this round ended the game
}
```

**Validation Rules**:
- initiatingPlayerId must be current turn player
- targetPlayerId must be the other player in game
- claim can be any CreatureType (truthful or false)
- response required to complete round
- outcome calculated server-side based on response and actual card type

## Derived Data and Relationships

### Game State Calculations
```typescript
interface GameStateView {
  // Calculated from entities above
  isMyTurn: boolean;           // Based on currentTurn vs current player
  opponentPenaltyCounts: {     // Count of penalty cards by type
    [CreatureType]: number;
  };
  myPenaltyCounts: {
    [CreatureType]: number;
  };
  cardsRemainingInHand: number;
  gameProgress: number;        // 0-100% based on penalty accumulation
  canEndGame: boolean;         // Either player close to losing
}
```

### Supabase Realtime Event Payloads
```typescript
// Database Operations (replace WebSocket events)
interface DatabaseOperations {
  // Join game operation
  joinGame: {
    table: 'game_players';
    operation: 'INSERT';
    data: {
      game_id: string;
      player_id: string;
      display_name: string;
    };
  };
  
  // Play card operation
  playCard: {
    table: 'game_actions';
    operation: 'INSERT';
    data: {
      game_id: string;
      player_id: string;
      action_type: 'play_card';
      action_data: {
        card_id: string;
        target_player_id: string;
        claim: CreatureType;
      };
    };
  };
  
  // Respond to round operation
  respondToRound: {
    table: 'game_actions';
    operation: 'INSERT';
    data: {
      game_id: string;
      player_id: string;
      action_type: 'respond_round';
      action_data: {
        round_id: string;
        response: ResponseType;
      };
    };
  };
}

// Realtime Subscriptions (replace Server → Client events)
interface RealtimeSubscriptions {
  // Game state changes
  gameStateChanges: {
    channel: `game-${string}`;
    table: 'games';
    filter: `id=eq.${string}`;
    events: ['INSERT', 'UPDATE', 'DELETE'];
  };
  
  // Game actions (card plays, responses)
  gameActions: {
    channel: `game-${string}`;
    table: 'game_actions';
    filter: `game_id=eq.${string}`;
    events: ['INSERT'];
  };
  
  // Player presence
  playerPresence: {
    channel: `game-${string}`;
    presence: {
      player_id: string;
      last_seen: string;
    };
  };
}
```

## Data Flow Patterns

### Game Initialization Flow
1. Player requests to join game (matchmaking or specific game ID)
2. Server creates Game entity with WAITING_FOR_PLAYERS status
3. When 2nd player joins:
   - Game status → IN_PROGRESS
   - Deal 9 cards to each player
   - Set 6 cards as hidden deck
   - Randomly select starting player
   - Send initial game-state-update to both clients

### Turn-Based Action Flow
1. Current player plays card → play-card event
2. Server creates Round entity
3. Target player receives round-started event
4. Target player responds → respond-to-round event  
5. Server calculates outcome, updates penalty piles
6. Server checks win/loss conditions
7. Both players receive round-completed event
8. If game continues, next turn begins

### State Synchronization Strategy
- **Authoritative Server**: All game logic runs on server
- **Optimistic Updates**: Client immediately updates UI, server confirms
- **Event Sourcing**: Each action creates immutable Round record
- **Full State Sync**: Periodic full game state broadcast for consistency

## Storage Requirements

### Server Database (PostgreSQL)
```sql
-- Games table
CREATE TABLE games (
  id UUID PRIMARY KEY,
  status VARCHAR(50) NOT NULL,
  current_turn UUID,
  created_at TIMESTAMP NOT NULL,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  winner_id UUID,
  settings JSONB NOT NULL
);

-- Players table  
CREATE TABLE players (
  id UUID PRIMARY KEY,
  game_id UUID REFERENCES games(id),
  device_id VARCHAR(255) NOT NULL,
  display_name VARCHAR(20) NOT NULL,
  is_connected BOOLEAN DEFAULT true,
  last_seen TIMESTAMP NOT NULL,
  joined_at TIMESTAMP NOT NULL
);

-- Cards table
CREATE TABLE cards (
  id UUID PRIMARY KEY,
  game_id UUID REFERENCES games(id),
  creature_type VARCHAR(20) NOT NULL,
  location VARCHAR(20) NOT NULL,
  owner_id UUID REFERENCES players(id)
);

-- Rounds table (event sourcing)
CREATE TABLE rounds (
  id UUID PRIMARY KEY,
  game_id UUID REFERENCES games(id),
  card_id UUID REFERENCES cards(id),
  initiating_player_id UUID REFERENCES players(id),
  target_player_id UUID REFERENCES players(id),
  claim VARCHAR(20) NOT NULL,
  response JSONB,
  outcome JSONB,
  created_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP
);
```

### Client Storage (SQLite)
```sql
-- Cache for offline resilience
CREATE TABLE cached_game_states (
  game_id TEXT PRIMARY KEY,
  state_data TEXT NOT NULL, -- JSON blob
  last_updated INTEGER NOT NULL
);

-- Queued actions during disconnection
CREATE TABLE pending_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_data TEXT NOT NULL, -- JSON blob
  created_at INTEGER NOT NULL
);
```

This data model provides:
- **Clear entity relationships** with proper foreign keys
- **Event sourcing** for game actions via Rounds table
- **Real-time synchronization** through WebSocket events
- **Offline resilience** with client-side caching
- **Scalability** through stateless server design
- **Data integrity** with validation rules and constraints