# Research: G-Poker Mobile Server-Authoritative Architecture

**Generated**: 2025-01-12 | **Context**: Mobile multiplayer gaming platform technical decisions

## Server-Authoritative Game Architecture

### Decision: Hono Framework for Backend API
**Rationale**: Lightweight TypeScript framework optimized for Edge/Cloud environments with excellent performance and developer experience. Native support for Cloud Run deployment with minimal overhead.

**Key Benefits**:
- Ultra-fast startup times ideal for Cloud Run cold starts
- Built-in middleware for JWT validation and CORS handling
- TypeScript-first with excellent type safety
- Minimal resource footprint for cost-effective scaling
- Native Edge Runtime compatibility

**Alternatives Considered**:
- Express.js (rejected: slower startup, heavier resource usage)
- Fastify (rejected: less optimal for Cloud Run deployment)
- NestJS (rejected: too heavy for serverless architecture)

### Decision: Socket.io with Redis Adapter for Real-Time
**Rationale**: Industry-standard solution for real-time multiplayer gaming with proven horizontal scaling through Redis clustering. Automatic reconnection and room management built-in.

**Key Benefits**:
- Proven scalability for 1000+ concurrent connections per instance
- Automatic client reconnection handling
- Built-in room-based message broadcasting
- Redis adapter enables seamless horizontal scaling
- WebSocket fallback support for various network conditions

**Alternatives Considered**:
- Server-Sent Events (rejected: unidirectional, no automatic reconnection)
- WebRTC (rejected: peer-to-peer conflicts with server-authority model)
- Custom WebSocket implementation (rejected: reinventing proven solutions)

## Mobile Frontend Architecture

### Decision: React Native with Expo
**Rationale**: Cross-platform development with native performance, comprehensive development toolchain, and simplified app store deployment process.

**Key Benefits**:
- Single codebase for iOS and Android
- Native performance for real-time gaming
- Expo's managed workflow simplifies deployment
- Rich ecosystem of gaming-optimized libraries
- Over-the-air updates for rapid iteration

**Alternatives Considered**:
- Flutter (rejected: less mature gaming ecosystem)
- Native iOS/Android (rejected: development overhead for small team)
- Ionic (rejected: web-based performance limitations)

### Decision: TypeScript Shared Types
**Rationale**: Type safety across frontend/backend boundaries reduces runtime errors and improves development velocity. Shared type definitions ensure API contract compliance.

**Implementation Pattern**:
- `/shared` directory with common type definitions
- API request/response types generated from OpenAPI schemas
- Socket.io event typing for real-time message validation
- Game state types ensuring consistent data structures

## Cloud Infrastructure

### Decision: Google Cloud Run for Backend Deployment
**Rationale**: Serverless container platform with automatic scaling, pay-per-use pricing, and excellent TypeScript/Node.js support. Ideal for variable gaming workloads.

**Key Benefits**:
- Automatic scaling from 0 to 1000+ instances
- Sub-second cold start times with Hono
- Integrated load balancing and SSL termination
- Cost-effective pay-per-request pricing model
- Native Docker container support

**Scaling Configuration**:
- Minimum instances: 1 (warm instance for low latency)
- Maximum instances: 100 (supports 100,000+ concurrent players)
- Concurrency: 1000 connections per instance
- CPU allocation: 2 vCPU for optimal game processing
- Memory: 2Gi for game state management

### Decision: Redis Cloud for Socket.io Clustering
**Rationale**: Managed Redis service optimized for real-time applications with built-in clustering and persistence for game state recovery.

**Configuration**:
- Redis Cluster mode for horizontal scaling
- Persistence enabled for session recovery
- SSL/TLS encryption for secure communication
- Automatic failover for high availability

## Database Architecture

### Decision: Supabase PostgreSQL with Simplified RLS
**Rationale**: Managed PostgreSQL with built-in authentication, real-time subscriptions (replaced by Socket.io), and simplified security model focused on server-side operations.

**Schema Strategy**:
- Owner role for all database operations through Hono
- Simplified RLS policies removing direct client access
- Optimized indexes for concurrent player queries
- Game state persistence supporting Socket.io recovery

**Key Tables**:
- `profiles`: Enhanced player information and statistics
- `game_rooms`: Persistent room state and configuration
- `game_sessions`: Active game state for recovery
- `server_events`: Audit trail for game actions
- `player_statistics`: Aggregated performance metrics

### Decision: Migration from Existing Schema
**Rationale**: Evolutionary approach preserving existing player data while adding server-authoritative capabilities.

**Migration Path**:
1. Enhance existing `profiles` table with new fields
2. Create `game_rooms` table for server-managed rooms
3. Add `game_sessions` table for state persistence
4. Implement server audit logging in `server_events`
5. Simplify RLS policies for backend-only access

## Security Model

### Decision: JWT-Based Authentication with Supabase Auth
**Rationale**: Industry-standard token-based authentication with built-in session management and secure token validation in Hono middleware.

**Security Flow**:
1. Mobile app authenticates with Supabase Auth
2. JWT token passed to Hono API for validation
3. Server validates token and extracts user identity
4. All database operations performed with server owner role
5. Rate limiting and abuse prevention at API gateway level

**Key Security Features**:
- Server-side validation of all game actions
- Zero direct database access from mobile clients
- Audit logging of all player actions
- Rate limiting to prevent API abuse
- Secure session management with token refresh

## Performance Optimization

### Decision: Aggressive Caching Strategy
**Rationale**: Multi-layer caching reduces database load and improves response times for frequent operations.

**Caching Layers**:
- Redis: Active game state and player sessions
- Application: Frequently accessed player statistics
- CDN: Static game assets and images
- Client: Game rules and card metadata

### Decision: Database Connection Pooling
**Rationale**: Optimized connection management for Cloud Run's ephemeral nature with connection pooling suited for serverless workloads.

**Configuration**:
- Connection pool size: 5-10 per instance
- Pool timeout: 30 seconds
- Connection lifetime: 60 minutes
- Prepared statement caching enabled

## Development Workflow

### Decision: Monorepo with Clear Separation
**Rationale**: Single repository with distinct `/frontend` and `/backend` directories enables shared tooling while maintaining clear architectural boundaries.

**Repository Structure**:
```
/frontend          # React Native application
/backend           # Hono API server
/shared            # TypeScript type definitions
/docs              # API documentation and guides
/deployment        # Docker and Cloud Run configuration
```

### Decision: Contract-First API Development
**Rationale**: OpenAPI schema generation ensures frontend/backend compatibility and enables automated testing of API contracts.

**Workflow**:
1. Define OpenAPI schemas in `/backend/schemas`
2. Generate TypeScript types for `/shared`
3. Create contract tests verifying API compliance
4. Implement backend endpoints satisfying contracts
5. Generate frontend API client from schemas

---

**Research Status**: ✅ Complete - All technical decisions documented with rationale
**Next Phase**: Design data models and API contracts based on research findings