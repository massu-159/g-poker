# 🎮 G-Poker Backend

Server-authoritative backend API for G-Poker mobile gaming platform.

## 🏗️ Tech Stack

- **Framework**: [Hono](https://hono.dev/) (Fast Edge-first web framework)
- **Runtime**: Node.js 18+ with TypeScript
- **Real-time**: Socket.io with Redis adapter
- **Database**: Supabase PostgreSQL
- **Deployment**: Google Cloud Run
- **Testing**: Vitest
- **Language**: TypeScript 5.x

## 📁 Project Structure

```
backend/
├── src/
│   ├── index.ts              # Application entry point
│   ├── routes/               # API endpoints
│   │   ├── auth.ts          # Authentication (register, login, logout)
│   │   ├── users.ts         # User profile management
│   │   ├── rooms.ts         # Game room management
│   │   └── games.ts         # Game action endpoints
│   ├── socket/               # Socket.io handlers
│   │   ├── SocketServer.ts  # Socket.io initialization
│   │   ├── AuthHandler.ts   # WebSocket authentication
│   │   ├── RoomHandler.ts   # Room state synchronization
│   │   ├── GameHandler.ts   # Game state broadcast
│   │   └── RecoveryHandler.ts # Connection recovery
│   ├── services/             # Business logic
│   │   ├── roomService.ts   # Room management
│   │   ├── gameService.ts   # Game logic
│   │   └── auditService.ts  # Audit logging
│   ├── middleware/           # Middleware
│   │   ├── auth.ts          # JWT authentication
│   │   └── rateLimit.ts     # Rate limiting
│   ├── lib/                  # Utilities
│   │   └── supabase.ts      # Supabase client
│   └── types/                # Type definitions
│       └── database.ts      # Database types
├── tests/                    # Test suites
│   ├── contracts/           # API contract tests
│   ├── events/              # Socket.io event tests
│   ├── integration/         # Integration tests
│   └── e2e/                 # End-to-end tests
├── scripts/                  # Deployment scripts
│   ├── deploy-cloud-run.sh  # Cloud Run deployment
│   ├── enable-gcp-apis.sh   # GCP API enablement
│   └── setup-secrets.sh     # Secret Manager setup
├── Dockerfile                # Optimized multi-stage build
├── docker-compose.yml        # Local development
└── DEPLOYMENT_GUIDE.md       # Complete deployment guide
```

## 🚀 Quick Start

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Setup environment variables
cp .env.example .env
# Edit .env with your credentials

# 3. Start development server
npm run dev

# Server will start on http://localhost:3001
# Socket.io server on http://localhost:3002
```

### Docker Development

```bash
# 1. Start services
docker-compose up

# 2. Access services
# Backend API: http://localhost:3001
# Redis: localhost:6379
```

### Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:contracts     # API contract tests
npm run test:events        # Socket.io event tests
npm run test:integration   # Integration tests
npm run test:e2e          # End-to-end tests

# Run tests with UI
npm run test:ui
```

## 🌐 Cloud Run Deployment

### Prerequisites

- Google Cloud Project with billing enabled
- gcloud CLI installed and authenticated
- Docker Desktop running

### Initial Setup (One-time)

```bash
# 1. Install gcloud CLI (macOS)
brew install --cask google-cloud-sdk

# 2. Authenticate
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 3. Enable required APIs
./scripts/enable-gcp-apis.sh

# 4. Setup secrets
./scripts/setup-secrets.sh
```

### Deploy to Cloud Run

```bash
# 1. Update deployment script
nano scripts/deploy-cloud-run.sh
# Set PROJECT_ID to your GCP project ID

# 2. Deploy
./scripts/deploy-cloud-run.sh

# 3. Test deployment
curl https://your-service-url.run.app/health
```

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions.

## 📋 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users/me` - Get user profile
- `POST /api/users/me/tutorial-complete` - Mark tutorial complete
- `PUT /api/users/me/preferences` - Update preferences

### Rooms
- `POST /api/rooms/create` - Create game room
- `POST /api/rooms/join` - Join game room
- `POST /api/rooms/:id/start` - Start game
- `GET /api/rooms/list` - List available rooms
- `POST /api/rooms/:id/leave` - Leave room

### Games
- `POST /api/games/:id/claim` - Make card claim
- `POST /api/games/:id/respond` - Respond to claim
- `POST /api/games/:id/pass` - Pass card to opponent

### System
- `GET /health` - Health check endpoint
- `GET /api/v1/status` - API status and version

## 🔧 Environment Variables

```env
# Server
NODE_ENV=production
PORT=8080

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Authentication
JWT_SECRET=your-jwt-secret

# Redis (optional, for Socket.io scaling)
REDIS_URL=redis://localhost:6379
```

## 🛠️ Development Commands

```bash
# Development
npm run dev              # Start dev server with nodemon

# Building
npm run build            # Compile TypeScript to dist/

# Production
npm start                # Run compiled application

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint errors
npm run format           # Format code with Prettier

# Testing
npm test                 # Run all tests
npm run test:run         # Run tests once
npm run test:ui          # Run tests with UI
```

## 📊 Database Schema

See [docs/specs/003-g-poker-mobile/data-model.md](../docs/specs/003-g-poker-mobile/data-model.md) for complete schema documentation.

### Key Tables
- `profiles` - User authentication and profile data
- `public_profiles` - Public user information
- `games` - Game session management
- `game_participants` - Player participation tracking
- `game_rounds` - Round-by-round game state
- `game_actions` - Complete audit trail
- `user_sessions` - Session management
- `user_preferences` - User settings

## 🔐 Security Features

- JWT-based authentication
- Rate limiting on all endpoints
- Session token hashing (SHA-256)
- Non-root Docker container execution
- Row Level Security (RLS) on Supabase
- Secret Manager for sensitive data

## 📈 Performance Optimizations

- Multi-stage Docker build (minimal image size)
- Alpine Linux base image
- Redis caching for Socket.io
- Connection pooling
- Optimized TypeScript compilation

## 🐛 Troubleshooting

### Port already in use

```bash
# Find process using port 3001
lsof -i :3001

# Kill process
kill -9 <PID>
```

### Docker build fails

```bash
# Clean Docker cache
docker system prune -a

# Rebuild without cache
docker build --no-cache -t g-poker-backend:latest .
```

### Cloud Run deployment fails

```bash
# Check logs
gcloud run services logs read g-poker-backend \
    --region asia-northeast1 \
    --filter "severity>=ERROR"

# Verify secrets
gcloud secrets list
```

## 📚 Documentation

- [API Documentation](./docs/API_DOCUMENTATION.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Architecture Spec](../docs/specs/003-g-poker-mobile/spec.md)
- [Database Model](../docs/specs/003-g-poker-mobile/data-model.md)

## 🤝 Contributing

1. Follow the existing code structure
2. Write tests for new features
3. Run linter before committing
4. Update documentation as needed

## 📄 License

MIT
