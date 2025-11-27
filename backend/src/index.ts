// Load environment variables FIRST
import dotenv from 'dotenv'
dotenv.config()

import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { createServer } from 'http'

// Import API routes
import authRoutes from './routes/auth.js'
import roomRoutes from './routes/rooms.js'
import userRoutes from './routes/users.js'
import gameRoutes from './routes/games.js'

// Import Socket.io server setup
import { initializeSocketServer } from './socket/SocketServer.js'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use(
  '*',
  cors({
    origin: ['http://localhost:3000', 'http://localhost:8081'],
    credentials: true,
  })
)

// Health check endpoint
app.get('/health', c => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes
app.get('/api/v1/status', c => {
  return c.json({
    message: 'G-Poker Backend API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  })
})

// Mount API routes
app.route('/api/auth', authRoutes)
app.route('/api/rooms', roomRoutes)
app.route('/api/users', userRoutes)
app.route('/api/games', gameRoutes)

// Only start servers if not in test environment (but allow E2E tests)
if ((process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') || process.env.E2E_TEST === 'true') {
  const port = parseInt(process.env.PORT || '3001')

  // Create HTTP server for Socket.io integration
  const server = createServer()

  // Initialize Socket.io with new handler architecture
  initializeSocketServer(server)
    .then(() => {
      console.log('[Server] Socket.io initialized successfully')
    })
    .catch(error => {
      console.error('[Server] Failed to initialize Socket.io:', error)
      process.exit(1)
    })

  // Start the server
  console.log(`Starting G-Poker backend server on port ${port}`)

  // Start Hono server
  serve(
    {
      fetch: app.fetch,
      port: port,
    },
    info => {
      console.log(`Hono server running at http://localhost:${info.port}`)
    }
  )

  // Start Socket.io server on port + 1
  server.listen(port + 1, () => {
    console.log(`Socket.io server running at http://localhost:${port + 1}`)
  })
}

// Export app for testing
export { app }
