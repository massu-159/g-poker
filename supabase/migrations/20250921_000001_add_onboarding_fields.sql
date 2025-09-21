-- Add onboarding and tutorial fields to profiles table
-- Enables tracking of user tutorial completion and onboarding state

-- Add onboarding fields to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tutorial_completed boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tutorial_completed_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_version text DEFAULT '1.0.0';

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.tutorial_completed IS 'Has completed Cockroach Poker tutorial';
COMMENT ON COLUMN public.profiles.tutorial_completed_at IS 'When tutorial was completed';
COMMENT ON COLUMN public.profiles.onboarding_version IS 'App version when onboarded';

-- Update existing profiles to have default onboarding version
UPDATE public.profiles
SET onboarding_version = '1.0.0'
WHERE onboarding_version IS NULL;

-- Create index for efficient tutorial completion queries
CREATE INDEX IF NOT EXISTS idx_profiles_tutorial_completed
ON public.profiles(tutorial_completed, tutorial_completed_at)
WHERE tutorial_completed = true;