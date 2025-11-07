/**
 * Security-Focused ESLint Configuration
 * Specialized configuration for security-only linting
 */

const securityPlugin = require('eslint-plugin-security');
const typescriptParser = require('@typescript-eslint/parser');

module.exports = [
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        project: './tsconfig.json',
      },
    },
    plugins: {
      'security': securityPlugin,
    },
    rules: {
      // Security rules - ALL ERRORS (no warnings for security)
      'security/detect-object-injection': 'error',
      'security/detect-non-literal-regexp': 'error',
      'security/detect-unsafe-regex': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-fs-filename': 'error',
      'security/detect-non-literal-require': 'error',
      'security/detect-possible-timing-attacks': 'error', // Upgraded from warn
      'security/detect-pseudoRandomBytes': 'error',

      // Additional security-focused rules
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-script-url': 'error',
      'no-caller': 'error',
      'no-new-func': 'error',
      'no-with': 'error',

      // Prevent dangerous patterns
      'no-console': 'warn', // Allow but warn for potential info leakage
      'no-debugger': 'error',
      'no-alert': 'error',
    },
  },
];