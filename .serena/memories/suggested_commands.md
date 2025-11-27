# Essential Development Commands

## App Development & Running
```bash
# Start development server
npm run start                    # Start Expo dev server
npx expo start                   # Alternative start command
npx expo start --ios             # iOS Simulator
npx expo start --android         # Android Emulator  
npx expo start --web             # Web browser
npx expo start --clear           # Clear cache and start

# Development modes
npx expo start --tunnel          # Tunnel for physical device testing
npx expo start --dev-client      # Development client mode
```

## Code Quality & Testing
```bash
# Testing
npm run test                     # Run Jest tests (79+ tests)
npm run test:watch               # Run tests in watch mode
npm run test:coverage            # Generate test coverage report

# Code Quality
npm run lint                     # Run ESLint on src/ directory
npm run lint:fix                 # Auto-fix ESLint issues
npm run typecheck                # TypeScript type checking
```

## Build & Deployment
```bash
# Local builds
npm run prebuild                 # Expo prebuild (clean)
npm run build                    # Run build script
npm run build:ios               # iOS preview build
npm run build:android           # Android preview build
npm run build:production        # Production build (all platforms)
npm run build:development       # Development build (all platforms)

# EAS Deployment
npm run deploy                   # Submit to both app stores
npm run deploy:ios              # Submit to App Store
npm run deploy:android          # Submit to Google Play
npm run update                  # OTA update via EAS
```

## Database & Backend
```bash
# Note: This project uses Supabase Cloud (not local)
# Database operations via Supabase Dashboard or MCP tools
# No local database setup required
```

## System Commands (macOS/Darwin)
```bash
# File operations
ls -la                          # List files with details
find . -name "*.ts" -type f     # Find TypeScript files
grep -r "pattern" src/          # Search in source code
cd src/components               # Navigate to directory

# Git operations
git status                      # Check repository status
git log --oneline -10           # Recent commits
git diff                        # Show changes
git add .                       # Stage all changes
git commit -m "message"         # Commit changes

# Package management
npm install                     # Install dependencies
npm install --force            # Force install (if needed)
npm audit                      # Security audit
npx expo install package-name  # Expo-compatible package install
```

## Performance & Debugging
```bash
# Metro bundler
npx expo start --no-dev         # Production-like build
npx expo start --minify        # Minified JavaScript

# Debugging
npx expo start --dev            # Development mode (default)
npx expo start --lan           # LAN access for device testing
npx react-devtools             # React DevTools (if needed)
```

## Quick Workflows
```bash
# Full development cycle
npm run lint && npm run typecheck && npm run test && npm run start

# Code quality check before commit  
npm run lint:fix && npm run typecheck && npm run test

# Clean start (when having issues)
npm run start -- --clear
# or
npx expo start --clear --reset-cache
```