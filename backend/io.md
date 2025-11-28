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

- **ベースURL**: `http://localhost:3001` (環境変数 `PORT` で変更可能)
- **プロトコル**: HTTP/REST
- **データ形式**: JSON
- **文字エンコーディング**: UTF-8
- **認証方式**: JWT Bearer Token
- **WebSocket**: Socket.io (ポート 3002 = `PORT + 1`)
- **フレームワーク**: Hono (Node.js)
- **データベース**: Supabase PostgreSQL
- **バリデーション**: Zod

---

## 共通仕様

### 認証ヘッダー
保護されたエンドポイントには以下のヘッダーが必要です：

```
Authorization: Bearer <access_token>
```

### レート制限

| エンドポイントカテゴリ | 制限 | 備考 |
|-------------------|-----|------|
| **POST /api/auth/register** | 3回/分 | IPベース |
| **POST /api/auth/login** | 5回/分 | IPベース |
| **POST /api/auth/refresh** | 10回/分 | IPベース |
| **POST /api/rooms/create** | 5回/分 | ユーザーベース |
| **POST /api/rooms/join** | 10回/分 | ユーザーベース |

制限超過時のレスポンス：
```json
{
  "error": "Too many requests",
  "message": "Too many registration attempts, please try again later"
}
```

### エラーレスポンス形式

| HTTPステータス | エラー内容 | レスポンス例 |
|--------------|----------|-------------|
| **400** | バリデーションエラー | `{"error": "Validation failed", "details": [...]}` |
| **401** | 認証エラー | `{"error": "Invalid credentials"}` |
| **403** | アクセス拒否 | `{"error": "Access denied - not a participant"}` |
| **404** | リソース未検出 | `{"error": "Game not found"}` |
| **409** | リソース競合 | `{"error": "Email already registered"}` |
| **429** | レート制限超過 | `{"error": "Too many requests"}` |
| **500** | サーバーエラー | `{"error": "Internal server error"}` |

---

## 基本API

### 1. ヘルスチェック

**概要**
サーバーの稼働状態を確認するための軽量なエンドポイント。ロードバランサーやモニタリングツールからの定期的なヘルスチェックに使用。

**エンドポイント**: `GET /health`

**認証**: 不要

**リクエスト**
- ヘッダー: なし
- パラメータ: なし

**レスポンス（200 OK）**
```json
{
  "status": "ok",
  "timestamp": "2025-11-23T14:30:00.000Z"
}
```

---

### 2. APIステータス

**概要**
G-Poker Backend APIのバージョンと環境情報を取得。

**エンドポイント**: `GET /api/v1/status`

**認証**: 不要

**リクエスト**
- ヘッダー: なし
- パラメータ: なし

**レスポンス（200 OK）**
```json
{
  "message": "G-Poker Backend API",
  "version": "1.0.0",
  "environment": "production"
}
```

---

## 認証API

### 1. ユーザー登録

**概要**
新規ユーザーアカウントを作成。Supabase Auth統合、プロファイル・公開プロファイル・セッション・設定を自動作成。

**エンドポイント**: `POST /api/auth/register`

**認証**: 不要

**レート制限**: 3回/分

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

**バリデーション**:
- `email`: メールアドレス形式必須
- `password`: 最低8文字
- `displayName`: 2-50文字
- `username`: 3-30文字、英数字とアンダースコアのみ

**レスポンス（201 Created）**
```json
{
  "message": "Registration successful",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "displayName": "プレイヤー名"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**エラー**:
- `409 Conflict`: メールアドレスまたはユーザー名が既に使用されている
- `500 Internal Server Error`: プロファイル作成失敗（データベーストリガーエラー）

---

### 2. ログイン

**概要**
既存ユーザーの認証を実行。Supabase Authによるパスワード検証後、JWTトークン発行。

**エンドポイント**: `POST /api/auth/login`

**認証**: 不要

**レート制限**: 5回/分

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

**レスポンス（200 OK）**
```json
{
  "message": "Login successful",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
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

**エラー**:
- `401 Unauthorized`: 認証情報が無効、またはアカウントが無効化されている

---

### 3. トークンリフレッシュ

**概要**
期限切れ間近のアクセストークンを新しいトークンペアに更新。

**エンドポイント**: `POST /api/auth/refresh`

**認証**: 不要（refresh token必須）

**レート制限**: 10回/分

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

**レスポンス（200 OK）**
```json
{
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**エラー**:
- `401 Unauthorized`: refresh tokenが無効、期限切れ、またはセッションが無効化されている

---

### 4. ログアウト

**概要**
現在のセッションを無効化し、ユーザーをログアウト。

**エンドポイント**: `POST /api/auth/logout`

**認証**: 必須

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  ```

**レスポンス（200 OK）**
```json
{
  "message": "Logout successful"
}
```

---

### 5. 現在のユーザー情報取得

**概要**
現在ログイン中のユーザーの詳細プロフィール情報を取得。

**エンドポイント**: `GET /api/auth/me`

**認証**: 必須

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  ```

**レスポンス（200 OK）**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "displayName": "プレイヤー名",
    "avatarUrl": "https://example.com/avatars/user1.jpg",
    "lastSeenAt": "2025-11-23T14:30:00.000Z",
    "preferences": {
      "theme": "dark",
      "language": "en",
      "sound_enabled": true
    }
  }
}
```

---

## ゲームルームAPI

### 1. ゲームルーム作成

**概要**
新しいCockroach Pokerゲームルームを作成し、作成者を最初の参加者として登録。

**エンドポイント**: `POST /api/rooms/create`

**認証**: 必須

**レート制限**: 5回/分

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

**バリデーション**:
- `timeLimitSeconds`: 30-300秒、デフォルト60秒

**レスポンス（201 Created）**
```json
{
  "message": "Game created successfully",
  "game": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "maxPlayers": 2,
    "currentPlayers": 1,
    "status": "waiting",
    "timeLimitSeconds": 60,
    "createdAt": "2025-11-23T14:30:00.000Z"
  }
}
```

---

### 2. 利用可能なゲームルーム一覧取得

**概要**
現在参加可能なゲームルーム（待機中または進行中）の一覧を取得。

**エンドポイント**: `GET /api/rooms/list`

**認証**: 必須

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  ```

**レスポンス（200 OK）**
```json
{
  "games": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "maxPlayers": 2,
      "currentPlayers": 1,
      "status": "waiting",
      "timeLimitSeconds": 60,
      "creatorName": "作成者の表示名",
      "creatorAvatarUrl": "https://example.com/avatars/creator1.jpg",
      "createdAt": "2025-11-23T14:30:00.000Z"
    }
  ]
}
```

**備考**: 最新20件を降順で返却

---

### 3. ゲームルームに参加

**概要**
既存のゲームルームに2番目のプレイヤーとして参加。

**エンドポイント**: `POST /api/rooms/join`

**認証**: 必須

**レート制限**: 10回/分

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  Content-Type: application/json
  ```
- ボディ:
  ```json
  {
    "gameId": "550e8400-e29b-41d4-a716-446655440000"
  }
  ```

**レスポンス（200 OK）**
```json
{
  "message": "Successfully joined game",
  "position": 2
}
```

**エラー**:
- `404 Not Found`: ゲームが存在しない
- `409 Conflict`: 既に参加済み
- `400 Bad Request`: ルームが満員、または既に開始されている

---

### 4. ゲーム開始

**概要**
待機中のゲームルームを開始し、各プレイヤーにカードを配布。

**エンドポイント**: `POST /api/rooms/:id/start`

**認証**: 必須（作成者のみ実行可能）

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  ```
- パラメータ:
  - `id`: ゲームID（UUID）

**レスポンス（200 OK）**
```json
{
  "message": "Game started successfully",
  "currentTurnPlayer": "550e8400-e29b-41d4-a716-446655440000"
}
```

**エラー**:
- `403 Forbidden`: 作成者以外が実行
- `400 Bad Request`: ゲームが既に開始済み、または参加者が2名未満

---

### 5. ゲーム詳細情報取得

**概要**
特定のゲームルームの詳細情報を取得（参加者のみアクセス可能）。

**エンドポイント**: `GET /api/rooms/:id`

**認証**: 必須（参加者のみ）

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  ```
- パラメータ:
  - `id`: ゲームID（UUID）

**レスポンス（200 OK）**
```json
{
  "game": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "in_progress",
    "maxPlayers": 2,
    "currentPlayers": 2,
    "currentTurnPlayer": "550e8400-e29b-41d4-a716-446655440000",
    "roundNumber": 1,
    "timeLimitSeconds": 60,
    "creatorName": "作成者の表示名",
    "creatorAvatarUrl": "https://example.com/avatars/creator1.jpg",
    "createdAt": "2025-11-23T14:30:00.000Z",
    "participants": [
      {
        "playerId": "550e8400-e29b-41d4-a716-446655440000",
        "position": 1,
        "displayName": "プレイヤー1",
        "avatarUrl": "https://...",
        "cardsRemaining": 9,
        "hasLost": false,
        "losingCreatureType": null,
        "penaltyCards": {
          "cockroach": [{"creature": "cockroach", "id": "cockroach_1"}],
          "mouse": [],
          "bat": [],
          "frog": []
        }
      }
    ],
    "currentRound": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "claiming_player_id": "550e8400-e29b-41d4-a716-446655440000",
      "claimed_creature_type": "cockroach",
      "target_player_id": "550e8400-e29b-41d4-a716-446655440000",
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

**エラー**:
- `403 Forbidden`: 参加者ではない

---

### 6. ゲームから退出

**概要**
ゲームから退出（待機中のみ可能）。

**エンドポイント**: `POST /api/rooms/:id/leave`

**認証**: 必須

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  ```
- パラメータ:
  - `id`: ゲームID（UUID）

**レスポンス（200 OK）**
```json
{
  "message": "Successfully left game"
}
```

**エラー**:
- `400 Bad Request`: ゲームが進行中または完了済み
- `403 Forbidden`: 参加者ではない

---

## ユーザーAPI

### 1. 自分のプロフィール取得

**概要**
現在ログイン中のユーザーの完全なプロフィール情報を取得。

**エンドポイント**: `GET /api/users/me`

**認証**: 必須

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  ```

**レスポンス（200 OK）**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "displayName": "プレイヤー名",
    "avatarUrl": "https://...",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "lastSeenAt": "2025-11-23T14:30:00.000Z",
    "isActive": true,
    "tutorialCompleted": true,
    "tutorialCompletedAt": "2025-01-02T00:00:00.000Z",
    "onboardingVersion": "1.0",
    "preferences": {
      "theme": "dark",
      "language": "en",
      "sound_enabled": true
    },
    "statistics": {
      "friendCount": 5
    },
    "currentRooms": [],
    "recentAchievements": []
  }
}
```

---

### 2. プロフィール更新

**概要**
ユーザーの公開プロフィール情報を更新。

**エンドポイント**: `PUT /api/users/me/profile`

**認証**: 必須

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  Content-Type: application/json
  ```
- ボディ:
  ```json
  {
    "displayName": "新しい表示名",
    "avatarUrl": "https://example.com/avatars/new.jpg"
  }
  ```

**レスポンス（200 OK）**
```json
{
  "message": "Profile updated successfully",
  "profile": {
    "profile_id": "550e8400-e29b-41d4-a716-446655440000",
    "display_name": "新しい表示名",
    "avatar_url": "https://example.com/avatars/new.jpg",
    "updated_at": "2025-11-23T14:30:00.000Z"
  }
}
```

**エラー**:
- `409 Conflict`: 表示名が既に使用されている

---

### 3. 設定更新

**概要**
ユーザーの設定（テーマ、サウンド、言語など）を更新。

**エンドポイント**: `PUT /api/users/me/preferences`

**認証**: 必須

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  Content-Type: application/json
  ```
- ボディ（すべてoptional）:
  ```json
  {
    "theme": "dark",
    "language": "ja",
    "soundEnabled": true,
    "soundVolume": 0.8,
    "actionTimeoutSeconds": 30,
    "mobileCardSize": "medium",
    "mobileVibrationEnabled": true
  }
  ```

**レスポンス（200 OK）**
```json
{
  "message": "Preferences updated successfully",
  "preferences": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "theme": "dark",
    "language": "ja",
    "sound_enabled": true,
    "updated_at": "2025-11-23T14:30:00.000Z"
  }
}
```

---

### 4. 統計情報取得

**概要**
ユーザーの詳細な統計情報を取得（ゲーム参加履歴、勝率など）。

**エンドポイント**: `GET /api/users/me/statistics`

**認証**: 必須

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  ```
- クエリパラメータ:
  - `days`: 集計期間（日数、デフォルト: 30）

**レスポンス（200 OK）**
```json
{
  "statistics": {
    "activitySummary": {
      "total_games_played": 50,
      "total_games_won": 25,
      "win_rate": 50.0,
      "period_days": 30
    },
    "gameStats": [],
    "achievements": [],
    "leaderboardPositions": [],
    "period": "30 days"
  }
}
```

---

### 5. ゲーム履歴取得

**概要**
ユーザーの過去のゲーム履歴を取得（ページネーション対応）。

**エンドポイント**: `GET /api/users/me/games`

**認証**: 必須

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  ```
- クエリパラメータ:
  - `page`: ページ番号（デフォルト: 1）
  - `limit`: 1ページあたりの件数（デフォルト: 20、最大: 50）

**レスポンス（200 OK）**
```json
{
  "games": [
    {
      "game_id": "550e8400-e29b-41d4-a716-446655440000",
      "has_lost": false,
      "losing_creature_type": null,
      "joined_at": "2025-11-23T14:30:00.000Z",
      "games": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "status": "completed",
        "created_at": "2025-11-23T14:00:00.000Z",
        "round_number": 10
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

---

### 6. チュートリアル完了マーク

**概要**
ユーザーのチュートリアル完了ステータスを更新。

**エンドポイント**: `POST /api/users/me/tutorial-complete`

**認証**: 必須

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  ```

**レスポンス（200 OK）**
```json
{
  "message": "Tutorial marked as completed"
}
```

---

### 7. 他ユーザーの公開プロフィール取得

**概要**
他のユーザーの公開プロフィール情報を取得（プライバシー設定に応じて表示）。

**エンドポイント**: `GET /api/users/:id/profile`

**認証**: 必須

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  ```
- パラメータ:
  - `id`: ユーザーID（UUID）

**レスポンス（200 OK）**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "displayName": "他のプレイヤー",
    "avatarUrl": "https://...",
    "verificationStatus": "verified",
    "gamesPlayed": 100,
    "gamesWon": 50,
    "winRate": 50.0,
    "lastSeenAt": "2025-11-23T14:00:00.000Z",
    "isOnline": true,
    "friendshipStatus": "accepted",
    "achievements": []
  }
}
```

**備考**: `gamesPlayed`, `gamesWon`, `winRate`, `lastSeenAt`, `isOnline` はプライバシー設定により `null` になる場合あり

---

## ゲームプレイAPI

### 1. カードのクレーム（ラウンド開始）

**概要**
自分の手札からカードを選択し、特定のクリーチャータイプであると宣言して対戦相手に提示。

**エンドポイント**: `POST /api/games/:id/claim`

**認証**: 必須

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
    "targetPlayerId": "550e8400-e29b-41d4-a716-446655440000"
  }
  ```

**バリデーション**:
- `claimedCreature`: "cockroach" | "mouse" | "bat" | "frog"

**レスポンス（200 OK）**
```json
{
  "message": "Claim made successfully",
  "round": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "roundNumber": 1,
    "claimedCreature": "cockroach",
    "targetPlayer": "550e8400-e29b-41d4-a716-446655440000",
    "awaitingResponse": true
  }
}
```

---

### 2. クレームへの応答（信じる／疑う）

**概要**
対戦相手のクレームに対して「信じる」または「疑う」で応答。

**エンドポイント**: `POST /api/games/:id/respond`

**認証**: 必須

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
    "roundId": "550e8400-e29b-41d4-a716-446655440000",
    "believeClaim": true
  }
  ```

**レスポンス（200 OK）**
```json
{
  "message": "Response recorded",
  "roundResult": {
    "correct": true,
    "penaltyReceiver": "550e8400-e29b-41d4-a716-446655440000",
    "penaltyCard": {
      "creature": "cockroach",
      "id": "cockroach_1"
    },
    "gameOver": false,
    "winner": null,
    "nextTurnPlayer": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**備考**: `gameOver: true` の場合、`winner` にゲーム勝者のプレイヤーIDが設定される

---

### 3. カードのパス

**概要**
対戦相手のクレームに対して「信じる」「疑う」ではなく、新しいクレームをつけてカードを次のプレイヤーに渡す。

**エンドポイント**: `POST /api/games/:id/pass`

**認証**: 必須

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
    "roundId": "550e8400-e29b-41d4-a716-446655440000",
    "targetPlayerId": "550e8400-e29b-41d4-a716-446655440000",
    "newClaim": "mouse"
  }
  ```

**レスポンス（200 OK）**
```json
{
  "message": "Card passed successfully",
  "nextTurnPlayer": "550e8400-e29b-41d4-a716-446655440000",
  "newClaim": "mouse",
  "passCount": 2
}
```

---

### 4. ゲーム状態取得

**概要**
現在のゲーム状態を取得（参加者のみ、自分の手札を含む）。

**エンドポイント**: `GET /api/games/:id/state`

**認証**: 必須（参加者のみ）

**リクエスト**
- ヘッダー:
  ```
  Authorization: Bearer <access_token>
  ```
- パラメータ:
  - `id`: ゲームID（UUID）

**レスポンス（200 OK）**
```json
{
  "gameState": {
    "gameId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "in_progress",
    "currentTurnPlayer": "550e8400-e29b-41d4-a716-446655440000",
    "roundNumber": 1,
    "isYourTurn": true,
    "playerHand": [
      {"creature": "cockroach", "id": "cockroach_1"},
      {"creature": "mouse", "id": "mouse_2"}
    ],
    "cardsRemaining": 9,
    "hasLost": false,
    "penaltyCards": {
      "cockroach": [],
      "mouse": [],
      "bat": [],
      "frog": []
    },
    "currentRound": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "claimingPlayer": "550e8400-e29b-41d4-a716-446655440000",
      "claimedCreature": "cockroach",
      "targetPlayer": "550e8400-e29b-41d4-a716-446655440000",
      "passCount": 0,
      "isCompleted": false
    },
    "allPlayers": [
      {
        "playerId": "550e8400-e29b-41d4-a716-446655440000",
        "displayName": "プレイヤー1",
        "avatarUrl": "https://...",
        "position": 1,
        "cardsRemaining": 9,
        "hasLost": false,
        "penaltyCards": {
          "cockroach": 0,
          "mouse": 0,
          "bat": 0,
          "frog": 0
        }
      }
    ]
  }
}
```

**エラー**:
- `403 Forbidden`: 参加者ではない

---

## 技術詳細

### データベーススキーマ（Supabase）

実装済みテーブル（8個）:

1. **profiles** (314行): ユーザープロファイル（auth.users連携）
2. **public_profiles** (293行): 公開プロフィール（display_name, username, avatar_url）
3. **games** (13行): ゲーム管理（status: waiting/in_progress/completed/cancelled）
4. **game_participants** (21行): ゲーム参加者（hand_cards, penalty情報）
5. **game_rounds** (0行): ラウンド管理（claiming, guessing情報）
6. **game_actions** (0行): アクション履歴（join/leave/claim/guess等）
7. **user_sessions** (115行): セッション管理（JWT token, refresh token）
8. **user_preferences** (277行): ユーザー設定（theme, sound, mobile設定）

### セキュリティ

- **RLS（Row Level Security）**: 全テーブルで有効化
- **JWT認証**: Supabase Auth統合、カスタムJWTトークン発行
- **トークンハッシュ化**: セッションテーブルに保存時はSHA-256ハッシュ化
- **レート制限**: 認証・ゲームルーム作成・参加で実装
- **入力バリデーション**: Zodによる厳密なバリデーション
- **サービスアカウントRLS**: バックエンドのみアクセス可能（service_role）

### パフォーマンス

- **インデックス**: 外部キー制約に自動インデックス
- **ページネーション**: ゲーム履歴取得で実装（最大50件/ページ）
- **クエリ最適化**: Supabase select()でJOIN最小化
- **接続プール**: Supabaseシングルトンクライアント使用

---

**作成日**: 2025-11-23
**最終更新**: 2025-11-25
**バージョン**: 2.1.0
**実装フレームワーク**: Hono + Supabase + Socket.io
**Node.js バージョン**: 18+
