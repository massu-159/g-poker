/**
 * Authentication middleware for JWT token validation
 * Updated: 2025-10-30 - Added RLS debugging
 */

import { createMiddleware } from 'hono/factory'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { getSupabase } from '../lib/supabase.js'

export function getJWTSecret(): string {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is not set. ' +
        'Cannot start server without secure token signing.'
    )
  }
  return process.env.JWT_SECRET
}

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
 * Hash a token using SHA-256 for secure storage
 * Prevents token theft if database is compromised
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
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
    const decoded = jwt.verify(token, getJWTSecret()) as AuthContext

    // Verify user exists and is active
    const supabase = getSupabase()
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, email, is_active')
      .eq('id', decoded.userId)
      .single()

    if (userError || !user) {
      console.error('[Auth Middleware] User not found:', decoded.userId)
      return c.json({ error: 'User not found' }, 401)
    }

    if (user.is_active === false) {
      console.warn(
        '[Auth Middleware] Inactive user attempted access:',
        decoded.userId
      )
      return c.json({ error: 'Account inactive' }, 401)
    }

    // Verify session is active
    const hashedToken = hashToken(token)
    const { data: session, error: sessionError } = await supabase
      .from('user_sessions')
      .select('is_active')
      .eq('user_id', decoded.userId)
      .eq('session_token', hashedToken)
      .single()

    if (sessionError || !session) {
      console.error(
        '[Auth Middleware] Session not found:',
        sessionError?.message
      )
      return c.json({ error: 'Invalid or expired session' }, 401)
    }

    if (!session.is_active) {
      console.warn('[Auth Middleware] Inactive session used:', decoded.userId)
      return c.json({ error: 'Session has been terminated' }, 401)
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
        const decoded = jwt.verify(token, getJWTSecret()) as AuthContext
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
    getJWTSecret(),
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
    getJWTSecret(),
    {
      expiresIn: '30d',
      issuer: 'g-poker-backend',
      audience: 'g-poker-client',
    }
  )
}
