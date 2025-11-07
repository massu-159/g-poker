# サーバーオーソリタティブRLS実装ガイド

**作成日**: 2025-11-01
**対象**: G-Poker Mobile (003-g-poker-mobile)
**目的**: 完全なサーバーオーソリタティブモデルの実現

---

## 📋 目次

- [概要](#概要)
- [アーキテクチャ設計](#アーキテクチャ設計)
- [実装ステップ](#実装ステップ)
  - [ステップ1: RLSポリシー再設計](#ステップ1-rlsポリシー再設計)
  - [ステップ2: バックエンドセキュリティ強化](#ステップ2-バックエンドセキュリティ強化)
  - [ステップ3: テスト手順](#ステップ3-テスト手順)
- [実装順序](#実装順序)
- [期待される効果](#期待される効果)
- [チェックリスト](#チェックリスト)

---

## 概要

### 問題

現在のRLS設定では、`public`ロール向けポリシーが存在するため、サーバーオーソリタティブモデルと競合が発生しています：

- ユーザーAがゲームルーム作成
- ユーザーBがゲームルーム参加を試みる
- RLSポリシーにより、ユーザーBの参加がブロックされる

### 解決策

- **DB操作**: 全てAPI経由で行う
- **クライアント**: 直接DB操作は一切できない
- **バックエンド**: サービスロールがDB操作を行う
- **認証**: バックエンドで検証後、DB操作を許可
- **RLS**: publicロールを完全ブロック、service_roleのみ許可

---

## アーキテクチャ設計

### システム構成図

```
┌─────────────────┐
│   Mobile App    │ ← anonキーなし、直接DB接続なし
│   (Frontend)    │
└────────┬────────┘
         │ JWT Bearer Token
         │ HTTPS/WSS
         ▼
┌─────────────────┐
│  Hono Backend   │ ← 認証検証 (authMiddleware)
│   + Socket.io   │
└────────┬────────┘
         │ Service Role Key
         │ (RLSバイパス)
         ▼
┌─────────────────┐
│   Supabase DB   │
│  RLS: ENABLED   │ ← publicロール完全ブロック
│  Policies:      │   service_roleのみアクセス可
│  - No public    │
│  - service only │
└─────────────────┘
```

### データフロー

```
Request Flow:

Mobile App
    │
    ├─ Authorization: Bearer <JWT>
    │
    ▼
authMiddleware (バックエンド)
    │
    ├─ 1. JWT検証
    ├─ 2. ユーザー存在確認 (service_roleでDB問い合わせ)
    ├─ 3. アクティブステータス確認
    ├─ 4. セッション検証
    │
    ▼
Business Logic (バックエンド)
    │
    ├─ 権限チェック
    ├─ データ検証
    │
    ▼
Supabase Client (service_role)
    │
    ├─ RLS評価 (service_roleはバイパス)
    ├─ publicポリシー: 0個 → ブロック
    ├─ service_roleポリシー: 存在 → 許可
    │
    ▼
PostgreSQL Database
```

### RLS設定の最終形

```
┌─────────────────────────────────────────────────┐
│              Supabase Database                  │
│                                                 │
│  RLS: ENABLED (全テーブル)                      │
│                                                 │
│  ┌───────────────────────────────────────┐     │
│  │  public role                          │     │
│  │  ポリシー: なし (0個)                  │     │
│  │  結果: 完全ブロック ❌                 │     │
│  └───────────────────────────────────────┘     │
│                                                 │
│  ┌───────────────────────────────────────┐     │
│  │  service_role                         │     │
│  │  ポリシー: ALL (全テーブル)            │     │
│  │  結果: 全アクセス可能 ✅               │     │
│  └───────────────────────────────────────┘     │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 実装ステップ

### ステップ1: RLSポリシー再設計

#### マイグレーションSQL

以下のSQLを `supabase/migrations/YYYYMMDDHHMMSS_server_authoritative_rls.sql` として作成します。

```sql
-- ================================================================
-- Migration: Server-Authoritative RLS Configuration
-- Date: 2025-11-01
-- Purpose: Block all public role access, allow service_role only
-- ================================================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PHASE 1: ゲームコアテーブル (games, game_participants, etc.)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 1.1 games テーブル
-- 既存のpublicロールポリシーを削除
DROP POLICY IF EXISTS "Authenticated users can create games" ON public.games;
DROP POLICY IF EXISTS "games_select_policy" ON public.games;
DROP POLICY IF EXISTS "games_update_policy" ON public.games;

-- service_role専用ポリシー（service_roleはRLSバイパスするため実質不要だが明示的に設定）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'games'
    AND policyname = 'service_role_all_access'
  ) THEN
    CREATE POLICY service_role_all_access ON public.games
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.games IS
  'Server-authoritative: Backend service_role only. No direct client access.';


-- 1.2 game_participants テーブル
DROP POLICY IF EXISTS "participants_insert_policy" ON public.game_participants;
DROP POLICY IF EXISTS "participants_select_policy" ON public.game_participants;
DROP POLICY IF EXISTS "participants_update_policy" ON public.game_participants;
DROP POLICY IF EXISTS "participants_delete_policy" ON public.game_participants;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'game_participants'
    AND policyname = 'service_role_all_access'
  ) THEN
    CREATE POLICY service_role_all_access ON public.game_participants
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.game_participants IS
  'Server-authoritative: Backend service_role only. No direct client access.';


-- 1.3 game_rounds テーブル
DROP POLICY IF EXISTS "Users can view rounds in their games" ON public.game_rounds;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'game_rounds'
    AND policyname = 'service_role_all_access'
  ) THEN
    CREATE POLICY service_role_all_access ON public.game_rounds
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.game_rounds IS
  'Server-authoritative: Backend service_role only. No direct client access.';


-- 1.4 game_actions テーブル
DROP POLICY IF EXISTS "Users can insert their own game actions" ON public.game_actions;
DROP POLICY IF EXISTS "Users can view game actions in their games" ON public.game_actions;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'game_actions'
    AND policyname = 'service_role_all_access'
  ) THEN
    CREATE POLICY service_role_all_access ON public.game_actions
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.game_actions IS
  'Server-authoritative: Backend service_role only. No direct client access.';


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PHASE 2: 認証・ユーザー管理テーブル
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 2.1 profiles テーブル
-- publicロールポリシーを削除
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- service_roleポリシーは維持（既に存在する場合）
DO $$
BEGIN
  -- SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'Service role can select all profiles'
  ) THEN
    CREATE POLICY "Service role can select all profiles" ON public.profiles
      FOR SELECT
      TO service_role
      USING (true);
  END IF;

  -- INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'Service role can insert profiles'
  ) THEN
    CREATE POLICY "Service role can insert profiles" ON public.profiles
      FOR INSERT
      TO service_role
      WITH CHECK (true);
  END IF;

  -- UPDATE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'Service role can update profiles'
  ) THEN
    CREATE POLICY "Service role can update profiles" ON public.profiles
      FOR UPDATE
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.profiles IS
  'Server-authoritative: Backend service_role only. No direct client access.';


-- 2.2 public_profiles テーブル
DROP POLICY IF EXISTS "direct_profile_insert" ON public.public_profiles;
DROP POLICY IF EXISTS "direct_profile_select" ON public.public_profiles;
DROP POLICY IF EXISTS "direct_profile_update" ON public.public_profiles;

-- service_roleポリシー
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'public_profiles'
    AND policyname = 'Service role can insert public profiles'
  ) THEN
    CREATE POLICY "Service role can insert public profiles" ON public.public_profiles
      FOR INSERT
      TO service_role
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'public_profiles'
    AND policyname = 'service_role_all_access'
  ) THEN
    CREATE POLICY service_role_all_access ON public.public_profiles
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.public_profiles IS
  'Server-authoritative: Backend service_role only. No direct client access.';


-- 2.3 user_sessions テーブル
DROP POLICY IF EXISTS "Users can manage their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.user_sessions;

COMMENT ON TABLE public.user_sessions IS
  'Server-authoritative: Backend service_role only. No direct client access.';


-- 2.4 user_preferences テーブル
DROP POLICY IF EXISTS "Users can manage their own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.user_preferences;

COMMENT ON TABLE public.user_preferences IS
  'Server-authoritative: Backend service_role only. No direct client access.';


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PHASE 3: 検証とログ出力
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- RLS有効状態の確認
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '=== RLS Status ===';
  FOR rec IN
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  LOOP
    RAISE NOTICE 'Table: %, RLS: %', rec.tablename, rec.rowsecurity;
  END LOOP;
END $$;

-- ポリシー一覧の確認
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '=== Remaining Policies ===';
  FOR rec IN
    SELECT tablename, policyname, roles
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  LOOP
    RAISE NOTICE 'Table: %, Policy: %, Roles: %',
      rec.tablename, rec.policyname, rec.roles;
  END LOOP;
END $$;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PHASE 4: セキュリティ検証用関数
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- publicロールがアクセスできないことを確認する関数
CREATE OR REPLACE FUNCTION public.verify_rls_block_public()
RETURNS TABLE(
  table_name text,
  has_public_policies boolean,
  rls_enabled boolean,
  status text
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.tablename::text,
    EXISTS(
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname = 'public'
      AND p.tablename = t.tablename
      AND 'public' = ANY(p.roles::text[])
    ) as has_public_policies,
    t.rowsecurity as rls_enabled,
    CASE
      WHEN t.rowsecurity AND NOT EXISTS(
        SELECT 1
        FROM pg_policies p
        WHERE p.schemaname = 'public'
        AND p.tablename = t.tablename
        AND 'public' = ANY(p.roles::text[])
      ) THEN '✅ Secure (RLS enabled, no public policies)'
      WHEN NOT t.rowsecurity THEN '⚠️ Warning (RLS disabled)'
      ELSE '❌ Risk (public policies exist)'
    END as status
  FROM pg_tables t
  WHERE t.schemaname = 'public'
  ORDER BY t.tablename;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.verify_rls_block_public() IS
  'Verify that public role is blocked from all tables';

-- 使用例: SELECT * FROM verify_rls_block_public();
```

#### マイグレーション適用

```bash
# MCP経由で適用
mcp__supabase__apply_migration(
  name: "server_authoritative_rls",
  query: "<上記のSQL全文>"
)

# または、Supabase CLIで適用
npx supabase migration up
```

---

### ステップ2: バックエンドセキュリティ強化

#### 2.1 認証ミドルウェア強化

**ファイル**: `backend/src/middleware/auth.ts`

```typescript
/**
 * 強化版認証ミドルウェア
 * - JWT検証
 * - ユーザー存在確認
 * - アクティブステータス確認
 * - セッション検証
 */

import { createMiddleware } from 'hono/factory'
import jwt from 'jsonwebtoken'
import { getSupabase } from '../lib/supabase.js'

export const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export interface AuthContext {
  userId: string
  email: string
  iat: number
  exp: number
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthContext
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  try {
    // 1. Authorization ヘッダー検証
    const authorization = c.req.header('Authorization')
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return c.json({ error: 'Authorization header missing or invalid' }, 401)
    }

    const token = authorization.split(' ')[1]
    if (!token) {
      return c.json({ error: 'Token missing' }, 401)
    }

    // 2. JWT検証
    let decoded: AuthContext
    try {
      decoded = jwt.verify(token, JWT_SECRET) as AuthContext
    } catch (jwtError) {
      if (jwtError instanceof jwt.TokenExpiredError) {
        return c.json({ error: 'Token expired' }, 401)
      }
      return c.json({ error: 'Invalid token' }, 401)
    }

    // 3. ユーザー存在確認（service_roleで実行）
    const supabase = getSupabase()
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, email, is_active')
      .eq('id', decoded.userId)
      .single()

    if (userError || !user) {
      console.error('[Auth] User not found:', decoded.userId)
      return c.json({ error: 'User not found' }, 401)
    }

    // 4. アクティブステータス確認
    if (!user.is_active) {
      console.warn('[Auth] Inactive user attempted access:', decoded.userId)
      return c.json({ error: 'Account inactive' }, 401)
    }

    // 5. セッション検証
    const { data: session, error: sessionError } = await supabase
      .from('user_sessions')
      .select('is_active, expires_at')
      .eq('user_id', decoded.userId)
      .eq('session_token', token)
      .eq('is_active', true)
      .single()

    if (sessionError || !session) {
      console.warn('[Auth] Invalid session for user:', decoded.userId)
      return c.json({ error: 'Invalid or expired session' }, 401)
    }

    // 6. セッション有効期限確認
    if (new Date(session.expires_at) < new Date()) {
      console.warn('[Auth] Expired session for user:', decoded.userId)
      return c.json({ error: 'Session expired' }, 401)
    }

    // 7. ユーザー情報をコンテキストに保存
    c.set('user', decoded)

    // 8. 最終アクティビティ更新（非同期、エラーは無視）
    supabase
      .from('user_sessions')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('session_token', token)
      .then(() => {})
      .catch(err => console.warn('[Auth] Failed to update last activity:', err))

    await next()
  } catch (error) {
    console.error('[Auth] Middleware error:', error)
    return c.json({ error: 'Authentication failed' }, 401)
  }
})

/**
 * 権限チェックヘルパー関数
 */
export async function requireGameParticipant(
  gameId: string,
  userId: string
): Promise<boolean> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('game_participants')
    .select('id')
    .eq('game_id', gameId)
    .eq('player_id', userId)
    .single()

  if (error || !data) {
    throw new Error('NOT_PARTICIPANT')
  }
  return true
}

export async function requireGameCreator(
  gameId: string,
  userId: string
): Promise<boolean> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('games')
    .select('creator_id')
    .eq('id', gameId)
    .single()

  if (error || !data || data.creator_id !== userId) {
    throw new Error('NOT_CREATOR')
  }
  return true
}
```

#### 2.2 エンドポイント権限チェック例

**ファイル**: `backend/src/routes/rooms.ts` (一部抜粋)

```typescript
/**
 * POST /api/rooms/join
 * ゲーム参加（権限チェック強化版）
 */
rooms.post('/join', authMiddleware, async c => {
  try {
    const user = c.get('user')
    const { gameId } = await c.req.json()
    const supabase = getSupabase()

    // 1. ゲーム存在確認
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('id, status, creator_id')
      .eq('id', gameId)
      .single()

    if (gameError || !game) {
      return c.json({ error: 'Game not found' }, 404)
    }

    // 2. ステータス確認
    if (game.status !== 'waiting') {
      return c.json({ error: 'Game already started or completed' }, 400)
    }

    // 3. 参加者数確認
    const { data: participants } = await supabase
      .from('game_participants')
      .select('id, player_id')
      .eq('game_id', gameId)

    // 4. 定員確認
    if (participants && participants.length >= 2) {
      return c.json({ error: 'Game is full' }, 400)
    }

    // 5. 重複参加チェック
    if (participants?.some(p => p.player_id === user.userId)) {
      return c.json({ error: 'Already joined this game' }, 409)
    }

    // 6. 参加処理（service_roleで実行）
    const position = participants.length + 1
    const { error: insertError } = await supabase
      .from('game_participants')
      .insert({
        game_id: gameId,
        player_id: user.userId,
        position: position,
        hand_cards: [],
        penalty_cockroach: [],
        penalty_mouse: [],
        penalty_bat: [],
        penalty_frog: [],
        cards_remaining: 0,
        has_lost: false,
        status: 'joined',
      })

    if (insertError) {
      console.error('[Rooms] Failed to add participant:', insertError)
      return c.json({ error: 'Failed to join game' }, 500)
    }

    return c.json({
      message: 'Successfully joined game',
      position: position,
    })
  } catch (error) {
    console.error('[Rooms] Join game error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})
```

#### 2.3 Socket.io認証強化

**ファイル**: `backend/src/socket/AuthHandler.ts` (一部抜粋)

```typescript
async function handleAuthentication(
  socket: AuthenticatedSocket,
  data: AuthenticateEvent
) {
  try {
    // 1. データ検証
    if (!data?.access_token || !data?.device_info) {
      socket.emit('authentication_failed', {
        error_code: 'INVALID_TOKEN',
        message: 'Missing required authentication data',
        requires_login: true,
      })
      return
    }

    // 2. JWT検証
    let decoded: any
    try {
      decoded = jwt.verify(data.access_token, JWT_SECRET)
    } catch (jwtError: any) {
      socket.emit('authentication_failed', {
        error_code: jwtError.name === 'TokenExpiredError'
          ? 'TOKEN_EXPIRED'
          : 'INVALID_TOKEN',
        message: jwtError.message,
        requires_login: true,
      })
      return
    }

    const userId = decoded.userId || decoded.sub
    if (!userId) {
      socket.emit('authentication_failed', {
        error_code: 'INVALID_TOKEN',
        message: 'Token does not contain user ID',
        requires_login: true,
      })
      return
    }

    // 3. ユーザー検証（service_roleで実行）
    const supabase = getSupabase()
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, is_active')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      socket.emit('authentication_failed', {
        error_code: 'INVALID_TOKEN',
        message: 'User profile not found',
        requires_login: true,
      })
      return
    }

    if (!profile.is_active) {
      socket.emit('authentication_failed', {
        error_code: 'USER_BANNED',
        message: 'User account has been suspended',
        requires_login: false,
      })
      return
    }

    // 4. セッション検証（service_roleで実行）
    const { data: session, error: sessionError } = await supabase
      .from('user_sessions')
      .select('is_active, expires_at')
      .eq('session_token', data.access_token)
      .eq('is_active', true)
      .single()

    if (sessionError || !session) {
      socket.emit('authentication_failed', {
        error_code: 'INVALID_TOKEN',
        message: 'Invalid or expired session',
        requires_login: true,
      })
      return
    }

    if (new Date(session.expires_at) < new Date()) {
      socket.emit('authentication_failed', {
        error_code: 'TOKEN_EXPIRED',
        message: 'Session expired',
        requires_login: true,
      })
      return
    }

    // 5. 認証成功処理
    // ... (既存のコード)
  } catch (error) {
    console.error('[Auth] Authentication error:', error)
    socket.emit('authentication_failed', {
      error_code: 'INVALID_TOKEN',
      message: 'Authentication failed due to server error',
      requires_login: true,
    })
  }
}
```

---

### ステップ3: テスト手順

#### 3.1 RLSポリシー検証

```sql
-- Test 1: publicロールがブロックされていることを確認
SELECT * FROM verify_rls_block_public();
-- 期待結果: すべてのテーブルが "✅ Secure" ステータス

-- Test 2: 各テーブルのRLS状態を確認
SELECT
  tablename,
  rowsecurity as rls_enabled,
  (SELECT COUNT(*)
   FROM pg_policies p
   WHERE p.schemaname = 'public'
   AND p.tablename = t.tablename) as policy_count,
  (SELECT COUNT(*)
   FROM pg_policies p
   WHERE p.schemaname = 'public'
   AND p.tablename = t.tablename
   AND 'public' = ANY(p.roles::text[])) as public_policy_count
FROM pg_tables t
WHERE t.schemaname = 'public'
ORDER BY tablename;
-- 期待結果:
--   rls_enabled = true (全テーブル)
--   public_policy_count = 0 (全テーブル)

-- Test 3: service_roleポリシーが存在することを確認
SELECT
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND 'service_role' = ANY(roles::text[])
ORDER BY tablename, policyname;
-- 期待結果: 各テーブルにservice_role用ポリシーが存在
```

#### 3.2 統合テスト

**ファイル**: `backend/tests/integration/rls-verification.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

describe('RLS Policy Verification', () => {
  it('should block public role from accessing games table', async () => {
    const publicClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    const { data, error } = await publicClient
      .from('games')
      .select('*')
      .limit(1)

    expect(error).toBeDefined()
    expect(error?.message).toContain('permission denied')
    expect(data).toBeNull()
  })

  it('should allow service_role to access games table', async () => {
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { data, error } = await serviceClient
      .from('games')
      .select('*')
      .limit(1)

    expect(error).toBeNull()
  })

  it('should block public role from accessing profiles table', async () => {
    const publicClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    const { data, error } = await publicClient
      .from('profiles')
      .select('*')
      .limit(1)

    expect(error).toBeDefined()
    expect(data).toBeNull()
  })
})

describe('Backend API Authorization', () => {
  let userAToken: string
  let userBToken: string

  beforeAll(async () => {
    // User A ログイン
    const responseA = await fetch(`http://localhost:3001/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'userA@example.com',
        password: 'password123',
      }),
    })
    const dataA = await responseA.json()
    userAToken = dataA.tokens.accessToken

    // User B ログイン
    const responseB = await fetch(`http://localhost:3001/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'userB@example.com',
        password: 'password123',
      }),
    })
    const dataB = await responseB.json()
    userBToken = dataB.tokens.accessToken
  })

  it('should allow user A to create game', async () => {
    const response = await fetch(`http://localhost:3001/api/rooms/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ timeLimitSeconds: 60 }),
    })

    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.game).toBeDefined()
  })

  it('should allow user B to join user A game', async () => {
    // User A creates game
    const createResponse = await fetch(`http://localhost:3001/api/rooms/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ timeLimitSeconds: 60 }),
    })
    const createData = await createResponse.json()
    const gameId = createData.game.id

    // User B joins game
    const joinResponse = await fetch(`http://localhost:3001/api/rooms/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userBToken}`,
      },
      body: JSON.stringify({ gameId }),
    })

    expect(joinResponse.status).toBe(200)
    const joinData = await joinResponse.json()
    expect(joinData.message).toBe('Successfully joined game')
  })
})
```

#### 3.3 手動テスト

```bash
# ステップ1: バックエンド起動
cd backend
npm run dev

# ステップ2: User A - ゲーム作成
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"userA@example.com","password":"password123"}'
# -> TOKEN_A を取得

curl -X POST http://localhost:3001/api/rooms/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d '{"timeLimitSeconds":60}'
# -> GAME_ID を取得

# ステップ3: User B - ゲーム参加
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"userB@example.com","password":"password123"}'
# -> TOKEN_B を取得

curl -X POST http://localhost:3001/api/rooms/join \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_B" \
  -d '{"gameId":"'$GAME_ID'"}'
# -> 成功: "Successfully joined game"

# ステップ4: 直接DBアクセステスト（失敗を確認）
# Supabase Dashboard または psql で anon role として実行
# SELECT * FROM games; -- permission denied エラーになるはず
```

---

## 実装順序

### フェーズ1: マイグレーション適用（優先度: 最高）

```bash
# 1. バックアップ作成
# Supabaseダッシュボードからバックアップ

# 2. マイグレーション適用
mcp__supabase__apply_migration(
  name: "server_authoritative_rls",
  query: "<マイグレーションSQL>"
)

# 3. 検証
SELECT * FROM verify_rls_block_public();
```

### フェーズ2: バックエンド強化（優先度: 高）

```bash
# 1. 認証ミドルウェア更新
# backend/src/middleware/auth.ts を強化版に置き換え

# 2. エンドポイント権限チェック追加
# backend/src/routes/*.ts に権限チェックロジック追加

# 3. Socket.io認証強化
# backend/src/socket/AuthHandler.ts を強化版に更新

# 4. テスト実行
npm run test
```

### フェーズ3: 統合テスト（優先度: 中）

```bash
# 1. RLS検証テスト
npm run test:integration

# 2. 手動E2Eテスト
# User A → ゲーム作成
# User B → ゲーム参加
# 動作確認
```

### フェーズ4: 監視・ログ（優先度: 低）

```bash
# 1. アクセスログ強化
# 2. 監査ログ実装
# 3. アラート設定
```

---

## 期待される効果

| 項目 | 変更前 | 変更後 |
|------|--------|--------|
| **ユーザーBのゲーム参加** | ❌ RLSでブロック | ✅ API経由で成功 |
| **publicロールのDB直接アクセス** | ⚠️ 一部可能 | ❌ 完全ブロック |
| **service_roleのDB操作** | ✅ 可能 | ✅ 可能 |
| **クライアント直接DB接続** | ⚠️ anonキーで可能 | ❌ 完全ブロック |
| **バックエンド認証検証** | ⚠️ 基本的な検証のみ | ✅ 多層検証 |

---

## チェックリスト

実装前に確認してください：

- [ ] バックエンドがサービスロールキーを使用している
- [ ] フロントエンドがSupabase直接アクセスしていない
- [ ] マイグレーションSQLを確認した
- [ ] バックアップを作成した
- [ ] テスト環境で検証した
- [ ] ロールバック計画を準備した
- [ ] チーム全体に変更を周知した

---

## 注意事項

### セキュリティ

1. **バックエンドコードが唯一の防御線**
   - RLSでpublicロールをブロック
   - バックエンドの脆弱性が致命的になる
   - コードレビューとセキュリティテストを徹底

2. **サービスロールキーの管理**
   - 環境変数で管理
   - コミットしない
   - 定期的にローテーション

3. **監査ログの実装**
   - すべてのDB操作をログ
   - 不正アクセスの検知

### ロールバック

緊急時のロールバック手順：

```sql
-- publicロールポリシーを再作成
-- 元のマイグレーションファイルから復元
-- または、バックアップから復元
```

### パフォーマンス

- service_roleはRLSバイパスするため高速
- 大量アクセス時はコネクションプーリング検討
- Redis等でセッションキャッシュ検討

---

## トラブルシューティング

### Q1: マイグレーション適用後、既存ユーザーがログインできない

**原因**: セッションテーブルのデータが不整合
**解決策**: 既存セッションを一度クリアしてログインし直す

```sql
UPDATE user_sessions SET is_active = false WHERE is_active = true;
```

### Q2: "permission denied for table games" エラー

**原因**: publicロールでアクセスしている
**解決策**: バックエンドがservice_roleキーを使用していることを確認

```typescript
// backend/src/lib/supabase.ts
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
// SUPABASE_ANON_KEY ではない！
```

### Q3: User Bがゲームに参加できない

**原因**: 認証トークンが無効
**解決策**: ログイン→トークン取得→参加のフローを確認

```bash
# トークンの有効性確認
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## 参考資料

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Hono Authentication Middleware](https://hono.dev/middleware/builtin/jwt)
- [G-Poker 003 Specification](./spec.md)

---

**更新履歴**:
- 2025-11-01: 初版作成
