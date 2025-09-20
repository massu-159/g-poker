# G-Poker Enterprise Architecture

## Directory Structure

### Core Libraries (`lib/`)
- **`entities/`** - Enterprise data models with security metadata
- **`gameLogic/`** - Game logic with security validation
- **`security/`** - Security utilities and authentication helpers
- **`audit/`** - Audit trail utilities and event sourcing
- **`logging/`** - Structured logging with correlation IDs

### Services (`services/`)
- Authentication, game, realtime, matchmaking, and storage services
- All services implement security validation and audit logging

### State Management (`stores/`)
- Zustand stores with security context
- TanStack Query with authentication interceptors

### UI Components (`components/`)
- **`auth/`** - Authentication screens and forms
- **`cards/`** - Card display with secure data handling
- **`game/`** - Game UI with authenticated player display
- **`animations/`** - Animations with security state validation
- **`security/`** - Security indicators and status displays

### Screens (`screens/`)
- All screens implement authentication guards
- Secure gameplay context throughout

### Tests (`tests/`)
- **`contract/security/`** - Authentication, RLS, indirection tests
- **`contract/audit/`** - Audit trail and compliance tests
- **`contract/supabase_api/`** - Secure API operation tests
- **`unit/`** - Unit tests with security context
- **`integration/`** - End-to-end security flow tests

### Configuration (`config/`)
- Environment configuration with security settings
- Enterprise deployment configurations

## Security Architecture

### Authentication Flow
- Supabase Auth with enterprise session management
- Discord/Steam-style secure indirection via `game_player_id`
- Row Level Security (RLS) policies for data isolation

### Audit System
- Complete event sourcing for game actions
- Structured logging with correlation IDs
- Compliance-ready audit trails

### Enterprise Patterns
- Secure indirection for player identity
- Comprehensive security validation
- Enterprise-grade error handling and monitoring
