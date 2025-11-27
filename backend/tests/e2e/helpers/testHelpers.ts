/**
 * E2E Test Helper Utilities
 * Provides common utilities for end-to-end integration testing
 */

import { Socket, io as socketClient } from 'socket.io-client'
import { getSupabase } from '../../../src/lib/supabase.js'

// Test configuration
export const TEST_CONFIG = {
  API_URL: process.env.TEST_API_URL || 'http://localhost:3001',
  SOCKET_URL: process.env.TEST_SOCKET_URL || 'http://localhost:3002',
  TIMEOUT: 10000,
}

/**
 * Wait for a Socket.io event with timeout
 */
export function waitForEvent<T = any>(
  socket: Socket,
  eventName: string,
  timeout: number = TEST_CONFIG.TIMEOUT
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${eventName}`))
    }, timeout)

    socket.once(eventName, (data: T) => {
      clearTimeout(timer)
      resolve(data)
    })
  })
}

/**
 * Wait for multiple events (any order)
 */
export async function waitForEvents(
  socket: Socket,
  eventNames: string[],
  timeout: number = TEST_CONFIG.TIMEOUT
): Promise<Record<string, any>> {
  const results: Record<string, any> = {}
  const promises = eventNames.map(eventName =>
    waitForEvent(socket, eventName, timeout).then(data => {
      results[eventName] = data
    })
  )

  await Promise.all(promises)
  return results
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Generate unique test email
 */
export function generateTestEmail(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(7)
  return `test-${timestamp}-${random}@e2e.test`
}

/**
 * Generate unique test username
 */
export function generateTestUsername(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(7)
  return `testuser_${timestamp}_${random}`
}

/**
 * Create test user and return credentials
 */
export async function createTestUser() {
  const email = generateTestEmail()
  const password = 'TestPassword123!'
  const displayName = 'Test User'
  const username = generateTestUsername()

  const response = await fetch(`${TEST_CONFIG.API_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      displayName,
      username,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to create test user: ${JSON.stringify(error)}`)
  }

  const data = await response.json()

  return {
    email,
    password,
    displayName,
    username,
    userId: data.user.id,
    accessToken: data.tokens.accessToken,
    refreshToken: data.tokens.refreshToken,
  }
}

/**
 * Login test user
 */
export async function loginTestUser(email: string, password: string) {
  const response = await fetch(`${TEST_CONFIG.API_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to login test user: ${JSON.stringify(error)}`)
  }

  const data = await response.json()

  return {
    userId: data.user.id,
    accessToken: data.tokens.accessToken,
    refreshToken: data.tokens.refreshToken,
  }
}

/**
 * Delete test user from database (cleanup)
 */
export async function deleteTestUser(userId: string) {
  try {
    const supabase = getSupabase()

    // Delete user profile data
    await supabase.from('user_preferences').delete().eq('user_id', userId)
    await supabase.from('public_profiles').delete().eq('profile_id', userId)
    await supabase.from('profiles').delete().eq('id', userId)

    // Delete auth user (requires admin privileges)
    await supabase.auth.admin.deleteUser(userId)

    console.log(`[Test Cleanup] Deleted test user: ${userId}`)
  } catch (error) {
    console.error(`[Test Cleanup] Failed to delete test user ${userId}:`, error)
  }
}

/**
 * Create authenticated Socket.io connection
 */
export async function createAuthenticatedSocket(
  accessToken: string
): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = socketClient(TEST_CONFIG.SOCKET_URL, {
      transports: ['websocket'],
      timeout: TEST_CONFIG.TIMEOUT,
      reconnection: false,
    })

    socket.on('connect', async () => {
      try {
        // Send authentication
        socket.emit('authenticate', {
          access_token: accessToken,
          device_info: {
            device_id: 'test-device-' + Date.now(),
            platform: 'ios',
            app_version: '1.0.0',
          },
        })

        // Wait for authentication response
        const authData = await waitForEvent(socket, 'authenticated', 5000)
        console.log('[Test Socket] Authenticated:', authData)
        resolve(socket)
      } catch (error) {
        socket.disconnect()
        reject(error)
      }
    })

    socket.on('connect_error', error => {
      reject(new Error(`Socket connection error: ${error.message}`))
    })

    socket.on('authentication_failed', error => {
      socket.disconnect()
      reject(new Error(`Authentication failed: ${error.message}`))
    })
  })
}

/**
 * Disconnect and cleanup socket
 */
export function disconnectSocket(socket: Socket) {
  if (socket && socket.connected) {
    socket.disconnect()
  }
}

/**
 * Create test game room via REST API
 */
export async function createTestRoom(
  accessToken: string,
  settings?: { timeLimitSeconds?: number }
) {
  const response = await fetch(`${TEST_CONFIG.API_URL}/api/rooms/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      timeLimitSeconds: settings?.timeLimitSeconds || 60,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to create test room: ${JSON.stringify(error)}`)
  }

  const data = await response.json()
  return {
    roomId: data.game.id,
    status: data.game.status,
    timeLimitSeconds: data.game.timeLimitSeconds,
  }
}

/**
 * Join test game room via REST API
 */
export async function joinTestRoom(accessToken: string, roomId: string) {
  const response = await fetch(`${TEST_CONFIG.API_URL}/api/rooms/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      gameId: roomId,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to join test room: ${JSON.stringify(error)}`)
  }

  const data = await response.json()
  return data
}

/**
 * Start game via REST API
 */
export async function startTestGame(accessToken: string, roomId: string) {
  const response = await fetch(
    `${TEST_CONFIG.API_URL}/api/rooms/${roomId}/start`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to start test game: ${JSON.stringify(error)}`)
  }

  const data = await response.json()
  return data
}

/**
 * Clean up test game room
 */
export async function deleteTestRoom(roomId: string) {
  try {
    const supabase = getSupabase()

    // Delete game data
    await supabase.from('game_rounds').delete().eq('game_id', roomId)
    await supabase.from('game_actions').delete().eq('game_id', roomId)
    await supabase.from('game_participants').delete().eq('game_id', roomId)
    await supabase.from('games').delete().eq('id', roomId)

    console.log(`[Test Cleanup] Deleted test room: ${roomId}`)
  } catch (error) {
    console.error(
      `[Test Cleanup] Failed to delete test room ${roomId}:`,
      error
    )
  }
}

/**
 * Assert response status
 */
export function assertStatus(response: Response, expectedStatus: number) {
  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.status}`
    )
  }
}

/**
 * Assert object contains expected properties
 */
export function assertContains<T extends object>(
  obj: T,
  expectedProps: Partial<T>
) {
  Object.entries(expectedProps).forEach(([key, value]) => {
    if (obj[key as keyof T] !== value) {
      throw new Error(
        `Expected ${key} to be ${value}, got ${obj[key as keyof T]}`
      )
    }
  })
}
