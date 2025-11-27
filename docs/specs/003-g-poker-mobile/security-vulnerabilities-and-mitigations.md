# セキュリティ脆弱性と対策ガイド

**作成日**: 2025-11-01
**対象**: G-Poker Mobile (003-g-poker-mobile)
**目的**: サーバーオーソリタティブRLS実装における脆弱性の分析と対策

---

## 📋 目次

- [エグゼクティブサマリー](#エグゼクティブサマリー)
- [脆弱性の総合評価](#脆弱性の総合評価)
- [詳細な脆弱性分析](#詳細な脆弱性分析)
  - [1. service_role乱用リスク](#1-service_role乱用リスク)
  - [2. JWT_SECRET脆弱性](#2-jwt_secret脆弱性)
  - [3. セッション管理の脆弱性](#3-セッション管理の脆弱性)
  - [4. レートリミットの脆弱性](#4-レートリミットの脆弱性)
  - [5. SQLインジェクションリスク](#5-sqlインジェクションリスク)
  - [6. 権限昇格の脆弱性](#6-権限昇格の脆弱性)
  - [7. DoS攻撃ベクトル](#7-dos攻撃ベクトル)
  - [8. データ漏洩リスク](#8-データ漏洩リスク)
- [包括的対策プラン](#包括的対策プラン)
- [実装ガイド](#実装ガイド)
- [セキュリティチェックリスト](#セキュリティチェックリスト)

---

## エグゼクティブサマリー

### 重大な発見

サーバーオーソリタティブRLS実装において、**service_roleの使用は設計上必要**ですが、**適切な保護がなければ深刻な脆弱性を引き起こします**。

### 最重要リスク

1. **service_role乱用** - authMiddlewareでのDB問い合わせが無制限に実行可能
2. **JWT_SECRET脆弱性** - デフォルト値使用でJWT偽造が可能
3. **セッショントークン平文保存** - DB漏洩時に全セッションが危殆化
4. **レートリミット不足** - DoS攻撃とservice_role乱用が可能

### 緊急対応の必要性

- 🔴 **即座の対応**: JWT_SECRET強制検証、authMiddlewareレートリミット
- 🟠 **1週間以内**: セッショントークンハッシュ化、Redis導入
- 🟡 **1ヶ月以内**: WAF導入、監査ログシステム

---

## 脆弱性の総合評価

| 脆弱性 | 深刻度 | 悪用難易度 | 影響範囲 | 対策優先度 | 推定CVSS |
|--------|--------|----------|---------|----------|----------|
| **service_role乱用** | 🔴 Critical | 🟡 Medium | 全ユーザー | ⚡ 最優先 | 8.6 |
| **JWT_SECRET脆弱性** | 🔴 Critical | 🟢 Easy | 全ユーザー | ⚡ 最優先 | 9.1 |
| **セッショントークン平文保存** | 🟠 High | 🟡 Medium | 全セッション | 🔥 高 | 7.3 |
| **レートリミット不足** | 🟠 High | 🟢 Easy | サービス全体 | 🔥 高 | 7.5 |
| **DoS攻撃** | 🟡 Medium | 🟢 Easy | サービス全体 | 📋 中 | 5.3 |
| **権限昇格** | 🟡 Medium | 🟠 Hard | ゲーム管理 | 📋 中 | 6.5 |
| **データ漏洩** | 🟢 Low | 🟢 Easy | 個人情報 | 📝 低 | 4.3 |

**CVSS: Common Vulnerability Scoring System (0-10スケール)*

---

## 詳細な脆弱性分析

### 1. service_role乱用リスク

#### 🎯 概要

**ご指摘の通り、authMiddlewareでのservice_role使用は乱用リスクがあります。**

**問題のコード**:
```typescript
// backend/src/middleware/auth.ts
export const authMiddleware = createMiddleware(async (c, next) => {
  const decoded = jwt.verify(token, JWT_SECRET) as AuthContext

  // ← service_roleクライアントでDB問い合わせ
  const { data: user } = await supabase
    .from('profiles')
    .select('id, email, is_active')
    .eq('id', decoded.userId)  // ← JWT内のuserIdをそのまま使用
    .single()

  // セッション検証も同様
  const { data: session } = await supabase
    .from('user_sessions')
    .select('is_active, expires_at')
    .eq('session_token', token)  // ← トークン全文でクエリ
    .single()
})
```

#### 🔴 攻撃シナリオ1: JWT偽造によるユーザー列挙

**前提条件**:
- JWT_SECRETが推測可能または漏洩

**攻撃手順**:
```python
import jwt
import requests

# JWT_SECRETを推測または取得
guessed_secret = "your-secret-key"  # デフォルト値

# 大量のuserIdでJWTを生成
for user_id in range(1, 10000):
    fake_token = jwt.encode({
        'userId': f'00000000-0000-0000-0000-{user_id:012d}',
        'email': 'fake@example.com',
        'iat': time.time(),
    }, guessed_secret)

    # API呼び出し
    response = requests.get(
        'http://backend:3001/api/auth/me',
        headers={'Authorization': f'Bearer {fake_token}'}
    )

    # ← service_roleがDB問い合わせを実行
    # ユーザー存在確認、メールアドレス取得が可能

    if response.status_code == 200:
        print(f"User {user_id} exists: {response.json()}")
```

**影響**:
- ✅ ユーザー列挙（10,000ユーザー分）
- ✅ メールアドレス漏洩
- ✅ アクティブステータス確認
- ✅ データベース負荷（service_roleで10,000クエリ）

#### 🔴 攻撃シナリオ2: レートリミットバイパスとDoS

**問題のコード**:
```typescript
// backend/src/middleware/rateLimit.ts
const clientId =
  c.req.header('X-Forwarded-For') ||  // ← 偽装可能！
  c.req.header('X-Real-IP') ||
  'unknown'
```

**攻撃手順**:
```bash
# X-Forwarded-Forヘッダーを偽装して大量リクエスト
for i in $(seq 1 100000); do
  curl -H "X-Forwarded-For: 192.168.1.$((i % 255))" \
       -H "Authorization: Bearer $FAKE_TOKEN" \
       http://backend:3001/api/auth/me &
done

# 結果:
# - 各IPごとに新しいレートリミット枠
# - service_roleがDB問い合わせを100,000回実行
# - データベース過負荷 → サービスダウン
```

**影響**:
- ✅ レートリミットバイパス
- ✅ service_role乱用（無制限DB問い合わせ）
- ✅ データベース過負荷
- ✅ サービス停止（DoS）

#### 🛡️ 対策

**即座に適用（優先度: 最高）**

```typescript
// 1. authMiddlewareにレートリミット追加
import { rateLimit } from '../middleware/rateLimit.js'

const authRateLimit = rateLimit({
  windowMs: 60 * 1000,      // 1分
  maxRequests: 20,           // 20リクエスト/分/IP
  message: 'Too many authentication requests',
})

export const authMiddleware = createMiddleware(async (c, next) => {
  // レートリミットを先に実行
  const rateLimitResult = await new Promise((resolve, reject) => {
    authRateLimit(c, () => resolve(true)).catch(reject)
  })

  if (!rateLimitResult) {
    return c.json({ error: 'Rate limit exceeded' }, 429)
  }

  // 既存の認証ロジック...
})

// 2. IP偽装対策
function getClientIP(c: Context): string {
  const forwardedFor = c.req.header('X-Forwarded-For')
  const realIP = c.req.header('X-Real-IP')

  // 本番環境では最初のIPのみ使用（プロキシチェーン対策）
  if (process.env.NODE_ENV === 'production' && forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  return forwardedFor || realIP || 'unknown'
}

// 3. 複合キーでレートリミット
const key = `${getClientIP(c)}:${c.req.path}:${Date.now() / 60000 | 0}`
```

**中期対策（1週間以内）**

```typescript
// Redis導入でレートリミット強化
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)

export function rateLimitRedis(options: RateLimitOptions) {
  return async (c: Context, next: Next) => {
    const clientId = getClientIP(c)
    const key = `ratelimit:${clientId}:${c.req.path}`

    // Redisでカウント
    const current = await redis.incr(key)

    if (current === 1) {
      await redis.expire(key, Math.ceil(options.windowMs / 1000))
    }

    if (current > options.maxRequests) {
      const ttl = await redis.ttl(key)
      return c.json(
        { error: options.message, retryAfter: ttl },
        429
      )
    }

    return next()
  }
}
```

**長期対策（1ヶ月以内）**

```typescript
// セッションキャッシュでDB問い合わせ削減
async function getSessionFromCache(tokenHash: string) {
  // 1. Redisキャッシュ確認
  const cached = await redis.get(`session:${tokenHash}`)
  if (cached) {
    return JSON.parse(cached)
  }

  // 2. DBから取得（service_role）
  const { data: session } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('session_token_hash', tokenHash)
    .single()

  // 3. キャッシュに保存（5分間）
  if (session) {
    await redis.setex(`session:${tokenHash}`, 300, JSON.stringify(session))
  }

  return session
}
```

---

### 2. JWT_SECRET脆弱性

#### 🎯 概要

**現在のコード**:
```typescript
// backend/src/middleware/auth.ts
export const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
                                                    // ↑ これは極めて危険！
```

#### 🔴 問題点

1. **デフォルト値が既知**
   - `'your-secret-key'` は予測可能
   - GitHub等で公開される可能性
   - 環境変数未設定時にこの値を使用

2. **JWT偽造が可能**
   - デフォルト値を知っていれば誰でもJWT生成可能
   - 任意のuserIdでトークン作成
   - 全ユーザーのなりすまし

#### 🔴 攻撃シナリオ

```python
import jwt

# 既知のデフォルト値
secret = "your-secret-key"

# 管理者ユーザーのJWT偽造
fake_admin_token = jwt.encode({
    'userId': 'admin-user-id',  # 推測または取得
    'email': 'admin@example.com',
    'iat': time.time(),
}, secret)

# このトークンで全APIにアクセス可能
requests.get('/api/admin/users', headers={
    'Authorization': f'Bearer {fake_admin_token}'
})
```

**影響**:
- ✅ 全ユーザーのなりすまし
- ✅ 管理者権限の乗っ取り
- ✅ セッション無効化のバイパス
- ✅ 全データへのアクセス

#### 🛡️ 対策

**即座に適用（優先度: 最高）**

```typescript
// backend/src/middleware/auth.ts
export const JWT_SECRET = process.env.JWT_SECRET

// 起動時に検証
if (!JWT_SECRET) {
  throw new Error(
    'FATAL: JWT_SECRET environment variable is required. ' +
    'Generate a secure secret with: openssl rand -base64 64'
  )
}

if (JWT_SECRET.length < 32) {
  throw new Error(
    'FATAL: JWT_SECRET must be at least 32 characters long. ' +
    'Current length: ' + JWT_SECRET.length
  )
}

// 既知の脆弱な値をブロック
const KNOWN_WEAK_SECRETS = [
  'your-secret-key',
  'secret',
  'jwt-secret',
  'change-me',
]

if (KNOWN_WEAK_SECRETS.includes(JWT_SECRET)) {
  throw new Error(
    'FATAL: JWT_SECRET is using a known weak value. ' +
    'Generate a secure secret with: openssl rand -base64 64'
  )
}

console.log('[Security] JWT_SECRET validation passed')
```

**環境変数設定**

```bash
# .env.example
# JWT_SECRET - 最低32文字、推奨64文字以上
# 生成方法: openssl rand -base64 64
JWT_SECRET=

# 実際の .env ファイル（コミットしない！）
JWT_SECRET=vK8x...（64文字以上のランダム文字列）
```

**デプロイ時チェック**

```bash
# Docker起動時に検証
if [ -z "$JWT_SECRET" ]; then
  echo "ERROR: JWT_SECRET not set"
  exit 1
fi

if [ ${#JWT_SECRET} -lt 32 ]; then
  echo "ERROR: JWT_SECRET too short"
  exit 1
fi
```

---

### 3. セッション管理の脆弱性

#### 🎯 概要

**問題のコード**:
```typescript
// セッション作成
await supabase.from('user_sessions').insert({
  user_id: userId,
  session_token: accessToken,  // ← トークン全文を平文保存！
  refresh_token: refreshToken,  // ← リフレッシュトークンも平文！
  ...
})

// セッション検証
const { data: session } = await supabase
  .from('user_sessions')
  .select('*')
  .eq('session_token', token)  // ← 平文トークンで検索
  .single()
```

#### 🔴 問題点

1. **トークン全文がDB保存**
   - DBダンプで全トークンが漏洩
   - バックアップファイルが危険
   - ログに記録される可能性

2. **攻撃者がDB読み取り権限を得た場合**
   - 全ユーザーのセッション乗っ取り
   - リフレッシュトークンで永続的アクセス

#### 🔴 攻撃シナリオ

```bash
# シナリオ: DBダンプが漏洩
# 攻撃者がuser_sessionsテーブルにアクセス

SELECT session_token, refresh_token, user_id
FROM user_sessions
WHERE is_active = true;

# 結果: 全アクティブセッションのトークンを取得
# → 各ユーザーになりすまし可能
```

**影響**:
- ✅ 全アクティブセッションの乗っ取り
- ✅ 永続的なアクセス（リフレッシュトークン）
- ✅ 検知困難（正規のトークンを使用）

#### 🛡️ 対策

**即座に適用（優先度: 高）**

```typescript
import crypto from 'crypto'

// トークンハッシュ化関数
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// セッション作成時
const sessionTokenHash = hashToken(accessToken)
const refreshTokenHash = hashToken(refreshToken)

await supabase.from('user_sessions').insert({
  user_id: userId,
  session_token_hash: sessionTokenHash,   // ハッシュ値のみ保存
  refresh_token_hash: refreshTokenHash,   // ハッシュ値のみ保存
  // session_token: accessToken,  // ← 削除！
  // refresh_token: refreshToken,  // ← 削除！
  device_type: deviceType,
  ip_address: ipAddress,
  ...
})

// セッション検証時
const tokenHash = hashToken(token)
const { data: session } = await supabase
  .from('user_sessions')
  .select('is_active, expires_at, user_id')
  .eq('session_token_hash', tokenHash)  // ハッシュ値で検索
  .single()
```

**マイグレーション**

```sql
-- user_sessionsテーブルのカラム変更
ALTER TABLE public.user_sessions
  ADD COLUMN session_token_hash VARCHAR(64),
  ADD COLUMN refresh_token_hash VARCHAR(64);

-- 既存データの移行（必要に応じて）
-- 注: 既存トークンはハッシュ化できないため、全セッション無効化が必要

-- 古いカラムを削除
ALTER TABLE public.user_sessions
  DROP COLUMN session_token,
  DROP COLUMN refresh_token;

-- インデックス追加
CREATE INDEX idx_session_token_hash ON public.user_sessions(session_token_hash);
CREATE INDEX idx_refresh_token_hash ON public.user_sessions(refresh_token_hash);
```

---

### 4. レートリミットの脆弱性

#### 🎯 概要

**現在の実装**:
```typescript
// backend/src/middleware/rateLimit.ts
const store: RateLimitStore = {}  // メモリベース

const clientId =
  c.req.header('X-Forwarded-For') ||  // ← 偽装可能
  'unknown'

const key = `${clientId}:${c.req.path}`
```

#### 🔴 問題点

1. **メモリベース**
   - サーバー再起動でリセット
   - 水平スケーリング不可（各サーバーで独立）
   - メモリリーク可能性

2. **IP偽装可能**
   - `X-Forwarded-For` ヘッダーは改竄可能
   - プロキシチェーンで実IP隠蔽
   - 無制限のレートリミット枠取得

3. **authMiddlewareにレートリミットなし**
   - service_role乱用の主要経路
   - DB問い合わせが無制限

#### 🔴 攻撃シナリオ

```bash
# IP偽装でレートリミットバイパス
for i in {1..100000}; do
  curl -H "X-Forwarded-For: 10.0.0.$((i % 255))" \
       http://backend:3001/api/auth/login \
       -d '{"email":"victim@example.com","password":"guess"}' &
done

# 結果:
# - 各偽装IPで新しいレート枠
# - ブルートフォース攻撃成功
# - パスワード推測可能
```

#### 🛡️ 対策

前述の「1. service_role乱用リスク」の対策を参照。

---

### 5. SQLインジェクションリスク

#### 🎯 現状評価

**良い点**:
- ✅ Supabase JavaScriptクライアントは自動的にパラメータ化
- ✅ 現在のコードに直接的なSQLインジェクション脆弱性なし

**リスク**:
- ⚠️ service_roleでの実行のため、成功時の影響が大きい
- ⚠️ 入力値検証が不十分な箇所あり

#### 🟡 潜在的リスク箇所

```typescript
// rooms.ts
const { gameId } = await c.req.json()  // ユーザー入力

const { data: game } = await supabase
  .from('games')
  .select('*')
  .eq('id', gameId)  // ← Supabaseが自動エスケープ（安全）
  .single()
```

**現在**: ✅ 安全

**危険な例（絶対にやってはいけない）**:
```typescript
// ❌ 生のSQL実行（絶対に使用禁止）
await supabase.rpc('execute_raw_sql', {
  query: `SELECT * FROM games WHERE id = '${gameId}'`
  // ↑ SQLインジェクション！
})
```

#### 🛡️ 対策

**入力値検証の徹底**

```typescript
import { z } from 'zod'

// スキーマ定義
const gameIdSchema = z.string().uuid('Invalid game ID format')
const emailSchema = z.string().email('Invalid email format')
const usernameSchema = z.string()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain alphanumeric and underscore')

// 全エンドポイントで使用
async function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): Promise<T> {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new ValidationError(result.error.issues)
  }
  return result.data
}

// 使用例
rooms.post('/join', authMiddleware, async c => {
  const body = await c.req.json()
  const validated = await validateInput(joinGameSchema, body)
  // validated.gameId は必ずUUID形式
})
```

---

### 6. 権限昇格の脆弱性

#### 🎯 概要

**問題のコード**:
```typescript
// rooms.ts - ゲーム開始
if (game.creator_id !== user.userId) {
  return c.json({ error: 'Only creator can start' }, 403)
}

// 問題点: userIdはJWTから取得
// JWTが偽造されたら権限チェックが無意味
```

#### 🔴 攻撃シナリオ

```python
# 1. 他ユーザーのcreator_idを取得（ゲーム一覧から）
games = requests.get('/api/rooms/list').json()
target_game = games['games'][0]
creator_id = target_game['creatorId']

# 2. JWTを偽造（JWT_SECRETが既知の場合）
fake_token = jwt.encode({
    'userId': creator_id,  # 他ユーザーID
    'email': 'fake@example.com',
}, weak_secret)

# 3. ゲーム開始（なりすまし）
requests.post(
    f'/api/rooms/{target_game["id"]}/start',
    headers={'Authorization': f'Bearer {fake_token}'}
)
# → 成功！他ユーザーのゲームを開始できてしまう
```

#### 🛡️ 対策

**多層防御の実装**

```typescript
// 権限チェック関数（セッション検証含む）
async function requireGameCreator(
  gameId: string,
  userId: string,
  sessionTokenHash: string
): Promise<boolean> {
  const supabase = getSupabase()

  // 1. セッション検証（必須）
  const { data: session } = await supabase
    .from('user_sessions')
    .select('user_id, is_active, expires_at')
    .eq('session_token_hash', sessionTokenHash)
    .eq('is_active', true)
    .single()

  if (!session) {
    throw new Error('INVALID_SESSION')
  }

  if (session.user_id !== userId) {
    throw new Error('USER_ID_MISMATCH')
  }

  if (new Date(session.expires_at) < new Date()) {
    throw new Error('SESSION_EXPIRED')
  }

  // 2. 権限確認
  const { data: game } = await supabase
    .from('games')
    .select('creator_id')
    .eq('id', gameId)
    .single()

  if (!game || game.creator_id !== userId) {
    throw new Error('NOT_CREATOR')
  }

  return true
}

// 使用例
rooms.post('/:id/start', authMiddleware, async c => {
  const user = c.get('user')
  const gameId = c.req.param('id')
  const token = c.req.header('Authorization')?.split(' ')[1]

  try {
    await requireGameCreator(
      gameId,
      user.userId,
      hashToken(token)
    )
  } catch (error) {
    return c.json({ error: error.message }, 403)
  }

  // ゲーム開始処理...
})
```

---

### 7. DoS攻撃ベクトル

#### 🎯 攻撃シナリオ

**1. 認証エンドポイントへの大量リクエスト**

```bash
# authMiddlewareは毎回DB問い合わせ（service_role）
while true; do
  curl http://backend:3001/api/auth/me \
    -H "Authorization: Bearer $FAKE_TOKEN" &
done

# → 無限のDB SELECTクエリ
# → データベース接続プール枯渇
# → サービス停止
```

**2. Socket.io大量接続**

```javascript
// 10,000個の接続を同時に確立
const attacks = []
for (let i = 0; i < 10000; i++) {
  const socket = io('ws://backend:3001')
  socket.emit('authenticate', {
    access_token: generateFakeToken(),
    device_info: { device_id: `fake-${i}`, ... }
  })
  attacks.push(socket)
}

// → 各接続でDB問い合わせ
// → メモリ枯渇、CPU高負荷
// → サーバークラッシュ
```

**3. ゲーム作成DoS**

```bash
# 大量のゲーム作成
for i in {1..10000}; do
  curl -X POST http://backend:3001/api/rooms/create \
    -H "Authorization: Bearer $VALID_TOKEN" \
    -d '{"timeLimitSeconds":60}' &
done

# → 10,000個のゲームレコード作成
# → データベース肥大化
```

#### 🛡️ 対策

**即座に適用**

```typescript
// 1. 接続数制限（Socket.io）
import { Server } from 'socket.io'
import rateLimit from 'express-rate-limit'

const socketConnectionLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,  // 1分に5回まで
  message: 'Too many connection attempts',
})

io.use((socket, next) => {
  const req = socket.request
  socketConnectionLimit(req, {}, (err) => {
    if (err) {
      next(new Error('Rate limit exceeded'))
    } else {
      next()
    }
  })
})

// 2. 同時接続数制限
const MAX_CONNECTIONS_PER_IP = 3
const connectionCounts = new Map<string, number>()

io.use((socket, next) => {
  const ip = getClientIP(socket.request)
  const current = connectionCounts.get(ip) || 0

  if (current >= MAX_CONNECTIONS_PER_IP) {
    next(new Error('Too many concurrent connections'))
    return
  }

  connectionCounts.set(ip, current + 1)

  socket.on('disconnect', () => {
    connectionCounts.set(ip, (connectionCounts.get(ip) || 1) - 1)
  })

  next()
})

// 3. ゲーム作成制限
const gameCreationLimit = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1時間
  max: 10,                    // 10ゲーム/時間
  message: 'Too many games created',
})

rooms.post('/create', authMiddleware, gameCreationLimit, async c => {
  // ...
})
```

---

### 8. データ漏洩リスク

#### 🎯 概要

**問題のコード**:
```typescript
// auth.ts - /api/auth/me
const { data: profile } = await supabase
  .from('profiles')
  .select(`
    id,
    email,
    last_seen_at,
    is_active,
    public_profiles (display_name, avatar_url),
    user_preferences (theme, language, sound_enabled)
  `)
  .eq('id', user.userId)
  .single()

return c.json({ user: profile })  // ← すべてを返す
```

#### 🔴 問題点

- `is_active` - 内部ステータスが露出
- `last_seen_at` - プライバシー情報
- `email` - 必要以上の個人情報

#### 🛡️ 対策

```typescript
// 必要最小限の情報のみ返す
return c.json({
  user: {
    id: profile.id,
    email: profile.email,  // 本人なので許可
    displayName: profile.public_profiles?.[0]?.display_name,
    avatarUrl: profile.public_profiles?.[0]?.avatar_url,
    preferences: {
      theme: profile.user_preferences?.[0]?.theme,
      language: profile.user_preferences?.[0]?.language,
    },
    // is_active は返さない
    // last_seen_at は返さない
  },
})

// 他ユーザーの情報を返す場合はさらに制限
function sanitizePublicProfile(profile: any) {
  return {
    id: profile.id,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    // email は返さない
    // preferences は返さない
  }
}
```

---

## 包括的対策プラン

### Phase 1: 緊急対応（1-2日）⚡

**優先度: 最高**

#### 1.1 JWT_SECRET強制検証

**ファイル**: `backend/src/middleware/auth.ts`

```typescript
export const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    'FATAL: JWT_SECRET must be set and at least 32 characters. ' +
    'Generate: openssl rand -base64 64'
  )
}

const WEAK_SECRETS = ['your-secret-key', 'secret', 'jwt-secret']
if (WEAK_SECRETS.includes(JWT_SECRET)) {
  throw new Error('FATAL: JWT_SECRET is using a known weak value')
}
```

#### 1.2 authMiddlewareレートリミット

**ファイル**: `backend/src/middleware/auth.ts`

```typescript
import { rateLimit } from './rateLimit.js'

const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 20,
  message: 'Too many authentication requests',
})

export const authMiddleware = createMiddleware(async (c, next) => {
  // レートリミット先に実行
  await new Promise((resolve, reject) => {
    authRateLimit(c, resolve as any).catch(reject)
  })

  // 既存の認証ロジック...
})
```

#### 1.3 入力値検証強化

**ファイル**: `backend/src/routes/rooms.ts`

```typescript
import { z } from 'zod'

const schemas = {
  gameId: z.string().uuid(),
  userId: z.string().uuid(),
  timeLimitSeconds: z.number().min(30).max(300),
}

// 全エンドポイントで使用
```

**検証**:
```bash
npm run test
curl http://localhost:3001/api/auth/me  # レート確認
```

---

### Phase 2: 重要対策（1週間）🔥

**優先度: 高**

#### 2.1 セッショントークンハッシュ化

**マイグレーション**: `supabase/migrations/YYYYMMDDHHMMSS_hash_session_tokens.sql`

```sql
ALTER TABLE public.user_sessions
  ADD COLUMN session_token_hash VARCHAR(64),
  ADD COLUMN refresh_token_hash VARCHAR(64);

-- 既存セッション無効化（ハッシュ化できないため）
UPDATE public.user_sessions SET is_active = false;

ALTER TABLE public.user_sessions
  DROP COLUMN session_token,
  DROP COLUMN refresh_token;

CREATE INDEX idx_session_token_hash
  ON public.user_sessions(session_token_hash);
```

**コード更新**: `backend/src/middleware/auth.ts`, `backend/src/routes/auth.ts`

#### 2.2 Redis導入

**インストール**:
```bash
npm install ioredis
```

**設定**:
```typescript
// backend/src/lib/redis.ts
import Redis from 'ioredis'

export const redis = new Redis(process.env.REDIS_URL)
```

**レートリミット更新**: `backend/src/middleware/rateLimit.redis.ts`

**セッションキャッシュ**: `backend/src/middleware/auth.ts`

#### 2.3 IP偽装対策

**ファイル**: `backend/src/middleware/rateLimit.ts`

```typescript
function getClientIP(c: Context): string {
  const forwardedFor = c.req.header('X-Forwarded-For')

  if (process.env.NODE_ENV === 'production' && forwardedFor) {
    // 最初のIPのみ使用（プロキシチェーン対策）
    return forwardedFor.split(',')[0].trim()
  }

  return forwardedFor || c.req.header('X-Real-IP') || 'unknown'
}
```

**検証**:
```bash
npm run test:integration
# レートリミットテスト
# セッションハッシュテスト
```

---

### Phase 3: 強化対策（2-4週間）📋

**優先度: 中**

#### 3.1 WAF導入

**選択肢**:
- Cloudflare WAF（推奨）
- AWS WAF
- Google Cloud Armor

**設定例（Cloudflare）**:
```yaml
# Cloudflare設定
security_level: high
challenge_passage: 30
browser_integrity_check: true

rate_limiting:
  - path: /api/auth/*
    requests: 100
    period: 60
  - path: /api/rooms/*
    requests: 50
    period: 60
```

#### 3.2 DDoS対策

**Cloudflare DDoS Protection**:
- L3/L4 DDoS防御
- L7 アプリケーション層防御
- ボットマネジメント

#### 3.3 監査ログシステム

**ファイル**: `backend/src/lib/auditLog.ts`

```typescript
export async function logAudit(event: {
  userId: string
  action: string
  resource: string
  result: 'success' | 'failure'
  metadata?: any
}) {
  await supabase.from('audit_logs').insert({
    user_id: event.userId,
    action: event.action,
    resource: event.resource,
    result: event.result,
    metadata: event.metadata,
    ip_address: getClientIP(),
    user_agent: getUserAgent(),
    timestamp: new Date().toISOString(),
  })
}

// 使用例
await logAudit({
  userId: user.id,
  action: 'GAME_START',
  resource: `game:${gameId}`,
  result: 'success',
})
```

#### 3.4 侵入検知システム

**OSSEC / Fail2Ban 導入**

```bash
# Fail2Ban設定
[backend-auth]
enabled = true
port = 3001
filter = backend-auth
logpath = /var/log/backend/auth.log
maxretry = 5
bantime = 3600
```

---

### Phase 4: 継続的改善（継続）🔄

#### 4.1 脆弱性スキャン自動化

**GitHub Actions**:
```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # 毎日2:00

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Snyk
        uses: snyk/actions/node@master
      - name: Run npm audit
        run: npm audit --audit-level=high
```

#### 4.2 ペネトレーションテスト

**定期実施**:
- 四半期ごと
- 主要リリース前
- 外部セキュリティ専門家に依頼

#### 4.3 セキュリティ教育

**開発チーム向け**:
- OWASP Top 10 トレーニング
- セキュアコーディング研修
- インシデント対応訓練

---

## 実装ガイド

### 優先順位付き実装ロードマップ

```
Week 1 (緊急)
├─ Day 1-2: JWT_SECRET検証、authMiddlewareレート実装
├─ Day 3-4: 入力値検証、IP偽装対策
└─ Day 5-7: テスト、デプロイ

Week 2 (重要)
├─ Day 1-3: セッショントークンハッシュ化
├─ Day 4-5: Redis導入
└─ Day 6-7: 統合テスト

Week 3-4 (強化)
├─ Week 3: WAF/DDoS対策導入
└─ Week 4: 監査ログ、侵入検知

Ongoing (継続)
└─ 脆弱性スキャン、ペネトレーションテスト
```

### コードレビューチェックリスト

- [ ] 全入力値を検証（Zod等）
- [ ] service_roleクエリにレート制限
- [ ] JWT_SECRETが強力（32文字以上）
- [ ] セッショントークンをハッシュ化
- [ ] IP偽装対策実装
- [ ] エラーメッセージが情報漏洩しない
- [ ] ログに機密情報を記録しない

---

## セキュリティチェックリスト

### デプロイ前

- [ ] JWT_SECRET設定済み（32文字以上）
- [ ] 環境変数に機密情報なし（コミット前確認）
- [ ] RLSポリシー適用済み
- [ ] レートリミット実装済み
- [ ] 入力値検証実装済み
- [ ] セッショントークンハッシュ化済み
- [ ] エラーハンドリング実装済み
- [ ] ログ設定確認済み

### 運用中

- [ ] 監査ログ定期レビュー
- [ ] レートリミット効果測定
- [ ] 異常アクセス監視
- [ ] 脆弱性スキャン実施（月次）
- [ ] ペネトレーションテスト（四半期）
- [ ] インシデント対応訓練（半期）

---

## 参考資料

- [OWASP Top 10 2021](https://owasp.org/www-project-top-ten/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Supabase Security Guide](https://supabase.com/docs/guides/platform/going-into-prod)

---

## 更新履歴

- 2025-11-01: 初版作成（service_role乱用リスク分析含む）
