/**
 * Connection Recovery Handler (T046)
 * Handles heartbeat, connection monitoring, and state recovery
 */

import { Server } from 'socket.io'
import type {
  AuthenticatedSocket,
  HeartbeatEvent,
  HeartbeatAckEvent,
} from './types.js'
import { isAuthenticated } from './AuthHandler.js'
import { getSupabase } from '../lib/supabase.js'

// Heartbeat tracking
const heartbeatTimestamps = new Map<string, Date>() // socketId -> last heartbeat
const CONNECTION_TIMEOUT_MS = 60000 // 1 minute

/**
 * Setup connection recovery handlers
 */
export function setupRecoveryHandlers(io: Server) {
  io.on('connection', (socket: AuthenticatedSocket) => {
    // Handle heartbeat events
    socket.on('heartbeat', (data: HeartbeatEvent) => {
      handleHeartbeat(socket, data)
    })

    // Track initial connection
    heartbeatTimestamps.set(socket.id, new Date())

    // Monitor connection health
    // eslint-disable-next-line no-undef
    const healthCheckInterval = setInterval(() => {
      checkConnectionHealth(socket)
    }, 30000) // Check every 30 seconds

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      // eslint-disable-next-line no-undef
      clearInterval(healthCheckInterval)
      heartbeatTimestamps.delete(socket.id)
    })
  })
}

/**
 * Handle heartbeat event
 */
function handleHeartbeat(socket: AuthenticatedSocket, data: HeartbeatEvent) {
  if (!isAuthenticated(socket)) {
    socket.emit('connection_error', {
      error_code: 'INVALID_ROOM',
      message: 'Not authenticated',
    })
    return
  }

  // Record heartbeat timestamp
  const clientTimestamp = new Date(data.timestamp)
  const serverTimestamp = new Date()
  heartbeatTimestamps.set(socket.id, serverTimestamp)

  // Calculate latency
  const latency = serverTimestamp.getTime() - clientTimestamp.getTime()

  // Update last seen in database (fire and forget)
  if (socket.userId) {
    const supabase = getSupabase()
    supabase
      .from('profiles')
      .update({
        last_seen_at: serverTimestamp.toISOString(),
      })
      .eq('id', socket.userId)
      .then(() => {
        // Success - fire and forget
      })
  }

  // Send acknowledgment
  const response: HeartbeatAckEvent = {
    server_timestamp: serverTimestamp.toISOString(),
    latency_ms: Math.max(0, latency), // Ensure non-negative
  }
  socket.emit('heartbeat_ack', response)
}

/**
 * Check connection health
 */
function checkConnectionHealth(socket: AuthenticatedSocket) {
  const lastHeartbeat = heartbeatTimestamps.get(socket.id)

  if (!lastHeartbeat) {
    return
  }

  const timeSinceHeartbeat = Date.now() - lastHeartbeat.getTime()

  if (timeSinceHeartbeat > CONNECTION_TIMEOUT_MS) {
    console.log(
      `[Recovery] Connection timeout for ${socket.id} (${socket.userId})`
    )

    // Disconnect stale connection
    socket.disconnect(true)
  }
}

/**
 * Broadcast connection status update to room
 */
export function broadcastConnectionStatus(
  io: Server,
  roomId: string,
  userId: string,
  status: 'connected' | 'disconnected' | 'reconnecting'
) {
  io.to(roomId).emit('participant_status_update', {
    room_id: roomId,
    participant_id: userId,
    connection_status: status,
  })

  console.log(`[Recovery] Broadcast ${status} for user ${userId} in ${roomId}`)
}

/**
 * Get connection statistics
 */
export function getConnectionStats() {
  const now = Date.now()
  const stats = {
    total: heartbeatTimestamps.size,
    healthy: 0,
    stale: 0,
  }

  heartbeatTimestamps.forEach(timestamp => {
    const age = now - timestamp.getTime()
    if (age < CONNECTION_TIMEOUT_MS) {
      stats.healthy++
    } else {
      stats.stale++
    }
  })

  return stats
}
