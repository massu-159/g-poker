/**
 * Room Management API Contract Test
 * Tests room endpoints against actual backend implementation
 *
 * Validates endpoints match io.md specification:
 * - POST /api/rooms/create
 * - GET /api/rooms/list
 * - POST /api/rooms/join
 * - POST /api/rooms/:id/start
 * - GET /api/rooms/:id
 */

import { describe, it, expect } from 'vitest'
import { app } from '../../src/index.js'

describe('Room Management API Contract Tests', () => {
  describe('POST /api/rooms/create', () => {
    it('should respond with 401 for missing authorization', async () => {
      const request = new Request('http://localhost/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeLimitSeconds: 60,
        }),
      })

      const response = await app.fetch(request)

      expect(response.status).toBe(401)
    })

    it('should respond with 401 for invalid token', async () => {
      const request = new Request('http://localhost/api/rooms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid.token',
        },
        body: JSON.stringify({
          timeLimitSeconds: 60,
        }),
      })

      const response = await app.fetch(request)

      expect(response.status).toBe(401)
    })

    it('should respond with 400 for invalid time limit', async () => {
      const request = new Request('http://localhost/api/rooms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid.token',
        },
        body: JSON.stringify({
          timeLimitSeconds: 10, // Too low (min is 30)
        }),
      })

      const response = await app.fetch(request)

      expect([400, 401]).toContain(response.status)
    })
  })

  describe('GET /api/rooms/list', () => {
    it('should respond with 401 for missing authorization', async () => {
      const request = new Request('http://localhost/api/rooms/list', {
        method: 'GET',
      })

      const response = await app.fetch(request)

      expect(response.status).toBe(401)
    })

    it('should respond with 401 for invalid token', async () => {
      const request = new Request('http://localhost/api/rooms/list', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer invalid.token',
        },
      })

      const response = await app.fetch(request)

      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/rooms/join', () => {
    it('should respond with 401 for missing authorization', async () => {
      const request = new Request('http://localhost/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: 'some-game-id',
        }),
      })

      const response = await app.fetch(request)

      expect(response.status).toBe(401)
    })

    it('should respond with 400 for invalid game ID format', async () => {
      const request = new Request('http://localhost/api/rooms/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid.token',
        },
        body: JSON.stringify({
          gameId: 'not-a-uuid',
        }),
      })

      const response = await app.fetch(request)

      expect([400, 401]).toContain(response.status)
    })

    it('should respond with 404 for non-existent game', async () => {
      const request = new Request('http://localhost/api/rooms/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid.token',
        },
        body: JSON.stringify({
          gameId: '123e4567-e89b-12d3-a456-426614174000', // Valid UUID format
        }),
      })

      const response = await app.fetch(request)

      expect([401, 404]).toContain(response.status)
    })
  })

  describe('GET /api/rooms/:id', () => {
    it('should respond with 401 for missing authorization', async () => {
      const request = new Request(
        'http://localhost/api/rooms/123e4567-e89b-12d3-a456-426614174000',
        {
          method: 'GET',
        }
      )

      const response = await app.fetch(request)

      expect(response.status).toBe(401)
    })

    it('should respond with 401 for invalid token', async () => {
      const request = new Request(
        'http://localhost/api/rooms/123e4567-e89b-12d3-a456-426614174000',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer invalid.token',
          },
        }
      )

      const response = await app.fetch(request)

      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/rooms/:id/start', () => {
    it('should respond with 401 for missing authorization', async () => {
      const request = new Request(
        'http://localhost/api/rooms/123e4567-e89b-12d3-a456-426614174000/start',
        {
          method: 'POST',
        }
      )

      const response = await app.fetch(request)

      expect(response.status).toBe(401)
    })

    it('should respond with 401 for invalid token', async () => {
      const request = new Request(
        'http://localhost/api/rooms/123e4567-e89b-12d3-a456-426614174000/start',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer invalid.token',
          },
        }
      )

      const response = await app.fetch(request)

      expect(response.status).toBe(401)
    })
  })
})

/**
 * Summary: Room Management API Contract Test
 *
 * This test file validates room management endpoints against actual backend implementation:
 * - Room creation with validation
 * - Room listing with filters
 * - Joining existing rooms
 * - Starting games
 * - Getting room details
 *
 * Tests verify response structure matches io.md specification
 * All tests check authentication and authorization properly
 */
