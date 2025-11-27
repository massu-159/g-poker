# G-Poker Project Structure - Current State (2025-09-20)

## Project Overview
React Native application built with Expo, TypeScript, and Supabase backend.

## Directory Structure
```
/private/tmp/g-poker-temp/
├── .expo/                      # Expo configuration
├── .git/                       # Git repository
├── assets/                     # Static assets
├── dist/                       # Build output
├── node_modules/              # Dependencies
├── src/                       # Source code
│   ├── expo-app/              # Expo-specific app code
│   └── lib/                   # Shared libraries
│       ├── audit/             # Security audit system
│       ├── integration/       # Enterprise integration
│       ├── logging/           # Enterprise logging
│       └── security/          # Security utilities
├── supabase/                  # Supabase configuration
│   ├── config.toml            # Supabase config
│   └── migrations/            # Database migrations
├── app.json                   # Expo app configuration
├── App.tsx                    # Main app component
├── eas.json                   # EAS build configuration
├── index.ts                   # Entry point
├── package.json               # Dependencies and scripts
├── package-lock.json          # Dependency lock file
└── tsconfig.json              # TypeScript configuration
```

## Key Configuration Files

### package.json (Dependencies)
```json
{
  "name": "g-poker",
  "version": "1.0.0",
  "main": "index.ts",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  },
  "dependencies": {
    "expo": "latest",
    "@supabase/supabase-js": "latest",
    "react": "latest",
    "react-native": "latest"
  }
}
```

### app.json (Expo Configuration)
```json
{
  "expo": {
    "name": "G-Poker",
    "slug": "g-poker",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "platforms": ["ios", "android", "web"]
  }
}
```

## Source Code Structure

### src/lib/ (Enterprise Libraries)
- **audit/** - Security event processing system
- **integration/** - Enterprise system integration
- **logging/** - Structured logging with correlation IDs  
- **security/** - Cryptographic utilities and rate limiting

### src/expo-app/ (Application Code)
- React Native application components
- UI screens and navigation
- Game logic implementation

## Recent Major Changes (2025-09-20)

### Database Schema Simplifications:
1. **Removed Tables:**
   - `players` table (consolidated into `public_profiles`)
   - `audit_logs` table (removed for small-scale app)

2. **Removed Columns:**
   - `games.created_by`, `games.game_code`, `games.game_type`
   - `profiles.display_name`, `profiles.avatar_url`
   - `public_profiles.is_visible`

3. **Column Renames:**
   - `public_display_name` → `display_name`
   - `public_avatar_url` → `avatar_url`

4. **Direct References:**
   - `game_participants.player_id` → `public_profiles.id`
   - `game_actions.player_id` → `public_profiles.id`

### Enterprise Security Features:
- Correlation ID tracking system
- Structured audit logging
- Rate limiting capabilities
- Security event pipeline
- Verification status management

## Current Development State
- **Database**: Fully migrated and simplified
- **Backend**: Supabase with RLS policies
- **Frontend**: Expo React Native setup
- **Security**: Enterprise-grade logging and audit system
- **Documentation**: Being updated to match current state

## Next Steps
- Update documentation to match current DB schema
- Implement UI components for simplified data model
- Add game logic for poker mechanics
- Integrate security features with UI