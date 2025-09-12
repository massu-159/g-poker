# Quickstart Guide: ごきぶりポーカー React Native App

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (macOS) or Android Studio (for Android development)
- PostgreSQL 14+ (for backend)
- Redis 6+ (for session management)

## Quick Setup (Development)

### 1. Clone and Setup Repository
```bash
git clone <repository-url>
cd g-poker

# Setup backend
cd api
npm install
cp .env.example .env
# Edit .env with your database credentials

# Setup database
npm run db:migrate
npm run db:seed

# Start backend server
npm run dev

# Setup mobile app (in new terminal)
cd ../mobile
npm install

# Start Expo development server  
npx expo start
```

### 2. Run Integration Test (2-Player Game)
This test validates the complete game flow from start to finish:

```bash
# In api/ directory
npm run test:integration:game-flow
```

**Expected Flow**:
1. ✅ Two players join matchmaking
2. ✅ Game created with 2 players, status: IN_PROGRESS  
3. ✅ Each player receives 9 cards
4. ✅ 6 cards remain hidden in deck
5. ✅ Player 1 plays card with claim "cockroach" 
6. ✅ Player 2 responds "disbelieve"
7. ✅ System assigns penalty card to correct player
8. ✅ Turn switches to next player
9. ✅ Game continues until one player gets 3 same-type penalty cards
10. ✅ Winner declared, game status: ENDED

### 3. Mobile App Demo Flow

**On Device/Simulator**:
1. Open Expo app → Scan QR code from `npx expo start`
2. App opens to main screen
3. Tap "Find Match" → Enters matchmaking queue  
4. Wait for 2nd player (use 2nd device/simulator)
5. Game starts → Each player sees their 9 cards
6. Player 1's turn → Select card → Choose target → Make claim
7. Player 2 receives notification → Choose response
8. Continue rounds until someone reaches 3 penalty cards
9. Winner screen displayed → Option to rematch

## API Testing

### Health Check
```bash
curl http://localhost:3000/v1/health
# Expected: {"status":"ok","timestamp":"...","version":"1.0.0"}
```

### Create Game
```bash
curl -X POST http://localhost:3000/v1/games \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": "player-uuid-1",  
    "displayName": "Player One"
  }'
  
# Expected: {"gameId":"game-uuid","status":"waiting_for_players",...}
```

### WebSocket Connection Test
```javascript
const io = require('socket.io-client');
const socket = io('ws://localhost:3000');

socket.emit('join-game', {
  gameId: 'game-uuid',
  playerId: 'player-uuid-1', 
  displayName: 'Test Player'
});

socket.on('game-joined', (data) => {
  console.log('Joined game:', data.game.id);
  console.log('Your cards:', data.yourHand.length); // Should be 9
});
```

## Complete Game Flow Example

### Step 1: Player 1 Creates Game
```bash
curl -X POST http://localhost:3000/v1/games \
  -H "Content-Type: application/json" \
  -d '{"playerId":"p1","displayName":"Alice"}'
  
# Response: {"gameId":"g1","status":"waiting_for_players",...}
```

### Step 2: Player 2 Joins via WebSocket
```javascript
const socket2 = io('ws://localhost:3000');
socket2.emit('join-game', {
  gameId: 'g1',
  playerId: 'p2',
  displayName: 'Bob'  
});

// Both players receive 'game-state-update' with status 'in_progress'
```

### Step 3: Game Play Example
```javascript
// Player 1 plays a card
socket1.emit('play-card', {
  cardId: 'card-cockroach-1',
  targetPlayerId: 'p2', 
  claim: 'mouse'  // False claim!
});

// Player 2 receives 'round-started' event
socket2.on('round-started', (data) => {
  console.log('Opponent claims:', data.round.claim); // 'mouse'
  
  // Player 2 doesn't believe the claim
  socket2.emit('respond-to-round', {
    roundId: data.round.id,
    response: 'disbelieve'
  });
});

// Both players receive 'round-completed' event
socket1.on('round-completed', (data) => {
  console.log('Penalty goes to:', data.outcome.penaltyReceiver); // 'p1' (liar)
  console.log('Guess was:', data.outcome.correctGuess); // true
});
```

### Step 4: Game End Condition
```javascript
// When a player gets 3 of same creature type
socket1.on('game-ended', (data) => {
  console.log('Winner:', data.winnerId);
  console.log('Reason:', data.reason); // 'penalty_limit_reached'
});
```

## Performance Benchmarks

Run these tests to verify system meets requirements:

### Response Time Test
```bash
# Should complete in <100ms
npm run test:performance:response-time

# Expected output:
# ✅ Card play response: 45ms (target: <100ms)  
# ✅ WebSocket event delivery: 12ms (target: <50ms)
# ✅ Game state sync: 23ms (target: <100ms)
```

### Concurrent Games Test  
```bash
# Test 1000 concurrent games
npm run test:load:concurrent-games

# Expected output:
# ✅ 1000 games created successfully
# ✅ Average response time: 78ms
# ✅ No connection drops
# ✅ Memory usage: stable
```

### Mobile Animation Test
```bash  
# In mobile/ directory
npm run test:performance:animations

# Expected output:
# ✅ Card dealing animation: 60fps
# ✅ Card flip animation: 60fps  
# ✅ UI transitions: 60fps
# ✅ Memory usage: <50MB
```

## Troubleshooting

### Common Issues

**WebSocket Connection Fails**:
```bash
# Check if backend is running
curl http://localhost:3000/v1/health

# Check WebSocket endpoint
telnet localhost 3000
```

**Mobile App Won't Connect**:
```bash
# Check IP address - use actual IP, not localhost
ipconfig getifaddr en0  # macOS
hostname -I | awk '{print $1}'  # Linux

# Update API endpoint in mobile app
export EXPO_PUBLIC_API_URL=http://YOUR_IP:3000
```

**Database Connection Issues**:
```bash
# Check PostgreSQL is running
brew services list | grep postgres  # macOS
sudo systemctl status postgresql    # Linux

# Test connection
psql -h localhost -U postgres -d gpoker_dev -c "SELECT 1;"
```

**Redis Connection Issues**:
```bash
# Check Redis is running
redis-cli ping  # Should return "PONG"

# Start Redis if needed
brew services start redis  # macOS
sudo systemctl start redis # Linux  
```

### Performance Issues

**Slow Card Animations**:
- Enable React Native Flipper debugger
- Check for excessive re-renders in components
- Verify `useNativeDriver: true` is set
- Monitor memory usage for leaks

**WebSocket Lag**:
- Check network latency: `ping localhost`
- Monitor server logs for errors
- Verify Redis is handling sessions efficiently
- Check for database query slowness

**High Memory Usage**:
- Use React DevTools Profiler
- Check for memory leaks in WebSocket listeners
- Verify images are properly optimized
- Monitor garbage collection

## Next Steps

After quickstart validation:

1. **Run Full Test Suite**: `npm run test:all` (should pass 100%)
2. **Deploy to Staging**: Follow deployment guide in `/docs/deployment.md`
3. **App Store Preparation**: Run `npx expo build:ios` and `npx expo build:android`
4. **Production Monitoring**: Setup logging and analytics
5. **Performance Optimization**: Profile and optimize based on real usage

**Success Criteria**:
- ✅ All integration tests pass
- ✅ 2-player game completes successfully  
- ✅ Mobile app runs smoothly on iOS and Android
- ✅ WebSocket events deliver within 50ms
- ✅ No memory leaks during 10-minute gameplay
- ✅ App Store build process completes without errors

This quickstart validates the entire system from database to mobile UI, ensuring all components work together for the complete multiplayer gaming experience.