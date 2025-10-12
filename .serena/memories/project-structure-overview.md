# G-Poker Project Structure Overview

## Repository Organization
```
g-poker/                                    # Repository root
├── docs/                                   # Documentation and specifications
│   ├── specs/003-g-poker-mobile/          # Current mobile architecture specs
│   │   ├── spec.md                        # Business requirements specification
│   │   ├── plan.md                        # Technical implementation plan
│   │   ├── research.md                    # Architecture research and decisions
│   │   ├── data-model.md                  # Database schema and entities
│   │   ├── quickstart.md                  # 90-minute validation guide
│   │   ├── tasks.md                       # 48-task implementation plan
│   │   └── contracts/                     # API contracts
│   │       ├── api-endpoints.md           # REST API specification
│   │       └── socket-events.md           # Socket.io events specification
│   ├── deployment/                        # App store and deployment guides
│   ├── memory/                            # Project constitution and guidelines
│   ├── .claude/                           # spec-kit command definitions
│   └── BUILD.md                           # Build configuration guide
├── supabase/                              # Database and backend services
│   └── migrations/                        # Database schema migrations
├── src/                                   # Legacy source code (to be evaluated)
└── [Future Implementation]
    ├── backend/                           # Hono API server + Socket.io
    ├── frontend/                          # React Native + Expo mobile app
    └── shared/                            # TypeScript shared types
```

## Documentation Standards
- **specs/**: Feature specifications using spec-kit methodology
- **Current spec**: `003-g-poker-mobile` for server-authoritative mobile platform
- **Legacy removed**: Old `001-reactnative-web` and `002-g-poker-hybrid` specs deleted
- **contracts/**: API specifications for both REST and real-time communication

## Development Phase
- **Status**: Planning complete, ready for T001 (project structure creation)
- **Architecture**: Server-authoritative mobile gaming platform
- **Target**: iOS/Android app stores with Cloud Run backend deployment

## Legacy Cleanup Completed
- ✅ Old specs moved from `/specs` to `/docs/specs`
- ✅ Obsolete specifications removed (001, 002)
- ✅ Current specification (003) properly organized in docs
- ✅ serena memory updated with current architecture