# G-Poker Mobile Server-Authoritative Architecture

## Project Overview
**Current Architecture**: Mobile-first multiplayer gaming platform with server-authoritative game rooms
**Branch**: `003-g-poker-mobile`
**Status**: Planning complete, ready for implementation

## Technical Stack
- **Frontend**: React Native + Expo (iOS/Android only, no web)
- **Backend**: Hono framework with TypeScript on Node.js 18+
- **Real-time**: Socket.io with Redis adapter for horizontal scaling
- **Database**: Supabase PostgreSQL with simplified RLS policies
- **Authentication**: Supabase Auth with JWT token validation
- **Deployment**: Docker containers on Google Cloud Run
- **Testing**: Jest (unit), Playwright (API), Detox (React Native E2E)

## Key Architecture Principles
1. **Server-Authoritative**: Complete server control over game state and rule enforcement
2. **Zero Client-Side Game Logic**: Mobile app handles UI only, all decisions made on server
3. **Mobile-Only Distribution**: iOS/Android app stores, no web version
4. **Cloud-Native Scaling**: Auto-scaling via Cloud Run with Redis clustering

## Directory Structure
```
/backend          # Hono API server + Socket.io
/frontend         # React Native + Expo mobile app
/shared           # TypeScript shared type definitions
/supabase/migrations  # Database schema evolution
/docs/specs/003-g-poker-mobile/  # Complete specification documents
```

## Database Schema (Server-Authoritative)
### Enhanced Tables
- **profiles**: Extended with mobile preferences (sound, notifications, theme)
- **game_rooms**: Server-managed multiplayer rooms (2-6 players)
- **game_sessions**: Active game state for Socket.io recovery
- **room_participants**: Player membership with roles and connection status
- **server_events**: Comprehensive audit trail for all game actions

### RLS Security Model
- **Simplified policies**: Server-only database access via service role
- **No direct client access**: All database operations through Hono backend
- **JWT validation**: Authentication handled in Hono middleware

## API Architecture
### REST Endpoints (Hono)
- Authentication: `/auth/login`, `/auth/refresh`, `/auth/logout`
- Profile: `/profile`, `/profile/preferences`
- Rooms: `/rooms` (CRUD), `/rooms/:id/join`, `/rooms/:id/ready`
- Game Actions: `/rooms/:id/actions/claim`, `/rooms/:id/actions/respond`

### Socket.io Events
- Connection: `authenticate`, `join_room`, `leave_room`
- Game State: `game_started`, `game_state_updated`, `action_performed`
- Recovery: `state_recovery_data`, `connection_status_update`

## Implementation Status
### Completed
- ✅ Complete specification and technical research
- ✅ Database schema design with migration path
- ✅ API contracts (REST + Socket.io events)
- ✅ 48-task implementation plan with TDD approach
- ✅ 90-minute quickstart validation guide

### Ready for Implementation
- **Phase 3.1**: Infrastructure setup (T001-T007)
- **Phase 3.2**: TDD test suite (T008-T024) - must fail before implementation
- **Phase 3.3**: Database schema evolution (T025-T031)
- **Phase 3.4**: Backend API + Socket.io (T032-T046)
- **Phase 3.5**: React Native frontend (T047-T048)

## Development Workflow
1. **TDD Enforcement**: All tests written first and must fail
2. **Parallel Execution**: 28 tasks marked [P] for concurrent development
3. **Backend-First**: Complete server implementation before frontend
4. **Incremental Testing**: Validation at each phase completion

## Performance Targets
- **Response Time**: <200ms for API operations
- **Real-time Sync**: <100ms for game state updates
- **Concurrent Players**: 1000+ across multiple rooms
- **Uptime**: 99.9% with graceful handling of connection issues
- **Scaling**: Horizontal via Cloud Run (0-100 instances)

## Key Differences from Previous Specs
- **No Web Version**: Mobile-only instead of hybrid web support
- **Server-Authoritative**: Complete backend control vs client-side game logic
- **Simplified Architecture**: Hono + Cloud Run vs complex Kubernetes migration
- **Direct Build**: New implementation vs migration from existing system
- **Modern Stack**: Latest React Native + Expo vs older hybrid approaches

## Next Steps
1. Execute T001: Create project structure (`backend/`, `frontend/`, `shared/`)
2. Initialize backend with Hono + Socket.io dependencies
3. Setup React Native + Expo frontend project
4. Begin TDD test suite development (all tests must fail initially)