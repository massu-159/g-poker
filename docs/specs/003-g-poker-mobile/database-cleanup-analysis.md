# Database Cleanup Analysis for Server-Authoritative Model

**Date**: 2025-11-01
**Project**: G-Poker Mobile (003-g-poker-mobile)
**Architecture**: Server-Authoritative (Backend service_role only)

## Executive Summary

This document analyzes the current G-Poker database configuration and identifies elements that are **unnecessary or incompatible** with the server-authoritative architecture, where:

- ✅ All DB operations go through Backend API (Hono + service_role)
- ✅ Mobile clients NEVER directly access the database
- ✅ Authentication/authorization happens at backend layer
- ❌ Public role should be completely blocked from DB operations

### Key Findings

| Category | Total | Remove | Keep | Modify |
|----------|-------|--------|------|--------|
| **RLS Policies** | 26 | 16 | 10 | 0 |
| **SECURITY DEFINER Functions** | 14 | 8 | 5 | 1 |
| **Triggers** | 7 | 1 | 6 | 0 |

---

## 1. RLS Policies Analysis

### 1.1 Summary

**Total Policies**: 26
- **Public role policies**: 16 (ALL should be removed)
- **Service role policies**: 10 (ALL should be kept)

### 1.2 Public Role Policies - REMOVE ALL (16 policies)

These policies were designed for client-side direct database access, which contradicts the server-authoritative model.

#### games table (2 policies)
```sql
-- ❌ REMOVE
DROP POLICY IF EXISTS "Authenticated users can create games" ON public.games;
DROP POLICY IF EXISTS "games_select_policy" ON public.games;
```

**Reason**: Backend creates games via service_role, clients never access directly.

#### game_participants table (4 policies)
```sql
-- ❌ REMOVE
DROP POLICY IF EXISTS "Players can view their game participants" ON public.game_participants;
DROP POLICY IF EXISTS "Players can join games through participants" ON public.game_participants;
DROP POLICY IF EXISTS "Players can update their own participation" ON public.game_participants;
DROP POLICY IF EXISTS "Players can view participants of their games" ON public.game_participants;
```

**Reason**: Backend manages all participant operations via service_role.

#### game_actions table (2 policies)
```sql
-- ❌ REMOVE
DROP POLICY IF EXISTS "Players can view actions in their games" ON public.game_actions;
DROP POLICY IF EXISTS "Players can create actions in their games" ON public.game_actions;
```

**Reason**: Backend validates and records all game actions via service_role.

#### game_rounds table (1 policy)
```sql
-- ❌ REMOVE
DROP POLICY IF EXISTS "Players can view rounds of their games" ON public.game_rounds;
```

**Reason**: Backend manages round lifecycle via service_role.

#### profiles table (2 policies)
```sql
-- ❌ REMOVE
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
```

**Reason**: Backend handles profile access via `/api/profile` endpoints with service_role.

#### public_profiles table (2 policies)
```sql
-- ❌ REMOVE
DROP POLICY IF EXISTS "Anyone can view public profiles" ON public.public_profiles;
DROP POLICY IF EXISTS "Users can update their own public profile" ON public.public_profiles;
```

**Reason**: Backend serves public profile data via API with service_role.

#### user_sessions table (2 policies)
```sql
-- ❌ REMOVE
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.user_sessions;
```

**Reason**: Backend manages sessions via service_role in authMiddleware.

#### user_preferences table (1 policy)
```sql
-- ❌ REMOVE
DROP POLICY IF EXISTS "Users can manage their own preferences" ON public.user_preferences;
```

**Reason**: Backend handles preference updates via `/api/profile/preferences` with service_role.

### 1.3 Service Role Policies - KEEP ALL (10 policies)

These policies allow the backend (service_role) to perform all necessary operations.

```sql
-- ✅ KEEP - Backend needs full access
-- games
"service_role can manage all games"
"service_role_all_access"

-- game_participants
"service_role_all_access"

-- game_actions
"service_role_all_access"

-- game_rounds
"service_role_all_access"

-- profiles
"service_role_all_access"

-- public_profiles
"service_role_all_access"

-- user_sessions
"service_role_all_access"

-- user_preferences
"service_role_all_access"

-- player_statistics
"service_role_all_access"

-- system_events
"service_role_all_access"
```

**Reason**: Backend (service_role) must perform all DB operations for server-authoritative model.

---

## 2. SECURITY DEFINER Functions Analysis

### 2.1 Summary

**Total SECURITY DEFINER Functions**: 14

SECURITY DEFINER functions execute with the creator's privileges (typically postgres), bypassing RLS. In the old client-access model, these were necessary to allow authenticated users to perform operations blocked by RLS.

In the **server-authoritative model**, the backend already uses service_role (which bypasses RLS), making most SECURITY DEFINER functions redundant.

### 2.2 REMOVE - Client-Side RLS Bypass Functions (8 functions)

These functions were designed to allow clients to bypass RLS for specific operations. **No longer needed** since clients don't access DB directly.

#### 2.2.1 get_game_details()
```sql
-- ❌ REMOVE
DROP FUNCTION IF EXISTS public.get_game_details(uuid);
```

**Current Purpose**: Allows clients to fetch game details bypassing RLS
**Backend Alternative**: Direct SELECT with service_role
```typescript
// Backend replacement
const { data } = await supabase
  .from('games')
  .select(`
    *,
    game_participants(*),
    game_rounds(*)
  `)
  .eq('id', gameId)
  .single()
```

#### 2.2.2 get_lobby_players()
```sql
-- ❌ REMOVE
DROP FUNCTION IF EXISTS public.get_lobby_players(uuid);
```

**Current Purpose**: Fetch lobby participants bypassing RLS
**Backend Alternative**: Direct SELECT with service_role
```typescript
const { data } = await supabase
  .from('game_participants')
  .select('*, public_profiles(*)')
  .eq('game_id', gameId)
```

#### 2.2.3 get_my_hand_cards()
```sql
-- ❌ REMOVE
DROP FUNCTION IF EXISTS public.get_my_hand_cards(uuid, uuid);
```

**Current Purpose**: Fetch player's hand cards bypassing RLS
**Backend Alternative**: Direct SELECT with service_role (backend never exposes other players' hands)
```typescript
const { data } = await supabase
  .from('hand_cards')
  .select('*')
  .eq('game_id', gameId)
  .eq('player_id', playerId)
```

#### 2.2.4 update_game_status()
```sql
-- ❌ REMOVE
DROP FUNCTION IF EXISTS public.update_game_status(uuid, text);
```

**Current Purpose**: Allow status updates bypassing RLS
**Backend Alternative**: Direct UPDATE with service_role
```typescript
await supabase
  .from('games')
  .update({ status: newStatus })
  .eq('id', gameId)
```

#### 2.2.5 create_user_session()
```sql
-- ❌ REMOVE
DROP FUNCTION IF EXISTS public.create_user_session(uuid, text, text, text, inet, text);
DROP FUNCTION IF EXISTS public.create_user_session(uuid, text, text, text, text, text, timestamp with time zone);
```

**Current Purpose**: Create session bypassing RLS (has 2 duplicate definitions)
**Backend Alternative**: Direct INSERT with service_role in `backend/src/routes/auth.ts:161-175`
```typescript
await supabase.from('user_sessions').insert({
  user_id: userId,
  session_token: accessToken,
  refresh_token: refreshToken,
  // ...
})
```

#### 2.2.6 initialize_user_preferences()
```sql
-- ❌ REMOVE (or convert to SECURITY INVOKER)
DROP FUNCTION IF EXISTS public.initialize_user_preferences(uuid);
```

**Current Purpose**: Initialize default preferences for new user
**Backend Alternative**: Direct INSERT with service_role during registration
```typescript
await supabase.from('user_preferences').insert({
  user_id: userId,
  theme: 'dark',
  language: 'en',
  sound_enabled: true
})
```

**Note**: Currently called in `backend/src/routes/auth.ts:132-136` but wrapped in try-catch as "optional"

#### 2.2.7 initialize_player_statistics()
```sql
-- ❌ REMOVE (or convert to SECURITY INVOKER)
DROP FUNCTION IF EXISTS public.initialize_player_statistics(uuid);
```

**Current Purpose**: Initialize player stats for new user
**Backend Alternative**: Direct INSERT with service_role during registration
```typescript
await supabase.from('player_statistics').insert({
  player_id: userId,
  games_played: 0,
  games_won: 0,
  // ...
})
```

**Note**: Currently called in `backend/src/routes/auth.ts:140-145` but wrapped in try-catch as "optional"

#### 2.2.8 Other RLS Bypass Functions
Any other functions with `SECURITY DEFINER` and `SET search_path` that are designed for client-side queries should be removed.

### 2.3 KEEP - Essential System Functions (5 functions)

These functions are triggered automatically or provide essential system functionality.

#### 2.3.1 handle_new_user()
```sql
-- ✅ KEEP
-- SECURITY DEFINER trigger function
```

**Purpose**: Automatically creates `profiles` and `public_profiles` when new user registers via Supabase Auth
**Trigger**: `on_auth_user_created` on `auth.users`
**Reason**: Triggered by Supabase Auth system, not by client or backend code
**Usage**: `backend/src/routes/auth.ts:112-121` relies on this trigger

#### 2.3.2 log_system_event()
```sql
-- ✅ KEEP
-- SECURITY DEFINER event logging function
```

**Purpose**: Log system events to `system_events` table
**Called From**: Backend at multiple points
**Reason**: Centralized logging function, useful for audit trail
**Usage Examples**:
- `backend/src/routes/auth.ts:185-196` (registration event)
- `backend/src/routes/auth.ts:321-326` (login event)
- `backend/src/socket/AuthHandler.ts:196-206` (WebSocket connection)

#### 2.3.3 update_*_updated_at() functions (5 functions)
```sql
-- ✅ KEEP
-- Automatic timestamp update triggers
```

**Functions**:
- `update_game_rounds_updated_at()`
- `update_games_updated_at()`
- `update_profiles_updated_at()`
- `update_public_profiles_updated_at()`
- `update_user_preferences_updated_at()`

**Purpose**: Automatically update `updated_at` timestamp on row modifications
**Reason**: Data integrity, prevents backend from forgetting to update timestamps
**Benefit**: Automatic, consistent timestamp tracking across all tables

### 2.4 MODIFY - Convert to SECURITY INVOKER (1 function)

#### 2.4.1 create_game_room() (if exists)
If this function exists and uses SECURITY DEFINER, it should be converted to SECURITY INVOKER or removed entirely.

**Current**: SECURITY DEFINER (bypasses RLS)
**Proposed**: Remove or convert to SECURITY INVOKER
**Reason**: Backend already uses service_role, no need for DEFINER privilege escalation

---

## 3. Triggers Analysis

### 3.1 Summary

**Total Triggers**: 7
- **Remove**: 1 (duplicate)
- **Keep**: 6 (data integrity)

### 3.2 REMOVE - Duplicate Triggers (1 trigger)

#### 3.2.1 Duplicate Player Count Triggers on game_participants

```sql
-- ❌ REMOVE ONE (duplicate functionality)
-- Keep: trigger_update_current_player_count
-- Remove: update_player_count_on_participant_change

DROP TRIGGER IF EXISTS update_player_count_on_participant_change ON public.game_participants;
```

**Issue**: Two triggers doing the same thing (updating player count)
- `trigger_update_current_player_count`
- `update_player_count_on_participant_change`

**Recommendation**: Keep one, remove the other

### 3.3 KEEP - Data Integrity Triggers (6 triggers)

These triggers maintain data consistency automatically.

#### 3.3.1 Player Count Update Trigger (1 trigger)
```sql
-- ✅ KEEP (one of the duplicates)
-- trigger_update_current_player_count ON game_participants
```

**Purpose**: Update `current_player_count` in `games` when participants join/leave
**Reason**: Ensures count stays synchronized with actual participants
**Benefit**: Backend doesn't need to manually calculate and update counts

#### 3.3.2 Timestamp Update Triggers (5 triggers)
```sql
-- ✅ KEEP ALL
-- update_game_rounds_updated_at ON game_rounds
-- update_games_updated_at ON games
-- update_profiles_updated_at ON profiles
-- update_public_profiles_updated_at ON public_profiles
-- update_user_preferences_updated_at ON user_preferences
```

**Purpose**: Automatically update `updated_at` column on row modifications
**Reason**: Data integrity, audit trail
**Benefit**: Backend doesn't need to remember to set `updated_at` in every UPDATE

---

## 4. Migration Strategy

### 4.1 Phase 1: Remove Public Role RLS Policies

```sql
-- Remove all 16 public role policies
DO $$
BEGIN
  -- games
  DROP POLICY IF EXISTS "Authenticated users can create games" ON public.games;
  DROP POLICY IF EXISTS "games_select_policy" ON public.games;

  -- game_participants
  DROP POLICY IF EXISTS "Players can view their game participants" ON public.game_participants;
  DROP POLICY IF EXISTS "Players can join games through participants" ON public.game_participants;
  DROP POLICY IF EXISTS "Players can update their own participation" ON public.game_participants;
  DROP POLICY IF EXISTS "Players can view participants of their games" ON public.game_participants;

  -- game_actions
  DROP POLICY IF EXISTS "Players can view actions in their games" ON public.game_actions;
  DROP POLICY IF EXISTS "Players can create actions in their games" ON public.game_actions;

  -- game_rounds
  DROP POLICY IF EXISTS "Players can view rounds of their games" ON public.game_rounds;

  -- profiles
  DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

  -- public_profiles
  DROP POLICY IF EXISTS "Anyone can view public profiles" ON public.public_profiles;
  DROP POLICY IF EXISTS "Users can update their own public profile" ON public.public_profiles;

  -- user_sessions
  DROP POLICY IF EXISTS "Users can view their own sessions" ON public.user_sessions;
  DROP POLICY IF EXISTS "Users can update their own sessions" ON public.user_sessions;

  -- user_preferences
  DROP POLICY IF EXISTS "Users can manage their own preferences" ON public.user_preferences;
END $$;
```

### 4.2 Phase 2: Remove SECURITY DEFINER Functions

```sql
-- Remove 8 client-side RLS bypass functions
DROP FUNCTION IF EXISTS public.get_game_details(uuid);
DROP FUNCTION IF EXISTS public.get_lobby_players(uuid);
DROP FUNCTION IF EXISTS public.get_my_hand_cards(uuid, uuid);
DROP FUNCTION IF EXISTS public.update_game_status(uuid, text);
DROP FUNCTION IF EXISTS public.create_user_session(uuid, text, text, text, inet, text);
DROP FUNCTION IF EXISTS public.create_user_session(uuid, text, text, text, text, text, timestamp with time zone);
DROP FUNCTION IF EXISTS public.initialize_user_preferences(uuid);
DROP FUNCTION IF EXISTS public.initialize_player_statistics(uuid);
```

### 4.3 Phase 3: Remove Duplicate Trigger

```sql
-- Remove duplicate player count trigger
DROP TRIGGER IF EXISTS update_player_count_on_participant_change ON public.game_participants;
```

### 4.4 Phase 4: Update Backend Code

After removing `initialize_user_preferences()` and `initialize_player_statistics()`, update backend registration logic:

**File**: `backend/src/routes/auth.ts`

```typescript
// Remove function calls, replace with direct INSERTs

// Initialize user preferences (lines 131-137)
await supabase.from('user_preferences').insert({
  user_id: authUser.user.id,
  theme: 'dark',
  language: 'en',
  sound_enabled: true,
  notifications_enabled: true
})

// Initialize player statistics (lines 139-145)
await supabase.from('player_statistics').insert({
  player_id: authUser.user.id,
  games_played: 0,
  games_won: 0,
  total_bluffs_called: 0,
  successful_bluffs: 0
})
```

---

## 5. Testing Checklist

After implementing the cleanup:

### 5.1 RLS Verification
- [ ] Verify public role CANNOT access any tables directly
- [ ] Verify service_role CAN access all tables
- [ ] Test backend API endpoints still work correctly

### 5.2 Function Verification
- [ ] Registration still creates profiles via `handle_new_user()` trigger
- [ ] System events still logged via `log_system_event()`
- [ ] Updated_at timestamps still update automatically

### 5.3 Backend Integration
- [ ] Registration flow works without `initialize_*` functions
- [ ] All game operations work without `get_*` and `update_*` functions
- [ ] Session management works without `create_user_session()` function

### 5.4 Security Testing
- [ ] Direct DB access from client fails with RLS error
- [ ] Forged JWT cannot access backend endpoints
- [ ] Rate limiting prevents abuse

---

## 6. Summary

### Elements to Remove (25 total)
- **16 RLS policies** for public role (client direct access)
- **8 SECURITY DEFINER functions** (RLS bypass for clients)
- **1 duplicate trigger** (player count update)

### Elements to Keep (21 total)
- **10 RLS policies** for service_role (backend access)
- **5 SECURITY DEFINER functions** (system triggers + logging)
- **6 triggers** (data integrity)

### Benefits
1. **Simplified Architecture**: Clear separation between client (no DB) and backend (full DB)
2. **Reduced Attack Surface**: No client-facing DB functions or policies
3. **Improved Security**: Public role completely blocked
4. **Better Maintainability**: Fewer DB objects to manage
5. **Clearer Intent**: Code explicitly shows backend handles all DB logic

### Risks
- **Breaking Changes**: Direct DB access from any legacy clients will fail
- **Function Dependencies**: Ensure no backend code calls removed functions
- **Testing Required**: Comprehensive testing needed to verify all flows work

---

## 7. Implementation Order

1. **Backup Database** - Create full backup before changes
2. **Remove Public RLS Policies** - Phase 1 (low risk, clients already blocked)
3. **Update Backend Code** - Replace function calls with direct DB operations
4. **Remove SECURITY DEFINER Functions** - Phase 2 (after backend updated)
5. **Remove Duplicate Trigger** - Phase 3 (low risk)
6. **Test All Flows** - Registration, login, game creation, joining, playing
7. **Security Audit** - Verify public role blocked, service_role works
8. **Deploy to Production** - After successful testing

---

**End of Analysis**
