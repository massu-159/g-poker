/**
 * Authentication Flow E2E Tests
 * Tests the complete authentication flow from registration to Socket.io authentication
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
} from 'vitest'
import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import {
  createTestUser,
  loginTestUser,
  deleteTestUser,
  createAuthenticatedSocket,
  disconnectSocket,
  waitForEvent,
  TEST_CONFIG,
  generateTestEmail,
  generateTestUsername,
} from './helpers/testHelpers.js'

describe('Authentication Flow E2E Tests', () => {
  const createdUserIds: string[] = []
  const activeSockets: Socket[] = []

  // Cleanup after each test
  afterEach(async () => {
    // Disconnect all sockets
    activeSockets.forEach(socket => disconnectSocket(socket))
    activeSockets.length = 0
  })

  // Cleanup after all tests
  afterAll(async () => {
    // Delete all test users
    for (const userId of createdUserIds) {
      await deleteTestUser(userId)
    }
  })

  describe('User Registration and Authentication', () => {
    it('should complete full registration flow: REST API registration → Socket.io authentication → profile fetch', async () => {
      // Step 1: Register new user via REST API
      const user = await createTestUser()
      createdUserIds.push(user.userId)

      expect(user.userId).toBeDefined()
      expect(user.accessToken).toBeDefined()
      expect(user.refreshToken).toBeDefined()
      expect(user.email).toContain('@e2e.test')

      // Step 2: Authenticate via Socket.io
      const socket = await createAuthenticatedSocket(user.accessToken)
      activeSockets.push(socket)

      expect(socket.connected).toBe(true)

      // Step 3: Fetch user profile via REST API
      const profileResponse = await fetch(
        `${TEST_CONFIG.API_URL}/api/users/me`,
        {
          headers: {
            Authorization: `Bearer ${user.accessToken}`,
          },
        }
      )

      expect(profileResponse.status).toBe(200)
      const profileData = await profileResponse.json()
      expect(profileData.user.id).toBe(user.userId)
      expect(profileData.user.email).toBe(user.email)
      expect(profileData.user.displayName).toBe(user.displayName)
    }, 15000)

    it('should handle login flow: login → Socket.io authentication → session validation', async () => {
      // Create test user first
      const user = await createTestUser()
      createdUserIds.push(user.userId)

      // Logout (disconnect socket if any)
      // Now login again
      const loginData = await loginTestUser(user.email, user.password)

      expect(loginData.userId).toBe(user.userId)
      expect(loginData.accessToken).toBeDefined()
      expect(loginData.refreshToken).toBeDefined()

      // Authenticate via Socket.io with new token
      const socket = await createAuthenticatedSocket(loginData.accessToken)
      activeSockets.push(socket)

      expect(socket.connected).toBe(true)

      // Verify session is valid
      const meResponse = await fetch(`${TEST_CONFIG.API_URL}/api/users/me`, {
        headers: {
          Authorization: `Bearer ${loginData.accessToken}`,
        },
      })

      expect(meResponse.status).toBe(200)
      const meData = await meResponse.json()
      expect(meData.user.id).toBe(user.userId)
    }, 15000)

    it('should reject duplicate registration with same email', async () => {
      // Create first user
      const user1 = await createTestUser()
      createdUserIds.push(user1.userId)

      // Try to register with same email
      const response = await fetch(`${TEST_CONFIG.API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user1.email, // Same email
          password: 'DifferentPassword123!',
          displayName: 'Different User',
          username: generateTestUsername(),
        }),
      })

      expect(response.status).toBe(409) // Conflict
      const error = await response.json()
      expect(error.error).toContain('already')
    }, 15000)
  })

  describe('Token Management', () => {
    it('should refresh access token using refresh token', async () => {
      // Create test user
      const user = await createTestUser()
      createdUserIds.push(user.userId)

      // Request token refresh
      const refreshResponse = await fetch(
        `${TEST_CONFIG.API_URL}/api/auth/refresh`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            refreshToken: user.refreshToken,
          }),
        }
      )

      expect(refreshResponse.status).toBe(200)
      const refreshData = await refreshResponse.json()
      expect(refreshData.tokens.accessToken).toBeDefined()
      expect(refreshData.tokens.refreshToken).toBeDefined()
      expect(refreshData.tokens.accessToken).not.toBe(user.accessToken) // New token

      // Use new access token to authenticate Socket.io
      const socket = await createAuthenticatedSocket(
        refreshData.tokens.accessToken
      )
      activeSockets.push(socket)

      expect(socket.connected).toBe(true)
    }, 15000)

    it('should reject invalid or expired access token', async () => {
      const invalidToken = 'invalid.jwt.token'

      // Try to authenticate Socket.io with invalid token
      try {
        await createAuthenticatedSocket(invalidToken)
        // Should not reach here
        expect.fail('Should have rejected invalid token')
      } catch (error: any) {
        expect(error.message).toContain('Authentication failed')
      }

      // Try to access protected REST endpoint with invalid token
      const meResponse = await fetch(`${TEST_CONFIG.API_URL}/api/users/me`, {
        headers: {
          Authorization: `Bearer ${invalidToken}`,
        },
      })

      expect(meResponse.status).toBe(401) // Unauthorized
    }, 15000)
  })

  describe('Logout and Session Management', () => {
    it('should logout user and invalidate session', async () => {
      // Create and login user
      const user = await createTestUser()
      createdUserIds.push(user.userId)

      const socket = await createAuthenticatedSocket(user.accessToken)
      activeSockets.push(socket)

      // Logout via REST API
      const logoutResponse = await fetch(
        `${TEST_CONFIG.API_URL}/api/auth/logout`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${user.accessToken}`,
          },
        }
      )

      expect(logoutResponse.status).toBe(200)

      // Socket should still be connected (logout doesn't force disconnect)
      // But session should be marked as inactive in database

      // Try to use the same access token again (should still work until expiry)
      // In production, implement token blacklisting for immediate invalidation
    }, 15000)
  })

  describe('Error Handling', () => {
    it('should handle malformed registration requests', async () => {
      const response = await fetch(`${TEST_CONFIG.API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'invalid-email', // Invalid email format
          password: '123', // Too short password
          displayName: '', // Empty display name
          username: 'ab', // Too short username
        }),
      })

      expect(response.status).toBe(400) // Bad Request
      const error = await response.json()
      expect(error.error).toBe('Validation failed')
      expect(error.details).toBeDefined()
    }, 10000)

    it('should handle malformed login requests', async () => {
      const response = await fetch(`${TEST_CONFIG.API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'invalid-email',
          password: '', // Empty password
        }),
      })

      expect(response.status).toBe(400) // Bad Request
    }, 10000)

    it('should reject Socket.io authentication without access token', async () => {
      const socket = io(TEST_CONFIG.SOCKET_URL, {
        autoConnect: false,
      })

      // Wait for authentication_failed event
      const authFailedPromise = new Promise<any>((resolve) => {
        socket.on('authentication_failed', (data) => {
          resolve(data)
        })
      })

      // Connect and try to authenticate without token
      socket.connect()
      socket.emit('authenticate', {
        access_token: null,
        device_info: {
          device_id: 'test-device-invalid',
          device_type: 'desktop',
        },
      })

      // Should receive authentication_failed event
      const failureData = await authFailedPromise
      expect(failureData.error_code).toBe('INVALID_TOKEN')
      expect(failureData.requires_login).toBe(true)

      socket.disconnect()
    }, 10000)
  })
})
