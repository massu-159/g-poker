// Load environment variables FIRST
import dotenv from 'dotenv'
dotenv.config()

import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { Server } from 'socket.io'
import { createServer } from 'http'

// Import API routes
import authRoutes from './routes/auth.js'
import roomRoutes from './routes/rooms.js'
import userRoutes from './routes/users.js'
import gameRoutes from './routes/games.js'

// Import Socket.io event handlers
import { setupGameEvents } from './events/gameEvents.js'

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

const port = parseInt(process.env.PORT || '3001')

// Create HTTP server for Socket.io integration
const server = createServer()

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:8081'],
    credentials: true,
  },
})

// Setup Socket.io event handlers for real-time gameplay
setupGameEvents(io)

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
