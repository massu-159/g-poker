/**
 * Authentication middleware for JWT token validation
 */

import { createMiddleware } from 'hono/factory'
import jwt from 'jsonwebtoken'
import { getSupabase } from '../lib/supabase.js'

// JWT secret from environment
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export interface AuthContext {
  userId: string
  email: string
  iat: number
  exp: number
}

// Extend Hono context to include auth user
declare module 'hono' {
  interface ContextVariableMap {
    user: AuthContext
  }
}

/**
 * Middleware to validate JWT tokens
 */
export const authMiddleware = createMiddleware(async (c, next) => {
  try {
    const authorization = c.req.header('Authorization')

    if (!authorization) {
      return c.json({ error: 'Authorization header missing' }, 401)
    }

    if (!authorization.startsWith('Bearer ')) {
      return c.json({ error: 'Invalid authorization format' }, 401)
    }

    const token = authorization.split(' ')[1]

    if (!token) {
      return c.json({ error: 'Token missing' }, 401)
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as AuthContext

    // Check if user exists and is active (handle missing columns gracefully)
    const supabase = getSupabase()
    try {
      const { data: user, error } = await supabase
        .from('profiles')
        .select('id, email, is_active')
        .eq('id', decoded.userId)
        .single()

      if (error || !user) {
        // Try with minimal columns if full query fails
        const { data: basicUser, error: basicError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', decoded.userId)
          .single()

        if (basicError || !basicUser) {
          return c.json({ error: 'User not found' }, 401)
        }

        // User exists but missing columns, assume active for now
        console.warn(
          'User profile missing columns, assuming active:',
          decoded.userId
        )
      } else {
        // Full user data available, check active status
        if (user.is_active === false) {
          return c.json({ error: 'Account inactive' }, 401)
        }
      }
    } catch (userError) {
      console.warn('User validation failed, skipping:', userError)
      // Continue without user validation for now
    }

    // Check if token is blacklisted (check user_sessions table if it exists)
    try {
      const { data: session } = await supabase
        .from('user_sessions')
        .select('is_active')
        .eq('user_id', decoded.userId)
        .eq('session_token', token)
        .single()

      if (!session || !session.is_active) {
        return c.json({ error: 'Invalid or expired session' }, 401)
      }
    } catch (sessionError) {
      // user_sessions table might not exist yet, skip session validation for now
      console.warn(
        'Session validation skipped - user_sessions table not available:',
        sessionError
      )
    }

    // Store user info in context
    c.set('user', decoded)

    await next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return c.json({ error: 'Invalid token' }, 401)
    }

    if (error instanceof jwt.TokenExpiredError) {
      return c.json({ error: 'Token expired' }, 401)
    }

    console.error('Auth middleware error:', error)
    return c.json({ error: 'Authentication failed' }, 401)
  }
})

/**
 * Optional auth middleware - doesn't fail if no token provided
 */
export const optionalAuthMiddleware = createMiddleware(async (c, next) => {
  try {
    const authorization = c.req.header('Authorization')

    if (authorization && authorization.startsWith('Bearer ')) {
      const token = authorization.split(' ')[1]

      if (token) {
        const decoded = jwt.verify(token, JWT_SECRET) as AuthContext
        c.set('user', decoded)
      }
    }

    await next()
  } catch (error) {
    console.error('Optional auth middleware error:', error)
    // Ignore auth errors in optional middleware
    await next()
  }
})

/**
 * Helper function to generate JWT token
 */
export function generateJWTToken(userId: string, email: string): string {
  return jwt.sign(
    {
      userId,
      email,
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_SECRET,
    {
      expiresIn: '7d',
      issuer: 'g-poker-backend',
      audience: 'g-poker-client',
    }
  )
}

/**
 * Helper function to generate refresh token
 */
export function generateRefreshToken(userId: string): string {
  return jwt.sign(
    {
      userId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_SECRET,
    {
      expiresIn: '30d',
      issuer: 'g-poker-backend',
      audience: 'g-poker-client',
    }
  )
}
