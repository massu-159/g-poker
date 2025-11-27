
# Implementation Plan: G-Poker Mobile Server-Authoritative Architecture

**Branch**: `003-g-poker-mobile` | **Date**: 2025-01-12 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-g-poker-mobile/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Server-authoritative mobile multiplayer gaming platform for Cockroach Poker with React Native frontend connecting exclusively through Hono backend API. Deployment via Docker containers on Google Cloud Run with horizontal scaling through Socket.io + Redis clustering. Zero direct database access from mobile clients, complete server authority over game state validation, and real-time synchronization targeting <200ms response times for 1000+ concurrent players.

## Technical Context
**Language/Version**: TypeScript 5.x for backend/frontend, Node.js 18+ for Hono server, React Native 0.74+ with Expo SDK
**Primary Dependencies**: Hono framework, Socket.io with Redis adapter, Supabase SDK, React Native/Expo, Docker for containerization
**Storage**: Supabase PostgreSQL with simplified RLS policies, Redis for Socket.io clustering, Cloud Storage for game assets
**Testing**: Jest for unit testing, Playwright for API integration, Detox for React Native E2E testing
**Target Platform**: iOS 15+ and Android 10+ mobile apps via app stores, Google Cloud Run for backend deployment
**Project Type**: mobile - React Native app + Hono API backend with clear /frontend and /backend directory separation
**Performance Goals**: <200ms API response times, 1000+ concurrent players, real-time game state sync within 100ms
**Constraints**: Server-authoritative model (zero client-side game logic), 99.9% uptime, horizontal auto-scaling via Cloud Run
**Scale/Scope**: Multi-room multiplayer support, 2-6 players per room, complete Cockroach Poker ruleset with statistics tracking

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: PASS - No project constitution defined, proceeding with mobile gaming industry best practices.

**Validation Notes**:
- No constitutional constraints found in `.specify/memory/constitution.md` (template only)
- Server-authoritative architecture follows standard multiplayer gaming patterns
- Frontend/backend separation aligns with mobile development best practices
- TDD approach supports quality assurance requirements
- Cloud-native deployment follows scalability principles

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure]
```

**Structure Decision**: Option 3 (Mobile + API) - React Native frontend in /frontend, Hono backend in /backend

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: ✅ research.md complete - All technical decisions resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude` for your AI assistant
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: ✅ data-model.md, contracts/*, quickstart.md, CLAUDE.md updated - Design artifacts complete

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each API endpoint → contract test task [P]
- Each Socket.io event → event test task [P]
- Each database entity → migration and model task [P]
- Each user acceptance scenario → integration test task
- Implementation tasks to make tests pass (backend before frontend)

**Ordering Strategy**:
- TDD order: Tests before implementation (all tests must fail initially)
- Architecture order: Database → Backend API → Socket.io → Frontend
- Frontend/backend separation: /backend tasks before /frontend tasks
- Mark [P] for parallel execution (independent files/components)
- Server-authoritative: All game logic in backend, UI logic in frontend

**Mobile-Specific Considerations**:
- React Native setup and configuration tasks
- iOS/Android platform-specific tasks where needed
- Cloud Run deployment and Docker containerization
- Supabase migration from existing schema to server-authoritative model

**Estimated Output**: 35-45 numbered, ordered tasks in tasks.md with clear frontend/backend separation

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) ✅
- [x] Phase 1: Design complete (/plan command) ✅
- [x] Phase 2: Task planning approach described (/plan command) ✅
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS ✅
- [x] Post-Design Constitution Check: PASS ✅
- [x] All NEEDS CLARIFICATION resolved ✅
- [x] Complexity deviations documented: N/A ✅

**Deliverables Generated**:
- ✅ research.md - Mobile gaming architecture and technology decisions
- ✅ data-model.md - Server-authoritative database schema with migration path
- ✅ contracts/api-endpoints.md - RESTful API specification for Hono backend
- ✅ contracts/socket-events.md - Real-time Socket.io event contracts
- ✅ quickstart.md - 90-minute development environment validation guide
- ✅ CLAUDE.md - Updated agent context for mobile server-authoritative architecture

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
