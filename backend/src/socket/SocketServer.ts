/**
 * Socket.io Server Setup (T042)
 * Configures Socket.io server with Redis adapter and integrates all handlers
 */

import { Server as SocketIOServer, ServerOptions } from 'socket.io'
import { Server as HttpServer } from 'http'
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'redis'
import { setupAuthenticationHandlers } from './AuthHandler.js'
import { setupRoomHandlers } from './RoomHandler.js'
import { setupGameHandlers } from './GameHandler.js'
import { setupRecoveryHandlers } from './RecoveryHandler.js'

let io: SocketIOServer | null = null

/**
 * Initialize Socket.io server with all handlers
 */
export async function initializeSocketServer(
  httpServer: HttpServer,
  options?: Partial<ServerOptions>
): Promise<SocketIOServer> {
  console.log('[Socket] Initializing Socket.io server...')

  // Create Socket.io server
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || [
        'http://localhost:3000',
        'http://localhost:8081',
      ],
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    ...options,
  })

  // Setup Redis adapter for multi-instance scaling (if configured)
  if (process.env.REDIS_URL && process.env.NODE_ENV === 'production') {
    try {
      console.log('[Socket] Configuring Redis adapter...')

      const pubClient = createClient({ url: process.env.REDIS_URL })
      const subClient = pubClient.duplicate()

      await Promise.all([pubClient.connect(), subClient.connect()])

      io.adapter(createAdapter(pubClient, subClient))

      console.log('[Socket] Redis adapter configured successfully')
    } catch (error) {
      console.error('[Socket] Failed to setup Redis adapter:', error)
      console.log(
        '[Socket] Continuing without Redis adapter (single instance mode)'
      )
    }
  } else {
    console.log('[Socket] Running in single instance mode (no Redis)')
  }

  // Setup all event handlers
  console.log('[Socket] Setting up event handlers...')

  setupAuthenticationHandlers(io)
  setupRoomHandlers(io)
  setupGameHandlers(io)
  setupRecoveryHandlers(io)

  // Global error handler
  io.on('connect_error', error => {
    console.error('[Socket] Connection error:', error)
  })

  // Log server statistics periodically
  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-undef
    setInterval(() => {
      const sockets = io?.sockets.sockets.size || 0
      console.log(`[Socket] Active connections: ${sockets}`)
    }, 60000) // Every minute
  }

  console.log('[Socket] Socket.io server initialized successfully')

  return io
}

/**
 * Get the Socket.io server instance
 */
export function getSocketServer(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io server not initialized')
  }
  return io
}

/**
 * Close Socket.io server
 */
export async function closeSocketServer(): Promise<void> {
  if (io) {
    console.log('[Socket] Closing Socket.io server...')
    io.close()
    io = null
    console.log('[Socket] Socket.io server closed')
  }
}

/**
 * Broadcast message to specific room
 */
export function broadcastToRoom(roomId: string, event: string, data: any) {
  if (io) {
    io.to(roomId).emit(event, data)
  }
}

/**
 * Broadcast message to all connected clients
 */
export function broadcastToAll(event: string, data: any) {
  if (io) {
    io.emit(event, data)
  }
}

/**
 * Get server statistics
 */
export function getServerStats() {
  if (!io) {
    return {
      connected: 0,
      rooms: 0,
    }
  }

  const sockets = io.sockets.sockets
  const rooms = io.sockets.adapter.rooms

  return {
    connected: sockets.size,
    rooms: rooms.size - sockets.size, // Exclude private rooms (one per socket)
  }
}
