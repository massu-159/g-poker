# G-Poker Technical Specification

## 1. Overview
ごきぶりポーカー React Native App
```
1. Parse user description from Input
   → Feature: Mobile app for playing ごきぶりポーカー (Cockroach Poker) card game
2. Extract key concepts from description
   → Actors: 2 human players each with their own device (online multiplayer)
   → Actions: Deal cards, pass cards with claims, guess truth/lie, accumulate penalty cards
   → Data: Card deck (4 types × 6 cards), player hands (9 cards each), penalty piles, hidden cards (6)
   → Constraints: 2 human players, online multiplayer, 10-minute games, bluffing mechanics
3. For each unclear aspect:
   → Resolved: Online multiplayer, 2 human players each with their own device for MVP
4. Fill User Scenarios & Testing section
   → Clear user flow: Setup game → Play rounds → Determine winner
5. Generate Functional Requirements
   → Each requirement is testable against game rules
6. Identify Key Entities: Game, Player, Card, Round, Penalty Pile
7. Run Review Checklist
   → WARN "Spec has uncertainties about multiplayer implementation"
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
Two players want to enjoy the popular German bluffing card game "ごきぶりポーカー" (Cockroach Poker) on their mobile devices through online multiplayer. This MVP version focuses on remote gameplay where Player 1 and Player 2 use separate devices, passing cards face-down while making claims about creature types (which may be lies). Each player must decide whether to believe the claim or pass the card back. The goal is to avoid collecting 3 of the same creature type, as this results in losing the game (modified from original 4 for faster gameplay).

### Acceptance Scenarios
1. **Given** two players join an online game, **When** cards are dealt, **Then** each player receives 9 cards on their device (6 cards remain hidden for randomness)
2. **Given** Player 1's turn, **When** they select a card and make a creature claim, **Then** Player 2 receives notification on their device
3. **Given** Player 2 receives a card claim, **When** they choose to guess or pass back, **Then** system synchronizes game state across both devices
4. **Given** a player guesses correctly about a lie, **When** the claim was false, **Then** the liar receives the penalty card
5. **Given** a player accumulates 3 cards of the same creature type, **When** the penalty is applied, **Then** that player loses and game ends

### Edge Cases
- What happens when all cards are exhausted before either player loses?
- How does the app handle network disconnections during gameplay?
- What happens when a player takes too long to respond during online play?

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST support exactly 2 human players in online multiplayer per game session
- **FR-002**: System MUST deal 9 cards to each player at game start (18 of 24 total cards, 6 cards remain hidden)
- **FR-003**: System MUST display 4 creature types: ゴキブリ (Cockroach), ネズミ (Mouse), コウモリ (Bat), カエル (Frog)
- **FR-004**: System MUST allow current player to select any card from their hand
- **FR-005**: System MUST allow current player to make any creature claim (truthful or false) when passing a card
- **FR-006**: System MUST allow receiving player to either guess (true/false) or pass the card back
- **FR-007**: System MUST correctly apply penalty rules: wrong guesser or successful bluffer receives the card
- **FR-008**: System MUST track penalty cards for each player by creature type
- **FR-009**: System MUST end the game when a player collects 3 cards of the same creature type (modified for faster gameplay)
- **FR-010**: System MUST display current game state: player's own hand, opponent penalty pile (visible), own penalty pile, and whose turn it is
- **FR-011**: System MUST synchronize game state across both player devices in real-time
- **FR-012**: System MUST provide matchmaking to connect two players for online games
- **FR-013**: System MUST handle network disconnections gracefully with reconnection attempts
- **FR-014**: System MUST provide game rules and tutorial for new players
- **FR-015**: System MUST keep 6 cards hidden from both players to add randomness and prevent perfect information
- **FR-016**: System MUST allow players to start a new game after completing one
- **FR-017**: System MUST display splash screen during app initialization
- **FR-018**: System MUST show welcome screen with game introduction before authentication
- **FR-019**: System MUST display Cockroach Poker rules tutorial after first login (skippable)
- **FR-020**: System MUST track tutorial completion status per user to avoid repeated tutorial display
- **FR-021**: System MUST provide skip button on tutorial screen that immediately proceeds to main app

### Key Entities *(include if feature involves data)*
- **Game**: Represents a single online multiplayer game session with 2 players, tracks current turn and game state
- **Player**: Individual participant with private hand of cards and public penalty pile, connected via separate devices
- **Card**: Individual card with creature type (one of 4 types), belongs to deck, hand, or penalty pile
- **Round**: Single card-passing interaction from initial claim through final penalty assignment via network
- **Penalty Pile**: Public collection of penalty cards for each player, organized by creature type, visible to both players

---

## 2. Functional Requirements

### 2.1 User Authentication & Profile Management

#### 2.1.1 Authentication
- **Registration**: Email/password signup with email verification
- **Login**: Secure authentication with rate limiting (5 attempts per 15 minutes)
- **Password Reset**: Email-based password recovery
- **Session Management**: Automatic session refresh and secure logout

#### 2.1.2 Profile System
- **Display Name**: Customizable player name (3-20 characters)
- **Avatar**: Optional profile picture upload
- **Verification Status**: 5-tier trust system (`unverified`, `pending`, `verified`, `rejected`, `suspended`)
- **Statistics**: Games played, wins, win rate, ranking

#### 2.1.3 Verification System
```typescript
interface VerificationLimits {
  unverified: { maxBuyIn: 100, dailyHours: 2 };
  pending: { maxBuyIn: 1000, dailyHours: 8 };
  verified: { maxBuyIn: Infinity, dailyHours: Infinity };
  rejected: { maxBuyIn: 50, dailyHours: 1 };
  suspended: { maxBuyIn: 0, dailyHours: 0 };
}
```

### 2.2 Game Management

#### 2.2.1 Game Creation
- **Player Limits**: 2-8 players per game
- **Game Settings**: Configurable blinds, buy-in amounts, time limits
- **Privacy**: Games are invite-only (no public game codes)
- **Persistence**: Games auto-save and can be resumed

#### 2.2.2 Game Joining
- **Direct Invite**: UUID-based game joining
- **Player Status**: Real-time ready/not ready indicators
- **Seat Selection**: Automatic or manual seat assignment
- **Late Joining**: Join games in progress (if enabled)

#### 2.2.3 Game States
```typescript
type GameStatus = 'waiting' | 'in_progress' | 'completed' | 'cancelled';
type PlayerStatus = 'joined' | 'playing' | 'eliminated' | 'disconnected' | 'left';
```

### 2.3 Poker Gameplay

#### 2.3.1 Texas Hold'em Rules
- **Standard Rules**: 2 hole cards, 5 community cards
- **Betting Rounds**: Pre-flop, flop, turn, river
- **Actions**: Fold, check, call, bet, raise, all-in
- **Hand Rankings**: Standard poker hand hierarchy

#### 2.3.2 Game Flow
1. **Setup**: Players join, select seats, confirm ready
2. **Deal**: Hole cards dealt, small/big blinds posted
3. **Betting**: Four rounds of betting with community cards
4. **Showdown**: Hand evaluation and winner determination
5. **Payout**: Pot distribution and statistics update

#### 2.3.3 Turn Management
- **Timer**: 30-second action timer (configurable)
- **Auto-actions**: Auto-fold on timeout, auto-check when possible
- **Action Queue**: Queued actions for network optimization

### 2.4 Real-time Features

#### 2.4.1 Synchronization
- **Game State**: Real-time game state updates across all clients
- **Player Actions**: Sub-second action propagation
- **Connection Status**: Visual indicators for player connectivity
- **Conflict Resolution**: Server-authoritative state management

#### 2.4.2 Communication
- **Action Broadcasting**: All player actions broadcast to participants
- **State Updates**: Incremental state updates for efficiency
- **Reconnection**: Automatic reconnection with state recovery

## 3. Non-Functional Requirements

### 3.1 Performance

#### 3.1.1 Response Times
- **Database Queries**: < 100ms average response time
- **Real-time Updates**: < 200ms action propagation
- **UI Interactions**: < 50ms response time
- **Game Loading**: < 2 seconds initial load

#### 3.1.2 Scalability
- **Concurrent Users**: Support 100+ simultaneous players
- **Concurrent Games**: Handle 20+ active games
- **Database Connections**: Efficient connection pooling
- **Memory Usage**: < 100MB per client

### 3.2 Security

#### 3.2.1 Authentication Security
- **Password Policy**: Minimum 8 characters, complexity requirements
- **Rate Limiting**: Multiple layers (auth, API, game actions)
- **Session Security**: Secure tokens with automatic expiration
- **Input Validation**: Comprehensive sanitization and validation

#### 3.2.2 Game Integrity
- **Server Authority**: All game logic validated server-side
- **Action Validation**: Player actions verified before execution
- **Anti-Cheat**: Detection of rapid/automated actions
- **Audit Trail**: Complete logging with correlation IDs

#### 3.2.3 Data Protection
- **Encryption**: TLS 1.3 for all communications
- **PII Protection**: Minimal personal data collection
- **Data Retention**: Automatic cleanup of old game data
- **Privacy**: Optional anonymous gameplay mode

### 3.3 Reliability

#### 3.3.1 Availability
- **Uptime Target**: 99.5% availability
- **Error Handling**: Graceful degradation on failures
- **Backup Systems**: Database backup and recovery
- **Monitoring**: Real-time system health monitoring

#### 3.3.2 Fault Tolerance
- **Network Issues**: Automatic reconnection with exponential backoff
- **Server Failures**: Game state preservation and recovery
- **Client Crashes**: State recovery on app restart
- **Data Consistency**: ACID compliance for critical operations

## 4. Technical Architecture

### 4.1 Client Architecture

#### 4.1.1 React Native Structure
```
src/
├── components/          # Reusable UI components
│   ├── auth/           # Authentication components
│   ├── game/           # Game-specific components
│   ├── lobby/          # Lobby and navigation
│   └── common/         # Shared components
├── screens/            # Screen components
├── navigation/         # Navigation configuration
├── services/           # API and business logic
├── store/             # State management
├── types/             # TypeScript definitions
└── utils/             # Utility functions
```

#### 4.1.2 State Management
- **Game State**: Zustand store for real-time game data
- **User State**: React Context for authentication
- **UI State**: Local component state for interface
- **Cache**: React Query for server state caching

### 4.2 Backend Architecture

#### 4.2.1 Supabase Configuration
- **Database**: PostgreSQL with RLS policies
- **Authentication**: Supabase Auth with custom claims
- **Real-time**: Supabase Realtime for live updates
- **Storage**: Supabase Storage for avatar images

#### 4.2.2 Database Design
```sql
-- Core tables with simplified schema
profiles (auth) → public_profiles (player data) → game_participants (game relationships)
games → game_rounds → game_actions
```

### 4.3 Security Implementation

#### 4.3.1 Enterprise Security Stack
```typescript
// Security service integration
const securityService = {
  authentication: AuthenticationManager,
  authorization: RLSPolicies,
  auditing: SecurityEventPipeline,
  rateLimit: RateLimitingService,
  validation: InputValidationService
};
```

#### 4.3.2 Audit System
- **Event Types**: Authentication, authorization, game actions, security violations
- **Risk Levels**: LOW, MEDIUM, HIGH, CRITICAL
- **Correlation IDs**: Complete traceability across all operations
- **Processors**: Configurable event processing pipeline

## 5. API Specification

### 5.1 Authentication Endpoints

#### POST /auth/login
```typescript
interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  user: User;
  session: Session;
  correlationId: string;
}
```

#### POST /auth/register
```typescript
interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}
```

### 5.2 Game Management Endpoints

#### POST /games
```typescript
interface CreateGameRequest {
  maxPlayers: number;
  gameSettings: {
    smallBlind: number;
    bigBlind: number;
    buyIn: number;
    timeLimit?: number;
  };
}
```

#### GET /games/:id/participants
```typescript
interface GameParticipant {
  id: string;
  playerId: string;
  displayName: string;
  seatPosition: number;
  status: PlayerStatus;
  isReady: boolean;
}
```

### 5.3 Real-time Events

#### Game State Updates
```typescript
interface GameStateUpdate {
  gameId: string;
  roundNumber: number;
  currentPlayer: string;
  communityCards: Card[];
  pot: number;
  players: PlayerState[];
}
```

#### Player Actions
```typescript
interface PlayerAction {
  playerId: string;
  action: 'fold' | 'check' | 'call' | 'bet' | 'raise';
  amount?: number;
  timestamp: string;
}
```

## 6. User Interface Specification

### 6.1 Design Principles
- **Mobile-First**: Optimized for touch interfaces
- **Accessibility**: WCAG 2.1 AA compliance
- **Dark/Light Theme**: System preference support
- **Responsive**: Adaptive layouts for different screen sizes

### 6.2 Screen Specifications

#### 6.2.1 Onboarding Screens
- **Splash Screen**: App logo and loading indicator during initialization (2-3 seconds)
- **Welcome Screen**: Game introduction, G-Poker branding, and "Get Started" button
- **Tutorial Screen**: Cockroach Poker rules explanation with skip functionality
  - Interactive rule display with creature types (Cockroach, Mouse, Bat, Frog)
  - Game objective explanation (avoid 3 of same creature type)
  - Basic gameplay flow demonstration
  - Prominent "Skip" button in top-right corner
  - "Continue" button to proceed after reading

#### 6.2.2 Authentication Screens
- **Login**: Email/password form with validation
- **Register**: Account creation with terms acceptance
- **Profile**: Display name, avatar, verification status
- **Verification**: Document upload and status tracking

#### 6.2.3 Game Screens
- **Lobby**: Game list, creation, and joining interface
- **Table**: Poker table with card display and action buttons
- **Settings**: Game configuration and preferences
- **Statistics**: Player performance and leaderboards

### 6.3 Component Library
- **Cards**: Animated card components with suit/rank display
- **Chips**: Poker chip representations with value indicators
- **Timer**: Countdown timer for player actions
- **Chat**: Optional in-game communication (Phase 7)

## 7. Performance Specifications

### 7.1 Client Performance
- **Bundle Size**: < 10MB total app size
- **Memory Usage**: < 100MB RAM usage
- **Battery Usage**: Minimal background processing
- **Network Usage**: Optimized for mobile data

### 7.2 Server Performance
- **Database**: Query optimization with proper indexing
- **Real-time**: WebSocket connection management
- **Caching**: Strategic caching for frequently accessed data
- **CDN**: Asset delivery optimization

## 8. Testing Requirements

### 8.1 Unit Testing
- **Coverage**: 80%+ code coverage
- **Game Logic**: Comprehensive poker rule testing
- **Security**: Input validation and authentication testing
- **Utilities**: Edge case testing for helper functions

### 8.2 Integration Testing
- **End-to-End**: Complete game flow automation
- **Real-time**: Multi-client synchronization testing
- **Security**: Penetration testing and vulnerability assessment
- **Performance**: Load testing with realistic scenarios

## 9. Deployment Specification

### 9.1 Platform Support
- **iOS**: iOS 14+ (React Native compatibility)
- **Android**: Android 8+ (API level 26+)
- **Web**: Modern browsers with WebSocket support

### 9.2 Release Strategy
- **Staged Rollout**: Beta testing followed by gradual release
- **Feature Flags**: Controlled feature activation
- **Monitoring**: Real-time error tracking and performance monitoring
- **Updates**: Over-the-air updates for non-native code

## 10. Compliance & Standards

### 10.1 Security Standards
- **OWASP**: Top 10 web application security compliance
- **Data Protection**: GDPR-compliant data handling
- **Encryption**: Industry-standard encryption protocols

### 10.2 Gaming Regulations
- **Fair Play**: Provably fair random number generation
- **Responsible Gaming**: Time limits and spending controls
- **Age Verification**: 18+ age verification requirements
- **Terms of Service**: Clear legal framework and user agreements