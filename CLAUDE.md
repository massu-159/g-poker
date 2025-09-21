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

## Project Structure
- **App Entry**: `app/index.tsx` (Splash Screen)
- **Navigation Flow**: Splash → Welcome → Authentication
- **Supabase Migrations**: `supabase/migrations/`
- **Documentation**: `docs/specs/001-reactnative-web/`

## Development Commands
- Start: `npm run start` or `npx expo start`
- Testing: `npm run test`
- Linting: `npm run lint`
- Type Check: `npm run typecheck`