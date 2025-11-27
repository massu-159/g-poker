# Data Model: G-Poker Mobile Server-Authoritative Architecture

**Generated**: 2025-01-12 | **Schema**: Server-controlled game rooms with mobile client integration

## Entity Definitions

### Player Profile (Enhanced)
**Purpose**: Authenticated mobile users with comprehensive gaming statistics and preferences
**Table**: `profiles` (enhanced from existing schema)

**Core Fields**:
- `id`: UUID, primary key, Supabase Auth user ID
- `display_name`: VARCHAR(50), player's chosen name, unique
- `email`: VARCHAR(255), authenticated email address
- `created_at`: TIMESTAMP, account creation time
- `last_seen`: TIMESTAMP, most recent login activity

**Gaming Statistics**:
- `games_played`: INTEGER DEFAULT 0, total completed games
- `games_won`: INTEGER DEFAULT 0, total victories
- `games_lost`: INTEGER DEFAULT 0, total defeats
- `win_percentage`: DECIMAL(5,2), calculated win rate
- `longest_game_seconds`: INTEGER, duration of longest game
- `shortest_game_seconds`: INTEGER, duration of shortest game
- `favorite_creature`: ENUM('cockroach', 'mouse', 'bat', 'frog'), most used creature
- `total_playtime_minutes`: INTEGER, cumulative gameplay time

**Mobile Preferences**:
- `preferred_language`: VARCHAR(2) DEFAULT 'en', CHECK (preferred_language IN ('en', 'ja'))
- `sound_enabled`: BOOLEAN DEFAULT true, audio preference
- `push_notifications`: BOOLEAN DEFAULT true, notification settings
- `vibration_enabled`: BOOLEAN DEFAULT true, haptic feedback
- `theme_preference`: ENUM('light', 'dark', 'auto') DEFAULT 'auto'

**Relationships**:
- One-to-many with `game_sessions` (player participations)
- One-to-many with `server_events` (audit trail)
- Many-to-many with `game_rooms` through `room_participants`

### Game Room (Server-Managed)
**Purpose**: Persistent multiplayer game rooms with server authority over state and access
**Table**: `game_rooms` (new)

**Core Fields**:
- `id`: UUID, primary key, unique room identifier
- `room_code`: VARCHAR(6), human-readable join code (optional for private rooms)
- `created_by`: UUID, foreign key to profiles.id, room creator
- `created_at`: TIMESTAMP, room creation time
- `updated_at`: TIMESTAMP, last state modification

**Room Configuration**:
- `room_type`: ENUM('public', 'private', 'tournament') DEFAULT 'public'
- `max_players`: INTEGER DEFAULT 6, CHECK (max_players BETWEEN 2 AND 6)
- `current_players`: INTEGER DEFAULT 0, active participant count
- `game_speed`: ENUM('slow', 'normal', 'fast') DEFAULT 'normal', turn timer settings
- `allow_spectators`: BOOLEAN DEFAULT true, spectator mode permission
- `password_protected`: BOOLEAN DEFAULT false, private room access

**Room State**:
- `status`: ENUM('waiting', 'active', 'completed', 'abandoned') DEFAULT 'waiting'
- `started_at`: TIMESTAMP, game start time
- `completed_at`: TIMESTAMP, game completion time
- `winner_id`: UUID, foreign key to profiles.id (nullable until completion)
- `total_rounds`: INTEGER, number of rounds played
- `current_turn_player`: UUID, foreign key to profiles.id (nullable when waiting)

**Game Settings**:
- `rule_variations`: JSONB, custom rule modifications
- `turn_timeout_seconds`: INTEGER DEFAULT 60, per-turn time limit
- `reconnection_timeout_minutes`: INTEGER DEFAULT 5, player disconnect grace period

**Relationships**:
- Many-to-one with `profiles` (creator)
- One-to-many with `room_participants` (players)
- One-to-one with `game_sessions` (active state)
- One-to-many with `server_events` (audit trail)

### Game Session (Active State)
**Purpose**: Real-time game state for Socket.io synchronization and recovery
**Table**: `game_sessions` (new)

**Core Fields**:
- `id`: UUID, primary key, session identifier
- `room_id`: UUID, foreign key to game_rooms.id, unique
- `session_version`: INTEGER DEFAULT 1, optimistic locking
- `created_at`: TIMESTAMP, session start time
- `updated_at`: TIMESTAMP, last state change

**Game State**:
- `current_round`: INTEGER DEFAULT 1, active round number
- `current_phase`: ENUM('setup', 'claiming', 'responding', 'resolution', 'completed') DEFAULT 'setup'
- `turn_order`: UUID[], ordered array of player IDs
- `current_turn_index`: INTEGER DEFAULT 0, index in turn_order
- `round_start_time`: TIMESTAMP, current round beginning
- `turn_deadline`: TIMESTAMP, current player's response deadline

**Card State**:
- `deck_state`: JSONB, remaining cards and distribution
- `player_hands`: JSONB, private card information per player
- `penalty_piles`: JSONB, public penalty cards per player per creature
- `current_claim`: JSONB, active claim details (player, card, creature)
- `awaiting_response_from`: UUID, player ID who must respond to claim

**Recovery Information**:
- `last_action_player`: UUID, most recent action performer
- `last_action_type`: VARCHAR(50), type of most recent action
- `last_action_timestamp`: TIMESTAMP, when last action occurred
- `reconnection_data`: JSONB, information for client state recovery

**Relationships**:
- One-to-one with `game_rooms` (room state)
- One-to-many with `server_events` (action history)

### Room Participants (Join Table)
**Purpose**: Player membership in game rooms with roles and timestamps
**Table**: `room_participants` (new)

**Core Fields**:
- `room_id`: UUID, foreign key to game_rooms.id
- `player_id`: UUID, foreign key to profiles.id
- `joined_at`: TIMESTAMP, when player joined room
- `left_at`: TIMESTAMP, when player left (nullable for active players)

**Participation Details**:
- `role`: ENUM('player', 'spectator') DEFAULT 'player', participation type
- `seat_position`: INTEGER, player order in game (1-6, nullable for spectators)
- `ready_status`: BOOLEAN DEFAULT false, ready to start game
- `connection_status`: ENUM('connected', 'disconnected', 'reconnecting') DEFAULT 'connected'
- `last_seen`: TIMESTAMP, most recent activity timestamp

**Primary Key**: (room_id, player_id)
**Relationships**:
- Many-to-one with `game_rooms`
- Many-to-one with `profiles`

### Server Events (Audit Trail)
**Purpose**: Comprehensive logging of all game actions and system events for dispute resolution
**Table**: `server_events` (new)

**Core Fields**:
- `id`: UUID, primary key, event identifier
- `room_id`: UUID, foreign key to game_rooms.id (nullable for system events)
- `player_id`: UUID, foreign key to profiles.id (nullable for system events)
- `event_timestamp`: TIMESTAMP DEFAULT NOW(), when event occurred
- `session_version`: INTEGER, game_sessions.session_version at time of event

**Event Details**:
- `event_type`: VARCHAR(50), standardized event classification
- `event_category`: ENUM('game_action', 'system_event', 'player_connection', 'room_management')
- `event_data`: JSONB, detailed event information and context
- `previous_state`: JSONB, game state before event (for rollback capability)
- `new_state`: JSONB, game state after event

**System Information**:
- `server_instance_id`: VARCHAR(50), Cloud Run instance identifier
- `request_ip`: INET, client IP address (when applicable)
- `user_agent`: TEXT, client application information
- `api_endpoint`: VARCHAR(100), backend endpoint that triggered event

**Relationships**:
- Many-to-one with `game_rooms` (optional)
- Many-to-one with `profiles` (optional)
- Many-to-one with `game_sessions` (via room_id lookup)

## Database Schema Evolution

### Migration Path from Existing Schema
**Current Schema**: Basic Cockroach Poker with direct client access
**Target Schema**: Server-authoritative with mobile-optimized structure

**Phase 1: Enhance Profiles Table**
```sql
-- Add new columns to existing profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS games_lost INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS win_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
  CASE WHEN games_played > 0
  THEN ROUND((games_won::DECIMAL / games_played::DECIMAL) * 100, 2)
  ELSE 0 END
) STORED,
ADD COLUMN IF NOT EXISTS longest_game_seconds INTEGER,
ADD COLUMN IF NOT EXISTS shortest_game_seconds INTEGER,
ADD COLUMN IF NOT EXISTS favorite_creature creature_type,
ADD COLUMN IF NOT EXISTS total_playtime_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(2) DEFAULT 'en' CHECK (preferred_language IN ('en', 'ja')),
ADD COLUMN IF NOT EXISTS sound_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS vibration_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(10) DEFAULT 'auto' CHECK (theme_preference IN ('light', 'dark', 'auto'));
```

**Phase 2: Create Server-Authoritative Tables**
```sql
-- Create game_rooms table
CREATE TABLE game_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code VARCHAR(6) UNIQUE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  room_type VARCHAR(20) DEFAULT 'public' CHECK (room_type IN ('public', 'private', 'tournament')),
  max_players INTEGER DEFAULT 6 CHECK (max_players BETWEEN 2 AND 6),
  current_players INTEGER DEFAULT 0,
  game_speed VARCHAR(10) DEFAULT 'normal' CHECK (game_speed IN ('slow', 'normal', 'fast')),
  allow_spectators BOOLEAN DEFAULT true,
  password_protected BOOLEAN DEFAULT false,

  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'abandoned')),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  winner_id UUID REFERENCES profiles(id),
  total_rounds INTEGER,
  current_turn_player UUID REFERENCES profiles(id),

  rule_variations JSONB DEFAULT '{}',
  turn_timeout_seconds INTEGER DEFAULT 60,
  reconnection_timeout_minutes INTEGER DEFAULT 5
);

-- Create game_sessions table
CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL UNIQUE REFERENCES game_rooms(id) ON DELETE CASCADE,
  session_version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  current_round INTEGER DEFAULT 1,
  current_phase VARCHAR(20) DEFAULT 'setup' CHECK (current_phase IN ('setup', 'claiming', 'responding', 'resolution', 'completed')),
  turn_order UUID[],
  current_turn_index INTEGER DEFAULT 0,
  round_start_time TIMESTAMP,
  turn_deadline TIMESTAMP,

  deck_state JSONB,
  player_hands JSONB,
  penalty_piles JSONB,
  current_claim JSONB,
  awaiting_response_from UUID REFERENCES profiles(id),

  last_action_player UUID REFERENCES profiles(id),
  last_action_type VARCHAR(50),
  last_action_timestamp TIMESTAMP,
  reconnection_data JSONB
);

-- Create room_participants table
CREATE TABLE room_participants (
  room_id UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP,

  role VARCHAR(20) DEFAULT 'player' CHECK (role IN ('player', 'spectator')),
  seat_position INTEGER CHECK (seat_position BETWEEN 1 AND 6),
  ready_status BOOLEAN DEFAULT false,
  connection_status VARCHAR(20) DEFAULT 'connected' CHECK (connection_status IN ('connected', 'disconnected', 'reconnecting')),
  last_seen TIMESTAMP DEFAULT NOW(),

  PRIMARY KEY (room_id, player_id)
);

-- Create server_events table
CREATE TABLE server_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES game_rooms(id),
  player_id UUID REFERENCES profiles(id),
  event_timestamp TIMESTAMP DEFAULT NOW(),
  session_version INTEGER,

  event_type VARCHAR(50) NOT NULL,
  event_category VARCHAR(20) NOT NULL CHECK (event_category IN ('game_action', 'system_event', 'player_connection', 'room_management')),
  event_data JSONB,
  previous_state JSONB,
  new_state JSONB,

  server_instance_id VARCHAR(50),
  request_ip INET,
  user_agent TEXT,
  api_endpoint VARCHAR(100)
);
```

**Phase 3: Optimize Indexes for Performance**
```sql
-- Game room lookup indexes
CREATE INDEX idx_game_rooms_status ON game_rooms(status);
CREATE INDEX idx_game_rooms_room_type ON game_rooms(room_type);
CREATE INDEX idx_game_rooms_created_by ON game_rooms(created_by);
CREATE INDEX idx_game_rooms_room_code ON game_rooms(room_code) WHERE room_code IS NOT NULL;

-- Game session performance indexes
CREATE INDEX idx_game_sessions_room_id ON game_sessions(room_id);
CREATE INDEX idx_game_sessions_updated_at ON game_sessions(updated_at);

-- Room participant lookup indexes
CREATE INDEX idx_room_participants_player_id ON room_participants(player_id);
CREATE INDEX idx_room_participants_room_status ON room_participants(room_id) WHERE left_at IS NULL;

-- Server events audit indexes
CREATE INDEX idx_server_events_room_player ON server_events(room_id, player_id);
CREATE INDEX idx_server_events_timestamp ON server_events(event_timestamp);
CREATE INDEX idx_server_events_type ON server_events(event_type);
```

### Row Level Security (Simplified)
**Philosophy**: Server-only database access with simplified policies

```sql
-- Enable RLS on all tables
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_events ENABLE ROW LEVEL SECURITY;

-- Server role has full access (Hono backend)
CREATE POLICY "Server full access" ON game_rooms FOR ALL TO service_role USING (true);
CREATE POLICY "Server full access" ON game_sessions FOR ALL TO service_role USING (true);
CREATE POLICY "Server full access" ON room_participants FOR ALL TO service_role USING (true);
CREATE POLICY "Server full access" ON server_events FOR ALL TO service_role USING (true);

-- Authenticated users have read-only access to their own data
CREATE POLICY "Players view own rooms" ON game_rooms FOR SELECT TO authenticated
  USING (id IN (SELECT room_id FROM room_participants WHERE player_id = auth.uid()));

CREATE POLICY "Players view own participation" ON room_participants FOR SELECT TO authenticated
  USING (player_id = auth.uid());

-- No direct write access for authenticated users (all writes through backend)
```

---

**Data Model Status**: ✅ Complete - Server-authoritative schema with mobile optimization
**Next Phase**: Generate API contracts and integration test scenarios