# Build Configuration for ごきぶりポーカー

This document outlines the build process and configuration for the ごきぶりポーカー React Native application.

## Prerequisites

### Development Environment
- Node.js 18+ and npm
- Expo CLI: `npm install -g @expo/cli`
- EAS CLI: `npm install -g @expo/eas-cli`
- Expo account and login: `eas login`

### Platform-Specific Requirements

#### iOS Development
- macOS with Xcode 14+
- iOS Deployment Target: 13.0+
- Apple Developer Account (for distribution)
- Provisioning profiles and certificates

#### Android Development
- Android SDK 34
- Minimum SDK: 21 (Android 5.0)
- Target SDK: 34
- Google Play Console account (for distribution)

## Build Profiles

### Development
```bash
npm run build:development
```
- Development client builds for internal testing
- Includes debugging tools and hot reloading
- Uses internal distribution

### Preview
```bash
npm run build:ios      # iOS preview build
npm run build:android  # Android preview build
npm run build          # All platforms preview
```
- Release builds for testing
- Optimized performance
- Internal distribution (TestFlight/Internal Testing)

### Production
```bash
npm run build:production
```
- Optimized builds for app store distribution
- Code minification and tree shaking enabled
- ProGuard enabled for Android
- Ready for App Store/Google Play submission

## Configuration Files

### app.json
Main Expo configuration with platform-specific settings:

- **Bundle Identifiers**: `com.gpoker.app`
- **App Name**: ごきぶりポーカー (Gokiburi Poker)
- **Version Management**: Semantic versioning
- **Permissions**: Minimal required permissions (INTERNET, WAKE_LOCK)
- **Localization**: Japanese and English support
- **Deep Linking**: Configured for `gpoker.app` domain

### eas.json
EAS Build configuration:

- **Resource Classes**: Optimized for build performance
- **Build Types**: Development, Preview, Production
- **Auto-increment**: Build numbers and version codes
- **Submission**: App Store and Google Play configuration

### metro.config.js
Metro bundler optimization:

- **Hermes Engine**: Enabled for better performance
- **Asset Optimization**: Optimized asset handling
- **Code Splitting**: Efficient bundle organization
- **Path Aliases**: Simplified import paths

## Build Process

### Automated Build Script
The `scripts/build.sh` script automates the entire build process:

1. **Pre-build Checks**
   - TypeScript compilation
   - ESLint code quality check
   - Test execution
   
2. **Platform Selection**
   - iOS, Android, or both platforms
   - Profile selection (development, preview, production)
   
3. **EAS Build Execution**
   - Cloud-based compilation
   - Automatic artifact generation
   - Build status notifications

### Manual Build Commands

#### Local Development
```bash
# Start development server
npm start

# Run on specific platforms
npm run ios
npm run android
npm run web
```

#### Cloud Builds
```bash
# Preview builds
eas build --platform ios --profile preview
eas build --platform android --profile preview

# Production builds
eas build --platform all --profile production
```

## Deployment

### Internal Testing
```bash
# Upload to TestFlight (iOS)
eas submit --platform ios

# Upload to Google Play Internal Testing (Android)
eas submit --platform android
```

### Production Release
```bash
# Deploy to both app stores
npm run deploy

# Platform-specific deployment
npm run deploy:ios
npm run deploy:android
```

### Over-the-Air Updates
```bash
# Deploy updates without app store submission
npm run update
```

## Asset Requirements

### App Icons
- **iOS**: 1024x1024 PNG (App Store)
- **Android**: 512x512 PNG (Adaptive icon)
- **Favicon**: 32x32 PNG (Web)

### Splash Screens
- **Universal**: 1242x2436 PNG
- **Background**: White (#ffffff)
- **Logo**: Centered, scalable

### Adaptive Icons (Android)
- **Foreground**: 432x432 PNG (safe area: 288x288)
- **Background**: Solid color or 432x432 PNG

## Build Optimization

### Performance Optimizations
- **Hermes Engine**: Faster startup and lower memory usage
- **ProGuard**: Android code obfuscation and size reduction
- **Resource Shrinking**: Unused resource removal
- **Bundle Splitting**: Efficient code organization

### Security Features
- **Certificate Pinning**: Secure API communications
- **Code Obfuscation**: Protection against reverse engineering
- **Encryption**: No sensitive data in plain text
- **Permission Minimization**: Only required permissions

## Environment Variables

### Build-time Variables
```bash
NODE_ENV=production    # Production builds
EAS_BUILD_PROFILE     # Current build profile
EXPO_PUBLIC_*         # Public environment variables
```

### App Configuration
```typescript
// Environment-specific configuration
const config = {
  development: {
    apiUrl: 'https://dev-api.gpoker.app',
    debug: true
  },
  production: {
    apiUrl: 'https://api.gpoker.app',
    debug: false
  }
};
```

## Troubleshooting

### Common Build Issues

#### iOS Build Failures
- **Provisioning Profile**: Ensure valid Apple Developer certificates
- **Bundle Identifier**: Must match registered App ID
- **Deployment Target**: iOS 13.0+ compatibility

#### Android Build Failures
- **Package Name**: Must be unique on Google Play
- **SDK Versions**: Ensure target SDK compatibility
- **Keystore**: Valid signing certificate required

#### Metro Bundle Issues
- **Cache Clear**: `npm start --clear-cache`
- **Node Modules**: `rm -rf node_modules && npm install`
- **Metro Reset**: `npx expo start --clear`

### Build Performance
- **Resource Classes**: Use appropriate EAS resource classes
- **Dependency Optimization**: Remove unused dependencies
- **Asset Optimization**: Compress images and fonts
- **Code Splitting**: Lazy load non-critical components

## Release Checklist

### Pre-Release
- [ ] All tests passing
- [ ] TypeScript compilation clean
- [ ] ESLint issues resolved
- [ ] Performance benchmarks met
- [ ] Security audit completed

### Build Configuration
- [ ] Version numbers updated
- [ ] Build profiles configured
- [ ] Environment variables set
- [ ] Asset files optimized

### Distribution
- [ ] App Store metadata prepared
- [ ] Screenshots and descriptions ready
- [ ] Privacy policy updated
- [ ] Terms of service reviewed

### Post-Release
- [ ] Build artifacts verified
- [ ] Distribution channels confirmed
- [ ] Monitoring and analytics enabled
- [ ] Rollback plan prepared

## Continuous Integration

### GitHub Actions (Future)
```yaml
name: Build and Deploy
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Build app
        run: eas build --platform all --non-interactive
```

## Support

For build-related issues:
1. Check EAS Build logs: `eas build:list`
2. Review configuration files
3. Validate environment setup
4. Contact development team

---

*Last updated: 2025-09-10*
*Build system: EAS Build*
*Platforms: iOS 13.0+, Android 5.0+ (API 21)*