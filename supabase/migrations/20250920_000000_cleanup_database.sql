-- Database cleanup before applying new migrations
-- Remove old/outdated tables and functions

-- Drop old tables if they exist (from previous poker implementation)
DROP TABLE IF EXISTS public.poker_hands CASCADE;
DROP TABLE IF EXISTS public.poker_betting_rounds CASCADE;
DROP TABLE IF EXISTS public.poker_chips CASCADE;
DROP TABLE IF EXISTS public.poker_tournaments CASCADE;
DROP TABLE IF EXISTS public.room_participants CASCADE;
DROP TABLE IF EXISTS public.room_settings CASCADE;
DROP TABLE IF EXISTS public.game_sessions CASCADE;
DROP TABLE IF EXISTS public.server_events CASCADE;

-- Drop old functions if they exist
DROP FUNCTION IF EXISTS public.calculate_poker_hand_strength(jsonb);
DROP FUNCTION IF EXISTS public.process_poker_betting_round(uuid, uuid, text, numeric);
DROP FUNCTION IF EXISTS public.update_poker_chip_count(uuid, numeric);
DROP FUNCTION IF EXISTS public.validate_poker_hand(jsonb);
DROP FUNCTION IF EXISTS public.create_poker_tournament(uuid, text, numeric, integer);

-- Drop old views if they exist
DROP VIEW IF EXISTS public.active_poker_games;
DROP VIEW IF EXISTS public.player_poker_statistics;
DROP VIEW IF EXISTS public.tournament_leaderboard;

-- Drop old sequences if they exist
DROP SEQUENCE IF EXISTS public.poker_hand_sequence;
DROP SEQUENCE IF EXISTS public.tournament_sequence;

-- Drop old indexes that might conflict
DROP INDEX IF EXISTS idx_poker_hands_player_id;
DROP INDEX IF EXISTS idx_poker_betting_rounds_game_id;
DROP INDEX IF EXISTS idx_room_participants_room_id;
DROP INDEX IF EXISTS idx_game_sessions_player_id;

-- Drop old types if they exist
DROP TYPE IF EXISTS poker_hand_type CASCADE;
DROP TYPE IF EXISTS betting_action_type CASCADE;
DROP TYPE IF EXISTS tournament_status CASCADE;

-- Clean up old RLS policies
DROP POLICY IF EXISTS "poker_hands_policy" ON public.poker_hands;
DROP POLICY IF EXISTS "room_participants_policy" ON public.room_participants;
DROP POLICY IF EXISTS "game_sessions_policy" ON public.game_sessions;

-- Drop old triggers
DROP TRIGGER IF EXISTS update_poker_statistics_trigger ON public.poker_hands;
DROP TRIGGER IF EXISTS validate_betting_action_trigger ON public.poker_betting_rounds;

-- Reset any old enum values (preserve the ones we still need)
-- creature_type and game_status should be preserved as they're used in current schema

-- Clean up any orphaned data
DELETE FROM public.profiles WHERE id NOT IN (SELECT id FROM auth.users);

-- Update any existing profiles to have required fields
UPDATE public.profiles
SET
    email = COALESCE(email, 'unknown@example.com'),
    is_active = COALESCE(is_active, true),
    last_seen_at = COALESCE(last_seen_at, now())
WHERE email IS NULL OR is_active IS NULL OR last_seen_at IS NULL;

-- Clean up any test data
DELETE FROM public.games WHERE creator_id NOT IN (SELECT id FROM public.profiles);
DELETE FROM public.game_participants WHERE player_id NOT IN (SELECT id FROM public.profiles);
DELETE FROM public.game_rounds WHERE game_id NOT IN (SELECT id FROM public.games);
DELETE FROM public.game_actions WHERE player_id NOT IN (SELECT id FROM public.profiles);

-- Add a comment to track cleanup
COMMENT ON SCHEMA public IS 'Cleaned up on 2025-01-21 - removed old poker tables and functions';

-- Reset sequences to avoid conflicts
SELECT setval('public.profiles_id_seq', COALESCE(MAX(id::text::bigint), 1)) FROM public.profiles WHERE id ~ '^[0-9]+$';

-- Vacuum and analyze after cleanup
VACUUM ANALYZE;