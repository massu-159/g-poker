/**
 * User management API routes
 */

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import { z } from 'zod'
import { validator } from 'hono/validator'
import { getSupabase } from '../lib/supabase.js'

const users = new Hono()

// Validation schemas
const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  avatarUrl: z.string().url().optional(),
  bio: z.string().max(500).optional(),
})

const updatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).optional(),
  language: z.string().min(2).max(10).optional(),
  currency: z.string().min(3).max(10).optional(),
  soundEnabled: z.boolean().optional(),
  soundVolume: z.number().min(0).max(1).optional(),
  voiceChatEnabled: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  gameInvites: z.boolean().optional(),
  tournamentAlerts: z.boolean().optional(),
  friendActivity: z.boolean().optional(),
  showOnlineStatus: z.boolean().optional(),
  allowFriendRequests: z.boolean().optional(),
  showStatisticsPublicly: z.boolean().optional(),
  allowSpectators: z.boolean().optional(),
  actionTimeoutSeconds: z.number().min(15).max(120).optional(),
  animationSpeed: z.enum(['slow', 'normal', 'fast', 'off']).optional(),
  autoMuckLosingHands: z.boolean().optional(),
  showMuckedCards: z.boolean().optional(),
  autoFoldEnabled: z.boolean().optional(),
  autoCheckEnabled: z.boolean().optional(),
  showHandStrength: z.boolean().optional(),
  quickBetAmounts: z.array(z.number()).optional(),
  tableBackground: z.string().max(50).optional(),
  cardBackDesign: z.string().max(50).optional(),
  mobileCardSize: z.enum(['small', 'medium', 'large']).optional(),
  mobileVibrationEnabled: z.boolean().optional(),
  mobileLowPowerMode: z.boolean().optional(),
})

/**
 * GET /api/users/me
 * Get current user's complete profile
 */
users.get('/me', authMiddleware, async c => {
  try {
    const supabase = getSupabase()
    const user = c.get('user')

    // Get comprehensive user data
    const { data: profile, error } = await supabase
      .from('profiles')
      .select(
        `
        id,
        email,
        created_at,
        last_seen_at,
        is_active,
        tutorial_completed,
        tutorial_completed_at,
        onboarding_version,
        public_profiles (
          display_name,
          avatar_url,
          verification_status,
          games_played,
          games_won,
          win_rate
        ),
        user_preferences (*)
      `
      )
      .eq('id', user.userId)
      .single()

    if (error || !profile) {
      return c.json({ error: 'User profile not found' }, 404)
    }

    // Get current active rooms (direct SQL query)
    const { data: activeRooms } = await supabase
      .from('game_participants')
      .select(
        `
        game_id,
        status,
        position,
        games!inner (
          id,
          status,
          max_players,
          current_player_count,
          round_number,
          created_at
        )
      `
      )
      .eq('player_id', user.userId)
      .in('status', ['joined', 'playing'])
      .in('games.status', ['waiting', 'in_progress'])

    // Get recent achievements
    const { data: recentAchievements } = await supabase
      .from('player_achievements')
      .select(
        `
        achievement_id,
        completed_at,
        achievements (
          name,
          description,
          category,
          difficulty
        )
      `
      )
      .eq('player_id', user.userId)
      .eq('is_completed', true)
      .order('completed_at', { ascending: false })
      .limit(5)

    // Get friend count
    const { count: friendCount } = await supabase
      .from('user_friendships')
      .select('*', { count: 'exact', head: true })
      .or(`requester_id.eq.${user.userId},addressee_id.eq.${user.userId}`)
      .eq('status', 'accepted')

    return c.json({
      user: {
        id: profile.id,
        email: profile.email,
        displayName: profile.public_profiles?.[0]?.display_name,
        avatarUrl: profile.public_profiles?.[0]?.avatar_url,
        verificationStatus: profile.public_profiles?.[0]?.verification_status,
        createdAt: profile.created_at,
        lastSeenAt: profile.last_seen_at,
        isActive: profile.is_active,
        tutorialCompleted: profile.tutorial_completed,
        tutorialCompletedAt: profile.tutorial_completed_at,
        onboardingVersion: profile.onboarding_version,
        preferences: profile.user_preferences?.[0],
        statistics: {
          gamesPlayed: profile.public_profiles?.[0]?.games_played || 0,
          gamesWon: profile.public_profiles?.[0]?.games_won || 0,
          winRate: profile.public_profiles?.[0]?.win_rate || 0,
          // Cockroach Poker game statistics from public_profiles
          friendCount: friendCount || 0,
        },
        currentRooms: activeRooms || [],
        recentAchievements: recentAchievements || [],
      },
    })
  } catch (error) {
    console.error('Get user profile error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * PUT /api/users/me/profile
 * Update user's public profile
 */
users.put(
  '/me/profile',
  authMiddleware,
  validator('json', (value, c) => {
    const parsed = updateProfileSchema.safeParse(value)
    if (!parsed.success) {
      return c.json(
        { error: 'Validation failed', details: parsed.error.issues },
        400
      )
    }
    return parsed.data
  }),
  async c => {
    try {
      const supabase = getSupabase()
      const user = c.get('user')
      const updateData = c.req.valid('json')

      // Check if display name is taken (if being updated)
      if (updateData.displayName) {
        const { data: existingUser } = await supabase
          .from('public_profiles')
          .select('profile_id')
          .eq('display_name', updateData.displayName)
          .neq('profile_id', user.userId)
          .single()

        if (existingUser) {
          return c.json({ error: 'Display name already taken' }, 409)
        }
      }

      // Update public profile
      const { data: updatedProfile, error } = await supabase
        .from('public_profiles')
        .update({
          display_name: updateData.displayName,
          avatar_url: updateData.avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('profile_id', user.userId)
        .select()
        .single()

      if (error) {
        console.error('Profile update error:', error)
        return c.json({ error: 'Failed to update profile' }, 500)
      }

      return c.json({
        message: 'Profile updated successfully',
        profile: updatedProfile,
      })
    } catch (error) {
      console.error('Update profile error:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
  }
)

/**
 * PUT /api/users/me/preferences
 * Update user's preferences
 */
users.put(
  '/me/preferences',
  authMiddleware,
  validator('json', (value, c) => {
    const parsed = updatePreferencesSchema.safeParse(value)
    if (!parsed.success) {
      return c.json(
        { error: 'Validation failed', details: parsed.error.issues },
        400
      )
    }
    return parsed.data
  }),
  async c => {
    try {
      const supabase = getSupabase()
      const user = c.get('user')
      const updateData = c.req.valid('json')

      // Update preferences
      const { data: updatedPreferences, error } = await supabase
        .from('user_preferences')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.userId)
        .select()
        .single()

      if (error) {
        console.error('Preferences update error:', error)
        return c.json({ error: 'Failed to update preferences' }, 500)
      }

      return c.json({
        message: 'Preferences updated successfully',
        preferences: updatedPreferences,
      })
    } catch (error) {
      console.error('Update preferences error:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
  }
)

/**
 * GET /api/users/me/statistics
 * Get detailed user statistics
 */
users.get('/me/statistics', authMiddleware, async c => {
  try {
    const supabase = getSupabase()
    const user = c.get('user')
    const days = parseInt(c.req.query('days') || '30')

    // Get game participation statistics (direct SQL query)
    const cutoffDate = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000
    ).toISOString()

    const { data: gameStats } = await supabase
      .from('game_participants')
      .select(
        'game_id, has_lost, losing_creature_type, joined_at, games!inner(status)'
      )
      .eq('player_id', user.userId)
      .gte('joined_at', cutoffDate)

    // Calculate activity summary from gameStats
    const totalGamesPlayed = gameStats?.length || 0
    const gamesWon =
      gameStats?.filter(
        g => !g.has_lost && (g.games as any)?.status === 'completed'
      ).length || 0
    const activitySummary = {
      total_games_played: totalGamesPlayed,
      total_games_won: gamesWon,
      win_rate: totalGamesPlayed > 0 ? (gamesWon / totalGamesPlayed) * 100 : 0,
      period_days: days,
    }

    // Get achievement progress
    const { data: achievements } = await supabase
      .from('player_achievements')
      .select(
        `
        achievement_id,
        progress,
        is_completed,
        completed_at,
        achievements (
          name,
          description,
          category,
          difficulty
        )
      `
      )
      .eq('player_id', user.userId)
      .order('progress', { ascending: false })

    // Get leaderboard positions
    const { data: leaderboardPositions } = await supabase
      .from('leaderboard_cache')
      .select('leaderboard_type, rank')
      .eq('player_id', user.userId)

    return c.json({
      statistics: {
        activitySummary: activitySummary || {},
        gameStats: gameStats || [],
        achievements: achievements || [],
        leaderboardPositions: leaderboardPositions || [],
        period: `${days} days`,
      },
    })
  } catch (error) {
    console.error('Get statistics error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * GET /api/users/me/games
 * Get user's game history
 */
users.get('/me/games', authMiddleware, async c => {
  try {
    const supabase = getSupabase()
    const user = c.get('user')
    const page = parseInt(c.req.query('page') || '1')
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50)
    const offset = (page - 1) * limit

    // Get game history
    const { data: gameHistory, error } = await supabase
      .from('game_participants')
      .select(
        `
        game_id,
        has_lost,
        losing_creature_type,
        joined_at,
        games (
          id,
          status,
          created_at,
          round_number
        )
      `
      )
      .eq('player_id', user.userId)
      .order('joined_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Game history error:', error)
      return c.json({ error: 'Failed to fetch game history' }, 500)
    }

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('game_participants')
      .select('*', { count: 'exact', head: true })
      .eq('player_id', user.userId)

    return c.json({
      games: gameHistory || [],
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Get game history error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /api/users/me/tutorial-complete
 * Mark tutorial as completed
 */
users.post('/me/tutorial-complete', authMiddleware, async c => {
  try {
    const supabase = getSupabase()
    const user = c.get('user')

    // Update tutorial status
    const { error } = await supabase
      .from('profiles')
      .update({
        tutorial_completed: true,
        tutorial_completed_at: new Date().toISOString(),
      })
      .eq('id', user.userId)

    if (error) {
      console.error('Tutorial completion error:', error)
      return c.json({ error: 'Failed to update tutorial status' }, 500)
    }

    return c.json({ message: 'Tutorial marked as completed' })
  } catch (error) {
    console.error('Tutorial completion error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * GET /api/users/:id/profile
 * Get public profile of another user
 */
users.get('/:id/profile', authMiddleware, async c => {
  try {
    const supabase = getSupabase()
    const userId = c.req.param('id')
    const currentUser = c.get('user')

    // Get public profile data
    const { data: profile, error } = await supabase
      .from('public_profiles')
      .select(
        `
        profile_id,
        display_name,
        avatar_url,
        verification_status,
        games_played,
        games_won,
        win_rate,
        created_at,
        profiles!inner (
          last_seen_at,
          is_active
        ),
        user_preferences!inner (
          show_statistics_publicly,
          show_online_status
        )
      `
      )
      .eq('profile_id', userId)
      .single()

    if (error || !profile) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Check friendship status
    const { data: friendship } = await supabase
      .from('user_friendships')
      .select('status')
      .or(
        `requester_id.eq.${currentUser.userId},addressee_id.eq.${currentUser.userId}`
      )
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .single()

    // Get public achievements if statistics are public
    let achievements: any[] = []
    if ((profile.user_preferences as any)?.[0]?.show_statistics_publicly) {
      const { data: publicAchievements } = await supabase
        .from('player_achievements')
        .select(
          `
          completed_at,
          achievements (
            name,
            description,
            category,
            difficulty
          )
        `
        )
        .eq('player_id', userId)
        .eq('is_completed', true)
        .order('completed_at', { ascending: false })
        .limit(10)

      achievements = publicAchievements || []
    }

    return c.json({
      user: {
        id: profile.profile_id,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
        verificationStatus: profile.verification_status,
        gamesPlayed: (profile.user_preferences as any)?.[0]
          ?.show_statistics_publicly
          ? profile.games_played
          : null,
        gamesWon: (profile.user_preferences as any)?.[0]
          ?.show_statistics_publicly
          ? profile.games_won
          : null,
        winRate: (profile.user_preferences as any)?.[0]
          ?.show_statistics_publicly
          ? profile.win_rate
          : null,
        lastSeenAt: (profile.user_preferences as any)?.[0]?.show_online_status
          ? (profile.profiles as any)?.last_seen_at
          : null,
        isOnline: (profile.user_preferences as any)?.[0]?.show_online_status
          ? (profile.profiles as any)?.is_active
          : null,
        friendshipStatus: friendship?.status || 'none',
        achievements: achievements,
      },
    })
  } catch (error) {
    console.error('Get public profile error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default users
