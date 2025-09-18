# Data Model: ごきぶりポーカー React Native App - Enterprise Architecture

## Overview

This document describes the enterprise-grade data architecture for the ごきぶりポーカー multiplayer game, following Discord/Steam/League of Legends style security patterns with secure indirection and proper domain separation.

**Authentication Flow**: `auth.users` → `profiles` → `public_profiles` → `players`

## Core Database Tables

### 1. Authentication & User Management

#### `auth.users` (Supabase Auth Table)
- **Purpose**: Core authentication, managed by Supabase Auth
- **Security**: Never directly referenced in application logic
- **Contains**: email, encrypted password, metadata

#### `profiles` (Private User Data)
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),    -- Secure surrogate key
  user_id UUID UNIQUE REFERENCES auth.users(id),   -- Hidden auth reference
  device_id TEXT,                                   -- Device identification
  email TEXT,                                       -- User email
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```
**RLS**: Strict - users can only access their own profile
**Access Pattern**: Used internally for user account management

#### `public_profiles` (Public Player Data)
```sql
CREATE TABLE public_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID UNIQUE REFERENCES profiles(id),
  display_name VARCHAR(20) NOT NULL CHECK (
    length(display_name) >= 1 AND 
    length(display_name) <= 20 AND
    display_name ~ '^[a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s_-]+$'
  ),
  avatar TEXT,
  bio TEXT CHECK (length(bio) <= 500),
  game_preferences JSONB DEFAULT '{
    "sound": true,
    "animations": true, 
    "auto_pass_back": false,
    "show_statistics": true
  }',
  privacy_settings JSONB DEFAULT '{
    "show_stats": true,
    "show_online_status": true,
    "allow_friend_requests": true
  }',
  statistics JSONB DEFAULT '{
    "wins": 0,
    "losses": 0,
    "win_rate": 0,
    "fastest_win": null,
    "total_games": 0,
    "longest_game": 0,
    "favorite_creature": null,
    "average_game_duration": 0
  }',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```
**RLS**: Public read, owner write
**Security**: No direct auth.users references

### 2. Game Management

#### `games` (Game Sessions)
```sql
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status VARCHAR(50) DEFAULT 'waiting_for_players' CHECK (
    status IN ('waiting_for_players', 'in_progress', 'ended', 'abandoned')
  ),
  current_turn UUID,                                -- References players.game_player_id
  created_at TIMESTAMP DEFAULT now(),
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  winner_id UUID,                                   -- References players.game_player_id
  settings JSONB DEFAULT '{
    "winCondition": 3,
    "turnTimeLimit": 60,
    "reconnectionGracePeriod": 30
  }'
);
```
**Security**: Uses game_player_id references (secure indirection)

#### `players` (Game Participation)
```sql
CREATE TABLE players (
  game_player_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  -- Secure game identity
  game_id UUID REFERENCES games(id),
  public_profile_id UUID REFERENCES public_profiles(id),      -- Secure indirection
  game_role TEXT CHECK (game_role IN ('host', 'player')),
  is_online BOOLEAN DEFAULT true,
  last_seen TIMESTAMP DEFAULT now(),
  joined_at TIMESTAMP DEFAULT now()
);
```
**Security**: 
- `game_player_id` provides secure indirection from auth system
- No direct user identification outside of public_profile_id
- RLS ensures players only see data for their games

#### `public_players` (Secure View)
```sql
CREATE VIEW public_players AS
SELECT 
  p.game_player_id,
  p.game_id,
  pp.display_name,
  pp.avatar,
  p.game_role,
  p.is_online,
  p.joined_at
FROM players p
JOIN public_profiles pp ON p.public_profile_id = pp.id;
```
**Usage**: Primary interface for client applications

### 3. Game Content

#### `cards` (Game Cards)
```sql
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id),
  creature_type VARCHAR(20) CHECK (
    creature_type IN ('cockroach', 'mouse', 'bat', 'frog')
  ),
  location VARCHAR(20) DEFAULT 'deck' CHECK (
    location IN ('deck', 'hand', 'penalty', 'in_play')
  ),
  owner_id UUID REFERENCES players(game_player_id)  -- Secure player reference
);
```

#### `rounds` (Game Rounds)
```sql
CREATE TABLE rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id),
  card_id UUID REFERENCES cards(id),
  initiating_player_id UUID REFERENCES players(game_player_id),
  target_player_id UUID REFERENCES players(game_player_id),
  claim VARCHAR(20) CHECK (
    claim IN ('cockroach', 'mouse', 'bat', 'frog')
  ),
  response JSONB,                    -- {type: 'believe'|'disbelieve'|'pass_back', timestamp: ISO}
  outcome JSONB,                     -- {winner: UUID, loser: UUID, penalty_card: Card}
  created_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP
);
```

#### `game_actions` (Event Sourcing)
```sql
CREATE TABLE game_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id),
  player_id UUID REFERENCES players(game_player_id),
  action_type VARCHAR(50) CHECK (
    action_type IN ('join_game', 'play_card', 'respond_round', 'disconnect', 'reconnect')
  ),
  action_data JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now()
);
```
**Purpose**: Immutable event log for game actions and audit trail

## TypeScript Interfaces

### Core Game Entities

```typescript
interface Game {
  id: string;
  status: 'waiting_for_players' | 'in_progress' | 'ended' | 'abandoned';
  currentTurn?: string;              // game_player_id
  winnerId?: string;                 // game_player_id
  settings: {
    winCondition: number;            // Default: 3
    turnTimeLimit: number;           // Default: 60 seconds
    reconnectionGracePeriod: number; // Default: 30 seconds
  };
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
}

interface Player {
  id: string;                        // game_player_id (secure)
  profile: {
    displayName: string;
    avatar?: string;
    gamePreferences: {
      sound: boolean;
      animations: boolean;
      autoPassBack: boolean;
    };
    statistics: PlayerStatistics;
  };
  connection: {
    isOnline: boolean;
    lastSeen: string;
    joinedAt: string;
  };
  gameState?: {                      // Only when in game
    hand: Card[];
    penaltyPile: {
      cockroach: Card[];
      mouse: Card[];
      bat: Card[];
      frog: Card[];
    };
    turnPosition: number;
    isReady: boolean;
    score: number;
    hasLost: boolean;
  };
}

interface GamePlayer extends Player {
  gameId: string;
  gameRole: 'host' | 'player';
  gameState: PlayerGameState;       // Always present
}

interface Card {
  id: string;
  creatureType: 'cockroach' | 'mouse' | 'bat' | 'frog';
  location: 'deck' | 'hand' | 'penalty' | 'in_play';
  ownerId?: string;                 // game_player_id when owned
}

interface Round {
  id: string;
  gameId: string;
  cardId: string;
  initiatingPlayerId: string;       // game_player_id
  targetPlayerId: string;           // game_player_id
  claim: 'cockroach' | 'mouse' | 'bat' | 'frog';
  response?: {
    type: 'believe' | 'disbelieve' | 'pass_back';
    timestamp: string;
  };
  outcome?: {
    winner: string;                 // game_player_id
    loser: string;                  // game_player_id
    penaltyCard: Card;
  };
  createdAt: string;
  completedAt?: string;
}
```

### Database Function Interfaces

```typescript
// Secure player creation using database function
interface CreatePlayerRequest {
  gameId: string;
  displayName: string;
  gameRole?: 'host' | 'player';
}

// Database function: get_or_create_player_for_game
function get_or_create_player_for_game(
  p_device_id: string,
  p_display_name: string, 
  p_game_id: string,
  p_game_role?: string
): string; // Returns game_player_id
```

## Security Architecture

### Row Level Security (RLS) Policies

```sql
-- Players can only see players in their games
CREATE POLICY "Players can view game participants" ON players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM players p2 
      WHERE p2.game_id = players.game_id 
      AND p2.public_profile_id IN (
        SELECT pp.id FROM public_profiles pp
        JOIN profiles pr ON pp.profile_id = pr.id
        WHERE pr.user_id = auth.uid()
      )
    )
  );

-- Users can only update their own public profile
CREATE POLICY "Users can update own profile" ON public_profiles
  FOR UPDATE USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Game data is visible to participants only
CREATE POLICY "Game visibility" ON games
  FOR SELECT USING (
    id IN (
      SELECT game_id FROM players 
      WHERE public_profile_id IN (
        SELECT pp.id FROM public_profiles pp
        JOIN profiles pr ON pp.profile_id = pr.id
        WHERE pr.user_id = auth.uid()
      )
    )
  );
```

### Security Benefits

1. **Secure Indirection**: `game_player_id` prevents auth.users.id exposure
2. **Domain Separation**: Public vs private data clearly separated  
3. **Audit Trail**: All actions logged in game_actions table
4. **Scalability**: UUID-based keys support massive scale
5. **Privacy**: Users control what profile data is public

## Realtime Subscriptions

### Game State Updates
```typescript
// Subscribe to game changes
supabase
  .channel(`game-${gameId}`)
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
    (payload) => handleGameStateChange(payload)
  )
  .subscribe();

// Subscribe to game actions (event sourcing)
supabase
  .channel(`actions-${gameId}`)
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'game_actions', filter: `game_id=eq.${gameId}` },
    (payload) => handleGameAction(payload)
  )
  .subscribe();

// Subscribe to player presence
supabase
  .channel(`players-${gameId}`)
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` },
    (payload) => handlePlayerUpdate(payload)
  )
  .subscribe();
```

## Data Flow Patterns

### 1. User Registration & Profile Creation
```
1. User signs up → auth.users entry created
2. Trigger creates profiles entry linked to auth.users.id
3. User completes profile → public_profiles entry created
4. User can now join games using secure public_profile_id
```

### 2. Game Joining Flow
```
1. Client calls: get_or_create_player_for_game(device_id, display_name, game_id)
2. Function resolves user → profile → public_profile → creates players entry
3. Returns secure game_player_id for all subsequent game operations
4. Realtime notifies other players of new participant
```

### 3. Game Action Flow
```
1. Player performs action (play card, respond to round)
2. Insert into game_actions table (event sourcing)
3. Database triggers update game state tables
4. Realtime pushes updates to all game participants
5. Clients update UI optimistically, then sync with server state
```

### 4. Secure Data Access
```
Client Query: "Get my game data"
→ RLS ensures user can only see own games
→ Uses game_player_id for all game operations  
→ Never exposes auth.users.id or profiles.id
→ Public data comes via public_players view
```

## Performance Considerations

### Database Indexes
```sql
-- Critical performance indexes
CREATE INDEX idx_players_game_id ON players(game_id);
CREATE INDEX idx_players_public_profile_id ON players(public_profile_id);  
CREATE INDEX idx_cards_game_id_location ON cards(game_id, location);
CREATE INDEX idx_cards_owner_id ON cards(owner_id);
CREATE INDEX idx_game_actions_game_id_created ON game_actions(game_id, created_at);
CREATE INDEX idx_rounds_game_id ON rounds(game_id);
```

### Caching Strategy
- **Game State**: Cache current game via players.game_id
- **Player Profiles**: Cache public_profiles data per game session
- **Card Positions**: Cache hand/penalty pile states
- **Statistics**: Cache computed statistics with periodic updates

## Migration from Legacy Architecture

### Deprecated Patterns (Legacy Compatibility)
- ❌ `device_id` based authentication
- ❌ Direct `auth.users.id` references  
- ❌ `display_name` in players table
- ❌ `is_connected` field naming

### Modern Patterns (Current)
- ✅ Enterprise authentication flow
- ✅ Secure indirection with UUIDs
- ✅ Domain separation (public vs private data)
- ✅ Event sourcing with game_actions
- ✅ Row Level Security throughout

This enterprise architecture provides Discord/Steam-level security and scalability while maintaining backwards compatibility during the transition period.