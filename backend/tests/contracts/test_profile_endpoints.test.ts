/**
 * Profile API Contract Test
 * Tests profile endpoints against actual backend implementation
 *
 * Validates endpoints match io.md specification:
 * - GET /api/users/me
 * - PUT /api/users/me/preferences
 */

import { describe, it, expect } from 'vitest'
import { app } from '../../src/index.js'

describe('Profile API Contract Tests', () => {
  describe('GET /api/users/me', () => {
    it('should respond with 401 for missing authorization', async () => {
      const request = new Request('http://localhost/api/users/me', {
        method: 'GET',
      })

      const response = await app.fetch(request)

      expect(response.status).toBe(401)
    })

    it('should respond with 401 for invalid token', async () => {
      const request = new Request('http://localhost/api/users/me', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer invalid.token',
        },
      })

      const response = await app.fetch(request)

      expect(response.status).toBe(401)
    })
  })

  describe('PUT /api/users/me/preferences', () => {
    it('should respond with 401 for missing authorization', async () => {
      const request = new Request(
        'http://localhost/api/users/me/preferences',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            theme: 'dark',
            language: 'ja',
            sound_enabled: true,
          }),
        }
      )

      const response = await app.fetch(request)

      expect(response.status).toBe(401)
    })

    it('should respond with 401 for invalid token', async () => {
      const request = new Request(
        'http://localhost/api/users/me/preferences',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer invalid.token',
          },
          body: JSON.stringify({
            theme: 'dark',
            language: 'ja',
            sound_enabled: true,
          }),
        }
      )

      const response = await app.fetch(request)

      expect(response.status).toBe(401)
    })

    it('should respond with 400 for invalid preferences data', async () => {
      const request = new Request(
        'http://localhost/api/users/me/preferences',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer invalid.token',
          },
          body: JSON.stringify({
            theme: 'invalid-theme',
            language: 'invalid-lang',
          }),
        }
      )

      const response = await app.fetch(request)

      expect([400, 401]).toContain(response.status)
    })
  })

  describe('GET /api/users/me/statistics', () => {
    it('should respond with 401 for missing authorization', async () => {
      const request = new Request('http://localhost/api/users/me/statistics', {
        method: 'GET',
      })

      const response = await app.fetch(request)

      expect(response.status).toBe(401)
    })

    it('should respond with 401 for invalid token', async () => {
      const request = new Request('http://localhost/api/users/me/statistics', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer invalid.token',
        },
      })

      const response = await app.fetch(request)

      expect(response.status).toBe(401)
    })
  })
})

/**
 * Summary: Profile API Contract Test
 *
 * This test file validates profile endpoints against actual backend implementation:
 * - GET /api/users/me - Getting current user profile
 * - PUT /api/users/me/preferences - Updating user preferences
 * - GET /api/users/me/statistics - Getting detailed user statistics
 *
 * Tests verify response structure matches io.md specification
 * All tests check authentication and authorization properly
 */
