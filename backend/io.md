# バックエンドAPI I/O仕様書

## 目次
1. [基本情報](#基本情報)
2. [共通仕様](#共通仕様)
3. [基本API](#基本api)
4. [認証API](#認証api)
5. [ゲームルームAPI](#ゲームルームapi)
6. [ユーザーAPI](#ユーザーapi)
7. [ゲームプレイAPI](#ゲームプレイapi)

---

## 基本情報

- **ベースURL**: `http://localhost:3001`
- **プロトコル**: HTTP/REST
- **データ形式**: JSON
- **文字エンコーディング**: UTF-8
- **認証方式**: JWT Bearer Token
- **WebSocket**: Socket.io (ポート 3002)

---

## 共通仕様

### 認証ヘッダー
保護されたエンドポイントには以下のヘッダーが必要です：

```
Authorization: Bearer <access_token>
```

### ページネーション
一覧取得APIではクエリパラメータでページネーションを制御できます：

- `page`: ページ番号（デフォルト: 1）
- `limit`: 1ページあたりの件数（デフォルト: 20、最大: 100）

### レート制限
- **認証エンドポイント**: 5回/分（IPベース）
- **ゲームアクション**: 10回/分（ユーザーベース）
- **一般API**: 60回/分（ユーザーベース）

制限超過時のレスポンス：
```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests",
  "retry_after": 60
}
```

---

## 基本API

### 1. ヘルスチェック

**概要説明**
サーバーの稼働状態を確認するための軽量なエンドポイントです。ロードバランサーやモニタリングツールからの定期的なヘルスチェックに使用されます。

**エンドポイント**: `GET /health`

**リクエスト**
- ヘッダー: なし
- パラメータ: なし

**レスポンス**
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

---

### 2. サーバーステータス

**概要説明**
サーバーの詳細な状態情報を取得するエンドポイントです。アクティブなゲーム数、接続中のプレイヤー数などを提供します。

**エンドポイント**: `GET /status`

**リクエスト**
- ヘッダー: なし
- パラメータ: なし

**レスポンス**
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "uptime": 3600,
  "activeGames": 15,
  "connectedPlayers": 42
}
```

---

## 認証API

### 1. ユーザー登録

**概要説明**
新規ユーザーアカウントを作成するエンドポイントです。メールアドレスとパスワードによる基本認証を実装し、Supabase Authと統合してセキュアな認証フローを提供します。

**エンドポイント**: `POST /api/auth/register`

**リクエスト**
- ヘッダー:
  ```
  Content-Type: application/json
  ```
- ボディ:
  ```json
  {
    "email": "user@example.com",
    "password": "securepass123",
    "displayName": "プレイヤー名",
    "username": "player_123"
  }
  ```

**レスポンス（成功時: 201 Created）**
```json
{
  "message": "Registration successful",
  "user": {
    "id": "uuid-v4",
    "email": "user@example.com",
    "displayName": "プレイヤー名",
    "avatarUrl": "https://example.com/avatars/user1.jpg"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 2. ログイン

**概要説明**
既存ユーザーの認証を行うエンドポイントです。メールアドレスとパスワードでSupabase Authによる認証を実行し、成功時にJWTトークンを発行します。

**エンドポイント**: `POST /api/auth/login`

**リクエスト**
- ヘッダー:
  ```
  Content-Type: application/json
  ```
- ボディ:
  ```json
  {
    "email": "user@example.com",
    "password": "securepass123"
  }
  ```

**レスポンス（成功時: 200 OK）**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid-v4",
    "email": "user@example.com",
    "displayName": "プレイヤー名",
    "avatarUrl": "https://example.com/avatars/user1.jpg"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 3. トークンリフレッシュ

**概要説明**
期限切れ間近のアクセストークンを新しいトークンペアに更新するエンドポイントです。

**エンドポイント**: `POST /api/auth/refresh`

**リクエスト**
- ヘッダー:
  ```
  Content-Type: application/json
  ```
- ボディ:
  ```json
  {
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

**レスポンス（成功時: 200 OK）**
```json
{
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 4. ログアウト

**概要説明**
現在のセッションを無効化し、ユーザーをログアウトさせるエンドポイントです。

**エンドポイント**: `POST /api/auth/logout`

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  ```
- ボディ: なし

**レスポンス（成功時: 200 OK）**
```json
{
  "message": "Logout successful"
}
```

---

### 5. 現在のユーザー情報取得

**概要説明**
現在ログイン中のユーザーの詳細プロフィール情報を取得するエンドポイントです。

**エンドポイント**: `GET /api/auth/me`

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  ```
- パラメータ: なし

**レスポンス（成功時: 200 OK）**
```json
{
  "user": {
    "id": "uuid-v4",
    "email": "user@example.com",
    "displayName": "プレイヤー名",
    "avatarUrl": "https://example.com/avatars/user1.jpg",
    "lastSeenAt": "2025-01-15T10:30:00.000Z",
    "preferences": {
      "theme": "dark",
      "language": "ja",
      "sound_enabled": true
    }
  }
}
```

---

## ゲームルームAPI

### 1. ゲームルーム作成

**概要説明**
新しいCockroach Pokerゲームルームを作成し、作成者を最初の参加者として登録するエンドポイントです。

**エンドポイント**: `POST /api/rooms/create`

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  Content-Type: application/json
  ```
- ボディ:
  ```json
  {
    "timeLimitSeconds": 60
  }
  ```

**レスポンス（成功時: 201 Created）**
```json
{
  "message": "Game created successfully",
  "game": {
    "id": "uuid-v4",
    "maxPlayers": 2,
    "currentPlayers": 1,
    "status": "waiting",
    "timeLimitSeconds": 60,
    "createdAt": "2025-01-15T10:30:00.000Z"
  }
}
```

---

### 2. 利用可能なゲームルーム一覧取得

**概要説明**
現在参加可能なゲームルーム（待機中または進行中）の一覧を取得するエンドポイントです。

**エンドポイント**: `GET /api/rooms/list`

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  ```
- パラメータ: なし

**レスポンス（成功時: 200 OK）**
```json
{
  "games": [
    {
      "id": "uuid-v4",
      "maxPlayers": 2,
      "currentPlayers": 1,
      "status": "waiting",
      "timeLimitSeconds": 60,
      "creatorName": "作成者の表示名",
      "creatorAvatarUrl": "https://example.com/avatars/creator1.jpg",
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### 3. ゲームルームに参加

**概要説明**
既存のゲームルームに2番目のプレイヤーとして参加するエンドポイントです。

**エンドポイント**: `POST /api/rooms/join`

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  Content-Type: application/json
  ```
- ボディ:
  ```json
  {
    "gameId": "uuid-v4"
  }
  ```

**レスポンス（成功時: 200 OK）**
```json
{
  "message": "Successfully joined game",
  "position": 2
}
```

---

### 4. ゲーム開始

**概要説明**
待機中のゲームルームを開始し、各プレイヤーにカードを配布してゲームを進行可能な状態にするエンドポイントです。

**エンドポイント**: `POST /api/rooms/:id/start`

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  ```
- パラメータ:
  - `id`: ゲームID（UUID）

**レスポンス（成功時: 200 OK）**
```json
{
  "message": "Game started successfully",
  "currentTurnPlayer": "uuid-v4"
}
```

---

### 5. ゲーム詳細情報取得

**概要説明**
特定のゲームルームの詳細情報を取得するエンドポイントです。

**エンドポイント**: `GET /api/rooms/:id`

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  ```
- パラメータ:
  - `id`: ゲームID（UUID）

**レスポンス（成功時: 200 OK）**
```json
{
  "game": {
    "id": "uuid-v4",
    "status": "active",
    "maxPlayers": 2,
    "currentPlayers": 2,
    "currentTurnPlayer": "uuid-v4",
    "roundNumber": 1,
    "timeLimitSeconds": 60,
    "creatorName": "作成者の表示名",
    "creatorAvatarUrl": "https://example.com/avatars/creator1.jpg",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "participants": [
      {
        "playerId": "uuid-v4",
        "position": 1,
        "displayName": "プレイヤー1",
        "avatarUrl": "https://...",
        "cardsRemaining": 9,
        "hasLost": false,
        "losingCreatureType": null,
        "penaltyCards": {
          "cockroach": [{"id": "card_1"}],
          "mouse": [],
          "bat": [],
          "frog": []
        }
      }
    ],
    "currentRound": {
      "id": "uuid-v4",
      "claiming_player_id": "uuid-v4",
      "claimed_creature_type": "cockroach",
      "target_player_id": "uuid-v4",
      "pass_count": 0,
      "is_completed": false
    },
    "playerHand": [
      {"creature": "cockroach", "id": "cockroach_1"},
      {"creature": "mouse", "id": "mouse_2"}
    ]
  }
}
```

---

## ユーザーAPI

### 1. 自分のプロフィール取得

**概要説明**
現在ログイン中のユーザーの完全なプロフィール情報を取得するエンドポイントです。

**エンドポイント**: `GET /api/users/me`

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  ```

**レスポンス（成功時: 200 OK）**
```json
{
  "profile": {
    "id": "uuid-v4",
    "email": "user@example.com",
    "displayName": "プレイヤー名",
    "avatarUrl": "https://...",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "lastSeenAt": "2025-01-15T10:30:00.000Z",
    "preferences": {
      "theme": "dark",
      "language": "ja",
      "sound_enabled": true,
      "push_notifications": true,
      "vibration_enabled": true
    },
    "statistics": {
      "games_played": 150,
      "games_won": 75,
      "win_percentage": 50.0,
      "longest_win_streak": 5,
      "current_win_streak": 2
    }
  }
}
```

---

## ゲームプレイAPI

### 1. カードのクレーム（ラウンド開始）

**概要説明**
自分の手札からカードを選択し、特定のクリーチャータイプであると宣言（クレーム）して、対戦相手に提示するゲームアクションエンドポイントです。

**エンドポイント**: `POST /api/games/:id/claim`

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  Content-Type: application/json
  ```
- パラメータ:
  - `id`: ゲームID（UUID）
- ボディ:
  ```json
  {
    "cardId": "cockroach_1",
    "claimedCreature": "cockroach",
    "targetPlayerId": "uuid-v4"
  }
  ```

**レスポンス（成功時: 200 OK）**
```json
{
  "message": "Claim submitted successfully",
  "roundId": "uuid-v4",
  "waitingForResponse": true
}
```

---

### 2. クレームへの応答（信じる／疑う）

**概要説明**
対戦相手のクレーム（カードの種類宣言）に対して「信じる」または「疑う」で応答するエンドポイントです。

**エンドポイント**: `POST /api/games/:id/respond`

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  Content-Type: application/json
  ```
- パラメータ:
  - `id`: ゲームID（UUID）
- ボディ:
  ```json
  {
    "roundId": "uuid-v4",
    "believeClaim": true
  }
  ```

**レスポンス（成功時: 200 OK）**
```json
{
  "message": "Response submitted successfully",
  "result": {
    "correct": true,
    "penaltyReceiver": "uuid-v4",
    "penaltyCard": {
      "creature": "cockroach",
      "id": "cockroach_1"
    },
    "gameOver": false,
    "winner": null
  }
}
```

---

### 3. カードのパス

**概要説明**
対戦相手のクレームに対して「信じる」「疑う」ではなく、新しいクレームをつけてカードを次のプレイヤーに渡す（パス）するエンドポイントです。

**エンドポイント**: `POST /api/games/:id/pass`

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  Content-Type: application/json
  ```
- パラメータ:
  - `id`: ゲームID（UUID）
- ボディ:
  ```json
  {
    "roundId": "uuid-v4",
    "targetPlayerId": "uuid-v4",
    "newClaim": "mouse"
  }
  ```

**レスポンス（成功時: 200 OK）**
```json
{
  "message": "Card passed successfully",
  "passCount": 2,
  "nextPlayer": "uuid-v4"
}
```

---

## エラーレスポンス一覧

### 400 Bad Request
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "Invalid credentials"
}
```

### 403 Forbidden
```json
{
  "error": "Access denied - not a participant"
}
```

### 404 Not Found
```json
{
  "error": "Game not found"
}
```

### 409 Conflict
```json
{
  "error": "Email already registered"
}
```

### 429 Too Many Requests
```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests",
  "retry_after": 60
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

---

**作成日**: 2025-01-15  
**最終更新**: 2025-01-15  
**バージョン**: 1.0.0
