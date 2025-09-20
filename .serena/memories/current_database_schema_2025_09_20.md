# G-Poker Database Schema - Current State (2025-09-20)

## Overview
G-Poker React Native application with simplified database schema after extensive refactoring.

## Current Tables and Structure

### 1. profiles (Core Authentication Table)
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,                                    -- References auth.users.id
  email VARCHAR,                                          -- User email
  created_at TIMESTAMPTZ DEFAULT NOW(),                   -- Account creation
  updated_at TIMESTAMPTZ DEFAULT NOW(),                   -- Last profile update
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),                 -- Last activity
  is_active BOOLEAN DEFAULT TRUE                          -- Account status
);
```

### 2. public_profiles (Public Player Information)
```sql
CREATE TABLE public_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),        -- Internal ID
  profile_id UUID REFERENCES profiles(id),               -- Links to profiles
  display_name VARCHAR,                                   -- Player display name (renamed from public_display_name)
  avatar_url TEXT,                                        -- Avatar URL (renamed from public_avatar_url)
  created_at TIMESTAMPTZ DEFAULT NOW(),                   -- Profile creation
  updated_at TIMESTAMPTZ DEFAULT NOW(),                   -- Last update
  verification_status VARCHAR DEFAULT 'unverified',       -- unverified, pending, verified, rejected, suspended
  games_played INTEGER DEFAULT 0,                         -- Total games played (moved from players table)
  games_won INTEGER DEFAULT 0,                           -- Total wins (moved from players table)
  win_rate NUMERIC DEFAULT 0.0000                        -- Win percentage (moved from players table)
);
```

### 3. games (Game Sessions)
```sql
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),        -- Game ID
  status VARCHAR DEFAULT 'waiting',                      -- waiting, in_progress, completed, cancelled
  max_players INTEGER DEFAULT 8,                         -- Maximum players allowed
  current_players INTEGER DEFAULT 0,                     -- Current player count
  game_settings JSONB DEFAULT '{}',                      -- Game configuration
  created_at TIMESTAMPTZ DEFAULT NOW(),                  -- Game creation
  updated_at TIMESTAMPTZ DEFAULT NOW(),                  -- Last update
  started_at TIMESTAMPTZ,                               -- Game start time
  completed_at TIMESTAMPTZ,                             -- Game completion time
  winner_player_id UUID                                 -- Winner reference
);
```

### 4. game_participants (Player-Game Relationships)
```sql
CREATE TABLE game_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),        -- Participation ID
  game_id UUID REFERENCES games(id),                     -- Game reference
  player_id UUID REFERENCES public_profiles(id),         -- Player reference (direct to public_profiles)
  joined_at TIMESTAMPTZ DEFAULT NOW(),                   -- Join time
  left_at TIMESTAMPTZ,                                  -- Leave time
  status VARCHAR DEFAULT 'joined',                      -- joined, playing, eliminated, disconnected, left
  seat_position INTEGER,                                -- Table position
  final_position INTEGER,                               -- Final ranking
  score INTEGER DEFAULT 0,                              -- Game score
  is_active BOOLEAN DEFAULT TRUE,                       -- Active status
  is_ready BOOLEAN DEFAULT FALSE,                       -- Ready status
  game_metadata JSONB DEFAULT '{}'                      -- Game-specific data
);
```

### 5. game_rounds (Round Management)
```sql
CREATE TABLE game_rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),        -- Round ID
  game_id UUID REFERENCES games(id),                     -- Game reference
  round_number INTEGER,                                  -- Round sequence
  status VARCHAR DEFAULT 'waiting',                     -- waiting, in_progress, completed
  started_at TIMESTAMPTZ,                               -- Round start
  completed_at TIMESTAMPTZ,                             -- Round completion
  round_data JSONB DEFAULT '{}',                        -- Round-specific data
  created_at TIMESTAMPTZ DEFAULT NOW(),                 -- Creation time
  updated_at TIMESTAMPTZ DEFAULT NOW()                  -- Last update
);
```

### 6. game_actions (Player Actions)
```sql
CREATE TABLE game_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),        -- Action ID
  game_id UUID REFERENCES games(id),                     -- Game reference
  round_id UUID REFERENCES game_rounds(id),              -- Round reference
  player_id UUID REFERENCES public_profiles(id),         -- Player reference (direct to public_profiles)
  action_type VARCHAR,                                   -- Action type (bet, fold, call, etc.)
  action_data JSONB,                                     -- Action details
  created_at TIMESTAMPTZ DEFAULT NOW(),                 -- Action time
  action_timestamp TIMESTAMPTZ DEFAULT NOW(),           -- Action execution time
  is_valid BOOLEAN DEFAULT TRUE,                        -- Validation status
  validation_errors JSONB                               -- Validation error details
);
```

## Key Design Changes Made

### Removed Tables:
- `players` table - Consolidated functionality into `public_profiles`
- `audit_logs` table - Removed for small-scale app simplification

### Removed Columns:
- `games.created_by` - Simplified game ownership model
- `games.game_code` - Removed public game codes
- `games.game_type` - Fixed to single poker variant
- `profiles.display_name` - Moved to public_profiles
- `profiles.avatar_url` - Moved to public_profiles
- `public_profiles.is_visible` - Simplified privacy model

### Renamed Columns:
- `public_profiles.public_display_name` → `display_name`
- `public_profiles.public_avatar_url` → `avatar_url`

### Key Relationships:
- `public_profiles.profile_id` → `profiles.id` (1-to-1)
- `game_participants.player_id` → `public_profiles.id` (direct reference)
- `game_actions.player_id` → `public_profiles.id` (direct reference)

## RLS Policies (Current)
- Users can view games they participate in
- Authenticated users can create games
- First participant can update games
- Public profiles follow auth.uid() patterns

## Views:
- `leaderboard` - Shows ranking based on public_profiles stats

## Security Features:
- Row Level Security enabled on all tables
- UUID-based secure identifiers
- Verification status system for trust levels
- Direct auth.users integration through profiles table