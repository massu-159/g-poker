/**
 * Metro Configuration for ごきぶりポーカー
 * Optimized bundler configuration for React Native builds
 */

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable Hermes for production builds only
if (process.env.NODE_ENV === 'production') {
  config.transformer.hermesCommand = 'hermes';
}

// Asset configuration for better optimization
config.resolver.assetExts = [
  ...(config.resolver.assetExts || []),
  // Image formats
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg',
  // Audio formats (if needed in future)
  'mp3', 'wav', 'aac',
  // Font formats
  'ttf', 'otf', 'woff', 'woff2',
  // Other assets
  'json'
];

// Platform-specific extensions - platforms option removed as it's not valid in Metro config

// Optimize for production builds
if (process.env.NODE_ENV === 'production') {
  // Enable minification
  config.transformer.minifierConfig = {
    keep_fnames: true,
    mangle: {
      keep_fnames: true,
    },
  };

  // Optimize asset handling
  config.transformer.assetRegistryPath = 'react-native/Libraries/Image/AssetRegistry';
}

// Watch folder configuration for monorepo setup (if needed)
config.watchFolders = [__dirname];

// Resolver configuration
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];
config.resolver.alias = {
  // Add any path aliases here if needed
  '@': './src',
  '@components': './src/components',
  '@screens': './src/screens',
  '@services': './src/services',
  '@lib': './src/lib',
  '@stores': './src/stores',
  '@hooks': './src/hooks',
};

// Platform-specific file extensions
config.resolver.sourceExts = [
  ...(config.resolver.sourceExts || []), 
  'web.js', 'web.ts', 'web.tsx'
];

// Source map configuration - Use default for development
if (process.env.NODE_ENV === 'production') {
  config.serializer.createModuleIdFactory = function () {
    return function (path) {
      // Use relative paths for smaller bundle size
      return require('crypto')
        .createHash('sha1')
        .update(path)
        .digest('base64')
        .substring(0, 8);
    };
  };
}

// Performance optimization for development
if (process.env.NODE_ENV === 'development') {
  config.transformer.enableBabelRCLookup = false;
  config.transformer.enableBabelRuntime = false;
}

module.exports = config;