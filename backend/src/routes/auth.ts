/**
 * Authentication API routes
 */

import { Hono } from 'hono'
import jwt from 'jsonwebtoken'
import {
  authMiddleware,
  generateJWTToken,
  generateRefreshToken,
} from '../middleware/auth.js'
import { z } from 'zod'
import { validator } from 'hono/validator'
import { getSupabase } from '../lib/supabase.js'

const auth = new Hono()

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(50),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30)
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'Username can only contain letters, numbers, and underscores'
    ),
})

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
})

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
})

/**
 * POST /api/auth/register
 * Register a new user account
 */
auth.post(
  '/register',
  validator('json', (value, c) => {
    const parsed = registerSchema.safeParse(value)
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
      const { email, password, displayName, username } = c.req.valid('json')
      const supabase = getSupabase()

      // Check if email already exists
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single()

      if (existingUser) {
        return c.json({ error: 'Email already registered' }, 409)
      }

      // Check if username already exists
      const { data: existingUsername } = await supabase
        .from('public_profiles')
        .select('id')
        .eq('display_name', username)
        .single()

      if (existingUsername) {
        return c.json({ error: 'Username already taken' }, 409)
      }

      // Create user in Supabase Auth (Supabase handles password hashing internally)
      const { data: authUser, error: authError } =
        await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        })

      if (authError || !authUser.user) {
        console.error('Auth user creation error:', authError)
        return c.json({ error: 'Failed to create user account' }, 500)
      }

      // Create profile record
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authUser.user.id,
        email,
        is_active: true,
      })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        // Clean up auth user if profile creation fails
        await supabase.auth.admin.deleteUser(authUser.user.id)
        return c.json({ error: 'Failed to create user profile' }, 500)
      }

      // Create public profile record
      const { error: publicProfileError } = await supabase
        .from('public_profiles')
        .insert({
          profile_id: authUser.user.id,
          display_name: displayName,
        })

      if (publicProfileError) {
        console.error('Public profile creation error:', publicProfileError)
        return c.json({ error: 'Failed to create public profile' }, 500)
      }

      // Initialize user preferences and statistics (if functions exist)
      try {
        await supabase.rpc('initialize_user_preferences', {
          p_user_id: authUser.user.id,
        })
      } catch (prefError) {
        console.warn('User preferences initialization skipped:', prefError)
      }

      try {
        await supabase.rpc('initialize_player_statistics', {
          p_player_id: authUser.user.id,
        })
      } catch (statsError) {
        console.warn('Player statistics initialization skipped:', statsError)
      }

      // Generate tokens
      const accessToken = generateJWTToken(authUser.user.id, email)
      const refreshToken = generateRefreshToken(authUser.user.id)

      // Create user session (if function exists)
      try {
        await supabase.rpc('create_user_session', {
          p_user_id: authUser.user.id,
          p_session_token: accessToken,
          p_refresh_token: refreshToken,
          p_device_type: c.req.header('User-Agent')?.includes('Mobile')
            ? 'mobile'
            : 'desktop',
          p_ip_address:
            c.req.header('X-Forwarded-For') ||
            c.req.header('X-Real-IP') ||
            'unknown',
          p_user_agent: c.req.header('User-Agent'),
        })
      } catch (sessionError) {
        console.warn(
          'Session creation skipped - function not available:',
          sessionError
        )
      }

      // Log registration event (if function exists)
      try {
        await supabase.rpc('log_system_event', {
          p_event_type: 'user_registration',
          p_event_category: 'user_action',
          p_user_id: authUser.user.id,
          p_event_data: JSON.stringify({ email, display_name: displayName }),
        })
      } catch (logError) {
        console.warn(
          'Event logging skipped - function not available:',
          logError
        )
      }

      return c.json(
        {
          message: 'Registration successful',
          user: {
            id: authUser.user.id,
            email,
            displayName,
          },
          tokens: {
            accessToken,
            refreshToken,
          },
        },
        201
      )
    } catch (error) {
      console.error('Registration error:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
  }
)

/**
 * POST /api/auth/login
 * Authenticate user and return tokens
 */
auth.post(
  '/login',
  validator('json', (value, c) => {
    const parsed = loginSchema.safeParse(value)
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
      const { email, password } = c.req.valid('json')
      const supabase = getSupabase()

      // Get user by email
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select(
          `
          id,
          email,
          is_active,
          public_profiles (
            display_name,
            avatar_url
          )
        `
        )
        .eq('email', email)
        .single()

      if (userError || !user) {
        return c.json({ error: 'Invalid credentials' }, 401)
      }

      if (!user.is_active) {
        return c.json({ error: 'Account is inactive' }, 401)
      }

      // Verify password with Supabase Auth
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        })

      if (authError || !authData.user) {
        return c.json({ error: 'Invalid credentials' }, 401)
      }

      // Generate new tokens
      const accessToken = generateJWTToken(user.id, email)
      const refreshToken = generateRefreshToken(user.id)

      // Create new user session
      await supabase.rpc('create_user_session', {
        p_user_id: user.id,
        p_session_token: accessToken,
        p_refresh_token: refreshToken,
        p_device_type: c.req.header('User-Agent')?.includes('Mobile')
          ? 'mobile'
          : 'desktop',
        p_ip_address:
          c.req.header('X-Forwarded-For') ||
          c.req.header('X-Real-IP') ||
          'unknown',
        p_user_agent: c.req.header('User-Agent'),
      })

      // Update last seen
      await supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', user.id)

      // Log login event
      await supabase.rpc('log_system_event', {
        p_event_type: 'user_login',
        p_event_category: 'user_action',
        p_user_id: user.id,
        p_event_data: JSON.stringify({ email }),
      })

      return c.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          displayName: user.public_profiles?.[0]?.display_name,
          avatarUrl: user.public_profiles?.[0]?.avatar_url,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      })
    } catch (error) {
      console.error('Login error:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
  }
)

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
auth.post(
  '/refresh',
  validator('json', (value, c) => {
    const parsed = refreshSchema.safeParse(value)
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
      const { refreshToken } = c.req.valid('json')
      const supabase = getSupabase()

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET!) as any

      if (decoded.type !== 'refresh') {
        return c.json({ error: 'Invalid refresh token' }, 401)
      }

      // Check if refresh token exists and is active
      const { data: session, error: sessionError } = await supabase
        .from('user_sessions')
        .select('user_id, is_active')
        .eq('refresh_token', refreshToken)
        .eq('is_active', true)
        .single()

      if (sessionError || !session) {
        return c.json({ error: 'Invalid or expired refresh token' }, 401)
      }

      // Get user info
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('id, email, is_active')
        .eq('id', session.user_id)
        .single()

      if (userError || !user || !user.is_active) {
        return c.json({ error: 'User not found or inactive' }, 401)
      }

      // Generate new tokens
      const newAccessToken = generateJWTToken(user.id, user.email)
      const newRefreshToken = generateRefreshToken(user.id)

      // Update session with new tokens
      await supabase
        .from('user_sessions')
        .update({
          session_token: newAccessToken,
          refresh_token: newRefreshToken,
          last_activity_at: new Date().toISOString(),
        })
        .eq('refresh_token', refreshToken)

      return c.json({
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        },
      })
    } catch (error) {
      console.error('Refresh token error:', error)
      return c.json({ error: 'Invalid refresh token' }, 401)
    }
  }
)

/**
 * POST /api/auth/logout
 * Logout user and invalidate session
 */
auth.post('/logout', authMiddleware, async c => {
  try {
    const user = c.get('user')
    const authorization = c.req.header('Authorization')
    const token = authorization?.split(' ')[1]
    const supabase = getSupabase()

    if (token) {
      // Deactivate session
      await supabase
        .from('user_sessions')
        .update({
          is_active: false,
          terminated_at: new Date().toISOString(),
        })
        .eq('session_token', token)

      // Log logout event
      await supabase.rpc('log_system_event', {
        p_event_type: 'user_logout',
        p_event_category: 'user_action',
        p_user_id: user.userId,
        p_event_data: JSON.stringify({}),
      })
    }

    return c.json({ message: 'Logout successful' })
  } catch (error) {
    console.error('Logout error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * GET /api/auth/me
 * Get current user profile
 */
auth.get('/me', authMiddleware, async c => {
  try {
    const user = c.get('user')
    const supabase = getSupabase()

    // Get full user profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select(
        `
        id,
        email,
        last_seen_at,
        is_active,
        public_profiles (
          display_name,
          avatar_url
        ),
        user_preferences (
          theme,
          language,
          sound_enabled
        )
      `
      )
      .eq('id', user.userId)
      .single()

    if (error || !profile) {
      return c.json({ error: 'User profile not found' }, 404)
    }

    return c.json({
      user: {
        id: profile.id,
        email: profile.email,
        displayName: profile.public_profiles?.[0]?.display_name,
        avatarUrl: profile.public_profiles?.[0]?.avatar_url,
        lastSeenAt: profile.last_seen_at,
        preferences: profile.user_preferences?.[0],
      },
    })
  } catch (error) {
    console.error('Get profile error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default auth
