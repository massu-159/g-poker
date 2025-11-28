/**
 * Authentication API routes
 */

import { Hono } from 'hono'
import jwt from 'jsonwebtoken'
import {
  authMiddleware,
  generateJWTToken,
  generateRefreshToken,
  hashToken,
  getJWTSecret,
} from '../middleware/auth.js'
import { getAuthAdminClient } from '../lib/supabase.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { z } from 'zod'
import { validator } from 'hono/validator'
import { getSupabase } from '../lib/supabase.js'

const auth = new Hono()

// Rate limit configurations
const registerRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 3,
  message: 'Too many registration attempts, please try again later',
})

const loginRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5,
  message: 'Too many login attempts, please try again later',
})

const refreshRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: 'Too many token refresh attempts, please try again later',
})

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
  registerRateLimit,
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
      // Use dedicated auth client to prevent session contamination of singleton client
      // Note: Database trigger (handle_new_user) automatically creates profile and public_profile records
      const authAdminClient = getAuthAdminClient()
      const { data: authUser, error: authError } =
        await authAdminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            display_name: displayName,
            username: username,
          },
        })

      if (authError || !authUser.user) {
        console.error('[Registration] Auth user creation error:', authError)
        return c.json({ error: 'Failed to create user account' }, 500)
      }

      console.log('[Registration] Auth user created:', authUser.user.id)

      // Wait for database trigger (handle_new_user) to complete profile creation
      // Trigger uses SECURITY DEFINER to bypass RLS policies
      console.log(
        '[Registration] Waiting for trigger to create profiles for user:',
        authUser.user.id
      )

      const maxRetries = 10
      const retryDelay = 300 // ms
      let profileCreated = false

      for (let i = 0; i < maxRetries; i++) {
        // Check if profiles were created by trigger
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', authUser.user.id)
          .maybeSingle()

        const { data: publicProfile } = await supabase
          .from('public_profiles')
          .select('profile_id')
          .eq('profile_id', authUser.user.id)
          .maybeSingle()

        if (profile && publicProfile) {
          console.log(
            `[Registration] ✅ Trigger completed after ${i * retryDelay}ms`
          )
          profileCreated = true
          break
        }

        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        }
      }

      if (!profileCreated) {
        console.error('[Registration] ❌ Trigger failed to create profiles')
        // Cleanup: delete auth user (use separate client to avoid session contamination)
        const cleanupClient = getAuthAdminClient()
        await cleanupClient.auth.admin.deleteUser(authUser.user.id)
        return c.json({ error: 'Failed to create user profile' }, 500)
      }

      // Initialize user preferences (direct insert, defaults from table schema)
      try {
        await supabase.from('user_preferences').insert({
          user_id: authUser.user.id,
          // Other columns use DEFAULT values from table schema:
          // theme: 'dark', language: 'en', sound_enabled: true, etc.
        })
      } catch (prefError) {
        console.warn(
          '[Registration] User preferences initialization skipped:',
          prefError
        )
      }

      // Generate tokens
      const accessToken = generateJWTToken(authUser.user.id, email)
      const refreshToken = generateRefreshToken(authUser.user.id)

      // Create user session directly (using service_role RLS policy)
      const deviceType = c.req.header('User-Agent')?.includes('Mobile')
        ? 'mobile'
        : 'desktop'
      const ipAddress =
        c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP') || null // Use null instead of 'unknown' for inet type

      console.log('[Registration] Creating session for user:', authUser.user.id)
      const { data: sessionData, error: sessionError } = await supabase
        .from('user_sessions')
        .insert({
          user_id: authUser.user.id,
          session_token: hashToken(accessToken), // Hash for security
          refresh_token: hashToken(refreshToken), // Hash for security
          device_type: deviceType,
          ip_address: ipAddress,
          user_agent: c.req.header('User-Agent') || null,
          is_active: true,
          last_activity_at: new Date().toISOString(),
          expires_at: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(), // 7 days
        })
        .select()

      if (sessionError) {
        console.error('[Registration] Session creation failed:', sessionError)
        console.error(
          '[Registration] Session error details:',
          JSON.stringify(sessionError)
        )
      } else {
        console.log('[Registration] Session created successfully:', sessionData)
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
  loginRateLimit,
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
      // Use dedicated auth client to prevent session contamination of singleton client
      const authClient = getAuthAdminClient()
      const { data: authData, error: authError } =
        await authClient.auth.signInWithPassword({
          email,
          password,
        })

      if (authError || !authData.user) {
        return c.json({ error: 'Invalid credentials' }, 401)
      }

      // Generate new tokens
      const accessToken = generateJWTToken(user.id, email)
      const refreshToken = generateRefreshToken(user.id)

      // Create new user session directly (using service_role RLS policy)
      const deviceType = c.req.header('User-Agent')?.includes('Mobile')
        ? 'mobile'
        : 'desktop'
      const ipAddress =
        c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP') || null // Use null instead of 'unknown' for inet type

      console.log('[Login] Creating session for user:', user.id)
      const { data: sessionData, error: sessionError } = await supabase
        .from('user_sessions')
        .insert({
          user_id: user.id,
          session_token: hashToken(accessToken), // Hash for security
          refresh_token: hashToken(refreshToken), // Hash for security
          device_type: deviceType,
          ip_address: ipAddress,
          user_agent: c.req.header('User-Agent') || null,
          is_active: true,
          last_activity_at: new Date().toISOString(),
          expires_at: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(), // 7 days
        })
        .select()

      if (sessionError) {
        console.error('[Login] Session creation failed:', sessionError)
        console.error(
          '[Login] Session error details:',
          JSON.stringify(sessionError)
        )
      } else {
        console.log('[Login] Session created successfully:', sessionData)
      }

      // Update last seen
      await supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', user.id)

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
  refreshRateLimit,
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
      const decoded = jwt.verify(refreshToken, getJWTSecret()) as any

      if (decoded.type !== 'refresh') {
        return c.json({ error: 'Invalid refresh token' }, 401)
      }

      // Check if refresh token exists and is active (hash for lookup)
      const hashedRefreshToken = hashToken(refreshToken)
      const { data: session, error: sessionError } = await supabase
        .from('user_sessions')
        .select('user_id, is_active')
        .eq('refresh_token', hashedRefreshToken)
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

      // Update session with new tokens (hash for security)
      await supabase
        .from('user_sessions')
        .update({
          session_token: hashToken(newAccessToken),
          refresh_token: hashToken(newRefreshToken),
          last_activity_at: new Date().toISOString(),
        })
        .eq('refresh_token', hashedRefreshToken)

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
    const authorization = c.req.header('Authorization')
    const token = authorization?.split(' ')[1]
    const supabase = getSupabase()

    if (token) {
      // Deactivate session (hash token for lookup)
      const hashedToken = hashToken(token)
      await supabase
        .from('user_sessions')
        .update({
          is_active: false,
          terminated_at: new Date().toISOString(),
        })
        .eq('session_token', hashedToken)
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
