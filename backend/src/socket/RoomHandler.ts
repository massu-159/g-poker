/**
 * Room State Synchronization Handler (T044)
 * Handles join_room, leave_room events and real-time room state updates
 */

import { Server } from 'socket.io'
import type {
  AuthenticatedSocket,
  JoinRoomEvent,
  LeaveRoomEvent,
  RoomJoinedEvent,
  RoomJoinFailedEvent,
  RoomLeftEvent,
  Participant,
  RoomState,
  YourParticipation,
  ParticipantJoinedEvent,
  ParticipantLeftEvent,
} from './types.js'
import { isAuthenticated } from './AuthHandler.js'
import { broadcastConnectionStatus } from './RecoveryHandler.js'
import { getSupabase } from '../lib/supabase.js'

// Track room memberships
const roomMemberships = new Map<string, Set<string>>() // roomId -> Set of socketIds
const socketRooms = new Map<string, Set<string>>() // socketId -> Set of roomIds

/**
 * Setup room state handlers
 */
export function setupRoomHandlers(io: Server) {
  io.on('connection', (socket: AuthenticatedSocket) => {
    // Handle join room event
    socket.on('join_room', async (data: JoinRoomEvent) => {
      await handleJoinRoom(io, socket, data)
    })

    // Handle leave room event
    socket.on('leave_room', async (data: LeaveRoomEvent) => {
      await handleLeaveRoom(io, socket, data)
    })

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      handleDisconnectFromRooms(io, socket)
    })
  })
}

/**
 * Handle join room request
 */
async function handleJoinRoom(
  io: Server,
  socket: AuthenticatedSocket,
  data: JoinRoomEvent
) {
  try {
    // Check authentication
    if (!isAuthenticated(socket) || !socket.userId) {
      const error: RoomJoinFailedEvent = {
        room_id: data.room_id,
        error_code: 'ACCESS_DENIED',
        message: 'Not authenticated',
      }
      socket.emit('room_join_failed', error)
      return
    }

    const supabase = getSupabase()
    const userId = socket.userId

    // Check if room exists
    const { data: room, error: roomError } = await supabase
      .from('games')
      .select('*')
      .eq('id', data.room_id)
      .single()

    if (roomError || !room) {
      const error: RoomJoinFailedEvent = {
        room_id: data.room_id,
        error_code: 'ROOM_NOT_FOUND',
        message: 'Room does not exist',
      }
      socket.emit('room_join_failed', error)
      return
    }

    // Check if user is a participant
    const { data: participation, error: participationError } = await supabase
      .from('game_participants')
      .select('*')
      .eq('game_id', data.room_id)
      .eq('player_id', userId)
      .single()

    if (participationError || !participation) {
      const error: RoomJoinFailedEvent = {
        room_id: data.room_id,
        error_code: 'ACCESS_DENIED',
        message: 'You are not a participant in this room',
      }
      socket.emit('room_join_failed', error)
      return
    }

    // Join socket.io room
    socket.join(data.room_id)

    // Track membership
    if (!roomMemberships.has(data.room_id)) {
      roomMemberships.set(data.room_id, new Set())
    }
    roomMemberships.get(data.room_id)!.add(socket.id)

    if (!socketRooms.has(socket.id)) {
      socketRooms.set(socket.id, new Set())
    }
    socketRooms.get(socket.id)!.add(data.room_id)

    // Update participant status to playing (existing schema uses 'status' field)
    await supabase
      .from('game_participants')
      .update({
        status: 'playing',
        updated_at: new Date().toISOString(),
      })
      .eq('game_id', data.room_id)
      .eq('player_id', userId)

    // Get complete room state
    const roomState = await getRoomState(data.room_id)
    const participants = await getRoomParticipants(data.room_id)
    const yourParticipation = await getYourParticipation(data.room_id, userId)

    if (!roomState || !yourParticipation) {
      const error: RoomJoinFailedEvent = {
        room_id: data.room_id,
        error_code: 'ROOM_NOT_FOUND',
        message: 'Failed to retrieve room state',
      }
      socket.emit('room_join_failed', error)
      return
    }

    // Send room joined confirmation
    const response: RoomJoinedEvent = {
      room_id: data.room_id,
      room_state: roomState,
      participants: participants,
      your_participation: yourParticipation,
    }
    socket.emit('room_joined', response)

    // Broadcast to others that participant joined
    const joinNotification: ParticipantJoinedEvent = {
      room_id: data.room_id,
      participant: {
        id: userId,
        display_name: socket.displayName || 'Anonymous',
        role: 'player', // Schema only supports players (no spectators)
        seat_position: participation.position || 0,
        joined_at: participation.joined_at,
      },
    }
    socket.to(data.room_id).emit('participant_joined', joinNotification)

    // Broadcast connection status
    broadcastConnectionStatus(io, data.room_id, userId, 'connected')

    console.log(`[Room] User ${userId} joined room ${data.room_id}`)
  } catch (error) {
    console.error('[Room] Join room error:', error)
    const errorResponse: RoomJoinFailedEvent = {
      room_id: data.room_id,
      error_code: 'ROOM_NOT_FOUND',
      message: 'Failed to join room due to server error',
    }
    socket.emit('room_join_failed', errorResponse)
  }
}

/**
 * Handle leave room request
 */
async function handleLeaveRoom(
  io: Server,
  socket: AuthenticatedSocket,
  data: LeaveRoomEvent
) {
  try {
    if (!isAuthenticated(socket) || !socket.userId) {
      return
    }

    const userId = socket.userId
    const roomId = data.room_id

    // Leave socket.io room
    socket.leave(roomId)

    // Update tracking
    roomMemberships.get(roomId)?.delete(socket.id)
    socketRooms.get(socket.id)?.delete(roomId)

    // Update database
    const supabase = getSupabase()
    await supabase
      .from('game_participants')
      .update({
        status: 'disconnected',
      })
      .eq('game_id', roomId)
      .eq('player_id', userId)

    // Send confirmation
    const response: RoomLeftEvent = {
      room_id: roomId,
      message: 'Successfully left room',
    }
    socket.emit('room_left', response)

    // Broadcast to others
    const notification: ParticipantLeftEvent = {
      room_id: roomId,
      participant_id: userId,
      reason: 'left_voluntarily',
    }
    socket.to(roomId).emit('participant_left', notification)

    // Broadcast connection status
    broadcastConnectionStatus(io, roomId, userId, 'disconnected')

    console.log(`[Room] User ${userId} left room ${roomId}`)
  } catch (error) {
    console.error('[Room] Leave room error:', error)
  }
}

/**
 * Handle disconnection from all rooms
 */
function handleDisconnectFromRooms(io: Server, socket: AuthenticatedSocket) {
  const rooms = socketRooms.get(socket.id)
  if (!rooms || !socket.userId) {
    return
  }

  const userId = socket.userId

  rooms.forEach(roomId => {
    // Update tracking
    roomMemberships.get(roomId)?.delete(socket.id)

    // Broadcast disconnection
    const notification: ParticipantLeftEvent = {
      room_id: roomId,
      participant_id: userId,
      reason: 'disconnected',
    }
    socket.to(roomId).emit('participant_left', notification)

    // Broadcast connection status
    broadcastConnectionStatus(io, roomId, userId, 'disconnected')

    console.log(`[Room] User ${userId} disconnected from room ${roomId}`)
  })

  // Cleanup
  socketRooms.delete(socket.id)

  // Update database (fire and forget)
  const supabase = getSupabase()
  rooms.forEach(roomId => {
    supabase
      .from('game_participants')
      .update({
        status: 'disconnected',
      })
      .eq('game_id', roomId)
      .eq('player_id', userId)
      .then(() => {
        // Success - fire and forget
      })
  })
}

/**
 * Get room state
 */
async function getRoomState(roomId: string): Promise<RoomState | null> {
  try {
    const supabase = getSupabase()
    const { data: room, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', roomId)
      .single()

    if (error || !room) {
      return null
    }

    return {
      id: room.id,
      status: room.status,
      settings: {
        max_players: 2, // Fixed to 2 players (schema design - no max_players column)
        time_limit_seconds: room.time_limit_seconds,
        allow_spectators: false, // Not supported in current schema
      },
      created_at: room.created_at,
      started_at: null, // games table doesn't have started_at (could use updated_at)
    }
  } catch (error) {
    console.error('[Room] Get room state error:', error)
    return null
  }
}

/**
 * Get room participants
 */
async function getRoomParticipants(roomId: string): Promise<Participant[]> {
  try {
    const supabase = getSupabase()
    const { data: participants, error } = await supabase
      .from('game_participants')
      .select(
        `
        *,
        profiles!inner (
          public_profiles (
            display_name
          )
        )
      `
      )
      .eq('game_id', roomId)
      .order('position')

    if (error || !participants) {
      return []
    }

    return participants.map(p => ({
      id: p.player_id,
      display_name:
        (p.profiles as any)?.public_profiles?.[0]?.display_name || 'Anonymous',
      role: 'player', // Schema only supports players
      seat_position: p.position || 0,
      ready_status: p.status === 'joined', // Map status to ready_status
      connection_status: p.status === 'playing' ? 'connected' : 'disconnected',
      joined_at: p.joined_at,
    }))
  } catch (error) {
    console.error('[Room] Get participants error:', error)
    return []
  }
}

/**
 * Get your participation details
 */
async function getYourParticipation(
  roomId: string,
  userId: string
): Promise<YourParticipation | null> {
  try {
    const supabase = getSupabase()
    const { data: participation, error } = await supabase
      .from('game_participants')
      .select('*')
      .eq('game_id', roomId)
      .eq('player_id', userId)
      .single()

    if (error || !participation) {
      return null
    }

    return {
      role: 'player', // Schema only supports players
      seat_position: participation.position || 0,
      ready_status: participation.status === 'joined',
    }
  } catch (error) {
    console.error('[Room] Get your participation error:', error)
    return null
  }
}

/**
 * Get room members count
 */
export function getRoomMemberCount(roomId: string): number {
  return roomMemberships.get(roomId)?.size || 0
}

/**
 * Get all rooms for socket
 */
export function getSocketRooms(socketId: string): string[] {
  return Array.from(socketRooms.get(socketId) || [])
}
