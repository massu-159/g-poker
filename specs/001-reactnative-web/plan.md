# Implementation Plan: ごきぶりポーカー React Native App

**Branch**: `001-reactnative-web` | **Date**: 2025-09-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-reactnative-web/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✅ Loaded: Online multiplayer ごきぶりポーカー with 2 players, 4 creature types, 9 cards each
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → ✅ React Native + Expo, Zustand, TanStack Query, Shopify Restyle
   → ✅ Project Type: Mobile app (React Native + Backend API)
   → ✅ Structure Decision: Mobile + API (Option 3)
3. Evaluate Constitution Check section below
   → ✅ Initial Constitution Check: PASS (documented below)
   → ✅ Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → ✅ All technical clarifications resolved through user input
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
6. Re-evaluate Constitution Check section
   → Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Online multiplayer ごきぶりポーカー (Cockroach Poker) mobile app where 2 players on separate devices play the bluffing card game. Each player receives 9 cards from a 24-card deck (4 creature types × 6 cards), with 6 cards hidden for randomness. Players take turns passing cards with creature claims (truth or lies), and the goal is to avoid collecting 3 of the same creature type. Requires real-time synchronization, matchmaking, and network resilience for smooth online gameplay.

Technical approach: React Native with Expo for cross-platform mobile development, Supabase for backend-as-a-service with built-in real-time capabilities, and modern state management with Zustand and TanStack Query.

## Technical Context
**Language/Version**: TypeScript 5.0+, React Native 0.73+  
**Primary Dependencies**: Expo SDK 50+, Zustand, TanStack Query, Shopify Restyle, Supabase  
**Storage**: SQLite (local), Supabase (PostgreSQL + realtime)  
**Testing**: Jest + React Native Testing Library, Supabase local development  
**Target Platform**: iOS 15+, Android 8+, App Store distribution  
**Project Type**: mobile - React Native app + Supabase backend  
**Performance Goals**: <100ms card action response, 60fps animations, <3s game start  
**Constraints**: Offline graceful degradation, <50MB app size, battery efficient  
**Scale/Scope**: 1k concurrent games, 5 screens, 10k registered users

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (mobile app) - under max 3 ✅
- Using framework directly? Yes - React Native & Supabase directly ✅
- Single data model? Yes - unified game state model ✅
- Avoiding patterns? Yes - no Repository/UoW, direct database access ✅

**Architecture**:
- EVERY feature as library? Yes - game-logic, supabase-client, ui-components libraries ✅
- Libraries listed: 
  - game-logic: Core ごきぶりポーカー rules and state management
  - supabase-client: Supabase integration with realtime subscriptions
  - ui-components: Reusable React Native components
- CLI per library: --help/--version/--format for testing and utilities ✅
- Library docs: llms.txt format planned ✅

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes - tests written first ✅
- Git commits show tests before implementation? Yes - commit strategy planned ✅
- Order: Contract→Integration→E2E→Unit strictly followed? Yes ✅
- Real dependencies used? Yes - actual SQLite, real Supabase instance ✅
- Integration tests for: new libraries, contract changes, Supabase realtime ✅
- FORBIDDEN: Implementation before test, skipping RED phase ✅

**Observability**:
- Structured logging included? Yes - JSON logs with correlation IDs ✅
- Frontend logs → backend? Yes - centralized logging pipeline ✅
- Error context sufficient? Yes - full error context with game state ✅

**Versioning**:
- Version number assigned? 1.0.0 (MAJOR.MINOR.BUILD) ✅
- BUILD increments on every change? Yes - automated via CI ✅
- Breaking changes handled? Yes - API versioning strategy ✅

## Project Structure

### Documentation (this feature)
```
specs/001-reactnative-web/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single Project (React Native + Supabase Backend)
src/
├── components/          # Reusable UI components (cards, game board)
├── screens/             # Game screens (lobby, game, results)
├── services/            # Supabase client, realtime subscriptions
├── stores/              # Zustand stores for game state
└── lib/                # Shared utilities and game logic

tests/
├── integration/         # Supabase integration tests
├── unit/               # Component and service unit tests
└── e2e/                # End-to-end game flow tests

supabase/
├── migrations/          # Database schema migrations
├── functions/           # Edge functions (if needed)
└── config.toml         # Supabase configuration
```

**Structure Decision**: Single Project (Option 1) - React Native app with Supabase backend-as-a-service

## Phase 0: Outline & Research

Since user provided comprehensive technical context, minimal research needed:

1. **Extract unknowns from Technical Context** above:
   - ✅ React Native + Expo: User specified, well-documented
   - ✅ Zustand + TanStack Query: User specified, proven state management
   - ✅ Shopify Restyle: User specified, solid styling solution
   - ✅ App Store distribution: Standard Expo workflow

2. **Generate and dispatch research agents**: 
   - Research best practices for React Native + Supabase multiplayer games
   - Evaluate Supabase realtime capabilities for card game scenarios
   - Research Expo limitations for Supabase apps and App Store publishing

3. **Consolidate findings** in `research.md`

**Output**: research.md with technology stack validation and architecture decisions

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Game: session state, players, deck, current turn
   - Player: hand, penalty pile, connection status
   - Card: creature type, location (hand/penalty/hidden)
   - Round: current card exchange, claims, responses

2. **Generate API contracts** from functional requirements:
   - Supabase table schemas: games, players, game_actions, game_players
   - Supabase realtime channels: game-specific subscriptions
   - Database functions: matchmaking, game logic validation
   - Output database schemas to `/contracts/`

3. **Generate contract tests** from contracts:
   - Supabase realtime subscription tests
   - Database schema validation tests
   - Row Level Security (RLS) policy tests

4. **Extract test scenarios** from user stories:
   - Full game flow integration test
   - Network disconnection recovery test
   - Quickstart test = complete 2-player game

5. **Update CLAUDE.md incrementally**:
   - Add React Native + game development context
   - Include Supabase debugging and development techniques
   - Update with Zustand + TanStack Query patterns

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs
- Database schema → Supabase migration and RLS policy tasks [P]
- Each entity → model creation + validation task [P] 
- Game flow user story → integration test task
- Mobile UI → component creation + screen assembly tasks
- Supabase integration → realtime subscription implementation tasks

**Ordering Strategy**:
- TDD order: Tests before implementation 
- Dependency order: Database Schema → Models → Supabase Services → UI → Integration
- Mark [P] for parallel execution (independent libraries)
- Database and UI tasks can run in parallel after schema

**Estimated Output**: 25-30 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (TDD execution of tasks.md)  
**Phase 5**: Validation (E2E tests, App Store preparation, performance validation)

## Complexity Tracking
*Constitution Check passed - no violations to justify*

No constitutional violations detected. Architecture follows all principles:
- Simple structure with 1 project (mobile app only)
- Direct framework usage without unnecessary abstractions (React Native + Supabase)
- Library-first approach with clear separation of concerns
- Comprehensive testing strategy following TDD principles
- Significant complexity reduction by eliminating custom backend server

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning approach described (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none required)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*