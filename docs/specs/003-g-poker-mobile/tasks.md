# Tasks: G-Poker Mobile Server-Authoritative Architecture

**Input**: Design documents from `/specs/003-g-poker-mobile/`
**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

## Execution Flow (main)
```
1. Load plan.md from feature directory ✅
   → Extracted: TypeScript 5.x, Hono framework, React Native + Expo, Cloud Run deployment
   → Tech stack: Socket.io + Redis, Supabase PostgreSQL, Docker containerization
2. Load design documents ✅:
   → data-model.md: Enhanced profiles, game_rooms, game_sessions, room_participants, server_events
   → contracts/: api-endpoints.md, socket-events.md with comprehensive REST + WebSocket APIs
   → research.md: Server-authoritative architecture, mobile-first decisions, cloud infrastructure
   → quickstart.md: 90-minute validation scenarios for full platform
3. Generate tasks by category ✅:
   → Setup: Directory structure, dependencies, Docker configuration
   → Tests: Contract tests, integration tests, mobile E2E tests
   → Core: Database migrations, API endpoints, Socket.io events, React Native screens
   → Integration: Authentication, real-time sync, Cloud Run deployment
   → Polish: Performance optimization, monitoring, documentation
4. Apply task rules ✅:
   → Different files = [P] parallel execution
   → Tests before implementation (TDD)
   → Backend before frontend (server-authoritative)
5. Tasks numbered T001-T048
6. Parallel execution examples provided for efficient development
7. SUCCESS: 48 production-ready tasks with mobile gaming platform architecture
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- All file paths are absolute from repository root

## Path Conventions
**Mobile + API Architecture Structure**:
- **Backend API**: `backend/src/` for Hono server and Socket.io
- **Frontend Mobile**: `frontend/src/` for React Native + Expo
- **Shared Types**: `shared/` for TypeScript type definitions
- **Database**: `supabase/migrations/` for schema evolution
- **Deployment**: `backend/docker/` for Cloud Run configuration

## Phase 3.1: Infrastructure Setup

- [ ] T001 Create mobile gaming project structure: `backend/`, `frontend/`, `shared/`, `supabase/migrations/`
- [ ] T002 Initialize backend Node.js project with Hono, Socket.io, TypeScript dependencies in `backend/package.json`
- [ ] T003 [P] Initialize React Native Expo project with TypeScript and navigation in `frontend/package.json`
- [ ] T004 [P] Create shared TypeScript types directory with game state interfaces in `shared/types/`
- [ ] T005 [P] Configure backend ESLint, Prettier, and Jest in `backend/.eslintrc.js`, `backend/.prettierrc`
- [ ] T006 [P] Configure frontend ESLint, Prettier, and Detox in `frontend/.eslintrc.js`, `frontend/.prettierrc`
- [ ] T007 [P] Setup Docker configuration for backend deployment in `backend/Dockerfile` and `backend/docker-compose.yml`

## Phase 3.2: Database Schema Evolution (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Database Migration Tests [P]
- [ ] T008 [P] Migration test for profiles table enhancement in `supabase/migrations/test_profiles_enhancement.sql`
- [ ] T009 [P] Migration test for game_rooms table creation in `supabase/migrations/test_game_rooms_creation.sql`
- [ ] T010 [P] Migration test for game_sessions table creation in `supabase/migrations/test_game_sessions_creation.sql`
- [ ] T011 [P] Migration test for room_participants table creation in `supabase/migrations/test_room_participants_creation.sql`
- [ ] T012 [P] Migration test for server_events table creation in `supabase/migrations/test_server_events_creation.sql`
- [ ] T013 [P] RLS policy validation test for simplified server-only access in `supabase/migrations/test_rls_policies.sql`

### API Contract Tests [P]
- [ ] T014 [P] Authentication API contract test in `backend/tests/contracts/test_auth_endpoints.test.ts`
- [ ] T015 [P] Profile API contract test in `backend/tests/contracts/test_profile_endpoints.test.ts`
- [ ] T016 [P] Room management API contract test in `backend/tests/contracts/test_room_endpoints.test.ts`
- [ ] T017 [P] Game action API contract test in `backend/tests/contracts/test_game_endpoints.test.ts`

### Socket.io Event Tests [P]
- [ ] T018 [P] WebSocket authentication event test in `backend/tests/events/test_auth_events.test.ts`
- [ ] T019 [P] Room state synchronization event test in `backend/tests/events/test_room_events.test.ts`
- [ ] T020 [P] Game state update event test in `backend/tests/events/test_game_events.test.ts`
- [ ] T021 [P] Connection recovery event test in `backend/tests/events/test_recovery_events.test.ts`

### Integration Tests [P]
- [ ] T022 [P] End-to-end room creation and joining test in `backend/tests/integration/test_room_lifecycle.test.ts`
- [ ] T023 [P] Game session state management test in `backend/tests/integration/test_game_session.test.ts`
- [ ] T024 [P] Player authentication and authorization test in `backend/tests/integration/test_player_auth.test.ts`

## Phase 3.3: Database Schema Implementation (ONLY after tests are failing)

### Database Migrations [P] - Backward Compatible
- [ ] T025 [P] Profiles table enhancement migration in `supabase/migrations/001_enhance_profiles_table.sql`
- [ ] T026 [P] Game rooms table creation migration in `supabase/migrations/002_create_game_rooms_table.sql`
- [ ] T027 [P] Game sessions table creation migration in `supabase/migrations/003_create_game_sessions_table.sql`
- [ ] T028 [P] Room participants table creation migration in `supabase/migrations/004_create_room_participants_table.sql`
- [ ] T029 [P] Server events table creation migration in `supabase/migrations/005_create_server_events_table.sql`
- [ ] T030 [P] Database indexes and constraints migration in `supabase/migrations/006_create_indexes_constraints.sql`
- [ ] T031 Simplified RLS policies implementation in `supabase/migrations/007_implement_rls_policies.sql`

## Phase 3.4: Backend API Implementation

### Core Backend Services
- [ ] T032 Database connection service with Supabase client in `backend/src/services/DatabaseService.ts`
- [ ] T033 JWT authentication middleware with Supabase Auth in `backend/src/middleware/AuthMiddleware.ts`
- [ ] T034 [P] Player profile service with statistics management in `backend/src/services/PlayerService.ts`
- [ ] T035 [P] Game room service with server authority in `backend/src/services/RoomService.ts`
- [ ] T036 [P] Game session service with state management in `backend/src/services/GameService.ts`
- [ ] T037 [P] Server events logging service in `backend/src/services/EventService.ts`

### Hono API Endpoints
- [ ] T038 Authentication endpoints (login, refresh, logout) in `backend/src/routes/auth.ts`
- [ ] T039 Player profile endpoints (get, update preferences) in `backend/src/routes/profile.ts`
- [ ] T040 Room management endpoints (create, join, list, leave) in `backend/src/routes/rooms.ts`
- [ ] T041 Game action endpoints (claim, respond, play-card) in `backend/src/routes/game.ts`

### Socket.io Real-Time Implementation
- [ ] T042 Socket.io server setup with Redis adapter in `backend/src/socket/SocketServer.ts`
- [ ] T043 WebSocket authentication handler in `backend/src/socket/AuthHandler.ts`
- [ ] T044 Room state synchronization handler in `backend/src/socket/RoomHandler.ts`
- [ ] T045 Game state broadcast handler in `backend/src/socket/GameHandler.ts`
- [ ] T046 Connection recovery handler in `backend/src/socket/RecoveryHandler.ts`

## Phase 3.5: Frontend Mobile Implementation

### React Native Application Setup
- [ ] T047 Navigation structure with room browsing and game screens in `frontend/src/navigation/AppNavigator.tsx`
- [ ] T048 API client with JWT token management in `frontend/src/services/ApiClient.ts`

## Dependencies

### Critical Path Dependencies
- **Infrastructure before everything**: T001-T007 must complete before any other tasks
- **Tests before implementation**: T008-T024 must complete and FAIL before T025-T048
- **Database before API**: T025-T031 must complete before T032-T046
- **Backend before frontend**: T032-T046 must complete before T047-T048

### Specific Blocking Dependencies
- T025 (Profiles enhancement) blocks T034 (Player service), T039 (Profile endpoints)
- T026 (Game rooms table) blocks T035 (Room service), T040 (Room endpoints)
- T027 (Game sessions table) blocks T036 (Game service), T041 (Game endpoints)
- T032 (Database service) blocks T034-T037 (All services)
- T033 (Auth middleware) blocks T038-T041 (All API endpoints)
- T042 (Socket.io server) blocks T043-T046 (All Socket handlers)

## Parallel Execution Examples

### Phase 3.2: Launch All Database Tests Together
```bash
# All migration validation tests can run in parallel (isolated test databases)
Task: "Migration test for profiles table enhancement in supabase/migrations/test_profiles_enhancement.sql"
Task: "Migration test for game_rooms table creation in supabase/migrations/test_game_rooms_creation.sql"
Task: "Migration test for game_sessions table creation in supabase/migrations/test_game_sessions_creation.sql"
Task: "Migration test for room_participants table creation in supabase/migrations/test_room_participants_creation.sql"
Task: "Migration test for server_events table creation in supabase/migrations/test_server_events_creation.sql"
Task: "RLS policy validation test for simplified server-only access in supabase/migrations/test_rls_policies.sql"
```

### Phase 3.3: Launch All Schema Migrations Together
```bash
# All migration scripts can be prepared in parallel (different files)
Task: "Profiles table enhancement migration in supabase/migrations/001_enhance_profiles_table.sql"
Task: "Game rooms table creation migration in supabase/migrations/002_create_game_rooms_table.sql"
Task: "Game sessions table creation migration in supabase/migrations/003_create_game_sessions_table.sql"
Task: "Room participants table creation migration in supabase/migrations/004_create_room_participants_table.sql"
Task: "Server events table creation migration in supabase/migrations/005_create_server_events_table.sql"
Task: "Database indexes and constraints migration in supabase/migrations/006_create_indexes_constraints.sql"
```

### Phase 3.4: Launch All Backend Services Together
```bash
# All service implementations can be developed in parallel (independent files)
Task: "Player profile service with statistics management in backend/src/services/PlayerService.ts"
Task: "Game room service with server authority in backend/src/services/RoomService.ts"
Task: "Game session service with state management in backend/src/services/GameService.ts"
Task: "Server events logging service in backend/src/services/EventService.ts"
```

## Notes

### Implementation Guidelines
- **[P] tasks**: Different files, truly independent, can run simultaneously
- **Sequential tasks**: Modify same database or have logical dependencies
- **TDD enforcement**: Tests must be written first and must fail before implementation
- **Server-authoritative**: All game logic implemented in backend, frontend handles UI only
- **Mobile-first**: React Native optimized for iOS/Android with responsive design

### Quality Gates
- All API endpoints from contracts have corresponding test tasks
- All database entities from data-model have migration script tasks
- All Socket.io events have validation test tasks
- All tests come before their implementation counterparts
- Each task specifies exact absolute file path
- No [P] task modifies the same file as another [P] task

### Success Criteria Per Phase
- **Phase 3.1**: Complete project structure ready for mobile gaming development
- **Phase 3.2**: Comprehensive failing test suite covering all server-authoritative scenarios
- **Phase 3.3**: Production-ready database schema supporting mobile multiplayer gaming
- **Phase 3.4**: Complete backend API with real-time Socket.io communication
- **Phase 3.5**: React Native frontend connecting to server-authoritative backend

## Task Generation Rules Applied

1. **From Contracts**: api-endpoints.md → T014-T017, T038-T041; socket-events.md → T018-T021, T042-T046
2. **From Data Model**: Enhanced profiles, game_rooms, game_sessions, room_participants, server_events → T025-T031
3. **From Research**: Server-authoritative architecture, cloud deployment → T032-T037, T047-T048
4. **From Quickstart**: Mobile validation scenarios → T022-T024, T047-T048
5. **Ordering**: Infrastructure → Tests → Database → Backend → Frontend
6. **Parallelization**: Independent files marked [P], dependencies explicitly blocked

## Validation Checklist ✅

- [x] All API endpoints have validation tests (T014-T017 cover REST endpoints)
- [x] All Socket.io events have test coverage (T018-T021 cover WebSocket events)
- [x] All entities have migration tasks (profiles enhancement, game_rooms creation, etc.)
- [x] All tests come before implementation (T008-T024 before T025-T048)
- [x] Parallel tasks are truly independent (different files, different concerns)
- [x] Each task specifies exact file path with absolute paths
- [x] No [P] task conflicts with another [P] task (verified file isolation)
- [x] Backend tasks come before frontend tasks (server-authoritative model)

**Total Tasks**: 48 | **Parallel Tasks**: 28 | **Critical Path Length**: ~6 sequential phases
**Estimated Completion**: 4-6 weeks with parallel execution | **Time to MVP**: Week 4 (after T041)
**Mobile Gaming Platform**: Complete server-authoritative architecture with React Native frontend