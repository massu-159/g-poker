/**
 * Room Lifecycle Flow E2E Tests
 * Tests the complete room creation, joining, and state synchronization flows
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
  deleteTestRoom,
  TEST_CONFIG,
} from './helpers/testHelpers.js'

describe('Room Lifecycle Flow E2E Tests', () => {
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

  describe('Room Creation and Joining', () => {
    it('should complete full room flow: create room → join via REST → join via Socket.io → receive notifications', async () => {
      // Create two test users
      const player1 = await createTestUser()
      const player2 = await createTestUser()
      createdUserIds.push(player1.userId, player2.userId)

      // Player 1: Create room via REST API
      const room = await createTestRoom(player1.accessToken)
      createdRoomIds.push(room.roomId)

      expect(room.roomId).toBeDefined()
      expect(room.status).toBe('waiting')

      // Player 1: Connect to Socket.io and join room
      const player1Socket = await createAuthenticatedSocket(
        player1.accessToken
      )
      activeSockets.push(player1Socket)

      player1Socket.emit('join_room', { room_id: room.roomId })
      const player1JoinedData = await waitForEvent(player1Socket, 'room_joined')

      expect(player1JoinedData.room_id).toBe(room.roomId)
      expect(player1JoinedData.room_state).toBeDefined()
      expect(player1JoinedData.participants).toHaveLength(1)

      // Player 2: Join room via REST API
      await joinTestRoom(player2.accessToken, room.roomId)

      // Player 2: Connect to Socket.io and join room
      const player2Socket = await createAuthenticatedSocket(
        player2.accessToken
      )
      activeSockets.push(player2Socket)

      player2Socket.emit('join_room', { room_id: room.roomId })

      // Player 2 should receive room_joined event
      const player2JoinedData = await waitForEvent(player2Socket, 'room_joined')
      expect(player2JoinedData.room_id).toBe(room.roomId)
      expect(player2JoinedData.participants).toHaveLength(2)

      // Player 1 should receive participant_joined notification
      const participantJoinedNotification = await waitForEvent(
        player1Socket,
        'participant_joined'
      )
      expect(participantJoinedNotification.room_id).toBe(room.roomId)
      expect(participantJoinedNotification.participant.id).toBe(player2.userId)
    }, 20000)

    it('should handle room list retrieval', async () => {
      // Create user and room
      const player = await createTestUser()
      createdUserIds.push(player.userId)

      const room = await createTestRoom(player.accessToken)
      createdRoomIds.push(room.roomId)

      // Get room list
      const listResponse = await fetch(`${TEST_CONFIG.API_URL}/api/rooms/list`, {
        headers: {
          Authorization: `Bearer ${player.accessToken}`,
        },
      })

      expect(listResponse.status).toBe(200)
      const listData = await listResponse.json()
      expect(listData.games).toBeInstanceOf(Array)

      // Find our created room
      const ourRoom = listData.games.find((g: any) => g.id === room.roomId)
      expect(ourRoom).toBeDefined()
    }, 15000)

    it('should prevent joining non-existent room', async () => {
      // Create test user
      const player = await createTestUser()
      createdUserIds.push(player.userId)

      // Try to join non-existent room
      const fakeRoomId = '00000000-0000-0000-0000-000000000000'
      const response = await fetch(`${TEST_CONFIG.API_URL}/api/rooms/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${player.accessToken}`,
        },
        body: JSON.stringify({
          gameId: fakeRoomId,
        }),
      })

      expect(response.status).toBe(404) // Not Found
    }, 10000)
  })

  describe('Room State Synchronization', () => {
    it('should synchronize room state across multiple participants', async () => {
      // Create two players
      const player1 = await createTestUser()
      const player2 = await createTestUser()
      createdUserIds.push(player1.userId, player2.userId)

      // Create room
      const room = await createTestRoom(player1.accessToken)
      createdRoomIds.push(room.roomId)

      // Both players join via REST
      await joinTestRoom(player2.accessToken, room.roomId)

      // Both players connect via Socket.io
      const player1Socket = await createAuthenticatedSocket(
        player1.accessToken
      )
      const player2Socket = await createAuthenticatedSocket(
        player2.accessToken
      )
      activeSockets.push(player1Socket, player2Socket)

      // Both players join room
      player1Socket.emit('join_room', { room_id: room.roomId })
      player2Socket.emit('join_room', { room_id: room.roomId })

      await Promise.all([
        waitForEvent(player1Socket, 'room_joined'),
        waitForEvent(player2Socket, 'room_joined'),
      ])

      // Get room details via REST for both players
      const [p1RoomData, p2RoomData] = await Promise.all([
        fetch(`${TEST_CONFIG.API_URL}/api/rooms/${room.roomId}`, {
          headers: { Authorization: `Bearer ${player1.accessToken}` },
        }).then(r => r.json()),
        fetch(`${TEST_CONFIG.API_URL}/api/rooms/${room.roomId}`, {
          headers: { Authorization: `Bearer ${player2.accessToken}` },
        }).then(r => r.json()),
      ])

      // Both should see the same room state
      expect(p1RoomData.game.id).toBe(room.roomId)
      expect(p2RoomData.game.id).toBe(room.roomId)
      expect(p1RoomData.game.participants).toHaveLength(2)
      expect(p2RoomData.game.participants).toHaveLength(2)
    }, 20000)

    it('should handle participant disconnection and reconnection', async () => {
      // Create two players
      const player1 = await createTestUser()
      const player2 = await createTestUser()
      createdUserIds.push(player1.userId, player2.userId)

      // Create and join room
      const room = await createTestRoom(player1.accessToken)
      createdRoomIds.push(room.roomId)
      await joinTestRoom(player2.accessToken, room.roomId)

      // Connect both players
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

      // Player 2 disconnects
      player2Socket.disconnect()
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Player 1 should receive participant_left notification
      const leftNotification = await waitForEvent(
        player1Socket,
        'participant_left',
        5000
      )
      expect(leftNotification.room_id).toBe(room.roomId)
      expect(leftNotification.participant_id).toBe(player2.userId)

      // Player 2 reconnects
      const player2NewSocket = await createAuthenticatedSocket(
        player2.accessToken
      )
      activeSockets.push(player2NewSocket)

      player2NewSocket.emit('join_room', { room_id: room.roomId })
      await waitForEvent(player2NewSocket, 'room_joined')

      // Player 1 should receive participant_joined notification
      const rejoinNotification = await waitForEvent(
        player1Socket,
        'participant_joined',
        5000
      )
      expect(rejoinNotification.room_id).toBe(room.roomId)
    }, 25000)
  })

  describe('Room Leaving and Cleanup', () => {
    it('should handle explicit room leave', async () => {
      // Create two players
      const player1 = await createTestUser()
      const player2 = await createTestUser()
      createdUserIds.push(player1.userId, player2.userId)

      // Create and join room
      const room = await createTestRoom(player1.accessToken)
      createdRoomIds.push(room.roomId)
      await joinTestRoom(player2.accessToken, room.roomId)

      // Connect both players
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

      // Player 2 explicitly leaves room
      player2Socket.emit('leave_room', { room_id: room.roomId })

      // Player 2 should receive room_left confirmation
      const leftData = await waitForEvent(player2Socket, 'room_left')
      expect(leftData.room_id).toBe(room.roomId)

      // Player 1 should receive participant_left notification
      const leftNotification = await waitForEvent(
        player1Socket,
        'participant_left'
      )
      expect(leftNotification.room_id).toBe(room.roomId)
      expect(leftNotification.participant_id).toBe(player2.userId)
      expect(leftNotification.reason).toBe('left_voluntarily')
    }, 20000)
  })

  describe('Error Handling', () => {
    it('should handle joining room without authentication', async () => {
      // Create a room first
      const player = await createTestUser()
      createdUserIds.push(player.userId)

      const room = await createTestRoom(player.accessToken)
      createdRoomIds.push(room.roomId)

      // Try to join via REST without auth token
      const response = await fetch(`${TEST_CONFIG.API_URL}/api/rooms/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No Authorization header
        },
        body: JSON.stringify({
          gameId: room.roomId,
        }),
      })

      expect(response.status).toBe(401) // Unauthorized
    }, 10000)

    it('should handle joining full room', async () => {
      // Create 2 players
      const player1 = await createTestUser()
      const player2 = await createTestUser()
      const player3 = await createTestUser()
      createdUserIds.push(player1.userId, player2.userId, player3.userId)

      // Create room (max 2 players for simplified version)
      const room = await createTestRoom(player1.accessToken)
      createdRoomIds.push(room.roomId)

      // Player 2 joins
      await joinTestRoom(player2.accessToken, room.roomId)

      // Player 3 tries to join (should be full)
      const response = await fetch(`${TEST_CONFIG.API_URL}/api/rooms/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${player3.accessToken}`,
        },
        body: JSON.stringify({
          gameId: room.roomId,
        }),
      })

      expect(response.status).toBe(400) // Bad Request - room full
      const error = await response.json()
      expect(error.error).toContain('full')
    }, 15000)
  })
})
