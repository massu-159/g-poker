# G-Poker Backend Testing Guide

## 🚀 サーバー起動

### 1. 環境設定確認
```bash
# .envファイルが正しく設定されていることを確認
cat .env
```

期待する内容：
```bash
NODE_ENV=development
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your-jwt-secret
```

### 2. サーバー起動
```bash
# 開発サーバー起動
npm run dev

# または手動起動
npx tsx src/index.ts
```

**成功時の出力例:**
```
Starting G-Poker backend server on port 3001
Hono server running at http://localhost:3001
Socket.io server running at http://localhost:3002
```

---

## 🧪 API テスト方法

### 1. ヘルスチェック（認証不要）

```bash
# サーバー動作確認
curl -X GET http://localhost:3001/health

# 期待するレスポンス
{"status":"ok","timestamp":"2025-01-01T00:00:00.000Z"}
```

```bash
# API ステータス確認
curl -X GET http://localhost:3001/api/v1/status

# 期待するレスポンス
{
  "message": "G-Poker Backend API",
  "version": "1.0.0",
  "environment": "development"
}
```

### 2. ユーザー登録テスト

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "displayName": "テストユーザー",
    "username": "testuser123"
  }'
```

**成功時のレスポンス:**
```json
{
  "message": "Registration successful",
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    "displayName": "テストユーザー"
  },
  "tokens": {
    "accessToken": "jwt_token_here",
    "refreshToken": "refresh_token_here"
  }
}
```

### 3. ログインテスト

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 4. 認証が必要なAPIテスト

```bash
# JWTトークンを使用
export TOKEN="your_jwt_token_here"

# 現在のユーザー情報取得
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# ゲームルーム作成
curl -X POST http://localhost:3001/api/rooms/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "timeLimitSeconds": 60
  }'

# ゲームルーム一覧取得
curl -X GET http://localhost:3001/api/rooms/list \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🔌 Socket.io テスト

### 1. 基本接続テスト

**Node.js スクリプトでテスト:**

```javascript
// test_socket.js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3002');

socket.on('connect', () => {
  console.log('✅ Socket.io接続成功:', socket.id);

  // 認証テスト
  socket.emit('authenticate', {
    token: 'your_jwt_token_here'
  });
});

socket.on('authentication-success', (data) => {
  console.log('✅ 認証成功:', data);

  // ゲーム参加テスト
  socket.emit('join-game', {
    gameId: 'your_game_id_here'
  });
});

socket.on('authentication-failed', (error) => {
  console.log('❌ 認証失敗:', error);
});

socket.on('game-state-update', (data) => {
  console.log('🎮 ゲーム状態更新:', data);
});

socket.on('disconnect', () => {
  console.log('🔌 接続切断');
});
```

```bash
# テスト実行
node test_socket.js
```

### 2. ブラウザでのSocket.ioテスト

**HTML ファイル作成:**

```html
<!DOCTYPE html>
<html>
<head>
    <title>Socket.io Test</title>
    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
</head>
<body>
    <h1>G-Poker Socket.io Test</h1>
    <div id="status">接続中...</div>
    <div id="messages"></div>

    <script>
        const socket = io('http://localhost:3002');
        const status = document.getElementById('status');
        const messages = document.getElementById('messages');

        function addMessage(msg) {
            const div = document.createElement('div');
            div.textContent = new Date().toISOString() + ': ' + msg;
            messages.appendChild(div);
        }

        socket.on('connect', () => {
            status.textContent = '✅ 接続成功';
            addMessage('Socket.io接続成功: ' + socket.id);
        });

        socket.on('disconnect', () => {
            status.textContent = '❌ 接続切断';
            addMessage('接続切断');
        });

        // 認証テスト
        setTimeout(() => {
            socket.emit('authenticate', {
                token: 'your_jwt_token_here'
            });
        }, 1000);
    </script>
</body>
</html>
```

---

## 🎯 ゲームフローテスト

### 完全なゲームテストシナリオ

```bash
# 1. 2人のユーザーを登録
# Player 1
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "player1@example.com",
    "password": "password123",
    "displayName": "プレイヤー1",
    "username": "player1"
  }'

# Player 2
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "player2@example.com",
    "password": "password123",
    "displayName": "プレイヤー2",
    "username": "player2"
  }'

# 2. 両方のプレイヤーでログイン（トークン取得）
# Player 1 Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "player1@example.com",
    "password": "password123"
  }'

# 3. Player 1 がゲームルーム作成
export TOKEN1="player1_jwt_token"
curl -X POST http://localhost:3001/api/rooms/create \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{"timeLimitSeconds": 60}'

# 4. Player 2 がゲーム参加
export TOKEN2="player2_jwt_token"
export GAME_ID="returned_game_id"
curl -X POST http://localhost:3001/api/rooms/join \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d '{"gameId": "'$GAME_ID'"}'

# 5. Player 1 がゲーム開始
curl -X POST http://localhost:3001/api/rooms/$GAME_ID/start \
  -H "Authorization: Bearer $TOKEN1"

# 6. ゲーム状態確認
curl -X GET http://localhost:3001/api/rooms/$GAME_ID \
  -H "Authorization: Bearer $TOKEN1"
```

---

## 🛠️ トラブルシューティング

### よくある問題と解決方法

**1. サーバーが起動しない**
```bash
# ポートが使用中の場合
lsof -ti:3001
kill -9 <PID>

# 環境変数を確認
echo $SUPABASE_URL
```

**2. 認証エラー**
```bash
# JWTトークンの形式確認
echo $TOKEN | base64 -d

# Supabase接続確認
curl -X GET "$SUPABASE_URL/rest/v1/" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

**3. Socket.io接続エラー**
```bash
# Socket.ioサーバーポート確認
netstat -an | grep 3002

# CORS設定確認（ブラウザコンソール）
```

---

## 📊 Postman Collection

**Postman用のテストコレクション作成推奨:**

1. **環境変数設定**
   - `base_url`: `http://localhost:3001`
   - `jwt_token`: `{{auth_token}}`

2. **テストシーケンス**
   - Health Check
   - User Registration
   - Login → Save token
   - Create Game Room
   - Join Game Room
   - Start Game
   - Make Claim
   - Respond to Claim

---

## 🎮 実際のゲームプレイテスト

### カード主張テスト

```bash
# プレイヤー1がカード主張
curl -X POST http://localhost:3001/api/games/$GAME_ID/claim \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{
    "cardId": "cockroach_1",
    "claimedCreature": "cockroach",
    "targetPlayerId": "player2_id"
  }'

# プレイヤー2が回答
curl -X POST http://localhost:3001/api/games/$GAME_ID/respond \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d '{
    "roundId": "round_id",
    "believeClaim": false
  }'
```

---

これらのテスト方法で、バックエンドの全機能を体系的に確認できます。何か特定の部分でエラーが発生した場合は、そのエラーメッセージをお知らせください。