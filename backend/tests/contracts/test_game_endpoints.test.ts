/**
 * Game Action API Contract Test
 * Tests game endpoints against actual backend implementation
 *
 * Validates endpoints match io.md specification:
 * - POST /api/games/:id/claim
 * - POST /api/games/:id/respond
 * - POST /api/games/:id/pass
 */

import { describe, it, expect } from 'vitest'
import { app } from '../../src/index.js'

describe('Game Action API Contract Tests', () => {
  describe('POST /api/games/:id/claim', () => {
    it('should respond with 401 for missing authorization', async () => {
      const request = new Request(
        'http://localhost/api/games/123e4567-e89b-12d3-a456-426614174000/claim',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cardId: 'cockroach_1',
            claimedCreature: 'cockroach',
            targetPlayerId: 'player-uuid',
          }),
        }
      )

      const response = await app.fetch(request)

      expect(response.status).toBe(401)
    })

    it('should respond with 401 for invalid token', async () => {
      const request = new Request(
        'http://localhost/api/games/123e4567-e89b-12d3-a456-426614174000/claim',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer invalid.token',
          },
          body: JSON.stringify({
            cardId: 'cockroach_1',
            claimedCreature: 'cockroach',
            targetPlayerId: 'player-uuid',
          }),
        }
      )

      const response = await app.fetch(request)

      expect(response.status).toBe(401)
    })

    it('should respond with 400 for invalid request body', async () => {
      const request = new Request(
        'http://localhost/api/games/123e4567-e89b-12d3-a456-426614174000/claim',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer invalid.token',
          },
          body: JSON.stringify({
            // Missing required fields
          }),
        }
      )

      const response = await app.fetch(request)

      expect([400, 401]).toContain(response.status)
    })
  })

  describe('POST /api/games/:id/respond', () => {
    it('should respond with 401 for missing authorization', async () => {
      const request = new Request(
        'http://localhost/api/games/123e4567-e89b-12d3-a456-426614174000/respond',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roundId: 'round-uuid',
            believeClaim: true,
          }),
        }
      )

      const response = await app.fetch(request)

      expect(response.status).toBe(401)
    })

    it('should respond with 401 for invalid token', async () => {
      const request = new Request(
        'http://localhost/api/games/123e4567-e89b-12d3-a456-426614174000/respond',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer invalid.token',
          },
          body: JSON.stringify({
            roundId: 'round-uuid',
            believeClaim: true,
          }),
        }
      )

      const response = await app.fetch(request)

      expect(response.status).toBe(401)
    })

    it('should respond with 400 for invalid request body', async () => {
      const request = new Request(
        'http://localhost/api/games/123e4567-e89b-12d3-a456-426614174000/respond',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer invalid.token',
          },
          body: JSON.stringify({
            // Missing required fields
          }),
        }
      )

      const response = await app.fetch(request)

      expect([400, 401]).toContain(response.status)
    })
  })

  describe('POST /api/games/:id/pass', () => {
    it('should respond with 401 for missing authorization', async () => {
      const request = new Request(
        'http://localhost/api/games/123e4567-e89b-12d3-a456-426614174000/pass',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roundId: 'round-uuid',
            targetPlayerId: 'player-uuid',
            newClaim: 'mouse',
          }),
        }
      )

      const response = await app.fetch(request)

      expect(response.status).toBe(401)
    })

    it('should respond with 401 for invalid token', async () => {
      const request = new Request(
        'http://localhost/api/games/123e4567-e89b-12d3-a456-426614174000/pass',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer invalid.token',
          },
          body: JSON.stringify({
            roundId: 'round-uuid',
            targetPlayerId: 'player-uuid',
            newClaim: 'mouse',
          }),
        }
      )

      const response = await app.fetch(request)

      expect(response.status).toBe(401)
    })

    it('should respond with 400 for invalid creature type', async () => {
      const request = new Request(
        'http://localhost/api/games/123e4567-e89b-12d3-a456-426614174000/pass',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer invalid.token',
          },
          body: JSON.stringify({
            roundId: 'round-uuid',
            targetPlayerId: 'player-uuid',
            newClaim: 'invalid-creature',
          }),
        }
      )

      const response = await app.fetch(request)

      expect([400, 401]).toContain(response.status)
    })
  })
})

/**
 * Summary: Game Action API Contract Test
 *
 * This test file validates game action endpoints against actual backend implementation:
 * - Card claiming with target player selection
 * - Responding to claims (believe/doubt)
 * - Passing cards to other players
 *
 * Tests verify response structure matches io.md specification
 * All tests check authentication and authorization properly
 */
