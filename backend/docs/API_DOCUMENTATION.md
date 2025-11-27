# G-Poker Backend API Documentation

## Overview

ごきぶりポーカーのモバイル向けマルチプレイヤーゲームのREST APIとSocket.io実装。

### Base URL
- **Development**: `http://localhost:3001`
- **Socket.io**: `http://localhost:3002`

### Authentication
すべてのAPIエンドポイント（認証関連を除く）でJWTトークンが必要：
```
Authorization: Bearer <your_jwt_token>
```

---

## 🔐 Authentication API

### POST /api/auth/register
新規ユーザー登録

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "displayName": "プレイヤー名",
  "username": "username123"
}
```

**Response:**
```json
{
  "message": "Registration successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "プレイヤー名"
  },
  "tokens": {
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token"
  }
}
```

### POST /api/auth/login
ユーザーログイン

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### POST /api/auth/refresh
トークンリフレッシュ

**Request Body:**
```json
{
  "refreshToken": "refresh_token"
}
```

### POST /api/auth/logout
ログアウト（認証必要）

### GET /api/auth/me
現在のユーザー情報取得（認証必要）

---

## 🎮 Game Room API

### POST /api/rooms/create
新しいゲームルーム作成（認証必要）

**Request Body:**
```json
{
  "timeLimitSeconds": 60
}
```

**Response:**
```json
{
  "message": "Game created successfully",
  "game": {
    "id": "game_uuid",
    "maxPlayers": 2,
    "currentPlayers": 1,
    "status": "waiting",
    "timeLimitSeconds": 60,
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

### GET /api/rooms/list
利用可能なゲームルーム一覧（認証必要）

**Response:**
```json
{
  "games": [
    {
      "id": "game_uuid",
      "maxPlayers": 2,
      "currentPlayers": 1,
      "status": "waiting",
      "timeLimitSeconds": 60,
      "creatorName": "作成者名",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### POST /api/rooms/join
ゲームルーム参加（認証必要）

**Request Body:**
```json
{
  "gameId": "game_uuid"
}
```

### POST /api/rooms/:id/start
ゲーム開始（作成者のみ、認証必要）

### GET /api/rooms/:id
ゲーム詳細取得（参加者のみ、認証必要）

**Response:**
```json
{
  "game": {
    "id": "game_uuid",
    "status": "active",
    "maxPlayers": 2,
    "currentPlayers": 2,
    "currentTurnPlayer": "player_uuid",
    "roundNumber": 1,
    "timeLimitSeconds": 60,
    "participants": [
      {
        "playerId": "player_uuid",
        "position": 1,
        "displayName": "プレイヤー名",
        "cardsRemaining": 8,
        "hasLost": false,
        "penaltyCards": {
          "cockroach": [],
          "mouse": ["card_id_1"],
          "bat": [],
          "frog": []
        }
      }
    ],
    "currentRound": {
      "id": "round_uuid",
      "gameId": "game_uuid",
      "claimedCard": "card_id",
      "claimedCreature": "cockroach",
      "actualCreature": "mouse",
      "claimingPlayerId": "player_uuid",
      "targetPlayerId": "target_player_uuid"
    },
    "playerHand": [
      {
        "creature": "cockroach",
        "id": "cockroach_1"
      }
    ]
  }
}
```

---

## 🃏 Gameplay API

### POST /api/games/:id/claim
カード主張（ラウンド開始）（認証必要）

**Request Body:**
```json
{
  "cardId": "cockroach_1",
  "claimedCreature": "cockroach",
  "targetPlayerId": "target_player_uuid"
}
```

### POST /api/games/:id/respond
主張への回答（認証必要）

**Request Body:**
```json
{
  "roundId": "round_uuid",
  "believeClaim": true
}
```

### POST /api/games/:id/pass
カードパス（認証必要）

**Request Body:**
```json
{
  "roundId": "round_uuid",
  "targetPlayerId": "target_player_uuid",
  "newClaim": "mouse"
}
```

---

## 👤 User Management API

### GET /api/users/me
詳細なユーザープロフィール（認証必要）

### PUT /api/users/me/profile
プロフィール更新（認証必要）

**Request Body:**
```json
{
  "displayName": "新しい名前",
  "avatarUrl": "https://example.com/avatar.jpg",
  "bio": "自己紹介"
}
```

### PUT /api/users/me/preferences
設定変更（認証必要）

**Request Body:**
```json
{
  "theme": "dark",
  "language": "ja",
  "soundEnabled": true,
  "soundVolume": 0.8
}
```

### GET /api/users/me/statistics
統計データ取得（認証必要）

### GET /api/users/me/games
ゲーム履歴取得（認証必要）

### POST /api/users/me/tutorial-complete
チュートリアル完了（認証必要）

### GET /api/users/:id/profile
他ユーザーの公開プロフィール（認証必要）

---

## 🔌 Socket.io Events

### Connection & Authentication

**Client → Server:**
```javascript
socket.emit('authenticate', { token: 'jwt_token' })
```

**Server → Client:**
```javascript
socket.emit('authentication-success', { userId: 'user_uuid' })
socket.emit('authentication-failed', { error: 'Invalid token' })
```

### Game Room Management

**Client → Server:**
```javascript
// ゲームルーム参加
socket.emit('join-game', { gameId: 'game_uuid' })

// ゲームルーム退出
socket.emit('leave-game', { gameId: 'game_uuid' })
```

**Server → Client:**
```javascript
// ゲーム状態更新
socket.emit('game-state-update', {
  gameId: 'game_uuid',
  status: 'active',
  participants: [...],
  currentTurnPlayer: 'player_uuid'
})

// プレイヤー参加通知
socket.emit('player-joined', {
  gameId: 'game_uuid',
  player: { ... }
})

// プレイヤー退出通知
socket.emit('player-left', {
  gameId: 'game_uuid',
  playerId: 'player_uuid'
})
```

### Gameplay Events

**Client → Server:**
```javascript
// カード主張
socket.emit('make-claim', {
  gameId: 'game_uuid',
  cardId: 'card_id',
  claimedCreature: 'cockroach',
  targetPlayerId: 'target_uuid'
})

// 主張への回答
socket.emit('respond-to-claim', {
  gameId: 'game_uuid',
  roundId: 'round_uuid',
  believeClaim: true
})

// カードパス
socket.emit('pass-card', {
  gameId: 'game_uuid',
  roundId: 'round_uuid',
  targetPlayerId: 'target_uuid',
  newClaim: 'mouse'
})
```

**Server → Client:**
```javascript
// ラウンド開始
socket.emit('round-started', {
  roundId: 'round_uuid',
  claimingPlayer: 'player_uuid',
  targetPlayer: 'target_uuid',
  claimedCreature: 'cockroach'
})

// ラウンド結果
socket.emit('round-result', {
  roundId: 'round_uuid',
  believedClaim: true,
  actualCreature: 'mouse',
  penaltyPlayer: 'player_uuid',
  penaltyCard: { creature: 'mouse', id: 'mouse_1' }
})

// ゲーム終了
socket.emit('game-ended', {
  gameId: 'game_uuid',
  winnerId: 'winner_uuid',
  loserId: 'loser_uuid',
  losingCreature: 'cockroach'
})

// エラー通知
socket.emit('game-error', {
  error: 'Not your turn',
  code: 'INVALID_TURN'
})
```

---

## 🎯 Game Rules (Mobile Simplified)

### 基本ルール
- **プレイヤー数**: 2人固定
- **カード構成**: 4種類 × 6枚 = 24枚
  - ゴキブリ (cockroach) × 6
  - ネズミ (mouse) × 6
  - コウモリ (bat) × 6
  - カエル (frog) × 6
- **初期配布**: 各プレイヤー9枚、残り6枚は非公開

### 勝利条件
同じ種類のペナルティカードを**3枚**集めたプレイヤーが**負け**

### ゲームフロー
1. プレイヤーAがカードを選択し、種類を主張してプレイヤーBに渡す
2. プレイヤーBは主張を「信じる」か「疑う」かを選択
3. **信じる場合**: カードをそのまま受け取る（ペナルティなし）
4. **疑う場合**: カードの実際の種類を確認
   - 主張が真実 → プレイヤーBがペナルティ
   - 主張が嘘 → プレイヤーAがペナルティ
5. ペナルティを受けた側の手番で次のラウンド開始

---

## 📊 Status Codes

- **200**: 成功
- **201**: 作成成功
- **400**: バリデーションエラー
- **401**: 認証エラー
- **403**: アクセス拒否
- **404**: リソースが見つからない
- **409**: 競合エラー（重複など）
- **500**: サーバーエラー

---

## 🛠️ Environment Variables

```bash
NODE_ENV=development
PORT=3001

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# JWT
JWT_SECRET=your_jwt_secret

# Redis (Optional)
REDIS_URL=redis://localhost:6379
```