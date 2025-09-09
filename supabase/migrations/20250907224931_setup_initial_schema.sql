-- Initial database schema for Cockroach Poker game
-- Based on data-model.md specifications

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Games table
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status VARCHAR(50) NOT NULL DEFAULT 'waiting_for_players',
  current_turn UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  winner_id UUID,
  settings JSONB NOT NULL DEFAULT '{"winCondition": 3, "turnTimeLimit": 60, "reconnectionGracePeriod": 30}'::jsonb,
  
  CONSTRAINT valid_status CHECK (status IN ('waiting_for_players', 'in_progress', 'ended', 'abandoned'))
);

-- Players table  
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  display_name VARCHAR(20) NOT NULL,
  is_connected BOOLEAN NOT NULL DEFAULT true,
  last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_display_name CHECK (LENGTH(display_name) >= 1 AND LENGTH(display_name) <= 20)
);

-- Cards table
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  creature_type VARCHAR(20) NOT NULL,
  location VARCHAR(20) NOT NULL DEFAULT 'deck',
  owner_id UUID REFERENCES players(id) ON DELETE SET NULL,
  
  CONSTRAINT valid_creature_type CHECK (creature_type IN ('cockroach', 'mouse', 'bat', 'frog')),
  CONSTRAINT valid_location CHECK (location IN ('deck', 'hand', 'penalty', 'in_play')),
  CONSTRAINT owner_required_for_hand_penalty CHECK (
    (location IN ('hand', 'penalty') AND owner_id IS NOT NULL) OR
    (location IN ('deck', 'in_play'))
  )
);

-- Rounds table (event sourcing for game actions)
CREATE TABLE rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  initiating_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  target_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  claim VARCHAR(20) NOT NULL,
  response JSONB,
  outcome JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  
  CONSTRAINT valid_claim CHECK (claim IN ('cockroach', 'mouse', 'bat', 'frog'))
);

-- Game actions table for comprehensive event sourcing
CREATE TABLE game_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  action_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_action_type CHECK (action_type IN ('join_game', 'play_card', 'respond_round', 'disconnect', 'reconnect'))
);

-- Indexes for performance
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_players_game_id ON players(game_id);
CREATE INDEX idx_players_device_id ON players(device_id);
CREATE INDEX idx_cards_game_id ON cards(game_id);
CREATE INDEX idx_cards_owner_id ON cards(owner_id);
CREATE INDEX idx_cards_location ON cards(location);
CREATE INDEX idx_rounds_game_id ON rounds(game_id);
CREATE INDEX idx_rounds_created_at ON rounds(created_at);
CREATE INDEX idx_game_actions_game_id ON game_actions(game_id);
CREATE INDEX idx_game_actions_player_id ON game_actions(player_id);
CREATE INDEX idx_game_actions_created_at ON game_actions(created_at);

-- Initial seed data: Create a complete deck of cards for testing
-- This will be called by functions when a new game is created
-- 24 cards total: 6 cards x 4 creature types