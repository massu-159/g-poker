/**
 * Rate Limiting Middleware
 * Simple memory-based rate limiter for API endpoints
 *
 * Production Note: Consider using Redis-based rate limiting for distributed systems
 */

import { Context, Next } from 'hono'

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const store: RateLimitStore = {}

export interface RateLimitOptions {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum number of requests per window
  message?: string // Custom error message
}

/**
 * Rate limiting middleware factory
 */
export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later',
  } = options

  return async (c: Context, next: Next) => {
    // Debug: Log environment variables (temporary)
    console.log('[RateLimit] NODE_ENV:', process.env.NODE_ENV)
    console.log('[RateLimit] E2E_TEST:', process.env.E2E_TEST)

    // Bypass rate limiting in test/E2E environment
    if (process.env.NODE_ENV === 'test' || process.env.E2E_TEST === 'true') {
      console.log('[RateLimit] BYPASSED for path:', c.req.path)
      return next()
    }

    // Get client identifier (IP address or user ID)
    const clientId =
      c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP') || 'unknown'

    // Create a unique key for this client and endpoint
    const key = `${clientId}:${c.req.path}`

    const now = Date.now()

    // Initialize or get existing rate limit data
    if (!store[key] || store[key].resetTime < now) {
      store[key] = {
        count: 1,
        resetTime: now + windowMs,
      }
      return next()
    }

    // Increment request count
    store[key].count++

    // Check if limit exceeded
    if (store[key].count > maxRequests) {
      const retryAfter = Math.ceil((store[key].resetTime - now) / 1000)

      return c.json(
        {
          error: message,
          retryAfter,
        },
        429,
        {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(store[key].resetTime).toISOString(),
        }
      )
    }

    // Add rate limit headers
    const remaining = maxRequests - store[key].count
    c.header('X-RateLimit-Limit', maxRequests.toString())
    c.header('X-RateLimit-Remaining', remaining.toString())
    c.header('X-RateLimit-Reset', new Date(store[key].resetTime).toISOString())

    return next()
  }
}

/**
 * Cleanup old entries periodically
 * Run this in a setInterval in production
 */
export function cleanupRateLimitStore() {
  const now = Date.now()
  Object.keys(store).forEach(key => {
    if (store[key].resetTime < now) {
      delete store[key]
    }
  })
}

// Auto-cleanup every 5 minutes
if (process.env.NODE_ENV !== 'test') {
  // eslint-disable-next-line no-undef
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000)
}
