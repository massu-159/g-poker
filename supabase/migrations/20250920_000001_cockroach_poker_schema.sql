-- Cockroach Poker Database Schema Migration
-- Replaces Texas Hold'em poker schema with Cockroach Poker game schema

-- Enable RLS and required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Creature types enum
CREATE TYPE creature_type AS ENUM ('cockroach', 'mouse', 'bat', 'frog');

-- Game status enum
CREATE TYPE game_status AS ENUM ('waiting', 'in_progress', 'completed', 'cancelled');

-- Player status enum
CREATE TYPE player_status AS ENUM ('joined', 'playing', 'disconnected', 'left');

-- User profiles table (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    display_name text NOT NULL CHECK (length(display_name) >= 3 AND length(display_name) <= 20),
    avatar_url text,
    verification_status text DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected', 'suspended')),
    games_played integer DEFAULT 0,
    games_won integer DEFAULT 0,
    win_rate numeric(5,2) DEFAULT 0.0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Games table for Cockroach Poker
CREATE TABLE public.games (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    creator_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    status game_status DEFAULT 'waiting' NOT NULL,
    max_players integer DEFAULT 2 CHECK (max_players = 2), -- Exactly 2 players for Cockroach Poker
    current_player_count integer DEFAULT 0,
    current_turn_player_id uuid REFERENCES public.profiles(id),
    round_number integer DEFAULT 0,

    -- Game settings (minimal for Cockroach Poker)
    time_limit_seconds integer DEFAULT 30,

    -- Game state
    hidden_card_count integer DEFAULT 6, -- Cards not dealt to players
    game_deck jsonb, -- Array of card objects with creature types

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Game participants table
CREATE TABLE public.game_participants (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    game_id uuid REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
    player_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    status player_status DEFAULT 'joined' NOT NULL,
    position integer CHECK (position IN (1, 2)), -- Player 1 or Player 2

    -- Player's hand (private cards)
    hand_cards jsonb DEFAULT '[]'::jsonb, -- Array of card objects

    -- Penalty pile by creature type
    penalty_cockroach jsonb DEFAULT '[]'::jsonb,
    penalty_mouse jsonb DEFAULT '[]'::jsonb,
    penalty_bat jsonb DEFAULT '[]'::jsonb,
    penalty_frog jsonb DEFAULT '[]'::jsonb,

    -- Game stats for this session
    cards_remaining integer DEFAULT 9, -- Start with 9 cards
    has_lost boolean DEFAULT false,
    losing_creature_type creature_type,

    joined_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    UNIQUE(game_id, player_id),
    UNIQUE(game_id, position)
);

-- Game rounds table for card passing mechanics
CREATE TABLE public.game_rounds (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    game_id uuid REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
    round_number integer NOT NULL,

    -- Current card being passed
    current_card jsonb NOT NULL, -- Card object with creature type

    -- Claim information
    claiming_player_id uuid REFERENCES public.profiles(id) NOT NULL,
    claimed_creature_type creature_type NOT NULL,
    target_player_id uuid REFERENCES public.profiles(id) NOT NULL,

    -- Round state
    pass_count integer DEFAULT 0, -- How many times card has been passed back
    is_completed boolean DEFAULT false,

    -- Final resolution
    final_guesser_id uuid REFERENCES public.profiles(id),
    guess_is_truth boolean, -- Did final guesser say it was truth?
    actual_is_truth boolean, -- Was the claim actually true?
    penalty_receiver_id uuid REFERENCES public.profiles(id), -- Who received the penalty card

    created_at timestamptz DEFAULT now(),
    completed_at timestamptz
);

-- Game actions/events log
CREATE TABLE public.game_actions (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    game_id uuid REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
    round_id uuid REFERENCES public.game_rounds(id) ON DELETE SET NULL,
    player_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

    action_type text NOT NULL CHECK (action_type IN (
        'join_game', 'leave_game', 'start_game',
        'pass_card', 'make_claim', 'guess_truth', 'guess_lie', 'pass_back',
        'receive_penalty', 'game_end'
    )),

    -- Action data (flexible JSON for different action types)
    action_data jsonb DEFAULT '{}'::jsonb,

    created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_games_status ON public.games(status);
CREATE INDEX idx_games_creator ON public.games(creator_id);
CREATE INDEX idx_game_participants_game ON public.game_participants(game_id);
CREATE INDEX idx_game_participants_player ON public.game_participants(player_id);
CREATE INDEX idx_game_rounds_game ON public.game_rounds(game_id);
CREATE INDEX idx_game_rounds_completed ON public.game_rounds(is_completed);
CREATE INDEX idx_game_actions_game ON public.game_actions(game_id);
CREATE INDEX idx_game_actions_player ON public.game_actions(player_id);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_actions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Games policies
CREATE POLICY "Users can view all non-private games" ON public.games
    FOR SELECT USING (true);

CREATE POLICY "Users can create games" ON public.games
    FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Game creators and participants can update games" ON public.games
    FOR UPDATE USING (
        auth.uid() = creator_id OR
        auth.uid() IN (
            SELECT player_id FROM public.game_participants
            WHERE game_id = games.id
        )
    );

-- Game participants policies
CREATE POLICY "Users can view participants of games they're in" ON public.game_participants
    FOR SELECT USING (
        auth.uid() = player_id OR
        auth.uid() IN (
            SELECT player_id FROM public.game_participants gp2
            WHERE gp2.game_id = game_participants.game_id
        ) OR
        auth.uid() IN (
            SELECT creator_id FROM public.games
            WHERE id = game_participants.game_id
        )
    );

CREATE POLICY "Users can join games" ON public.game_participants
    FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Users can update own participation" ON public.game_participants
    FOR UPDATE USING (auth.uid() = player_id);

-- Game rounds policies
CREATE POLICY "Players can view rounds of their games" ON public.game_rounds
    FOR SELECT USING (
        auth.uid() IN (
            SELECT player_id FROM public.game_participants
            WHERE game_id = game_rounds.game_id
        )
    );

CREATE POLICY "Players can create rounds in their games" ON public.game_rounds
    FOR INSERT WITH CHECK (
        auth.uid() = claiming_player_id AND
        auth.uid() IN (
            SELECT player_id FROM public.game_participants
            WHERE game_id = game_rounds.game_id
        )
    );

CREATE POLICY "Players can update rounds in their games" ON public.game_rounds
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT player_id FROM public.game_participants
            WHERE game_id = game_rounds.game_id
        )
    );

-- Game actions policies
CREATE POLICY "Players can view actions of their games" ON public.game_actions
    FOR SELECT USING (
        auth.uid() = player_id OR
        auth.uid() IN (
            SELECT player_id FROM public.game_participants
            WHERE game_id = game_actions.game_id
        )
    );

CREATE POLICY "Players can create actions in their games" ON public.game_actions
    FOR INSERT WITH CHECK (
        auth.uid() = player_id AND
        auth.uid() IN (
            SELECT player_id FROM public.game_participants
            WHERE game_id = game_actions.game_id
        )
    );

-- Functions for game logic

-- Function to check if a player has lost (3 of same creature type)
CREATE OR REPLACE FUNCTION check_player_loss(participant_id uuid)
RETURNS TABLE(has_lost boolean, losing_creature creature_type)
LANGUAGE plpgsql
AS $$
DECLARE
    participant_record RECORD;
BEGIN
    SELECT * INTO participant_record
    FROM public.game_participants
    WHERE id = participant_id;

    -- Check each creature type for 3 or more cards
    IF jsonb_array_length(participant_record.penalty_cockroach) >= 3 THEN
        RETURN QUERY SELECT true, 'cockroach'::creature_type;
    ELSIF jsonb_array_length(participant_record.penalty_mouse) >= 3 THEN
        RETURN QUERY SELECT true, 'mouse'::creature_type;
    ELSIF jsonb_array_length(participant_record.penalty_bat) >= 3 THEN
        RETURN QUERY SELECT true, 'bat'::creature_type;
    ELSIF jsonb_array_length(participant_record.penalty_frog) >= 3 THEN
        RETURN QUERY SELECT true, 'frog'::creature_type;
    ELSE
        RETURN QUERY SELECT false, NULL::creature_type;
    END IF;
END;
$$;

-- Function to add penalty card to appropriate pile
CREATE OR REPLACE FUNCTION add_penalty_card(
    participant_id uuid,
    card_data jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    creature_type_value text;
BEGIN
    creature_type_value := card_data->>'creatureType';

    CASE creature_type_value
        WHEN 'cockroach' THEN
            UPDATE public.game_participants
            SET penalty_cockroach = penalty_cockroach || card_data,
                updated_at = now()
            WHERE id = participant_id;
        WHEN 'mouse' THEN
            UPDATE public.game_participants
            SET penalty_mouse = penalty_mouse || card_data,
                updated_at = now()
            WHERE id = participant_id;
        WHEN 'bat' THEN
            UPDATE public.game_participants
            SET penalty_bat = penalty_bat || card_data,
                updated_at = now()
            WHERE id = participant_id;
        WHEN 'frog' THEN
            UPDATE public.game_participants
            SET penalty_frog = penalty_frog || card_data,
                updated_at = now()
            WHERE id = participant_id;
    END CASE;

    -- Update cards remaining count
    UPDATE public.game_participants
    SET cards_remaining = jsonb_array_length(hand_cards),
        updated_at = now()
    WHERE id = participant_id;
END;
$$;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply timestamp triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON public.games
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_game_participants_updated_at BEFORE UPDATE ON public.game_participants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();