/**
 * WebSocket Authentication Handler (T043)
 * Handles Socket.io authentication events per contract specification
 */

import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { getSupabase } from '../lib/supabase.js'
import { getJWTSecret } from '../middleware/auth.js'
import type {
  AuthenticatedSocket,
  AuthenticateEvent,
  AuthenticatedEvent,
  AuthenticationFailedEvent,
} from './types.js'

// Store active connections
const activeConnections = new Map<string, string>() // userId -> connectionId
const connectionDetails = new Map<
  string,
  {
    socketId: string
    userId: string
    deviceId: string
    connectedAt: Date
  }
>() // connectionId -> details

/**
 * Setup authentication event handlers
 */
export function setupAuthenticationHandlers(io: Server) {
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`[Auth] New connection: ${socket.id}`)

    // Handle authentication event
    socket.on('authenticate', async (data: AuthenticateEvent) => {
      await handleAuthentication(socket, data)
    })

    // Handle disconnection
    socket.on('disconnect', () => {
      handleDisconnection(socket)
    })
  })
}

/**
 * Handle authentication request
 */
async function handleAuthentication(
  socket: AuthenticatedSocket,
  data: AuthenticateEvent
) {
  try {
    console.log('[Auth Debug] Starting authentication', {
      hasToken: !!data?.access_token,
      hasDeviceInfo: !!data?.device_info,
    })

    // Validate payload
    if (!data?.access_token || !data?.device_info) {
      console.log('[Auth Debug] Missing authentication data')
      const error: AuthenticationFailedEvent = {
        error_code: 'INVALID_TOKEN',
        message: 'Missing required authentication data',
        requires_login: true,
      }
      socket.emit('authentication_failed', error)
      return
    }

    // Verify JWT token
    let decoded: any
    try {
      console.log('[Auth Debug] Verifying JWT token...')
      decoded = jwt.verify(data.access_token, getJWTSecret())
      console.log('[Auth Debug] JWT decoded:', {
        userId: decoded.userId,
        sub: decoded.sub,
        email: decoded.email,
      })
    } catch (jwtError: any) {
      console.log('[Auth Debug] JWT verification failed:', {
        name: jwtError.name,
        message: jwtError.message,
      })
      let error: AuthenticationFailedEvent

      if (jwtError.name === 'TokenExpiredError') {
        error = {
          error_code: 'TOKEN_EXPIRED',
          message: 'Access token has expired',
          requires_login: true,
        }
      } else {
        error = {
          error_code: 'INVALID_TOKEN',
          message: 'Invalid access token',
          requires_login: true,
        }
      }

      socket.emit('authentication_failed', error)
      return
    }

    const userId = decoded.userId || decoded.sub
    if (!userId) {
      console.log('[Auth Debug] No userId in token')
      const error: AuthenticationFailedEvent = {
        error_code: 'INVALID_TOKEN',
        message: 'Token does not contain user ID',
        requires_login: true,
      }
      socket.emit('authentication_failed', error)
      return
    }

    console.log('[Auth Debug] Querying profile for userId:', userId)

    // Get user profile from database
    const supabase = getSupabase()
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, is_active')
      .eq('id', userId)
      .single()

    console.log('[Auth Debug] Profile query result:', {
      profile,
      profileError,
    })

    if (profileError || !profile) {
      console.log('[Auth Debug] Profile not found or error')
      const error: AuthenticationFailedEvent = {
        error_code: 'INVALID_TOKEN',
        message: 'User profile not found',
        requires_login: true,
      }
      socket.emit('authentication_failed', error)
      return
    }

    // Check if user is banned
    if (!profile.is_active) {
      console.log('[Auth Debug] User is inactive/banned')
      const error: AuthenticationFailedEvent = {
        error_code: 'USER_BANNED',
        message: 'User account has been suspended',
        requires_login: false,
      }
      socket.emit('authentication_failed', error)
      return
    }

    // Get display name from public_profiles
    console.log('[Auth Debug] Querying public_profiles for userId:', userId)
    const { data: publicProfile } = await supabase
      .from('public_profiles')
      .select('display_name')
      .eq('profile_id', userId)
      .single()

    console.log('[Auth Debug] Public profile query result:', { publicProfile })

    // Generate connection ID
    const connectionId = uuidv4()

    // Store authentication data in socket
    socket.userId = userId
    socket.displayName = publicProfile?.display_name || 'Anonymous'
    socket.deviceId = data.device_info.device_id
    socket.connectionId = connectionId

    // Store connection details
    activeConnections.set(userId, connectionId)
    connectionDetails.set(connectionId, {
      socketId: socket.id,
      userId,
      deviceId: data.device_info.device_id,
      connectedAt: new Date(),
    })

    // Update last seen timestamp
    await supabase
      .from('profiles')
      .update({
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', userId)

    // Send success response
    const response: AuthenticatedEvent = {
      user_id: userId,
      display_name: socket.displayName || 'Anonymous',
      server_time: new Date().toISOString(),
      connection_id: connectionId,
    }

    console.log('[Auth Debug] Emitting authenticated event:', response)
    socket.emit('authenticated', response)

    console.log(
      `[Auth] User ${userId} authenticated successfully (connection: ${connectionId})`
    )
  } catch (error) {
    console.error('[Auth] Authentication error:', error)

    const errorResponse: AuthenticationFailedEvent = {
      error_code: 'INVALID_TOKEN',
      message: 'Authentication failed due to server error',
      requires_login: true,
    }
    socket.emit('authentication_failed', errorResponse)
  }
}

/**
 * Handle disconnection
 */
function handleDisconnection(socket: AuthenticatedSocket) {
  if (!socket.userId || !socket.connectionId) {
    return
  }

  const userId = socket.userId
  const connectionId = socket.connectionId

  console.log(
    `[Auth] User ${userId} disconnected (connection: ${connectionId})`
  )

  // Remove from active connections
  if (activeConnections.get(userId) === connectionId) {
    activeConnections.delete(userId)
  }
  connectionDetails.delete(connectionId)
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(socket: AuthenticatedSocket): boolean {
  return !!(socket.userId && socket.connectionId)
}

/**
 * Get active connection ID for user
 */
export function getUserConnectionId(userId: string): string | undefined {
  return activeConnections.get(userId)
}

/**
 * Get connection details
 */
export function getConnectionDetails(connectionId: string) {
  return connectionDetails.get(connectionId)
}

/**
 * Get all active user IDs
 */
export function getActiveUserIds(): string[] {
  return Array.from(activeConnections.keys())
}
