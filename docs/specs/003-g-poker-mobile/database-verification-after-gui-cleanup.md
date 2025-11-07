# Database Verification After GUI Cleanup

**Date**: 2025-11-01
**Verified By**: Claude Code
**Status**: ⚠️ **CRITICAL ISSUES FOUND**

---

## Executive Summary

GUIでの削除操作により、**必要なデータベース要素が過剰に削除**されています。
特に、ゲーム関連テーブルのRLSポリシーとトリガーが完全に削除され、バックエンドの動作に支障をきたす可能性があります。

---

## 📊 Current State

### Tables (8 tables - ✅ CORRECT)

| Table | RLS Enabled | Policy Count | Status |
|-------|-------------|--------------|--------|
| `game_actions` | ✅ Yes | 0 | ❌ **Missing service_role policies** |
| `game_participants` | ✅ Yes | 0 | ❌ **Missing service_role policies** |
| `game_rounds` | ✅ Yes | 0 | ❌ **Missing service_role policies** |
| `games` | ✅ Yes | 0 | ❌ **Missing service_role policies** |
| `profiles` | ✅ Yes | 3 | ✅ Has service_role policies |
| `public_profiles` | ✅ Yes | 1 | ✅ Has service_role policies |
| `user_preferences` | ✅ Yes | 1 | ✅ Has service_role policies |
| `user_sessions` | ✅ Yes | 1 | ✅ Has service_role policies |

**Result**: ✅ Only MVP core tables remain, but ❌ **4 tables missing RLS policies**

### RLS Policies (6 policies - ⚠️ INCOMPLETE)

| Table | Policy Name | Role | Command |
|-------|-------------|------|---------|
| `profiles` | Service role can insert profiles | service_role | INSERT |
| `profiles` | Service role can select all profiles | service_role | SELECT |
| `profiles` | Service role can update profiles | service_role | UPDATE |
| `public_profiles` | Service role can insert public profiles | service_role | INSERT |
| `user_preferences` | Service role has full access to user_preferences | service_role | ALL |
| `user_sessions` | Service role has full access to user_sessions | service_role | ALL |

**Missing Policies**:
- ❌ `games` - No service_role policies
- ❌ `game_participants` - No service_role policies
- ❌ `game_rounds` - No service_role policies
- ❌ `game_actions` - No service_role policies

**Impact**: Backend will **FAIL** when trying to access game tables because RLS is enabled but no policies exist for service_role.

### Functions (3 functions - ⚠️ INCOMPLETE)

| Function | Arguments | Security | Status |
|----------|-----------|----------|--------|
| `handle_new_user` | - | SECURITY DEFINER | ✅ Kept (Supabase Auth trigger) |
| `log_system_event` | event_type, category, user_id, ... | SECURITY DEFINER | ✅ Kept (Used in backend) |
| `update_updated_at_column` | - | SECURITY INVOKER | ✅ Kept (Used by 3 triggers) |

**Missing Functions** (deleted but were being used):
- ❌ `get_player_current_games(p_player_id)` - Used in `users.ts:92`
- ❌ `get_user_activity_summary(p_user_id, days_back)` - Used in `users.ts:299`
- ❌ `check_achievement_progress(...)` - Used in `users.ts:437`
- ❌ `update_current_player_count()` - Trigger function for `game_participants`

**Impact**: Backend API endpoints will **FAIL** with "function not found" errors.

### Triggers (3 triggers - ❌ INCOMPLETE)

| Table | Trigger | Function | Timing | Events |
|-------|---------|----------|--------|--------|
| `profiles` | update_profiles_updated_at | update_updated_at_column | BEFORE | UPDATE |
| `public_profiles` | update_public_profiles_updated_at | update_updated_at_column | BEFORE | UPDATE |
| `user_preferences` | update_user_preferences_updated_at | update_updated_at_column | BEFORE | UPDATE |

**Missing Triggers** (deleted):
- ❌ `game_rounds.update_game_rounds_updated_at` - Timestamp update
- ❌ `games.update_games_updated_at` - Timestamp update
- ❌ `game_participants.trigger_update_current_player_count` - Player count sync

**Impact**:
- `updated_at` columns for game tables will not update automatically
- `games.current_player_count` will not sync when participants join/leave

---

## ❌ Critical Issues

### Issue 1: Game Tables Missing RLS Policies

**Problem**:
- `games`, `game_participants`, `game_rounds`, `game_actions` have RLS enabled but **no policies**
- Backend uses `service_role` but has no permissions

**Error Example**:
```
Error: new row violates row-level security policy for table "games"
```

**Required Fix**:
```sql
-- Add service_role policies for game tables
CREATE POLICY "service_role_all_access" ON public.games
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_access" ON public.game_participants
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_access" ON public.game_rounds
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_access" ON public.game_actions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

### Issue 2: Backend Functions Deleted

**Problem**:
- `get_player_current_games()`, `get_user_activity_summary()`, `check_achievement_progress()` were deleted
- These are actively called by backend code

**Error Example**:
```typescript
// users.ts:92
const { data: activeRooms } = await supabase.rpc('get_player_current_games', {
  p_player_id: user.userId,
})
// Error: function public.get_player_current_games(uuid) does not exist
```

**Required Fix**: Either:
1. **Option A**: Restore the deleted functions
2. **Option B**: Rewrite backend code to use direct SQL queries instead of RPC calls

### Issue 3: Missing Triggers

**Problem**:
- `update_current_player_count()` trigger function deleted
- `game_rounds.update_game_rounds_updated_at` trigger deleted
- `games.update_games_updated_at` trigger deleted

**Impact**:
- Player count will not auto-sync
- Timestamp columns will not auto-update

**Required Fix**:
```sql
-- Restore timestamp triggers
CREATE TRIGGER update_game_rounds_updated_at
  BEFORE UPDATE ON public.game_rounds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Restore player count trigger (requires function restoration first)
CREATE OR REPLACE FUNCTION update_current_player_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE games
    SET current_player_count = (
      SELECT COUNT(*)
      FROM game_participants
      WHERE game_id = NEW.game_id AND status != 'left'
    )
    WHERE id = NEW.game_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE games
    SET current_player_count = (
      SELECT COUNT(*)
      FROM game_participants
      WHERE game_id = OLD.game_id AND status != 'left'
    )
    WHERE id = OLD.game_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_current_player_count
  AFTER INSERT OR UPDATE OR DELETE ON public.game_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_current_player_count();
```

---

## ✅ What Was Correctly Cleaned

### Removed Elements (Good)

The following were correctly removed:
- ✅ All public role RLS policies (15 policies)
- ✅ Unused SECURITY DEFINER functions like:
  - `are_users_friends`
  - `calculate_leaderboard_rankings`
  - `create_new_poker_hand`
  - `search_poker_rooms`
  - etc.
- ✅ Unused trigger functions like:
  - `update_room_player_count`
  - `update_chat_room_stats`
  - `update_tournament_participant_count`

### Kept Elements (Good)

The following were correctly kept:
- ✅ `handle_new_user()` - Supabase Auth trigger
- ✅ `log_system_event()` - Audit logging
- ✅ `update_updated_at_column()` - Timestamp trigger function
- ✅ Service_role RLS policies for user-related tables

---

## 🔧 Required Actions (URGENT)

### Priority 1: Restore Missing RLS Policies

Create service_role policies for game tables immediately to prevent backend failures.

### Priority 2: Restore Backend Functions

**Option A - Restore Functions** (Recommended):
Restore the 3 deleted functions that backend depends on:
- `get_player_current_games(p_player_id)`
- `get_user_activity_summary(p_user_id, days_back)`
- `check_achievement_progress(p_player_id, p_achievement_type, p_new_value)`

**Option B - Rewrite Backend Code**:
Replace RPC calls with direct SQL queries in:
- `backend/src/routes/users.ts:92` (get_player_current_games)
- `backend/src/routes/users.ts:299` (get_user_activity_summary)
- `backend/src/routes/users.ts:437` (check_achievement_progress)

### Priority 3: Restore Missing Triggers

Restore:
- `game_rounds.update_game_rounds_updated_at`
- `games.update_games_updated_at`
- `game_participants.trigger_update_current_player_count` (requires function restoration)

---

## 📋 Recommended Cleanup (Optional)

The following can be safely removed if still present:

### None Found

All remaining elements appear to be essential for MVP operation.

---

## 🎯 Final State After Fixes

### Expected State

| Component | Expected Count | Current Count | Status |
|-----------|----------------|---------------|--------|
| **Tables** | 8 | 8 | ✅ |
| **RLS Policies** | 10 (6 current + 4 missing) | 6 | ❌ Need 4 more |
| **SECURITY DEFINER Functions** | 5 (2 current + 3 missing) | 2 | ❌ Need 3 more |
| **SECURITY INVOKER Functions** | 1 | 1 | ✅ |
| **Triggers** | 6 (3 current + 3 missing) | 3 | ❌ Need 3 more |

---

## 📊 Comparison: Before GUI Cleanup vs. Current

| Component | Before GUI Cleanup | After GUI Cleanup | Change |
|-----------|-------------------|-------------------|--------|
| **Tables** | 8 | 8 | ✅ No change |
| **RLS Policies** | 6 service_role | 6 service_role | ⚠️ But missing 4 for game tables |
| **SECURITY DEFINER** | 6 | 2 | ❌ 4 deleted (3 needed, 1 ok) |
| **Triggers** | 6 | 3 | ❌ 3 deleted (all needed) |

**Conclusion**: GUI cleanup went **too far** and deleted essential components.

---

## 🚨 Immediate Next Steps

1. **DO NOT deploy current state** - Backend will fail
2. **Create migration** to restore missing elements
3. **Test all API endpoints** after restoration
4. **Verify game functionality** (room creation, joining, playing)

---

**End of Verification Report**
