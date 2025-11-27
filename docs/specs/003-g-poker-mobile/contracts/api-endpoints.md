# API Endpoints Contract

**Generated**: 2025-01-12 | **Service**: Hono Backend REST API

## Authentication Endpoints

### POST /auth/login
**Purpose**: Authenticate mobile user with Supabase credentials
**Request**:
```typescript
interface LoginRequest {
  email: string;
  password: string;
  device_info: {
    device_id: string;
    platform: 'ios' | 'android';
    app_version: string;
  };
}
```

**Response 200**:
```typescript
interface LoginResponse {
  success: true;
  user: {
    id: string;
    display_name: string;
    email: string;
    profile: PlayerProfile;
  };
  tokens: {
    access_token: string;
    refresh_token: string;
    expires_at: string;
  };
}
```

**Response 401**:
```typescript
interface AuthErrorResponse {
  success: false;
  error: {
    code: 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED' | 'EMAIL_NOT_VERIFIED';
    message: string;
    retry_after?: number;
  };
}
```

### POST /auth/refresh
**Purpose**: Refresh expired access token
**Headers**: `Authorization: Bearer <refresh_token>`

**Response 200**:
```typescript
interface RefreshResponse {
  success: true;
  tokens: {
    access_token: string;
    refresh_token: string;
    expires_at: string;
  };
}
```

### POST /auth/logout
**Purpose**: Invalidate user session and tokens
**Headers**: `Authorization: Bearer <access_token>`

**Response 200**:
```typescript
interface LogoutResponse {
  success: true;
  message: 'Session invalidated';
}
```

---

## Player Profile Endpoints

### GET /profile
**Purpose**: Retrieve authenticated player's profile information
**Headers**: `Authorization: Bearer <access_token>`

**Response 200**:
```typescript
interface ProfileResponse {
  success: true;
  profile: {
    id: string;
    display_name: string;
    email: string;
    created_at: string;
    last_seen: string;

    statistics: {
      games_played: number;
      games_won: number;
      games_lost: number;
      win_percentage: number;
      longest_game_seconds: number;
      shortest_game_seconds: number;
      favorite_creature: 'cockroach' | 'mouse' | 'bat' | 'frog' | null;
      total_playtime_minutes: number;
    };

    preferences: {
      preferred_language: 'en' | 'ja';
      sound_enabled: boolean;
      push_notifications: boolean;
      vibration_enabled: boolean;
      theme_preference: 'light' | 'dark' | 'auto';
    };
  };
}
```

### PUT /profile/preferences
**Purpose**: Update player preferences (mobile-specific settings)
**Headers**: `Authorization: Bearer <access_token>`

**Request**:
```typescript
interface UpdatePreferencesRequest {
  preferred_language?: 'en' | 'ja';
  sound_enabled?: boolean;
  push_notifications?: boolean;
  vibration_enabled?: boolean;
  theme_preference?: 'light' | 'dark' | 'auto';
}
```

**Response 200**:
```typescript
interface UpdatePreferencesResponse {
  success: true;
  preferences: PlayerPreferences;
  message: 'Preferences updated successfully';
}
```

---

## Room Management Endpoints

### GET /rooms
**Purpose**: List available public game rooms with filtering
**Headers**: `Authorization: Bearer <access_token>`
**Query Parameters**:
- `status?: 'waiting' | 'active' | 'completed'` - Filter by room status
- `max_players?: number` - Filter by room capacity
- `page?: number` - Pagination (default: 1)
- `limit?: number` - Results per page (default: 20, max: 50)

**Response 200**:
```typescript
interface RoomsListResponse {
  success: true;
  rooms: {
    id: string;
    room_code: string | null;
    room_type: 'public' | 'private' | 'tournament';
    creator: {
      id: string;
      display_name: string;
    };
    created_at: string;

    settings: {
      max_players: number;
      current_players: number;
      game_speed: 'slow' | 'normal' | 'fast';
      allow_spectators: boolean;
    };

    status: 'waiting' | 'active' | 'completed';
    started_at: string | null;
    estimated_duration_minutes: number | null;
  }[];
  pagination: {
    page: number;
    limit: number;
    total_pages: number;
    total_rooms: number;
  };
}
```

### POST /rooms
**Purpose**: Create new game room with configuration
**Headers**: `Authorization: Bearer <access_token>`

**Request**:
```typescript
interface CreateRoomRequest {
  room_type: 'public' | 'private';
  max_players: number; // 2-6
  game_speed: 'slow' | 'normal' | 'fast';
  allow_spectators: boolean;
  password_protected?: boolean;
  password?: string; // Required if password_protected is true
  rule_variations?: {
    enable_power_cards?: boolean;
    turn_timeout_seconds?: number;
    reconnection_timeout_minutes?: number;
  };
}
```

**Response 201**:
```typescript
interface CreateRoomResponse {
  success: true;
  room: {
    id: string;
    room_code: string | null;
    creator_id: string;
    settings: RoomSettings;
    status: 'waiting';
    created_at: string;
  };
  join_info: {
    player_position: number;
    ready_status: false;
  };
}
```

### POST /rooms/:roomId/join
**Purpose**: Join existing game room as player or spectator
**Headers**: `Authorization: Bearer <access_token>`

**Request**:
```typescript
interface JoinRoomRequest {
  role: 'player' | 'spectator';
  password?: string; // Required for password-protected rooms
}
```

**Response 200**:
```typescript
interface JoinRoomResponse {
  success: true;
  room: RoomDetails;
  participant_info: {
    role: 'player' | 'spectator';
    seat_position: number | null;
    ready_status: boolean;
    joined_at: string;
  };
  other_participants: {
    id: string;
    display_name: string;
    role: 'player' | 'spectator';
    seat_position: number | null;
    ready_status: boolean;
    connection_status: 'connected' | 'disconnected' | 'reconnecting';
  }[];
}
```

**Response 400**:
```typescript
interface JoinRoomErrorResponse {
  success: false;
  error: {
    code: 'ROOM_FULL' | 'INVALID_PASSWORD' | 'ALREADY_JOINED' | 'ROOM_STARTED';
    message: string;
    available_slots?: number;
  };
}
```

### PUT /rooms/:roomId/ready
**Purpose**: Toggle player ready status for game start
**Headers**: `Authorization: Bearer <access_token>`

**Request**:
```typescript
interface ToggleReadyRequest {
  ready: boolean;
}
```

**Response 200**:
```typescript
interface ToggleReadyResponse {
  success: true;
  ready_status: boolean;
  all_players_ready: boolean;
  game_will_start: boolean;
  countdown_seconds?: number;
}
```

### DELETE /rooms/:roomId/leave
**Purpose**: Leave game room (player or spectator)
**Headers**: `Authorization: Bearer <access_token>`

**Response 200**:
```typescript
interface LeaveRoomResponse {
  success: true;
  message: 'Left room successfully';
  room_status: 'waiting' | 'active' | 'abandoned';
  new_creator_id?: string; // If leaving player was creator
}
```

---

## Game Action Endpoints

### GET /rooms/:roomId/state
**Purpose**: Get current game state for room participant
**Headers**: `Authorization: Bearer <access_token>`

**Response 200**:
```typescript
interface GameStateResponse {
  success: true;
  room: {
    id: string;
    status: 'waiting' | 'active' | 'completed';
    current_players: number;
    started_at: string | null;
  };
  game_session: {
    session_version: number;
    current_round: number;
    current_phase: 'setup' | 'claiming' | 'responding' | 'resolution' | 'completed';
    turn_order: string[];
    current_turn_player: string;
    turn_deadline: string | null;

    player_info: {
      hand_size: number;
      penalty_counts: {
        cockroach: number;
        mouse: number;
        bat: number;
        frog: number;
      };
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
      connection_status: 'connected' | 'disconnected' | 'reconnecting';
    }[];

    current_claim: {
      claiming_player: string;
      target_player: string;
      claimed_creature: 'cockroach' | 'mouse' | 'bat' | 'frog';
      awaiting_response: boolean;
    } | null;
  } | null;
}
```

### POST /rooms/:roomId/actions/claim
**Purpose**: Make card claim against another player
**Headers**: `Authorization: Bearer <access_token>`

**Request**:
```typescript
interface ClaimActionRequest {
  target_player_id: string;
  claimed_creature: 'cockroach' | 'mouse' | 'bat' | 'frog';
  session_version: number; // Optimistic locking
}
```

**Response 200**:
```typescript
interface ClaimActionResponse {
  success: true;
  action_id: string;
  new_session_version: number;
  claim_details: {
    claiming_player: string;
    target_player: string;
    claimed_creature: 'cockroach' | 'mouse' | 'bat' | 'frog';
    response_deadline: string;
  };
  updated_game_state: GameStateSnapshot;
}
```

### POST /rooms/:roomId/actions/respond
**Purpose**: Respond to card claim (challenge or accept)
**Headers**: `Authorization: Bearer <access_token>`

**Request**:
```typescript
interface RespondActionRequest {
  response_type: 'challenge' | 'accept';
  session_version: number;
}
```

**Response 200**:
```typescript
interface RespondActionResponse {
  success: true;
  action_id: string;
  new_session_version: number;
  resolution: {
    response_type: 'challenge' | 'accept';
    outcome: 'challenger_wins' | 'claimer_wins';
    revealed_card: {
      creature: 'cockroach' | 'mouse' | 'bat' | 'frog';
      number: number;
    };
    penalty_assignment: {
      player_id: string;
      creature: 'cockroach' | 'mouse' | 'bat' | 'frog';
    };
  };
  updated_game_state: GameStateSnapshot;
  game_completed: boolean;
  winner_id?: string;
}
```

### POST /rooms/:roomId/actions/play-card
**Purpose**: Play card from hand (when not making claim)
**Headers**: `Authorization: Bearer <access_token>`

**Request**:
```typescript
interface PlayCardRequest {
  card_index: number; // Index in player's hand
  session_version: number;
}
```

**Response 200**:
```typescript
interface PlayCardResponse {
  success: true;
  action_id: string;
  new_session_version: number;
  played_card: {
    creature: 'cockroach' | 'mouse' | 'bat' | 'frog';
    number: number;
  };
  updated_game_state: GameStateSnapshot;
  next_turn_player: string;
}
```

---

## Error Response Standards

### 400 Bad Request
```typescript
interface BadRequestResponse {
  success: false;
  error: {
    code: 'VALIDATION_ERROR' | 'MISSING_FIELDS' | 'INVALID_INPUT';
    message: string;
    details?: {
      field: string;
      issue: string;
    }[];
  };
}
```

### 401 Unauthorized
```typescript
interface UnauthorizedResponse {
  success: false;
  error: {
    code: 'TOKEN_EXPIRED' | 'INVALID_TOKEN' | 'TOKEN_MISSING';
    message: string;
    requires_login: boolean;
  };
}
```

### 403 Forbidden
```typescript
interface ForbiddenResponse {
  success: false;
  error: {
    code: 'INSUFFICIENT_PERMISSIONS' | 'GAME_ACTION_NOT_ALLOWED' | 'NOT_YOUR_TURN';
    message: string;
    allowed_actions?: string[];
  };
}
```

### 404 Not Found
```typescript
interface NotFoundResponse {
  success: false;
  error: {
    code: 'ROOM_NOT_FOUND' | 'PLAYER_NOT_FOUND' | 'SESSION_NOT_FOUND';
    message: string;
  };
}
```

### 409 Conflict
```typescript
interface ConflictResponse {
  success: false;
  error: {
    code: 'STALE_SESSION_VERSION' | 'CONCURRENT_ACTION' | 'GAME_STATE_CHANGED';
    message: string;
    current_session_version?: number;
    suggested_action: 'REFRESH_STATE' | 'RETRY_ACTION' | 'RECONNECT';
  };
}
```

### 429 Too Many Requests
```typescript
interface RateLimitResponse {
  success: false;
  error: {
    code: 'RATE_LIMIT_EXCEEDED';
    message: string;
    retry_after_seconds: number;
    limit_type: 'API_CALLS' | 'GAME_ACTIONS' | 'ROOM_CREATION';
  };
}
```

### 500 Internal Server Error
```typescript
interface ServerErrorResponse {
  success: false;
  error: {
    code: 'INTERNAL_ERROR' | 'DATABASE_ERROR' | 'SERVICE_UNAVAILABLE';
    message: string;
    error_id: string; // For support reference
    retry_recommended: boolean;
  };
}
```

---

**API Contract Status**: ✅ Complete - RESTful endpoints with comprehensive error handling
**Authentication**: JWT Bearer token required for all authenticated endpoints
**Rate Limiting**: 100 requests/minute per user, 10 game actions/minute per player
**Next Phase**: Socket.io real-time event contracts