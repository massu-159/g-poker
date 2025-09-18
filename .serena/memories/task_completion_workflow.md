# Task Completion Workflow

## Pre-Development Checks
Before starting any coding task:
1. **Read CLAUDE.md** - Check project context and recent changes
2. **Check git status** - Understand current branch and uncommitted changes
3. **Review related tests** - Ensure understanding of expected behavior

## During Development
1. **Follow TDD approach** - Write/update tests first when appropriate
2. **Run type checking** - `npm run typecheck` frequently
3. **Lint as you go** - `npm run lint` to catch issues early
4. **Test locally** - Use `npm run test` for unit tests

## Task Completion Checklist
After implementing any feature or fix:

### 1. Code Quality Verification
```bash
npm run lint                     # ESLint checks - MUST pass
npm run lint:fix                 # Auto-fix any fixable issues
npm run typecheck                # TypeScript checks - MUST pass
```

### 2. Test Validation
```bash
npm run test                     # Run full test suite (79+ tests)
npm run test:coverage            # Check test coverage if needed
```

### 3. Build Verification
```bash
npm run start                    # Ensure app starts without errors
# Test on multiple platforms if UI changes made:
# npx expo start --ios
# npx expo start --android  
# npx expo start --web
```

### 4. Database Operations (if applicable)
- **Supabase Cloud**: Verify database changes via Supabase Dashboard
- **RLS Policies**: Ensure Row Level Security still functions
- **Real-time**: Test live data synchronization

### 5. Performance Verification (if applicable)
- **Animations**: Ensure 60fps performance with built-in monitor
- **Memory**: Check memory usage via performance monitoring
- **Network**: Test offline scenarios and reconnection

## Integration Testing
For significant changes:
1. **Test real device** - Use `npx expo start --tunnel`
2. **Multi-player testing** - Test game flow with 2 devices/browser tabs
3. **Supabase integration** - Verify auth, database, and realtime

## Documentation Updates
- **Update CLAUDE.md** - For architectural changes
- **Update data-model.md** - For database schema changes
- **Add/update JSDoc** - For new public APIs

## Git Workflow
```bash
git add .                        # Stage changes
git commit -m "descriptive message"  # Commit with clear message
# Note: Only push/create PRs when explicitly requested
```

## Error Handling
- **Always implement proper error boundaries** 
- **Graceful degradation** for network failures
- **User-friendly error messages** in Japanese and English
- **Log errors** for debugging without exposing sensitive data

## Performance Requirements to Meet
- **<100ms** card action response time
- **<50ms** Supabase realtime event delivery  
- **60fps** animations during gameplay
- **<50MB** mobile app memory usage

## Common Debugging Steps
1. **Clear Metro cache**: `npx expo start --clear`
2. **Check Supabase Dashboard**: For database/auth issues
3. **React DevTools**: For component state debugging
4. **Network tab**: For API call inspection
5. **Console logs**: Check for runtime errors