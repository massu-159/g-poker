# バックエンドゲームロジック改善計画

**作成日**: 2025-11-03
**対象**: Cockroach Poker バックエンド実装
**目的**: 現状の問題点を整理し、段階的な改善計画を策定

---

## 📊 現状分析

### データベース状況
```
games: 13件（作成済みゲーム）
game_participants: 21件（参加者）
game_rounds: 0件 ← ゲームが一度もプレイされていない
game_actions: 0件 ← 監査ログが全く記録されていない
```

**重大な発見**: ゲーム作成機能は動作しているが、**実際のゲームプレイが一度も実行されていない**

### アーキテクチャ分析

#### 現在のファイル構造
```
backend/src/
├── routes/              # REST API エンドポイント
│   ├── auth.ts          # 認証（完成）
│   ├── rooms.ts         # ルーム管理（作成、参加、開始）
│   ├── games.ts         # ゲームプレイ（claim, respond, pass）
│   └── users.ts         # ユーザー管理（完成）
├── socket/              # Socket.IO リアルタイム通信
│   ├── AuthHandler.ts   # Socket認証（完成）
│   ├── RoomHandler.ts   # ルーム同期（完成）
│   ├── GameHandler.ts   # ゲーム同期（❌ バグあり）
│   └── RecoveryHandler.ts  # 接続復旧（完成）
├── services/            # ビジネスロジック層
│   └── gameLogic.ts     # ゲームルール実装（✅ 正しい実装）
├── middleware/
│   ├── auth.ts          # JWT認証（完成）
│   └── rateLimit.ts     # レート制限（完成）
└── lib/
    └── supabase.ts      # DB接続（完成）
```

---

## 🔴 発見された問題点

### 問題1: ゲームロジックの二重実装（HIGH Priority）

#### 現状
```typescript
// ✅ 正しい実装: services/gameLogic.ts
export async function processCardClaim(...) {
  // 完全なビジネスロジック実装
  // - プレイヤーの手札検証
  // - カード実体の取得
  // - ラウンド作成
  // - 監査ログ記録
}

// ❌ バグあり: socket/GameHandler.ts
async function handleClaimCard(...) {
  // 独自実装（gameLogic.tsを使わない）
  // - 手札検証なし
  // - プレースホルダーカード使用（致命的バグ）
  // - 監査ログ記録なし
  current_card: { type: data.claimed_creature, id: randomUUID() }, // ★ 実際のカードではない
}
```

#### 影響
- REST API経由: ✅ 正常動作
- Socket.IO経由: ❌ ゲームロジック破綻
  - カード検証不可能
  - ペナルティ判定が常に失敗
  - 不正行為が防げない

#### 原因
- **Single Source of Truth原則の違反**
- 2つの実装が独立して存在

---

### 問題2: POST /api/rooms/:id/start の非アトミック実装（HIGH Priority）

#### 現状
```typescript
// rooms.ts:290-302 - カード配布ループ
for (let i = 0; i < allParticipants.length; i++) {
  const playerCards = gameDeck.splice(0, cardsPerPlayer)
  await supabase.from('game_participants').update({
    hand_cards: playerCards,
    cards_remaining: playerCards.length,
  }).eq('id', allParticipants[i].id)
}
```

#### リスクシナリオ
```
時刻 T1: Player 1 にカード配布 → 成功
時刻 T2: Player 2 にカード配布 → ネットワークエラーで失敗
結果: Player 1 だけカードを持ち、Player 2 は空の手札
     デッキは18枚消費済み（巻き戻し不可能）
     ゲームが進行不能に
```

#### 影響
- **データ整合性の破綻**
- リカバリー不可能な状態
- ゲーム再開不可

---

### 問題3: game_actions.action_type の不一致（HIGH Priority）

#### DB制約定義
```sql
CHECK (action_type IN (
  'join_game',      -- ゲーム参加
  'leave_game',     -- ゲーム退出
  'start_game',     -- ゲーム開始
  'make_claim',     -- カード主張
  'guess_truth',    -- 真実と予想
  'guess_lie',      -- 嘘と予想
  'pass_card',      -- カードパス
  'pass_back',      -- カード返却
  'receive_penalty',-- ペナルティ受取
  'game_end'        -- ゲーム終了
))
```

#### 実際のコード
```typescript
// gameLogic.ts で使用中
action_type: 'claim',    // ← DB制約違反（'make_claim'が正しい）
action_type: 'respond',  // ← DB制約違反（'guess_truth' or 'guess_lie'）
action_type: 'pass',     // ← DB制約違反（'pass_card'が正しい）
```

#### 影響
- 現在: CHECK制約が無効化されているため動作
- 将来: 制約有効化時に**全てのINSERTが失敗**

---

### 問題4: 監査ログの不完全実装（MEDIUM Priority）

#### 記録状況
| アクション | REST API | Socket.IO | 実装箇所 |
|-----------|----------|-----------|---------|
| join_game | ❌ 未実装 | ❌ 未実装 | - |
| start_game | ❌ 未実装 | - | - |
| make_claim | ✅ 実装済み | ❌ 未実装 | gameLogic.ts:144 |
| guess_truth/lie | ✅ 実装済み | ❌ 未実装 | gameLogic.ts:314 |
| pass_card | ✅ 実装済み | ❌ 未実装 | gameLogic.ts:418 |
| receive_penalty | ❌ 未実装 | ❌ 未実装 | - |
| game_end | ❌ 未実装 | ❌ 未実装 | - |
| leave_game | ❌ 未実装 | ❌ 未実装 | - |

#### 影響
- 不正行為の検出不可能
- デバッグ困難
- コンプライアンス違反の可能性

---

### 問題5: game_rounds.final_guesser_id の外部キー違反（LOW Priority）

#### DB構造
```sql
game_rounds.final_guesser_id → game_participants.id (UUIDを参照)
```

#### 実装
```typescript
// gameLogic.ts:242
await supabase.from('game_rounds').update({
  final_guesser_id: userId,  // ← これは public_profiles.id
  // 正しくは game_participants.id が必要
})
```

#### 影響
- 外部キー制約違反の可能性
- 現在動作しているなら制約が無効化されている

---

## 🏗️ アーキテクチャ設計原則

### サーバー権威型アーキテクチャのベストプラクティス

#### 1. Single Source of Truth
```
ビジネスロジックは1箇所に集約
  ↓
services/ レイヤーに全ロジックを配置
  ↓
routes/ と socket/ は薄いアダプター層
```

#### 2. レイヤー分離
```
Presentation Layer (routes/ + socket/)
  ↓ 入力検証、認証のみ
Service Layer (services/)
  ↓ ビジネスロジック、トランザクション管理
Data Layer (supabase + migrations/)
  ↓ データ永続化、制約
```

#### 3. トランザクション管理
```
複数のDB操作 → Stored Function化
  ↓
ACID保証
  ↓
部分的な失敗を防止
```

---

## 📁 推奨ファイル構成

### 改善後の構造
```
backend/src/
├── routes/              # Thin Controllers（認証・バリデーションのみ）
│   ├── rooms.ts         # → roomService呼び出しに変更
│   └── games.ts         # → gameService呼び出しに変更
│
├── socket/              # Thin Event Handlers（認証・ブロードキャストのみ）
│   ├── RoomHandler.ts   # → roomService呼び出しに変更
│   └── GameHandler.ts   # → gameService呼び出しに変更（★要修正）
│
├── services/            # Business Logic（全ロジックをここに集約）
│   ├── gameService.ts   # ゲームロジック（gameLogic.tsをリネーム）
│   ├── roomService.ts   # ルーム管理ロジック（★新規作成）
│   └── auditService.ts  # 監査ログ統一（★新規作成）
│
└── lib/
    └── supabase.ts      # DB接続
```

### 各ファイルの責任

#### services/gameService.ts（gameLogic.tsをリネーム）
```typescript
// ゲームプレイのビジネスロジック
export async function processCardClaim(...)
export async function processClaimResponse(...)
export async function processCardPass(...)
export async function getGameState(...)
```

#### services/roomService.ts（新規作成）
```typescript
// ルーム管理のビジネスロジック
export async function createRoom(...)
export async function joinRoom(...)
export async function startGame(...)  // ← rooms.ts:POST /:id/start のロジックを移動
export async function leaveRoom(...)  // ← 新規実装
```

#### services/auditService.ts（新規作成）
```typescript
// 監査ログの統一インターフェース
export async function logAction(
  gameId: string,
  playerId: string,
  actionType: ActionType,  // 型安全な定数
  actionData: unknown
): Promise<void>

// 全ての action_type を定数で定義
export const ActionType = {
  JOIN_GAME: 'join_game',
  LEAVE_GAME: 'leave_game',
  START_GAME: 'start_game',
  MAKE_CLAIM: 'make_claim',
  GUESS_TRUTH: 'guess_truth',
  GUESS_LIE: 'guess_lie',
  PASS_CARD: 'pass_card',
  RECEIVE_PENALTY: 'receive_penalty',
  GAME_END: 'game_end',
} as const
```

---

## 📋 段階的実装計画

### Phase 1: 緊急修正（HIGH Priority）

#### H1: GameHandler.ts を gameService.ts に統合
**目的**: ロジックの二重実装を解消、バグ修正

**作業内容**:
1. `socket/GameHandler.ts` の独自ロジックを削除
2. `services/gameService.ts` の関数を呼び出すように変更
3. ブロードキャスト処理のみ GameHandler に残す

**変更ファイル**:
- `src/socket/GameHandler.ts` - 100行削減予定

**修正例**:
```typescript
// Before: 独自実装（バグあり）
async function handleClaimCard(io, socket, data) {
  const roundId = randomUUID()
  const { error } = await supabase.from('game_rounds').insert({
    current_card: { type: data.claimed_creature, id: randomUUID() }, // バグ
  })
  // ...
}

// After: gameService呼び出し
import { processCardClaim } from '../services/gameService.js'

async function handleClaimCard(io, socket, data) {
  const result = await processCardClaim(data.room_id, socket.userId, {
    cardId: data.card_id,
    claimedCreature: data.claimed_creature,
    targetPlayerId: data.target_player_id,
  })

  if (!result.success) {
    emitGameActionError(socket, { message: result.error })
    return
  }

  // ブロードキャストのみ
  io.to(data.room_id).emit('card_claimed', {
    claiming_player_id: socket.userId,
    claimed_creature: data.claimed_creature,
    round_id: result.data.roundId,
  })
}
```

**検証方法**:
- Socket.IO経由でカード主張
- game_rounds に正しいカードが記録されることを確認
- ペナルティ判定が正常動作することを確認

**期待効果**:
- バグ修正（current_card プレースホルダー問題）
- コード重複削減（~100行）
- メンテナンス性向上

---

#### H2: POST /api/rooms/:id/start のトランザクション化
**目的**: カード配布の原子性保証

**作業内容**:
1. Stored Function `start_game_and_deal_cards` を作成
2. `routes/rooms.ts` のカード配布ループを削除
3. RPC呼び出しに変更

**新規ファイル**:
- Migration: `add_start_game_transaction_function.sql`

**Migration内容**:
```sql
CREATE OR REPLACE FUNCTION start_game_and_deal_cards(
  p_game_id UUID,
  p_cards_per_player INTEGER,
  p_game_deck JSONB
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  current_turn_player_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant RECORD;
  v_deck_index INTEGER := 0;
  v_player_cards JSONB;
  v_first_player UUID;
BEGIN
  -- ゲーム状態をロック（FOR UPDATE）
  PERFORM 1 FROM games WHERE id = p_game_id FOR UPDATE;

  -- 参加者数確認
  IF (SELECT COUNT(*) FROM game_participants WHERE game_id = p_game_id) != 2 THEN
    RETURN QUERY SELECT false, 'Exactly 2 players required', NULL::UUID;
    RETURN;
  END IF;

  -- 全参加者にカード配布（同一トランザクション内）
  FOR v_participant IN
    SELECT id, player_id FROM game_participants
    WHERE game_id = p_game_id
    ORDER BY position
  LOOP
    -- デッキから抽出
    v_player_cards := p_game_deck[v_deck_index:v_deck_index+p_cards_per_player-1];

    UPDATE game_participants
    SET
      hand_cards = v_player_cards,
      cards_remaining = p_cards_per_player
    WHERE id = v_participant.id;

    -- 最初のプレイヤーを記録
    IF v_first_player IS NULL THEN
      v_first_player := v_participant.player_id;
    END IF;

    v_deck_index := v_deck_index + p_cards_per_player;
  END LOOP;

  -- ゲーム開始
  UPDATE games
  SET
    status = 'in_progress',
    current_turn_player_id = v_first_player,
    round_number = 1,
    game_deck = p_game_deck[v_deck_index:],  -- 残りカード（6枚）
    updated_at = NOW()
  WHERE id = p_game_id;

  RETURN QUERY SELECT true, 'Game started successfully', v_first_player;
END;
$$;

GRANT EXECUTE ON FUNCTION start_game_and_deal_cards TO service_role;
```

**routes/rooms.ts 修正**:
```typescript
// Before: ループでカード配布（非アトミック）
for (let i = 0; i < allParticipants.length; i++) {
  await supabase.from('game_participants').update(...)
}

// After: RPC呼び出し（アトミック）
const { data: result, error } = await supabase.rpc('start_game_and_deal_cards', {
  p_game_id: gameId,
  p_cards_per_player: 9,
  p_game_deck: gameDeck,
})

if (error || !result || !result[0].success) {
  return c.json({ error: result?.[0]?.message || 'Failed to start game' }, 500)
}
```

**検証方法**:
- 2人のプレイヤーでゲーム開始
- 各プレイヤーが9枚ずつ取得
- デッキに6枚残ることを確認
- ネットワークエラー時のロールバック確認

**期待効果**:
- ACID保証（部分的失敗の防止）
- パフォーマンス向上（DB往復削減）
- エラーハンドリング改善

---

#### H3: game_actions の action_type 修正
**目的**: DB制約との整合性確保

**作業内容**:
1. `services/auditService.ts` 新規作成
2. 全ての action_type を定数化
3. `gameService.ts` を auditService 使用に変更

**新規ファイル**:
- `src/services/auditService.ts`

**auditService.ts 実装**:
```typescript
import { getSupabase } from '../lib/supabase.js'

// DB制約と一致する定数定義
export const ActionType = {
  JOIN_GAME: 'join_game',
  LEAVE_GAME: 'leave_game',
  START_GAME: 'start_game',
  MAKE_CLAIM: 'make_claim',
  GUESS_TRUTH: 'guess_truth',
  GUESS_LIE: 'guess_lie',
  PASS_CARD: 'pass_card',
  PASS_BACK: 'pass_back',
  RECEIVE_PENALTY: 'receive_penalty',
  GAME_END: 'game_end',
} as const

export type ActionTypeValue = typeof ActionType[keyof typeof ActionType]

export interface LogActionParams {
  gameId: string
  roundId?: string | null
  playerId: string
  actionType: ActionTypeValue
  actionData: unknown
}

export async function logAction(params: LogActionParams): Promise<void> {
  const supabase = getSupabase()

  const { error } = await supabase.from('game_actions').insert({
    game_id: params.gameId,
    round_id: params.roundId || null,
    player_id: params.playerId,
    action_type: params.actionType,
    action_data: params.actionData,
  })

  if (error) {
    console.error('[AuditService] Failed to log action:', error)
    // ログ記録失敗は致命的ではないので throw しない
  }
}
```

**gameService.ts 修正**:
```typescript
import { logAction, ActionType } from './auditService.js'

// Line 144-154: カード主張のログ
await logAction({
  gameId,
  roundId: newRound.id,
  playerId: userId,
  actionType: ActionType.MAKE_CLAIM,  // ← 'claim' から修正
  actionData: {
    card: claimedCard,
    claimed_creature: claimedCreature,
    target_player: targetPlayerId,
  },
})

// Line 314-324: 応答のログ
await logAction({
  gameId,
  roundId,
  playerId: userId,
  actionType: believeClaim ? ActionType.GUESS_TRUTH : ActionType.GUESS_LIE,  // ← 分岐
  actionData: {
    believed_claim: believeClaim,
    claim_was_truthful: claimIsTruthful,
    penalty_receiver: penaltyReceiverId,
  },
})

// Line 418-428: パスのログ
await logAction({
  gameId,
  roundId,
  playerId: userId,
  actionType: ActionType.PASS_CARD,  // ← 'pass' から修正
  actionData: {
    target_player: targetPlayerId,
    new_claim: newClaim,
    pass_count: newPassCount,
  },
})
```

**検証方法**:
- 各アクション実行後、game_actions テーブル確認
- action_type が DB制約に一致することを確認
- TypeScriptの型チェックでエラーがないこと確認

**期待効果**:
- DB制約違反の防止
- 型安全性の向上
- コードの可読性向上

---

### Phase 2: 機能強化（MEDIUM Priority）

#### M3-1: join_game アクション記録
**ファイル**: `src/routes/rooms.ts POST /join`

**修正箇所**: Line 232（join成功後）
```typescript
import { logAction, ActionType } from '../services/auditService.js'

// Success後にログ記録
await logAction({
  gameId,
  roundId: null,
  playerId: user.userId,
  actionType: ActionType.JOIN_GAME,
  actionData: {
    position: joinResult.participant_position,
    joined_at: new Date().toISOString(),
  },
})
```

---

#### M3-2: start_game アクション記録
**ファイル**: `src/routes/rooms.ts POST /:id/start`

**修正箇所**: Line 324（ゲーム開始成功後）
```typescript
await logAction({
  gameId,
  roundId: null,
  playerId: user.userId,
  actionType: ActionType.START_GAME,
  actionData: {
    participant_count: 2,
    cards_per_player: 9,
    first_player: result[0].current_turn_player_id,
    started_at: new Date().toISOString(),
  },
})
```

---

#### M3-3: receive_penalty アクション記録
**ファイル**: `src/services/gameService.ts processClaimResponse`

**修正箇所**: Line 278（ペナルティ更新後）
```typescript
import { logAction, ActionType } from './auditService.js'

// ペナルティ記録後
await logAction({
  gameId,
  roundId,
  playerId: penaltyReceiverId,
  actionType: ActionType.RECEIVE_PENALTY,
  actionData: {
    creature_type: actualCreature,
    penalty_count: updatedPenalties.length,
    has_lost: hasLost,
    losing_creature_type: hasLost ? actualCreature : null,
  },
})
```

---

#### M3-4: game_end アクション記録
**ファイル**: `src/services/gameService.ts processClaimResponse`

**修正箇所**: Line 298（ゲーム終了時）
```typescript
if (gameOver) {
  await logAction({
    gameId,
    roundId,
    playerId: winnerId,
    actionType: ActionType.GAME_END,
    actionData: {
      winner_id: winnerId,
      loser_id: penaltyReceiverId,
      total_rounds: game.round_number,
      ended_at: new Date().toISOString(),
    },
  })
}
```

---

### Phase 3: 将来の改善（LOW Priority）

#### L1: final_guesser_id の外部キー修正
**ファイル**: `src/services/gameService.ts:242`

**問題**:
```typescript
final_guesser_id: userId,  // ← public_profiles.id (誤り)
```

**修正**:
```typescript
// userId は public_profiles.id
// final_guesser_id は game_participants.id が必要

// 1. current round の target_player の participant.id を取得
const { data: targetParticipant } = await supabase
  .from('game_participants')
  .select('id')
  .eq('game_id', gameId)
  .eq('player_id', userId)
  .single()

// 2. game_participants.id を使用
await supabase.from('game_rounds').update({
  final_guesser_id: targetParticipant.id,  // ✅ 正しい
  // ...
})
```

---

#### L2: leave_game 機能の実装
**新規エンドポイント**: `POST /api/rooms/:id/leave`

**実装**:
```typescript
// routes/rooms.ts
rooms.post('/:id/leave', authMiddleware, async c => {
  const gameId = c.req.param('id')
  const user = c.get('user')

  // ゲーム進行中は退出不可
  const { data: game } = await supabase
    .from('games')
    .select('status')
    .eq('id', gameId)
    .single()

  if (game?.status === 'in_progress') {
    return c.json({ error: 'Cannot leave game in progress' }, 400)
  }

  // 参加者削除
  await supabase
    .from('game_participants')
    .delete()
    .eq('game_id', gameId)
    .eq('player_id', user.userId)

  // ログ記録
  await logAction({
    gameId,
    roundId: null,
    playerId: user.userId,
    actionType: ActionType.LEAVE_GAME,
    actionData: { left_at: new Date().toISOString() },
  })

  return c.json({ message: 'Left game successfully' })
})
```

---

#### L3: roomService.ts の作成
**目的**: ルーム管理ロジックをサービス層に移動

**新規ファイル**: `src/services/roomService.ts`

**実装**:
```typescript
export async function createRoomWithCreator(
  creatorId: string,
  timeLimitSeconds: number,
  gameDeck: unknown[]
) {
  // create_game_with_participant RPC呼び出し
  // 現在の rooms.ts:77-114 のロジックを移動
}

export async function joinRoomSafely(
  gameId: string,
  playerId: string
) {
  // join_game_safe RPC呼び出し
  // 現在の rooms.ts:202-233 のロジックを移動
}

export async function startGameWithDeal(
  gameId: string,
  creatorId: string
) {
  // start_game_and_deal_cards RPC呼び出し
  // 現在の rooms.ts:285-329 のロジックを移動
}
```

**routes/rooms.ts の変更**:
```typescript
import { createRoomWithCreator, joinRoomSafely, startGameWithDeal } from '../services/roomService.js'

// POST /create
rooms.post('/create', createRoomRateLimit, authMiddleware, validator(...), async c => {
  const result = await createRoomWithCreator(user.userId, timeLimitSeconds, gameDeck)
  return c.json({ game: result })
})
```

---

## 🧪 テスト戦略

### Phase 1 検証

#### H1: GameHandler統合
```bash
# Socket.IO経由でゲームプレイ
1. 2人のプレイヤーでゲーム作成・参加・開始
2. Socket.IO接続後、claim_card イベント送信
3. game_rounds.current_card が実際のカードであることを確認
4. respond_to_claim でペナルティ判定が正常動作を確認
```

**期待結果**:
- ✅ current_card に実際のカードデータ
- ✅ ペナルティが正しく付与される
- ✅ game_actions にログ記録される

#### H2: ゲーム開始トランザクション
```bash
# ネットワーク障害シミュレーション
1. Stored Function の途中でエラーを強制発生
2. ロールバックが発生することを確認
3. game_participants.hand_cards が全員空のままであることを確認
```

**期待結果**:
- ✅ 部分的なカード配布が発生しない
- ✅ ゲームステータスが waiting のまま
- ✅ デッキが消費されていない

#### H3: action_type修正
```bash
# TypeScript型チェック + DBログ確認
1. npm run typecheck でエラーがないこと
2. ゲームプレイ後、game_actions テーブル確認
3. action_type が DB制約定義に一致すること
```

**期待結果**:
- ✅ 'make_claim', 'guess_truth', 'guess_lie', 'pass_card' が記録される
- ✅ TypeScriptの型エラーなし

---

### Phase 2 検証

#### M3: 監査ログ完全実装
```bash
# 全フロー実行
1. ゲーム作成 → join_game ログ確認
2. ゲーム開始 → start_game ログ確認
3. カード主張 → make_claim ログ確認
4. 応答 → guess_truth/guess_lie, receive_penalty ログ確認
5. ゲーム終了 → game_end ログ確認
```

**期待結果**:
- ✅ 全10種類の action_type が記録される
- ✅ action_data に必要な情報が含まれる

---

## 📊 実装進捗管理

### 作業チェックリスト

#### Phase 1（緊急修正）
- [ ] H1-1: auditService.ts 作成
- [ ] H1-2: gameService.ts を auditService使用に変更
- [ ] H1-3: GameHandler.ts を gameService呼び出しに変更
- [ ] H1-4: Socket.IO経由のゲームプレイ動作確認
- [ ] H2-1: Migration `add_start_game_transaction_function` 作成
- [ ] H2-2: rooms.ts POST /:id/start を RPC呼び出しに変更
- [ ] H2-3: ゲーム開始のトランザクション動作確認
- [ ] H3-1: gameLogic.ts のファイル名を gameService.ts にリネーム
- [ ] H3-2: 全ての action_type を ActionType定数に変更
- [ ] H3-3: TypeScript型チェック + ESLint確認

#### Phase 2（機能強化）
- [ ] M3-1: rooms.ts POST /join にログ追加
- [ ] M3-2: rooms.ts POST /:id/start にログ追加
- [ ] M3-3: gameService.ts processClaimResponse にペナルティログ追加
- [ ] M3-4: gameService.ts processClaimResponse にゲーム終了ログ追加
- [ ] M3-5: 全フロー実行で10種類のログ記録確認

#### Phase 3（将来の改善）
- [ ] L1: final_guesser_id の修正
- [ ] L2: POST /api/rooms/:id/leave 実装
- [ ] L3: roomService.ts 作成とロジック移動

---

## 🎯 成功基準

### Phase 1完了時
- ✅ Socket.IO経由のゲームプレイが正常動作
- ✅ ゲーム開始時のカード配布がアトミック
- ✅ game_actions に正しい action_type が記録される
- ✅ TypeScriptエラー0件、ESLintエラー0件

### Phase 2完了時
- ✅ 全10種類の action_type が記録される
- ✅ game_actions テーブルに全アクションの履歴が残る
- ✅ 監査証跡が完全

### Phase 3完了時
- ✅ 全ての外部キー制約が正しい
- ✅ leave_game 機能が動作
- ✅ サービス層の責任分離が完了

---

## 📝 メモ

### 重要な技術的決定
1. **gameLogic.ts → gameService.ts へリネーム**: サービス層であることを明確化
2. **auditService.ts 新規作成**: 監査ログの統一インターフェース
3. **Stored Function多用**: トランザクション保証のため
4. **ActionType定数**: DB制約との一致、型安全性

### リスク管理
- Phase 1 の H1 は GameHandler の大幅な変更を伴うため、慎重にテスト
- H2 の Migration は既存データに影響しないが、ロールバック手順を準備
- Phase 2 以降は Phase 1 完了後に実施（依存関係あり）

---

**次のステップ**: Phase 1 の H1-1（auditService.ts作成）から開始
