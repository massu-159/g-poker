# Socket.io Events Contract

**Generated**: 2025-01-12 | **Service**: Real-time game state synchronization

## Connection Management

### Client → Server Events

#### `authenticate`
**Purpose**: Establish authenticated WebSocket connection
**Payload**:
```typescript
interface AuthenticateEvent {
  access_token: string;
  device_info: {
    device_id: string;
    platform: 'ios' | 'android';
    app_version: string;
  };
}
```

**Server Response Events**: `authenticated` | `authentication_failed`

#### `join_room`
**Purpose**: Subscribe to real-time updates for specific game room
**Payload**:
```typescript
interface JoinRoomEvent {
  room_id: string;
}
```

**Server Response Events**: `room_joined` | `room_join_failed`

#### `leave_room`
**Purpose**: Unsubscribe from room updates
**Payload**:
```typescript
interface LeaveRoomEvent {
  room_id: string;
}
```

**Server Response Events**: `room_left`

#### `heartbeat`
**Purpose**: Maintain connection and update last seen timestamp
**Payload**: `{ timestamp: string }`

**Server Response Events**: `heartbeat_ack`

---

### Server → Client Events

#### `authenticated`
**Purpose**: Confirm successful WebSocket authentication
**Payload**:
```typescript
interface AuthenticatedEvent {
  user_id: string;
  display_name: string;
  server_time: string;
  connection_id: string;
}
```

#### `authentication_failed`
**Purpose**: Notify authentication failure with reason
**Payload**:
```typescript
interface AuthenticationFailedEvent {
  error_code: 'INVALID_TOKEN' | 'TOKEN_EXPIRED' | 'USER_BANNED';
  message: string;
  requires_login: boolean;
}
```

#### `connection_error`
**Purpose**: Notify connection-level errors
**Payload**:
```typescript
interface ConnectionErrorEvent {
  error_code: 'RATE_LIMITED' | 'SERVER_ERROR' | 'INVALID_ROOM';
  message: string;
  retry_after_seconds?: number;
}
```

---

## Room State Events

### Server → Client Events

#### `room_joined`
**Purpose**: Confirm successful room subscription with current state
**Payload**:
```typescript
interface RoomJoinedEvent {
  room_id: string;
  room_state: {
    id: string;
    status: 'waiting' | 'active' | 'completed';
    settings: RoomSettings;
    created_at: string;
    started_at: string | null;
  };
  participants: {
    id: string;
    display_name: string;
    role: 'player' | 'spectator';
    seat_position: number | null;
    ready_status: boolean;
    connection_status: 'connected' | 'disconnected' | 'reconnecting';
    joined_at: string;
  }[];
  your_participation: {
    role: 'player' | 'spectator';
    seat_position: number | null;
    ready_status: boolean;
  };
}
```

#### `room_join_failed`
**Purpose**: Notify failed room subscription attempt
**Payload**:
```typescript
interface RoomJoinFailedEvent {
  room_id: string;
  error_code: 'ROOM_NOT_FOUND' | 'ACCESS_DENIED' | 'ROOM_FULL';
  message: string;
}
```

#### `participant_joined`
**Purpose**: Notify when new player/spectator joins room
**Payload**:
```typescript
interface ParticipantJoinedEvent {
  room_id: string;
  participant: {
    id: string;
    display_name: string;
    role: 'player' | 'spectator';
    seat_position: number | null;
    joined_at: string;
  };
  updated_room_state: {
    current_players: number;
    can_start_game: boolean;
  };
}
```

#### `participant_left`
**Purpose**: Notify when player/spectator leaves room
**Payload**:
```typescript
interface ParticipantLeftEvent {
  room_id: string;
  participant_id: string;
  left_at: string;
  reason: 'voluntary' | 'disconnected' | 'kicked' | 'banned';
  updated_room_state: {
    current_players: number;
    new_creator_id?: string; // If creator left
    game_status: 'waiting' | 'active' | 'paused' | 'abandoned';
  };
}
```

#### `ready_status_changed`
**Purpose**: Notify when player toggles ready status
**Payload**:
```typescript
interface ReadyStatusChangedEvent {
  room_id: string;
  player_id: string;
  ready_status: boolean;
  all_players_ready: boolean;
  game_start_countdown?: {
    will_start: boolean;
    countdown_seconds: number;
  };
}
```

#### `room_settings_updated`
**Purpose**: Notify when room creator modifies settings
**Payload**:
```typescript
interface RoomSettingsUpdatedEvent {
  room_id: string;
  updated_by: string;
  new_settings: RoomSettings;
  changes: {
    field: string;
    old_value: any;
    new_value: any;
  }[];
}
```

---

## Game State Events

### Server → Client Events

#### `game_started`
**Purpose**: Notify game beginning with initial state
**Payload**:
```typescript
interface GameStartedEvent {
  room_id: string;
  session_id: string;
  session_version: number;
  started_at: string;
  initial_state: {
    turn_order: string[];
    current_turn_player: string;
    turn_deadline: string;

    your_hand: {
      cards: {
        creature: 'cockroach' | 'mouse' | 'bat' | 'frog';
        number: number;
      }[];
      hand_size: number;
    };

    other_players: {
      id: string;
      display_name: string;
      hand_size: number;
      penalty_counts: {
        cockroach: number;
        mouse: number;
        bat: number;
        frog: number;
      };
    }[];

    game_phase: 'setup' | 'claiming' | 'responding' | 'resolution';
    current_round: number;
  };
}
```

#### `game_state_updated`
**Purpose**: Broadcast game state changes to all participants
**Payload**:
```typescript
interface GameStateUpdatedEvent {
  room_id: string;
  session_version: number;
  update_type: 'turn_change' | 'card_played' | 'claim_made' | 'claim_resolved' | 'round_completed';
  updated_at: string;

  updated_state: {
    current_turn_player: string;
    turn_deadline: string | null;
    game_phase: 'claiming' | 'responding' | 'resolution' | 'completed';
    current_round: number;

    player_updates: {
      id: string;
      hand_size_change?: number;
      penalty_changes?: {
        creature: 'cockroach' | 'mouse' | 'bat' | 'frog';
        count_change: number;
      }[];
    }[];

    current_claim?: {
      claiming_player: string;
      target_player: string;
      claimed_creature: 'cockroach' | 'mouse' | 'bat' | 'frog';
      response_deadline: string;
    };
  };

  // Private information for authenticated player only
  your_updated_hand?: {
    cards: GameCard[];
    hand_size: number;
  };
}
```

#### `action_performed`
**Purpose**: Notify successful game action with immediate feedback
**Payload**:
```typescript
interface ActionPerformedEvent {
  room_id: string;
  action_id: string;
  session_version: number;
  performed_by: string;
  action_type: 'claim' | 'challenge' | 'accept' | 'play_card';
  action_timestamp: string;

  action_details: {
    // For claim actions
    claim_info?: {
      target_player: string;
      claimed_creature: 'cockroach' | 'mouse' | 'bat' | 'frog';
    };

    // For response actions
    response_info?: {
      response_type: 'challenge' | 'accept';
      resolution_outcome: 'challenger_wins' | 'claimer_wins';
      revealed_card: GameCard;
      penalty_assignment: {
        player_id: string;
        creature: 'cockroach' | 'mouse' | 'bat' | 'frog';
      };
    };

    // For card play actions
    card_play_info?: {
      played_card: GameCard;
    };
  };

  next_state: {
    current_turn_player: string;
    turn_deadline: string | null;
    game_phase: string;
  };
}
```

#### `turn_timeout_warning`
**Purpose**: Warn current player of approaching turn deadline
**Payload**:
```typescript
interface TurnTimeoutWarningEvent {
  room_id: string;
  current_turn_player: string;
  seconds_remaining: number;
  timeout_action: 'auto_play_random' | 'auto_forfeit' | 'pause_game';
}
```

#### `turn_timeout`
**Purpose**: Notify turn timeout and automatic action taken
**Payload**:
```typescript
interface TurnTimeoutEvent {
  room_id: string;
  timed_out_player: string;
  automatic_action: {
    action_type: 'random_card_play' | 'forfeit_turn' | 'game_paused';
    action_details: any;
  };
  new_game_state: GameStateSnapshot;
}
```

#### `game_completed`
**Purpose**: Notify game completion with final results
**Payload**:
```typescript
interface GameCompletedEvent {
  room_id: string;
  session_id: string;
  completed_at: string;
  game_duration_seconds: number;

  final_results: {
    winner: {
      id: string;
      display_name: string;
      final_penalty_count: number;
    };
    final_standings: {
      id: string;
      display_name: string;
      final_penalty_counts: {
        cockroach: number;
        mouse: number;
        bat: number;
        frog: number;
      };
      total_penalties: number;
      ranking: number;
    }[];

    game_statistics: {
      total_rounds: number;
      total_claims: number;
      successful_challenges: number;
      failed_challenges: number;
      average_turn_duration_seconds: number;
    };
  };

  updated_player_stats: {
    games_played: number;
    games_won: number;
    win_percentage: number;
  };
}
```

---

## Connection Recovery Events

### Client → Server Events

#### `request_state_recovery`
**Purpose**: Request current game state after reconnection
**Payload**:
```typescript
interface StateRecoveryRequest {
  room_id: string;
  last_known_session_version?: number;
  connection_lost_at?: string;
}
```

#### `confirm_state_sync`
**Purpose**: Acknowledge successful state synchronization
**Payload**:
```typescript
interface StateSyncConfirmation {
  room_id: string;
  session_version: number;
  synchronized_at: string;
}
```

---

### Server → Client Events

#### `state_recovery_data`
**Purpose**: Provide complete game state for reconnecting client
**Payload**:
```typescript
interface StateRecoveryDataEvent {
  room_id: string;
  recovery_successful: boolean;
  recovery_timestamp: string;

  current_state: {
    session_version: number;
    game_phase: string;
    current_turn_player: string;
    turn_deadline: string | null;

    // Full game state reconstruction
    complete_game_state: GameStateSnapshot;

    // Actions missed during disconnection
    missed_actions: {
      action_id: string;
      action_type: string;
      performed_by: string;
      action_timestamp: string;
      action_summary: string;
    }[];

    // Updated private information
    your_current_hand: GameCard[];
  };

  reconnection_info: {
    was_disconnected_seconds: number;
    game_continued_during_absence: boolean;
    position_in_turn_order: number;
  };
}
```

#### `connection_status_update`
**Purpose**: Notify room participants of player connection changes
**Payload**:
```typescript
interface ConnectionStatusUpdateEvent {
  room_id: string;
  player_id: string;
  old_status: 'connected' | 'disconnected' | 'reconnecting';
  new_status: 'connected' | 'disconnected' | 'reconnecting';
  updated_at: string;

  impact_on_game: {
    game_paused: boolean;
    turn_extended: boolean;
    substitute_action_needed: boolean;
  };
}
```

---

## Error and Validation Events

### Server → Client Events

#### `action_rejected`
**Purpose**: Notify invalid game action attempt with detailed reason
**Payload**:
```typescript
interface ActionRejectedEvent {
  room_id: string;
  action_id: string;
  rejected_action: {
    action_type: string;
    attempted_by: string;
    rejection_reason: 'NOT_YOUR_TURN' | 'INVALID_MOVE' | 'STALE_SESSION' | 'GAME_ENDED';
    detailed_message: string;
  };

  current_valid_actions: string[];
  session_version_mismatch?: {
    client_version: number;
    server_version: number;
    recovery_needed: boolean;
  };
}
```

#### `validation_error`
**Purpose**: Notify client-side validation failures
**Payload**:
```typescript
interface ValidationErrorEvent {
  room_id: string;
  error_type: 'INVALID_PAYLOAD' | 'MISSING_FIELDS' | 'TYPE_MISMATCH';
  error_details: {
    field: string;
    expected: string;
    received: string;
  }[];
  suggested_fix: string;
}
```

---

## Event Rate Limiting

### Rate Limits
- **Game Actions**: 10 per minute per player
- **Room Management**: 20 per minute per player
- **Connection Events**: 100 per minute per player
- **Heartbeat**: 1 per 30 seconds per connection

### Rate Limit Exceeded Event
**Server → Client**:
```typescript
interface RateLimitExceededEvent {
  event_type: string;
  limit_type: 'GAME_ACTIONS' | 'ROOM_MANAGEMENT' | 'CONNECTION_EVENTS';
  current_count: number;
  limit_per_minute: number;
  reset_time: string;
  suggested_delay_seconds: number;
}
```

---

**Socket.io Contract Status**: ✅ Complete - Real-time bidirectional events with recovery
**Transport**: WebSocket with HTTP long-polling fallback
**Authentication**: JWT token validation on connection
**Next Phase**: Integration test scenarios and quickstart guide