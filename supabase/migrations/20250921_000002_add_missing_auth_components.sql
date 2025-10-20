-- Add missing authentication system components
-- This migration adds all the missing tables and functions required by the auth routes

-- First, modify the profiles table to match auth expectations
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Create user_sessions table for JWT session management
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    session_token text NOT NULL,
    refresh_token text NOT NULL,
    device_type text DEFAULT 'unknown',
    ip_address text,
    user_agent text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    last_activity_at timestamptz DEFAULT now(),
    terminated_at timestamptz,
    expires_at timestamptz DEFAULT (now() + interval '7 days')
);

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
    theme text DEFAULT 'dark' CHECK (theme IN ('light', 'dark', 'auto')),
    language text DEFAULT 'en',
    currency text DEFAULT 'USD',
    sound_enabled boolean DEFAULT true,
    sound_volume numeric(3,2) DEFAULT 1.0 CHECK (sound_volume >= 0 AND sound_volume <= 1),
    voice_chat_enabled boolean DEFAULT false,
    email_notifications boolean DEFAULT true,
    push_notifications boolean DEFAULT true,
    game_invites boolean DEFAULT true,
    tournament_alerts boolean DEFAULT true,
    friend_activity boolean DEFAULT true,
    show_online_status boolean DEFAULT true,
    allow_friend_requests boolean DEFAULT true,
    show_statistics_publicly boolean DEFAULT false,
    allow_spectators boolean DEFAULT true,
    action_timeout_seconds integer DEFAULT 30 CHECK (action_timeout_seconds >= 15 AND action_timeout_seconds <= 120),
    animation_speed text DEFAULT 'normal' CHECK (animation_speed IN ('slow', 'normal', 'fast', 'off')),
    auto_muck_losing_hands boolean DEFAULT false,
    show_mucked_cards boolean DEFAULT true,
    auto_fold_enabled boolean DEFAULT false,
    auto_check_enabled boolean DEFAULT false,
    show_hand_strength boolean DEFAULT true,
    quick_bet_amounts jsonb DEFAULT '[10, 25, 50, 100]'::jsonb,
    table_background text DEFAULT 'default',
    card_back_design text DEFAULT 'default',
    mobile_card_size text DEFAULT 'medium' CHECK (mobile_card_size IN ('small', 'medium', 'large')),
    mobile_vibration_enabled boolean DEFAULT true,
    mobile_low_power_mode boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create public_profiles table (separate from private profiles)
CREATE TABLE IF NOT EXISTS public.public_profiles (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
    display_name text NOT NULL CHECK (length(display_name) >= 2 AND length(display_name) <= 50),
    avatar_url text,
    verification_status text DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected', 'suspended')),
    games_played integer DEFAULT 0,
    games_won integer DEFAULT 0,
    win_rate numeric(5,2) DEFAULT 0.0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create achievements table
CREATE TABLE IF NOT EXISTS public.achievements (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    description text NOT NULL,
    category text NOT NULL,
    difficulty text DEFAULT 'easy' CHECK (difficulty IN ('easy', 'medium', 'hard', 'legendary')),
    points integer DEFAULT 10,
    icon_url text,
    requirements jsonb DEFAULT '{}'::jsonb,
    is_hidden boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Create player_achievements table
CREATE TABLE IF NOT EXISTS public.player_achievements (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    player_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    achievement_id uuid REFERENCES public.achievements(id) ON DELETE CASCADE NOT NULL,
    progress integer DEFAULT 0,
    is_completed boolean DEFAULT false,
    completed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(player_id, achievement_id)
);

-- Create user_friendships table
CREATE TABLE IF NOT EXISTS public.user_friendships (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    requester_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    addressee_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(requester_id, addressee_id)
);

-- Create leaderboard_cache table
CREATE TABLE IF NOT EXISTS public.leaderboard_cache (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    player_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    leaderboard_type text NOT NULL,
    rank integer NOT NULL,
    score numeric,
    updated_at timestamptz DEFAULT now(),
    UNIQUE(player_id, leaderboard_type)
);

-- Create system_events table for logging
CREATE TABLE IF NOT EXISTS public.system_events (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_type text NOT NULL,
    event_category text NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_data jsonb DEFAULT '{}'::jsonb,
    ip_address text,
    user_agent text,
    created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON public.user_sessions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_public_profiles_profile_id ON public.public_profiles(profile_id);
CREATE INDEX IF NOT EXISTS idx_player_achievements_player_id ON public.player_achievements(player_id);
CREATE INDEX IF NOT EXISTS idx_player_achievements_completed ON public.player_achievements(is_completed) WHERE is_completed = true;
CREATE INDEX IF NOT EXISTS idx_user_friendships_requester ON public.user_friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_user_friendships_addressee ON public.user_friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_type ON public.leaderboard_cache(leaderboard_type);
CREATE INDEX IF NOT EXISTS idx_system_events_user_id ON public.system_events(user_id);
CREATE INDEX IF NOT EXISTS idx_system_events_type ON public.system_events(event_type);

-- Create functions needed by auth system

-- Function to initialize user preferences
CREATE OR REPLACE FUNCTION initialize_user_preferences(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.user_preferences (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- Function to initialize player statistics
CREATE OR REPLACE FUNCTION initialize_player_statistics(p_player_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- This is a placeholder - actual implementation would initialize specific stats
    INSERT INTO public.public_profiles (profile_id, display_name)
    SELECT p_player_id, 'Player_' || substr(p_player_id::text, 1, 8)
    ON CONFLICT (profile_id) DO NOTHING;
END;
$$;

-- Function to create user session
CREATE OR REPLACE FUNCTION create_user_session(
    p_user_id uuid,
    p_session_token text,
    p_refresh_token text,
    p_device_type text DEFAULT 'unknown',
    p_ip_address text DEFAULT NULL,
    p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Deactivate old sessions
    UPDATE public.user_sessions
    SET is_active = false
    WHERE user_id = p_user_id AND is_active = true;

    -- Create new session
    INSERT INTO public.user_sessions (
        user_id, session_token, refresh_token, device_type, ip_address, user_agent
    ) VALUES (
        p_user_id, p_session_token, p_refresh_token, p_device_type, p_ip_address, p_user_agent
    );
END;
$$;

-- Function to log system events
CREATE OR REPLACE FUNCTION log_system_event(
    p_event_type text,
    p_event_category text,
    p_user_id uuid DEFAULT NULL,
    p_event_data text DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.system_events (event_type, event_category, user_id, event_data)
    VALUES (p_event_type, p_event_category, p_user_id, p_event_data::jsonb);
END;
$$;

-- Function to check achievement progress
CREATE OR REPLACE FUNCTION check_achievement_progress(
    p_player_id uuid,
    p_achievement_type text,
    p_new_value integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- This is a placeholder for achievement logic
    -- Real implementation would check specific achievement criteria
    NULL;
END;
$$;

-- Function to get player current games
CREATE OR REPLACE FUNCTION get_player_current_games(p_player_id uuid)
RETURNS TABLE(game_id uuid, status game_status)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT g.id, g.status
    FROM public.games g
    JOIN public.game_participants gp ON g.id = gp.game_id
    WHERE gp.player_id = p_player_id
    AND g.status IN ('waiting', 'in_progress');
END;
$$;

-- Function to get user activity summary
CREATE OR REPLACE FUNCTION get_user_activity_summary(p_user_id uuid, days_back integer DEFAULT 30)
RETURNS TABLE(games_played_period integer, games_won_period integer)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(DISTINCT gp.game_id)::integer as games_played_period,
        COUNT(DISTINCT CASE WHEN NOT gp.has_lost THEN gp.game_id END)::integer as games_won_period
    FROM public.game_participants gp
    JOIN public.games g ON gp.game_id = g.id
    WHERE gp.player_id = p_user_id
    AND g.created_at >= (now() - make_interval(days => days_back));
END;
$$;

-- Function to check if user is blocked
CREATE OR REPLACE FUNCTION is_user_blocked(blocker_id uuid, blocked_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_friendships
        WHERE requester_id = blocker_id
        AND addressee_id = blocked_id
        AND status = 'blocked'
    );
END;
$$;

-- Enable RLS on new tables
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- User sessions policies
CREATE POLICY "Users can manage own sessions" ON public.user_sessions
    FOR ALL USING (auth.uid() = user_id);

-- User preferences policies
CREATE POLICY "Users can manage own preferences" ON public.user_preferences
    FOR ALL USING (auth.uid() = user_id);

-- Public profiles policies
CREATE POLICY "Public profiles are viewable by all" ON public.public_profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own public profile" ON public.public_profiles
    FOR UPDATE USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert own public profile" ON public.public_profiles
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- Achievement policies
CREATE POLICY "Achievements are viewable by all" ON public.achievements
    FOR SELECT USING (true);

-- Player achievements policies
CREATE POLICY "Users can view own achievements" ON public.player_achievements
    FOR SELECT USING (auth.uid() = player_id);

-- Friendship policies
CREATE POLICY "Users can view friendships they're involved in" ON public.user_friendships
    FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can manage friendships they initiated" ON public.user_friendships
    FOR ALL USING (auth.uid() = requester_id);

-- Leaderboard policies
CREATE POLICY "Leaderboards are viewable by all" ON public.leaderboard_cache
    FOR SELECT USING (true);

-- System events policies (admin only, but allow user to view their own)
CREATE POLICY "Users can view own events" ON public.system_events
    FOR SELECT USING (auth.uid() = user_id);

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_public_profiles_updated_at BEFORE UPDATE ON public.public_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_achievements_updated_at BEFORE UPDATE ON public.player_achievements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_friendships_updated_at BEFORE UPDATE ON public.user_friendships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();