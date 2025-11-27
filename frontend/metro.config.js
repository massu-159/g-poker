const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add path resolution for TypeScript path mappings
// Support both @/* (root/src) and @/src/* patterns
config.resolver.alias = {
  '@/src': path.resolve(__dirname, 'src'),
  '@/components': path.resolve(__dirname, 'src/components'),
  '@/services': path.resolve(__dirname, 'src/services'),
  '@/lib': path.resolve(__dirname, 'src/lib'),
  '@/types': path.resolve(__dirname, 'src/types'),
  '@/config': path.resolve(__dirname, 'src/config'),
  '@/stores': path.resolve(__dirname, 'src/stores'),
  '@/hooks': path.resolve(__dirname, 'src/hooks'),
  '@/screens': path.resolve(__dirname, 'src/screens'),
  '@/navigation': path.resolve(__dirname, 'src/navigation'),
  '@/constants': path.resolve(__dirname, 'src/constants'),
  '@': path.resolve(__dirname),
};

// Ensure proper resolution of source files
config.resolver.platforms = ['native', 'ios', 'android', 'web'];

module.exports = config;