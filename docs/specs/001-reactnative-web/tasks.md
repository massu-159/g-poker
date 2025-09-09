# Tasks: ごきぶりポーカー React Native App

**Input**: Design documents from `/specs/001-reactnative-web/`
**Prerequisites**: plan.md (✅), research.md (✅), data-model.md (✅), contracts/ (✅)

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → ✅ Found: React Native + Expo, Supabase backend, Zustand state management
   → Extract: TypeScript, React Native 0.79.5, Expo SDK 53+, Supabase Cloud
2. Load optional design documents:
   → ✅ data-model.md: Game, Player, Card, Round entities
   → ✅ contracts/: REST API (6 endpoints) + WebSocket API (11 events)
   → ✅ research.md: Supabase over Socket.io, architecture decisions
3. Generate tasks by category:
   → Setup: Expo project, Supabase, dependencies, linting
   → Tests: contract tests (REST + WebSocket), integration tests
   → Core: database models, Supabase services, React Native components
   → Integration: realtime subscriptions, state management, animations
   → Polish: unit tests, performance optimization, documentation
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Mobile + Backend**: React Native app with Supabase backend-as-a-service
- Paths assume single project structure from plan.md

## Phase 3.1: Setup ✅ COMPLETED
- [x] T001 Create React Native project structure with Expo SDK 53+ at repository root
- [x] T002 Initialize Supabase Cloud project (vwrkmlgziauzchqpxemq) direct connection
- [x] T003 [P] Install and configure dependencies: Zustand, TanStack Query, Shopify Restyle, React Native Reanimated 3
- [x] T004 [P] Configure TypeScript strict mode and ESLint/Prettier in project root
- [x] T005 [P] Setup Supabase Cloud connection with initial schema migration

## Phase 3.2: Database Schema (TDD Foundation) ✅ COMPLETED
**CRITICAL: Database schema MUST exist before any tests or implementation**
**NOTE: Using Supabase Cloud direct connection, apply via MCP tools or Dashboard**
- [x] T006 [P] Create Supabase schema for games table (applied to Cloud DB)
- [x] T007 [P] Create Supabase schema for players table (applied to Cloud DB)
- [x] T008 [P] Create Supabase schema for cards table (applied to Cloud DB)
- [x] T009 [P] Create Supabase schema for rounds table (applied to Cloud DB)
- [x] T010 [P] Create Supabase schema for game_actions table (applied to Cloud DB)
- [x] T011 Configure Row Level Security policies via MCP tools (applied to Cloud DB)

## Phase 3.3: Contract Tests (TDD) ✅ COMPLETED
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
**NOTE: Updated to test Supabase Cloud API instead of custom REST/WebSocket**
- [x] T012 [P] Contract test Supabase connection in tests/contract/supabase_api/test_supabase_connection.test.ts
- [x] T013 [P] Contract test game CRUD operations in tests/contract/supabase_api/test_game_operations.test.ts
- [x] T014 [P] Contract test player operations in tests/contract/supabase_api/test_player_operations.test.ts  
- [x] T015 [P] Contract test matchmaking service in tests/contract/supabase_api/test_player_operations.test.ts
- [x] T016 [P] Contract test realtime subscriptions in tests/contract/supabase_api/test_realtime_operations.test.ts
- [x] T017 [P] Contract test game action recording in tests/contract/supabase_api/test_realtime_operations.test.ts
- [x] T018 [P] Contract test game history retrieval in tests/contract/supabase_api/test_realtime_operations.test.ts
- [x] T019 [P] Contract test RLS policy enforcement (all test files)
- [x] T020 [P] Contract test database constraints (all test files)
- [x] T021 [P] Contract test authentication/authorization (all test files)

**TDD RED PHASE VERIFIED**: All tests fail appropriately due to missing implementation ✅

## Phase 3.4: Integration Tests (TDD) ✅ COMPLETED
**TDD RED PHASE VERIFIED**: All integration tests fail appropriately due to missing implementation ✅
- [x] T022 [P] Integration test complete 2-player game flow in tests/integration/test_complete_game_flow.test.ts
- [x] T023 [P] Integration test player connection/disconnection in tests/integration/test_connection_handling.test.ts
- [x] T024 [P] Integration test matchmaking process in tests/integration/test_matchmaking_flow.test.ts
- [x] T025 [P] Integration test game state synchronization in tests/integration/test_state_sync.test.ts

## Phase 3.5: Data Models (ONLY after tests are failing) ✅ COMPLETED  
- [x] T026 [P] Game entity model with TypeScript interfaces in src/lib/entities/Game.ts
- [x] T027 [P] Player entity model with validation in src/lib/entities/Player.ts
- [x] T028 [P] Card entity model and enums in src/lib/entities/Card.ts
- [x] T029 [P] Round entity model with response types in src/lib/entities/Round.ts
- [x] T030 [P] Game logic utility functions in src/lib/gameLogic/index.ts

## Phase 3.6: Supabase Services ✅ COMPLETED
- [x] T031 Supabase client configuration and initialization in src/services/supabase.ts
- [x] T032 Game service for database operations in src/services/gameService.ts
- [x] T033 Realtime service for WebSocket subscriptions in src/services/realtimeService.ts
- [x] T034 Authentication service for player sessions in src/services/authService.ts
- [x] T035 Matchmaking service integration in src/services/matchmakingService.ts

## Phase 3.7: State Management ✅ COMPLETED
- [x] T036 [P] Zustand game store with optimistic updates in src/stores/gameStore.ts
- [x] T037 [P] Zustand user store for player profile in src/stores/userStore.ts
- [x] T038 [P] TanStack Query setup and configuration in src/lib/queryClient.ts
- [x] T039 React hooks for game state management in src/hooks/useGameState.ts
- [x] T040 React hooks for realtime subscriptions in src/hooks/useRealtimeSubscription.ts

## Phase 3.8: UI Components
- [ ] T041 [P] Card component with creature types in src/components/cards/Card.tsx
- [ ] T042 [P] Hand component for displaying player cards in src/components/cards/Hand.tsx
- [ ] T043 [P] Penalty pile component in src/components/game/PenaltyPile.tsx
- [ ] T044 [P] Game board layout component in src/components/game/GameBoard.tsx
- [ ] T045 [P] Player area component in src/components/game/PlayerArea.tsx
- [ ] T046 Turn indicator and game status in src/components/game/GameStatus.tsx

## Phase 3.9: Screens
- [ ] T047 Lobby screen with matchmaking in src/screens/LobbyScreen.tsx
- [ ] T048 Game screen with main gameplay in src/screens/GameScreen.tsx
- [ ] T049 Results screen with winner display in src/screens/ResultScreen.tsx
- [ ] T050 Loading screen and connection status in src/screens/LoadingScreen.tsx

## Phase 3.10: Animations
- [ ] T051 [P] Card dealing animations with Reanimated 3 in src/components/animations/CardDealing.tsx
- [ ] T052 [P] Card playing/moving animations in src/components/animations/CardMovement.tsx
- [ ] T053 [P] UI transition animations in src/components/animations/Transitions.tsx

## Phase 3.11: Navigation and App Structure
- [ ] T054 Navigation setup with React Navigation in src/navigation/AppNavigator.tsx
- [ ] T055 App root component with providers in App.tsx
- [ ] T056 Environment configuration and constants in src/config/environment.ts

## Phase 3.12: Polish
- [ ] T057 [P] Unit tests for game logic in tests/unit/gameLogic.test.ts
- [ ] T058 [P] Unit tests for utility functions in tests/unit/utils.test.ts
- [ ] T059 [P] Component tests with React Native Testing Library in tests/unit/components/
- [ ] T060 Performance optimization and monitoring in src/lib/performance.ts
- [ ] T061 Error boundary and error handling in src/components/ErrorBoundary.tsx
- [ ] T062 Offline storage with SQLite in src/services/storageService.ts
- [ ] T063 App build configuration for iOS and Android
- [ ] T064 Update CLAUDE.md with React Native development context

## Dependencies

### Critical Paths
- **Setup** (T001-T005) → **Database** (T006-T011) → **Tests** (T012-T025) → **Implementation** (T026-T056)
- **Database schema** (T006-T011) blocks all other work
- **Contract tests** (T012-T021) must fail before models (T026-T030)
- **Integration tests** (T022-T025) must fail before services (T031-T035)

### Implementation Dependencies
- T031 (Supabase client) blocks T032-T035 (all services)
- T026-T030 (models) required for T036-T037 (stores)
- T036-T037 (stores) required for T039-T040 (hooks)
- T041-T046 (components) required for T047-T049 (screens)
- T031-T035 (services) + T036-T037 (stores) required for T047-T049 (screens)

### Parallel Groups
- **Database Migrations**: T006-T010 (different migration files)
- **Contract Tests**: T012-T021 (different test files)
- **Integration Tests**: T022-T025 (different test files)
- **Entity Models**: T026-T030 (different entity files)
- **Stores**: T036-T037 (independent state domains)
- **UI Components**: T041-T046 (independent component files)
- **Animations**: T051-T053 (different animation systems)

## Parallel Execution Examples

### Phase 3.2: Database Setup
```bash
Task: "Create Supabase migration for games table in supabase/migrations/001_create_games.sql"
Task: "Create Supabase migration for players table in supabase/migrations/002_create_players.sql"
Task: "Create Supabase migration for cards table in supabase/migrations/003_create_cards.sql"
Task: "Create Supabase migration for rounds table in supabase/migrations/004_create_rounds.sql"
```

### Phase 3.3: Contract Tests Launch
```bash
Task: "Contract test GET /v1/health in tests/contract/rest_api/test_health.test.ts"
Task: "Contract test POST /v1/games in tests/contract/rest_api/test_create_game.test.ts"
Task: "Contract test join-game WebSocket event in tests/contract/websocket_api/test_join_game.test.ts"
Task: "Contract test play-card WebSocket event in tests/contract/websocket_api/test_play_card.test.ts"
```

### Phase 3.5: Entity Models
```bash
Task: "Game entity model with TypeScript interfaces in src/lib/entities/Game.ts"
Task: "Player entity model with validation in src/lib/entities/Player.ts"
Task: "Card entity model and enums in src/lib/entities/Card.ts"
Task: "Round entity model with response types in src/lib/entities/Round.ts"
```

## Validation Checklist
*GATE: All items must be ✅ before implementation begins*

- [x] All REST API contracts (6 endpoints) have corresponding tests (T012-T017)
- [x] All WebSocket events (4 client events) have corresponding tests (T018-T021)
- [x] All entities (Game, Player, Card, Round) have model tasks (T026-T029)
- [x] All tests come before implementation (Phase 3.2-3.4 before 3.5+)
- [x] Parallel tasks truly independent (different files, no shared dependencies)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Supabase migration tasks create separate SQL files
- [x] TDD enforced: failing tests before implementation
- [x] Integration tests cover quickstart scenarios from quickstart.md

## Success Criteria
- ✅ 64 tasks covering complete React Native + Supabase multiplayer game
- ✅ TDD approach: 14 contract tests + 4 integration tests before implementation
- ✅ Parallel execution: 31 [P] tasks can run concurrently
- ✅ Clear dependencies prevent blocking and ensure proper order
- ✅ All design documents (data-model, contracts, research) addressed
- ✅ Complete path from database schema to App Store-ready React Native app