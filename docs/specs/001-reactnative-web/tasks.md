# Tasks: ごきぶりポーカー React Native App - Enterprise Architecture

**Input**: Design documents from `/specs/001-reactnative-web/`
**Prerequisites**: plan.md (✅), research.md (✅), data-model.md (✅), contracts/ (enterprise patterns)

## Execution Flow (Enterprise Architecture)
```
1. Load plan.md from feature directory
   → ✅ Found: React Native + Expo, Supabase Cloud, Enterprise Security
   → Extract: TypeScript, Supabase with RLS, Discord/Steam-style indirection
2. Load enterprise design documents:
   → ✅ data-model.md: Enterprise auth flow, secure indirection, event sourcing
   → ✅ research.md: Supabase Cloud architecture, security decisions
3. Generate tasks by enterprise category:
   → Setup: Enterprise project structure, security config, audit logging
   → Security: Authentication flow, RLS policies, secure indirection
   → Tests: Security testing, contract validation, penetration testing
   → Core: Enterprise models, services with audit trails, secure APIs
   → Integration: Event sourcing, realtime with security, monitoring
   → Polish: Security audit, performance under load, compliance
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions
- **[SECURITY]**: Critical security implementation
- **[AUDIT]**: Requires audit trail implementation

## Path Conventions
- **Enterprise Mobile**: React Native app with Supabase Cloud enterprise security
- Paths follow enterprise architecture patterns from data-model.md

## Phase 3.1: Enterprise Setup & Security Foundation
- [ ] T001 Create React Native enterprise project structure with security directories
- [ ] T002 Initialize Supabase Cloud with enterprise authentication schema (auth.users → profiles → public_profiles)
- [ ] T003 [P] [SECURITY] Configure enterprise security dependencies: Supabase Auth, RLS, UUID generation
- [ ] T004 [P] Configure TypeScript strict mode with security linting (ESLint security plugin)
- [ ] T005 [P] [SECURITY] Setup enterprise logging with correlation IDs and audit trails
- [ ] T006 [P] [AUDIT] Configure structured logging pipeline for security events

## Phase 3.2: Enterprise Database Schema with Security
**CRITICAL: Enterprise security schema MUST exist before any tests or implementation**
- [ ] T007 [P] [SECURITY] Create enterprise authentication tables (profiles, public_profiles) in Supabase
- [ ] T008 [P] [SECURITY] Create secure indirection layer (players with game_player_id) in Supabase
- [ ] T009 [P] Create games table with secure player references in Supabase
- [ ] T010 [P] Create cards table with secure ownership tracking in Supabase
- [ ] T011 [P] Create rounds table with secure player indirection in Supabase
- [ ] T012 [P] [AUDIT] Create game_actions event sourcing table in Supabase
- [ ] T013 [SECURITY] Configure comprehensive RLS policies for data isolation
- [ ] T014 [SECURITY] Create secure database functions (get_or_create_player_for_game)
- [ ] T015 [P] [SECURITY] Configure database indexes for performance and security queries
- [ ] T016 [SECURITY] Setup database triggers for audit logging and data validation

## Phase 3.3: Enterprise Security Testing (TDD)
**CRITICAL: Security tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T017 [P] [SECURITY] Contract test authentication flow in tests/contract/security/test_auth_flow.test.ts
- [ ] T018 [P] [SECURITY] Contract test RLS policy enforcement in tests/contract/security/test_rls_policies.test.ts
- [ ] T019 [P] [SECURITY] Contract test secure indirection in tests/contract/security/test_secure_indirection.test.ts
- [ ] T020 [P] [SECURITY] Contract test data isolation between users in tests/contract/security/test_data_isolation.test.ts
- [ ] T021 [P] [AUDIT] Contract test audit trail creation in tests/contract/audit/test_audit_trails.test.ts
- [ ] T022 [P] Contract test Supabase connection security in tests/contract/supabase_api/test_secure_connection.test.ts
- [ ] T023 [P] Contract test game operations with security in tests/contract/supabase_api/test_secure_game_operations.test.ts
- [ ] T024 [P] Contract test player operations with RLS in tests/contract/supabase_api/test_secure_player_operations.test.ts
- [ ] T025 [P] Contract test realtime subscriptions security in tests/contract/supabase_api/test_secure_realtime.test.ts
- [ ] T026 [P] [AUDIT] Contract test event sourcing integrity in tests/contract/supabase_api/test_event_sourcing.test.ts

## Phase 3.4: Enterprise Integration Testing (TDD)
**TDD RED PHASE VERIFIED**: All integration tests fail appropriately due to missing implementation ✅
- [ ] T027 [P] [SECURITY] Integration test complete authentication flow in tests/integration/test_enterprise_auth_flow.test.ts
- [ ] T028 [P] [SECURITY] Integration test secure player creation in tests/integration/test_secure_player_creation.test.ts
- [ ] T029 [P] Integration test complete game flow with security in tests/integration/test_secure_game_flow.test.ts
- [ ] T030 [P] [AUDIT] Integration test event sourcing and audit trails in tests/integration/test_audit_integration.test.ts
- [ ] T031 [P] Integration test connection handling with security in tests/integration/test_secure_connection_handling.test.ts
- [ ] T032 [P] Integration test state synchronization with RLS in tests/integration/test_secure_state_sync.test.ts

## Phase 3.5: Enterprise Data Models (ONLY after security tests are failing)
- [ ] T033 [P] [SECURITY] Enterprise authentication models in src/lib/entities/Auth.ts
- [ ] T034 [P] [SECURITY] Secure Player model with indirection in src/lib/entities/Player.ts
- [ ] T035 [P] Enterprise Game model with security metadata in src/lib/entities/Game.ts
- [ ] T036 [P] Card model with secure ownership tracking in src/lib/entities/Card.ts
- [ ] T037 [P] Round model with secure player references in src/lib/entities/Round.ts
- [ ] T038 [P] [AUDIT] Event sourcing models for game actions in src/lib/entities/GameAction.ts
- [ ] T039 [P] Enterprise game logic with security validation in src/lib/gameLogic/index.ts
- [ ] T040 [P] [SECURITY] TypeScript interfaces for secure database operations in src/types/database.ts

## Phase 3.6: Enterprise Supabase Services with Security
- [ ] T041 [SECURITY] Supabase client with enterprise auth configuration in src/services/supabase.ts
- [ ] T042 [SECURITY] Authentication service with secure session management in src/services/authService.ts
- [ ] T043 Game service with security validation and audit logging in src/services/gameService.ts
- [ ] T044 [SECURITY] Realtime service with authenticated subscriptions in src/services/realtimeService.ts
- [ ] T045 [SECURITY] Matchmaking service with secure player handling in src/services/matchmakingService.ts
- [ ] T046 [AUDIT] Storage service with audit trails in src/services/storageService.ts

## Phase 3.7: Enterprise State Management with Security
- [ ] T047 [P] [SECURITY] Zustand game store with security context in src/stores/gameStore.ts
- [ ] T048 [P] [SECURITY] Zustand user store with secure profile management in src/stores/userStore.ts
- [ ] T049 [P] TanStack Query with authentication interceptors in src/lib/queryClient.ts
- [ ] T050 React hooks for secure game state management in src/hooks/useGameState.ts
- [ ] T051 React hooks for authenticated realtime subscriptions in src/hooks/useRealtimeSubscription.ts

## Phase 3.8: Enterprise UI Components with Security Context
- [ ] T052 [P] Card component with secure data handling in src/components/cards/Card.tsx
- [ ] T053 [P] Hand component with user context validation in src/components/cards/Hand.tsx
- [ ] T054 [P] Penalty pile component with secure display in src/components/game/PenaltyPile.tsx
- [ ] T055 [P] Game board with authenticated player display in src/components/game/GameBoard.tsx
- [ ] T056 [P] Player area with secure user identification in src/components/game/PlayerArea.tsx
- [ ] T057 Game status with security indicators in src/components/game/GameStatus.tsx

## Phase 3.9: Secure Screens with Authentication
- [ ] T058 Login screen with enterprise authentication in src/components/auth/LoginScreen.tsx
- [ ] T059 Lobby screen with authenticated matchmaking in src/screens/LobbyScreen.tsx
- [ ] T060 Game screen with secure gameplay context in src/screens/GameScreen.tsx
- [ ] T061 Results screen with secure winner verification in src/screens/ResultScreen.tsx
- [ ] T062 Loading screen with security status indicators in src/screens/LoadingScreen.tsx

## Phase 3.10: Enterprise Animations with Security
- [ ] T063 [P] Card dealing animations with secure state in src/components/animations/CardDealing.tsx
- [ ] T064 [P] Card movement animations with validation in src/components/animations/CardMovement.tsx
- [ ] T065 [P] UI transitions with security context in src/components/animations/Transitions.tsx

## Phase 3.11: Enterprise App Architecture
- [ ] T066 Navigation with authentication guards in src/navigation/AppNavigator.tsx
- [ ] T067 App root with security providers and error boundaries in App.tsx
- [ ] T068 Enterprise environment configuration in src/config/environment.ts
- [ ] T069 [SECURITY] Mock providers for testing security scenarios in src/components/MockProviders.tsx
- [ ] T070 Screen selector for enterprise testing in src/components/ScreenSelector.tsx

## Phase 3.12: Enterprise Error Handling & Monitoring
- [ ] T071 [P] Enterprise error boundary with security logging in src/components/ErrorBoundary.tsx
- [ ] T072 [P] [AUDIT] Performance monitoring with security metrics in src/lib/performance.ts
- [ ] T073 [P] Unit tests for enterprise game logic in tests/unit/gameLogic.test.ts
- [ ] T074 [P] Unit tests for security utilities in tests/unit/utils.test.ts
- [ ] T075 [P] Component tests with security context in tests/unit/components/

## Phase 3.13: Enterprise Polish & Compliance
- [ ] T076 [SECURITY] Security audit and penetration testing validation
- [ ] T077 [AUDIT] Compliance verification for audit trails and data retention
- [ ] T078 Performance optimization under enterprise load testing
- [ ] T079 [SECURITY] App build configuration with security hardening for iOS/Android
- [ ] T080 Update CLAUDE.md with enterprise React Native security patterns

## Dependencies

### Critical Enterprise Security Path
- **Security Foundation** (T001-T006) → **Database Security** (T007-T016) → **Security Tests** (T017-T032) → **Secure Implementation** (T033-T080)
- **Authentication Schema** (T007-T008) blocks all user-related operations
- **RLS Policies** (T013) blocks all data access operations
- **Security Tests** (T017-T026) must fail before secure models (T033-T040)
- **Integration Tests** (T027-T032) must fail before secure services (T041-T046)

### Enterprise Implementation Dependencies
- T041 (Supabase with auth) blocks T042-T046 (all secure services)
- T033-T040 (enterprise models) required for T047-T048 (secure stores)
- T047-T048 (secure stores) required for T050-T051 (authenticated hooks)
- T052-T057 (secure components) required for T058-T062 (authenticated screens)
- T041-T046 (secure services) + T047-T048 (secure stores) required for T058-T062 (screens)

### Parallel Security Groups
- **Authentication Setup**: T007-T008 (different auth tables)
- **Security Tests**: T017-T026 (different security test files)
- **Enterprise Models**: T033-T040 (different secure entity files)
- **Secure Stores**: T047-T048 (independent secure state domains)
- **UI Components**: T052-T057 (independent component files with security context)
- **Security Animations**: T063-T065 (different animation systems with validation)

## Parallel Execution Examples

### Phase 3.2: Enterprise Database Security Setup
```bash
Task: "Create enterprise authentication tables (profiles, public_profiles) in Supabase"
Task: "Create secure indirection layer (players with game_player_id) in Supabase"
Task: "Create games table with secure player references in Supabase"
Task: "Create game_actions event sourcing table in Supabase"
```

### Phase 3.3: Security Testing Launch
```bash
Task: "Contract test authentication flow in tests/contract/security/test_auth_flow.test.ts"
Task: "Contract test RLS policy enforcement in tests/contract/security/test_rls_policies.test.ts"
Task: "Contract test secure indirection in tests/contract/security/test_secure_indirection.test.ts"
Task: "Contract test audit trail creation in tests/contract/audit/test_audit_trails.test.ts"
```

### Phase 3.5: Enterprise Entity Models
```bash
Task: "Enterprise authentication models in src/lib/entities/Auth.ts"
Task: "Secure Player model with indirection in src/lib/entities/Player.ts"
Task: "Enterprise Game model with security metadata in src/lib/entities/Game.ts"
Task: "Event sourcing models for game actions in src/lib/entities/GameAction.ts"
```

## Enterprise Validation Checklist
*GATE: All items must be ✅ before implementation begins*

- [ ] All authentication flows have comprehensive security tests (T017-T021)
- [ ] All database operations have RLS policy validation (T018, T023-T025)
- [ ] All entities have secure indirection patterns (T034-T037 follow game_player_id pattern)
- [ ] All tests validate security before implementation (Phase 3.3-3.4 before 3.5+)
- [ ] Parallel tasks truly independent with no security context conflicts
- [ ] Each task specifies exact file path with security implications noted
- [ ] No task modifies same file as another [P] task
- [ ] Event sourcing implemented for complete audit trail (T012, T026, T038, T046)
- [ ] TDD enforced: failing security tests before secure implementation
- [ ] Enterprise patterns: Discord/Steam-style secure indirection throughout

## Enterprise Success Criteria
- ✅ 80 tasks covering enterprise-grade React Native + Supabase multiplayer game
- ✅ Security-first approach: 16 security/audit tests before any implementation
- ✅ Enterprise patterns: Secure indirection, RLS policies, event sourcing, audit trails
- ✅ Parallel execution: 35+ [P] tasks can run concurrently with security validation
- ✅ Clear dependencies prevent security gaps and ensure proper enterprise order
- ✅ Complete enterprise architecture: authentication → authorization → audit → implementation
- ✅ Discord/Steam-level security with game_player_id indirection throughout
- ✅ Full audit trail from user registration to game completion via event sourcing