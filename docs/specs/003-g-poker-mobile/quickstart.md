# G-Poker Mobile Server-Authoritative Quickstart

**Generated**: 2025-01-12 | **Goal**: Mobile multiplayer gaming platform validation in 90 minutes

## 🎯 Quick Validation (20 minutes)

**Success Criteria**: Complete development environment setup with server-authoritative game room creation and mobile client connection

### Prerequisites Check
```bash
# Verify development tools
node --version  # Should be 18+
npm --version   # Should be 9+
docker --version
gcloud --version  # For Cloud Run deployment

# Verify mobile development setup
npx expo --version
npx react-native --version

# Verify database and Redis access
psql $SUPABASE_DATABASE_URL -c "SELECT version();"
redis-cli -h $REDIS_ENDPOINT ping
```

### Rapid Environment Setup
```bash
# 1. Clone and setup repository
git clone <repository-url>
cd g-poker

# 2. Install backend dependencies
cd backend
npm install
npm run build

# 3. Install frontend dependencies
cd ../frontend
npm install

# 4. Setup environment variables
cp .env.example .env
# Configure SUPABASE_URL, REDIS_URL, JWT_SECRET, etc.

# 5. Run database migrations
cd ../backend
npm run migrate:dev

# 6. Start development servers
npm run dev &  # Backend on port 3000
cd ../frontend
npx expo start --dev-client  # Frontend development server
```

---

## 🚀 Core Functionality Workflow

### Phase 1: Backend API Validation (25 minutes)

#### Authentication Flow Test
```bash
# Test user authentication
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "device_info": {
      "device_id": "test-device-001",
      "platform": "ios",
      "app_version": "1.0.0"
    }
  }'

# Expected response: JWT tokens and user profile
# Save access_token for subsequent requests
export ACCESS_TOKEN="<received_token>"
```

#### Room Management Test
```bash
# Create game room
curl -X POST http://localhost:3000/rooms \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "room_type": "public",
    "max_players": 4,
    "game_speed": "normal",
    "allow_spectators": true
  }'

# Expected response: Room created with unique ID
export ROOM_ID="<received_room_id>"

# List available rooms
curl -X GET "http://localhost:3000/rooms?status=waiting" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Expected response: List including created room

# Join room
curl -X POST http://localhost:3000/rooms/$ROOM_ID/join \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "player"}'

# Expected response: Successful join with participant info
```

#### Game State API Test
```bash
# Get current room state
curl -X GET http://localhost:3000/rooms/$ROOM_ID/state \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Expected response: Room state with game session (null if not started)

# Toggle ready status
curl -X PUT http://localhost:3000/rooms/$ROOM_ID/ready \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ready": true}'

# Expected response: Ready status updated
```

### Phase 2: Socket.io Real-Time Validation (20 minutes)

#### WebSocket Connection Test
```javascript
// Run in browser console or Node.js script
const io = require('socket.io-client');

const socket = io('http://localhost:3000', {
  auth: {
    token: ACCESS_TOKEN
  }
});

socket.on('connect', () => {
  console.log('✅ Connected to Socket.io server');

  // Test authentication
  socket.emit('authenticate', {
    access_token: ACCESS_TOKEN,
    device_info: {
      device_id: 'test-websocket-001',
      platform: 'web',
      app_version: '1.0.0'
    }
  });
});

socket.on('authenticated', (data) => {
  console.log('✅ WebSocket authenticated:', data.user_id);

  // Join room for real-time updates
  socket.emit('join_room', { room_id: ROOM_ID });
});

socket.on('room_joined', (data) => {
  console.log('✅ Joined room via WebSocket:', data.room_id);
  console.log('Current participants:', data.participants.length);
});

socket.on('participant_joined', (data) => {
  console.log('🔄 New participant joined:', data.participant.display_name);
});

socket.on('ready_status_changed', (data) => {
  console.log('🔄 Ready status changed:', data.player_id, data.ready_status);
});

socket.on('game_started', (data) => {
  console.log('🎮 Game started!');
  console.log('Your hand size:', data.initial_state.your_hand.hand_size);
  console.log('Turn order:', data.initial_state.turn_order);
});
```

#### Multi-Client Real-Time Test
```bash
# Terminal 1: Create and join room as Player 1
curl -X POST http://localhost:3000/auth/login \
  -d '{"email": "player1@test.com", "password": "password"}' | jq '.tokens.access_token'

# Terminal 2: Join same room as Player 2
curl -X POST http://localhost:3000/auth/login \
  -d '{"email": "player2@test.com", "password": "password"}' | jq '.tokens.access_token'

curl -X POST http://localhost:3000/rooms/$ROOM_ID/join \
  -H "Authorization: Bearer $PLAYER2_TOKEN" \
  -d '{"role": "player"}'

# Expected: Both players see real-time participant updates via WebSocket
```

### Phase 3: Mobile Frontend Validation (25 minutes)

#### React Native App Connection
```typescript
// In React Native app (App.tsx)
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

// Test authentication flow
const authenticateUser = async () => {
  const response = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'mobile@test.com',
      password: 'password123',
      device_info: {
        device_id: await DeviceInfo.getUniqueId(),
        platform: Platform.OS,
        app_version: '1.0.0'
      }
    })
  });

  const data = await response.json();
  console.log('✅ Mobile authentication:', data.success);
  return data.tokens.access_token;
};

// Test room creation from mobile
const createRoom = async (token: string) => {
  const response = await fetch('http://localhost:3000/rooms', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      room_type: 'public',
      max_players: 4,
      game_speed: 'normal',
      allow_spectators: true
    })
  });

  const data = await response.json();
  console.log('✅ Room created from mobile:', data.room.id);
  return data.room.id;
};

// Test real-time connection
const connectToRoom = (token: string, roomId: string) => {
  socket.auth = { token };

  socket.connect();

  socket.on('authenticated', (data) => {
    console.log('✅ Mobile WebSocket authenticated');
    socket.emit('join_room', { room_id: roomId });
  });

  socket.on('room_joined', (data) => {
    console.log('✅ Mobile client joined room');
    console.log('Participants:', data.participants);
  });
};
```

#### Mobile UI Component Test
```typescript
// Test basic UI components
const GameRoomScreen = () => {
  const [roomState, setRoomState] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    socket.on('game_state_updated', (data) => {
      setRoomState(data.updated_state);
      console.log('✅ Mobile UI updated with game state');
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
  }, []);

  return (
    <View>
      <Text>Connection: {connected ? '🟢 Connected' : '🔴 Disconnected'}</Text>
      <Text>Room Status: {roomState?.status || 'Loading...'}</Text>
      <Button
        title="Toggle Ready"
        onPress={() => {
          fetch(`http://localhost:3000/rooms/${roomId}/ready`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ ready: !isReady })
          });
        }}
      />
    </View>
  );
};
```

---

## 🔍 Validation Checklist

### Backend API Validation
- [ ] **Authentication**: User login with JWT token generation
- [ ] **Room Management**: Create, join, and list game rooms
- [ ] **Player State**: Profile retrieval and preference updates
- [ ] **Game Actions**: Ready status toggle and room state queries
- [ ] **Error Handling**: Proper HTTP status codes and error messages
- [ ] **Rate Limiting**: API rate limits enforced correctly
- [ ] **Database Integration**: Supabase connection and schema validation

### Real-Time Communication Validation
- [ ] **WebSocket Connection**: Socket.io client authentication
- [ ] **Room Subscriptions**: Real-time room state synchronization
- [ ] **Multi-Client Sync**: Multiple players see same state updates
- [ ] **Connection Recovery**: Automatic reconnection after disconnect
- [ ] **Event Broadcasting**: Actions broadcast to all room participants
- [ ] **State Consistency**: Server-authoritative state maintained
- [ ] **Error Events**: Invalid actions properly rejected and communicated

### Mobile Frontend Validation
- [ ] **React Native Setup**: Expo development environment running
- [ ] **API Integration**: HTTP requests to backend successful
- [ ] **WebSocket Integration**: Real-time connection from mobile app
- [ ] **Authentication Flow**: Login and token management working
- [ ] **UI Responsiveness**: Game state updates reflected in UI
- [ ] **Navigation**: Screen transitions and routing functional
- [ ] **Platform Testing**: iOS simulator and Android emulator tested

### Database Schema Validation
- [ ] **Migration Success**: All new tables created without errors
- [ ] **Data Integrity**: Foreign key constraints enforced
- [ ] **RLS Policies**: Row-level security configured for server-only access
- [ ] **Performance**: Indexes created for query optimization
- [ ] **Audit Trail**: Server events logging all game actions
- [ ] **State Persistence**: Game sessions recoverable after server restart

---

## 🛠 Troubleshooting

### Common Backend Issues

**Authentication failures**
```bash
# Check JWT secret configuration
echo $JWT_SECRET | wc -c  # Should be 32+ characters

# Verify Supabase connection
psql $SUPABASE_DATABASE_URL -c "SELECT COUNT(*) FROM profiles;"

# Check Redis connectivity
redis-cli -h $REDIS_ENDPOINT ping
```

**Room creation errors**
```bash
# Verify database schema
psql $SUPABASE_DATABASE_URL -c "\d game_rooms"

# Check server logs
npm run dev 2>&1 | grep ERROR

# Test with minimal room configuration
curl -X POST http://localhost:3000/rooms \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"room_type": "public", "max_players": 2}'
```

### Common Socket.io Issues

**Connection timeouts**
```javascript
// Increase timeout settings
const socket = io('http://localhost:3000', {
  timeout: 10000,
  forceNew: true,
  transports: ['websocket', 'polling']
});

// Debug connection events
socket.on('connect_error', (error) => {
  console.log('Connection failed:', error.message);
});
```

**Event delivery failures**
```javascript
// Add acknowledgment callbacks
socket.emit('join_room', { room_id: ROOM_ID }, (response) => {
  if (response.success) {
    console.log('✅ Room join acknowledged');
  } else {
    console.log('❌ Room join failed:', response.error);
  }
});
```

### Common Mobile Issues

**Metro bundler errors**
```bash
# Clear React Native cache
npx react-native start --reset-cache

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check Expo configuration
npx expo doctor
```

**Network connectivity issues**
```bash
# Use device IP for local development
export BACKEND_URL="http://192.168.1.100:3000"

# Enable network security config for Android
# Add network_security_config.xml for localhost connections
```

---

## 🎮 Ready for Full Implementation!

### Success State
✅ Backend API responding with proper authentication and room management
✅ Socket.io real-time communication working across multiple clients
✅ React Native mobile app connecting and receiving live updates
✅ Database schema supporting server-authoritative game model
✅ Error handling and validation working at all levels
✅ Development environment fully functional for team collaboration

### Next Steps
1. **Complete Game Logic**: Implement full Cockroach Poker rules in backend
2. **Mobile UI Polish**: Design and implement complete game interface
3. **Cloud Deployment**: Setup Cloud Run and production database
4. **Load Testing**: Validate 1000+ concurrent player capacity
5. **App Store Preparation**: iOS and Android build configuration

**Time to Full MVP**: ~3-4 weeks following this quickstart foundation
**Mobile Gaming Platform**: Complete server-authoritative architecture validated