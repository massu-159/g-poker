#!/bin/bash

# Build Script for ごきぶりポーカー
# Automates the build process for iOS and Android

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    print_error "EAS CLI is not installed. Installing..."
    npm install -g @expo/eas-cli
fi

# Check if logged in to Expo
if ! eas whoami &> /dev/null; then
    print_warning "Not logged in to Expo. Please log in:"
    eas login
fi

# Build type (default to preview)
BUILD_TYPE=${1:-preview}
PLATFORM=${2:-all}

print_status "Building ごきぶりポーカー for $PLATFORM with $BUILD_TYPE profile"

# Pre-build checks
print_status "Running pre-build checks..."

# Check TypeScript
print_status "Checking TypeScript..."
npm run typecheck

# Run tests
print_status "Running tests..."
npm test -- --passWithNoTests

# Lint code
print_status "Linting code..."
npm run lint

print_status "Pre-build checks completed successfully"

# Build for specified platform
case $PLATFORM in
    ios)
        print_status "Building for iOS..."
        eas build --platform ios --profile $BUILD_TYPE
        ;;
    android)
        print_status "Building for Android..."
        eas build --platform android --profile $BUILD_TYPE
        ;;
    all)
        print_status "Building for all platforms..."
        eas build --platform all --profile $BUILD_TYPE
        ;;
    *)
        print_error "Invalid platform: $PLATFORM. Use 'ios', 'android', or 'all'"
        exit 1
        ;;
esac

print_status "Build completed successfully!"

# If production build, show submission instructions
if [ "$BUILD_TYPE" = "production" ]; then
    print_status "Production build completed!"
    print_warning "To submit to app stores, run:"
    echo "  iOS: eas submit --platform ios"
    echo "  Android: eas submit --platform android"
fi