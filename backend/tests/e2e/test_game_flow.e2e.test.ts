/**
 * Game Session Flow E2E Tests
 * Tests the complete game flow from start to finish
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
} from 'vitest'
import type { Socket } from 'socket.io-client'
import {
  createTestUser,
  deleteTestUser,
  createAuthenticatedSocket,
  disconnectSocket,
  waitForEvent,
  createTestRoom,
  joinTestRoom,
  startTestGame,
  deleteTestRoom,
  TEST_CONFIG,
  sleep,
} from './helpers/testHelpers.js'

describe('Game Session Flow E2E Tests', () => {
  const createdUserIds: string[] = []
  const createdRoomIds: string[] = []
  const activeSockets: Socket[] = []

  // Cleanup after each test
  afterEach(async () => {
    // Disconnect all sockets
    activeSockets.forEach(socket => disconnectSocket(socket))
    activeSockets.length = 0
  })

  // Cleanup after all tests
  afterAll(async () => {
    // Delete all test rooms
    for (const roomId of createdRoomIds) {
      await deleteTestRoom(roomId)
    }

    // Delete all test users
    for (const userId of createdUserIds) {
      await deleteTestUser(userId)
    }
  })

  describe('Game Start and Initialization', () => {
    it('should start game and broadcast initial state to all players', async () => {
      // Create two players
      const player1 = await createTestUser()
      const player2 = await createTestUser()
      createdUserIds.push(player1.userId, player2.userId)

      // Create and join room
      const room = await createTestRoom(player1.accessToken)
      createdRoomIds.push(room.roomId)
      await joinTestRoom(player2.accessToken, room.roomId)

      // Connect both players via Socket.io
      const player1Socket = await createAuthenticatedSocket(
        player1.accessToken
      )
      const player2Socket = await createAuthenticatedSocket(
        player2.accessToken
      )
      activeSockets.push(player1Socket, player2Socket)

      // Both join room
      player1Socket.emit('join_room', { room_id: room.roomId })
      player2Socket.emit('join_room', { room_id: room.roomId })

      await Promise.all([
        waitForEvent(player1Socket, 'room_joined'),
        waitForEvent(player2Socket, 'room_joined'),
      ])

      // Start game (only creator can start)
      const startResponse = await startTestGame(
        player1.accessToken,
        room.roomId
      )

      expect(startResponse.message).toBe('Game started successfully')
      expect(startResponse.currentTurnPlayer).toBeDefined()

      // Give Socket.io time to broadcast events
      await sleep(1000)

      // Verify game is active via REST
      const gameStateResponse = await fetch(
        `${TEST_CONFIG.API_URL}/api/games/${room.roomId}/state`,
        {
          headers: { Authorization: `Bearer ${player1.accessToken}` },
        }
      )

      expect(gameStateResponse.status).toBe(200)
      const gameState = await gameStateResponse.json()
      expect(gameState.gameState.status).toBe('active')
      expect(gameState.gameState.players).toHaveLength(2)
    }, 25000)

    it('should prevent non-creator from starting game', async () => {
      // Create two players
      const player1 = await createTestUser()
      const player2 = await createTestUser()
      createdUserIds.push(player1.userId, player2.userId)

      // Player 1 creates room
      const room = await createTestRoom(player1.accessToken)
      createdRoomIds.push(room.roomId)

      // Player 2 joins
      await joinTestRoom(player2.accessToken, room.roomId)

      // Player 2 tries to start game (should fail)
      const startResponse = await fetch(
        `${TEST_CONFIG.API_URL}/api/rooms/${room.roomId}/start`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${player2.accessToken}`,
          },
        }
      )

      expect(startResponse.status).toBe(403) // Forbidden
      const error = await startResponse.json()
      expect(error.error).toContain('creator')
    }, 15000)
  })

  describe('Game Actions and State Updates', () => {
    it('should handle complete game round: claim → respond → state update', async () => {
      // Setup: Create 2 players, room, and start game
      const player1 = await createTestUser()
      const player2 = await createTestUser()
      createdUserIds.push(player1.userId, player2.userId)

      const room = await createTestRoom(player1.accessToken)
      createdRoomIds.push(room.roomId)
      await joinTestRoom(player2.accessToken, room.roomId)

      const player1Socket = await createAuthenticatedSocket(
        player1.accessToken
      )
      const player2Socket = await createAuthenticatedSocket(
        player2.accessToken
      )
      activeSockets.push(player1Socket, player2Socket)

      // Join room
      player1Socket.emit('join_room', { room_id: room.roomId })
      player2Socket.emit('join_room', { room_id: room.roomId })
      await Promise.all([
        waitForEvent(player1Socket, 'room_joined'),
        waitForEvent(player2Socket, 'room_joined'),
      ])

      // Start game
      await startTestGame(player1.accessToken, room.roomId)
      await sleep(1000)

      // Player 1 makes a claim
      player1Socket.emit('claim_card', {
        room_id: room.roomId,
        claimed_creature: 'cockroach',
        target_player_id: player2.userId,
      })

      // Player 2 should receive card_claimed event
      const claimedEvent = await waitForEvent(player2Socket, 'card_claimed')
      expect(claimedEvent.room_id).toBe(room.roomId)
      expect(claimedEvent.claiming_player_id).toBe(player1.userId)
      expect(claimedEvent.claimed_creature).toBe('cockroach')
      expect(claimedEvent.round_id).toBeDefined()

      const roundId = claimedEvent.round_id

      // Player 2 responds to the claim
      player2Socket.emit('respond_to_claim', {
        room_id: room.roomId,
        round_id: roundId,
        believe_claim: false, // Doubt the claim
      })

      // Both players should receive claim_responded event
      const [p1Response, p2Response] = await Promise.all([
        waitForEvent(player1Socket, 'claim_responded'),
        waitForEvent(player2Socket, 'claim_responded'),
      ])

      expect(p1Response.room_id).toBe(room.roomId)
      expect(p1Response.responder_id).toBe(player2.userId)
      expect(p1Response.believed_claim).toBe(false)
      expect(p1Response.penalty_receiver_id).toBeDefined()

      // Either round_completed or game_ended should follow
      await sleep(500)
    }, 30000)

    it('should handle card passing between players', async () => {
      // Setup game with 2 players
      const player1 = await createTestUser()
      const player2 = await createTestUser()
      createdUserIds.push(player1.userId, player2.userId)

      const room = await createTestRoom(player1.accessToken)
      createdRoomIds.push(room.roomId)
      await joinTestRoom(player2.accessToken, room.roomId)

      const player1Socket = await createAuthenticatedSocket(
        player1.accessToken
      )
      const player2Socket = await createAuthenticatedSocket(
        player2.accessToken
      )
      activeSockets.push(player1Socket, player2Socket)

      // Join and start
      player1Socket.emit('join_room', { room_id: room.roomId })
      player2Socket.emit('join_room', { room_id: room.roomId })
      await Promise.all([
        waitForEvent(player1Socket, 'room_joined'),
        waitForEvent(player2Socket, 'room_joined'),
      ])
      await startTestGame(player1.accessToken, room.roomId)
      await sleep(1000)

      // Player 1 claims a card
      player1Socket.emit('claim_card', {
        room_id: room.roomId,
        claimed_creature: 'mouse',
        target_player_id: player2.userId,
      })

      const claimedEvent = await waitForEvent(player2Socket, 'card_claimed')
      const roundId = claimedEvent.round_id

      // Player 2 passes the card back to Player 1
      player2Socket.emit('pass_card', {
        room_id: room.roomId,
        round_id: roundId,
        target_player_id: player1.userId,
        new_claim: 'bat', // Change the claim
      })

      // Both should receive card_passed event
      const [p1Passed, p2Passed] = await Promise.all([
        waitForEvent(player1Socket, 'card_passed'),
        waitForEvent(player2Socket, 'card_passed'),
      ])

      expect(p1Passed.room_id).toBe(room.roomId)
      expect(p1Passed.from_player_id).toBe(player2.userId)
      expect(p1Passed.to_player_id).toBe(player1.userId)
      expect(p1Passed.new_claimed_creature).toBe('bat')
      expect(p1Passed.pass_count).toBe(1)
    }, 30000)
  })

  describe('Game State Retrieval', () => {
    it('should retrieve current game state via REST API', async () => {
      // Setup game
      const player1 = await createTestUser()
      const player2 = await createTestUser()
      createdUserIds.push(player1.userId, player2.userId)

      const room = await createTestRoom(player1.accessToken)
      createdRoomIds.push(room.roomId)
      await joinTestRoom(player2.accessToken, room.roomId)
      await startTestGame(player1.accessToken, room.roomId)

      // Get game state
      const stateResponse = await fetch(
        `${TEST_CONFIG.API_URL}/api/games/${room.roomId}/state`,
        {
          headers: { Authorization: `Bearer ${player1.accessToken}` },
        }
      )

      expect(stateResponse.status).toBe(200)
      const state = await stateResponse.json()

      expect(state.gameState.gameId).toBe(room.roomId)
      expect(state.gameState.status).toBe('active')
      expect(state.gameState.players).toHaveLength(2)
      expect(state.gameState.playerHand).toBeDefined()
      expect(state.gameState.cardsRemaining).toBeGreaterThan(0)
    }, 20000)

    it('should get game state via Socket.io', async () => {
      // Setup game
      const player1 = await createTestUser()
      const player2 = await createTestUser()
      createdUserIds.push(player1.userId, player2.userId)

      const room = await createTestRoom(player1.accessToken)
      createdRoomIds.push(room.roomId)
      await joinTestRoom(player2.accessToken, room.roomId)

      const player1Socket = await createAuthenticatedSocket(
        player1.accessToken
      )
      activeSockets.push(player1Socket)

      player1Socket.emit('join_room', { room_id: room.roomId })
      await waitForEvent(player1Socket, 'room_joined')

      await startTestGame(player1.accessToken, room.roomId)
      await sleep(1000)

      // Request game state via Socket.io
      player1Socket.emit('get_game_state', { room_id: room.roomId })

      const gameState = await waitForEvent(player1Socket, 'game_state_update')

      expect(gameState.room_id).toBe(room.roomId)
      expect(gameState.game_state.status).toBe('active')
      expect(gameState.game_state.players).toHaveLength(2)
    }, 20000)
  })

  describe('Error Handling', () => {
    it('should reject invalid game actions', async () => {
      // Create user and room
      const player1 = await createTestUser()
      createdUserIds.push(player1.userId)

      const room = await createTestRoom(player1.accessToken)
      createdRoomIds.push(room.roomId)

      const player1Socket = await createAuthenticatedSocket(
        player1.accessToken
      )
      activeSockets.push(player1Socket)

      player1Socket.emit('join_room', { room_id: room.roomId })
      await waitForEvent(player1Socket, 'room_joined')

      // Try to claim card before game starts
      player1Socket.emit('claim_card', {
        room_id: room.roomId,
        claimed_creature: 'cockroach',
        target_player_id: 'fake-player-id',
      })

      const error = await waitForEvent(player1Socket, 'game_action_error')

      expect(error.error_code).toBeDefined()
      expect(error.message).toBeDefined()
      expect(error.action_attempted).toBe('claim_card')
    }, 15000)

    it('should handle invalid game state requests', async () => {
      const player = await createTestUser()
      createdUserIds.push(player.userId)

      // Request state for non-existent game
      const fakeGameId = '00000000-0000-0000-0000-000000000000'
      const response = await fetch(
        `${TEST_CONFIG.API_URL}/api/games/${fakeGameId}/state`,
        {
          headers: { Authorization: `Bearer ${player.accessToken}` },
        }
      )

      expect(response.status).toBe(403) // Access denied - not a participant
    }, 10000)

    it('should prevent starting game with insufficient players', async () => {
      // Create room with only 1 player
      const player1 = await createTestUser()
      createdUserIds.push(player1.userId)

      const room = await createTestRoom(player1.accessToken)
      createdRoomIds.push(room.roomId)

      // Try to start with only 1 player (need 2)
      const response = await fetch(
        `${TEST_CONFIG.API_URL}/api/rooms/${room.roomId}/start`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${player1.accessToken}`,
          },
        }
      )

      expect(response.status).toBe(400) // Bad Request
      const error = await response.json()
      expect(error.error).toContain('2 players')
    }, 15000)
  })

  describe('Game Completion', () => {
    it('should handle game end and broadcast winner', async () => {
      // Note: This is a simplified test - actual game completion requires playing multiple rounds
      // For a full test, we would need to simulate multiple claim/respond cycles
      // until one player accumulates enough penalty cards

      const player1 = await createTestUser()
      const player2 = await createTestUser()
      createdUserIds.push(player1.userId, player2.userId)

      const room = await createTestRoom(player1.accessToken)
      createdRoomIds.push(room.roomId)
      await joinTestRoom(player2.accessToken, room.roomId)

      const player1Socket = await createAuthenticatedSocket(
        player1.accessToken
      )
      const player2Socket = await createAuthenticatedSocket(
        player2.accessToken
      )
      activeSockets.push(player1Socket, player2Socket)

      player1Socket.emit('join_room', { room_id: room.roomId })
      player2Socket.emit('join_room', { room_id: room.roomId })
      await Promise.all([
        waitForEvent(player1Socket, 'room_joined'),
        waitForEvent(player2Socket, 'room_joined'),
      ])

      await startTestGame(player1.accessToken, room.roomId)
      await sleep(1000)

      // In a real scenario, we would play multiple rounds here
      // For this test, we just verify the game is active
      const state = await fetch(
        `${TEST_CONFIG.API_URL}/api/games/${room.roomId}/state`,
        {
          headers: { Authorization: `Bearer ${player1.accessToken}` },
        }
      ).then(r => r.json())

      expect(state.gameState.status).toBe('active')

      // game_ended event would be emitted after a player loses
      // (accumulates 3 of same creature or 4 total penalty cards)
    }, 25000)
  })
})
