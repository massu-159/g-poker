# Archived Test Files

This directory contains test files that are no longer actively maintained but are kept for historical reference.

## TDD Phase Tests (`tdd_phase/`)

Tests written during the Test-Driven Development (TDD) pre-implementation phase. These tests were designed to fail initially and validate that endpoints did not exist before implementation.

**Status:** Archived after implementation completion

**Files:**
- `test_auth_endpoints.simple.test.ts` - TDD validation tests for authentication endpoints
  - Originally expected 404 responses (endpoints not implemented)
  - Implementation completed in Phase-3 (認証エンドポイント実装)
  - Archived on: 2025-11-12

**Note:** These files are kept for reference but should not be executed in the active test suite.

---

For active tests, see:
- `tests/contracts/` - Contract tests for API endpoints
- `tests/e2e/` - End-to-end integration tests
- `tests/events/` - WebSocket event tests
- `tests/integration/` - Integration tests
