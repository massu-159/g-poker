# Claude Code Configuration for G-Poker

## Development Guidelines

### Supabase Operations
**IMPORTANT**: All Supabase operations must use MCP tools instead of command-line tools.

#### Use MCP Tools For:
- Database migrations: `mcp__supabase__apply_migration`
- SQL execution: `mcp__supabase__execute_sql`
- Project management: `mcp__supabase__list_projects`, `mcp__supabase__get_project`
- Schema operations: `mcp__supabase__list_tables`, `mcp__supabase__list_migrations`
- Type generation: `mcp__supabase__generate_typescript_types`

#### Avoid Command-Line:
- ❌ `npx supabase db reset`
- ❌ `npx supabase migration list`
- ❌ `npx supabase db apply`

#### Reason:
MCP provides secure, consistent access to Supabase operations with proper permissions and error handling.

## Project Structure (Mobile Server-Authoritative Architecture)
- **Backend API**: `backend/src/` (Hono framework + Socket.io)
- **Frontend Mobile**: `frontend/src/` (React Native + Expo)
- **Shared Types**: `shared/types/` (TypeScript definitions)
- **Supabase Migrations**: `supabase/migrations/`
- **Documentation**: `docs/specs/003-g-poker-mobile/`

## Server-Authoritative Mobile Architecture (003-g-poker-mobile)

### Technology Stack
- **Frontend**: React Native 0.74+ with Expo SDK, TypeScript 5.x
- **Backend**: Hono framework on Node.js 18+, Socket.io with Redis adapter
- **Database**: Supabase PostgreSQL with simplified RLS policies
- **Real-time**: Socket.io for game state synchronization
- **Deployment**: Docker containers on Google Cloud Run
- **Authentication**: Supabase Auth with JWT validation in Hono middleware

### Architecture Principles
- **Server-Authoritative**: Complete backend control over game state and rule enforcement
- **Zero Client-Side Game Logic**: Mobile app handles UI only, all decisions made on server
- **Mobile-Only Distribution**: iOS/Android app stores, no web version
- **Cloud-Native Scaling**: Auto-scaling via Cloud Run with Redis clustering

### Key Directories
- `backend/src/services/` - Game logic, room management, player services
- `backend/src/routes/` - Hono API endpoints (auth, rooms, game actions)
- `backend/src/socket/` - Socket.io event handlers and real-time communication
- `frontend/src/screens/` - React Native game screens and navigation
- `frontend/src/services/` - API client and WebSocket integration
- `shared/types/` - Shared TypeScript interfaces for API contracts

### Development Commands
- **Backend**: `cd backend && npm run dev` (Hono server on port 3000)
- **Frontend**: `cd frontend && npx expo start` (React Native development)
- **Database**: Use MCP tools for migrations and SQL operations
- **Testing**: `npm run test` (Jest for backend, Detox for frontend)
- **Linting**: `npm run lint` (ESLint for both backend and frontend)
- **Type Check**: `npm run typecheck` (TypeScript validation)

### Recent Technical Decisions
- **Mobile-First**: iOS/Android only, eliminated web complexity
- **Server-Authoritative Model**: All game logic in Hono backend for fair play
- **Simplified Database**: Server-only RLS policies, no direct client access
- **Cloud-Native Deployment**: Docker + Cloud Run for horizontal scaling
- **Real-Time Architecture**: Socket.io + Redis for 1000+ concurrent players
- **Modern Stack**: Hono for performance, Expo for mobile development efficiency

### Database Schema (Server-Authoritative)
- **profiles**: Enhanced with mobile preferences (sound, notifications, theme)
- **game_rooms**: Server-managed multiplayer rooms (2-6 players)
- **game_sessions**: Active game state for Socket.io recovery
- **room_participants**: Player membership with roles and connection status
- **server_events**: Comprehensive audit trail for all game actions

### API Architecture
- **REST Endpoints**: Authentication, profile management, room operations
- **Socket.io Events**: Real-time game state, player actions, connection recovery
- **JWT Flow**: Supabase Auth → Hono validation → Socket.io authentication
- **Rate Limiting**: API abuse prevention at gateway level

### Implementation Status
- ✅ Complete specification (48 tasks planned)
- ✅ Database schema design with migration path
- ✅ API contracts (REST + Socket.io events)
- 🔄 **Current Phase**: T001-T007 (Infrastructure setup)
- 📋 **Next Phase**: T008-T024 (TDD test suite - must fail before implementation)

## Important Instructions
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.