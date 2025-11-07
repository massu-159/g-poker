/**
 * Enterprise Security Utilities
 * Security validation, encryption, and audit helpers
 */

import { v4 as uuidv4 } from 'uuid';
import environment from '../../config/environment';

// UUID Generation utilities
export const generateUUID = (): string => {
  return uuidv4();
};

export const generateCorrelationId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2);
  return `${timestamp}-${random}`;
};

export const generateSessionId = (): string => {
  return `session_${generateUUID()}`;
};

// Security validation utilities
export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

export const isValidGameCode = (code: string): boolean => {
  // Game codes should be 6 uppercase alphanumeric characters
  const gameCodeRegex = /^[A-Z0-9]{6}$/;
  return gameCodeRegex.test(code);
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Data sanitization utilities
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>\"']/g, '') // Remove potentially dangerous characters
    .substring(0, 1000); // Limit length
};

export const sanitizeDisplayName = (name: string): string => {
  return sanitizeInput(name)
    .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Allow only alphanumeric, spaces, hyphens, underscores
    .substring(0, 100);
};

export const sanitizeGameSettings = (settings: Record<string, any>): Record<string, any> => {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(settings)) {
    if (typeof value === 'string') {
      sanitized[sanitizeInput(key)] = sanitizeInput(value);
    } else if (typeof value === 'number' && isFinite(value)) {
      sanitized[sanitizeInput(key)] = value;
    } else if (typeof value === 'boolean') {
      sanitized[sanitizeInput(key)] = value;
    }
    // Skip other types for security
  }

  return sanitized;
};

// Rate limiting utilities
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();

  constructor(
    private maxAttempts: number = environment.maxRetryAttempts,
    private windowMs: number = 60000 // 1 minute window
  ) {}

  public isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing attempts for this key
    let keyAttempts = this.attempts.get(key) || [];

    // Remove attempts outside the window
    keyAttempts = keyAttempts.filter(timestamp => timestamp > windowStart);

    // Check if we're within limits
    if (keyAttempts.length >= this.maxAttempts) {
      return false;
    }

    // Record this attempt
    keyAttempts.push(now);
    this.attempts.set(key, keyAttempts);

    return true;
  }

  public getRemainingAttempts(key: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let keyAttempts = this.attempts.get(key) || [];
    keyAttempts = keyAttempts.filter(timestamp => timestamp > windowStart);

    return Math.max(0, this.maxAttempts - keyAttempts.length);
  }

  public reset(key: string): void {
    this.attempts.delete(key);
  }
}

// Security context utilities
export interface SecurityContext {
  userId: string;
  sessionId: string;
  correlationId: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

export const createSecurityContext = (
  userId: string,
  options?: {
    sessionId?: string;
    correlationId?: string;
    ipAddress?: string;
    userAgent?: string;
  }
): SecurityContext => {
  return {
    userId,
    sessionId: options?.sessionId || generateSessionId(),
    correlationId: options?.correlationId || generateCorrelationId(),
    timestamp: new Date(),
    ipAddress: options?.ipAddress,
    userAgent: options?.userAgent,
  };
};

// Password strength validation
export const validatePasswordStrength = (password: string): {
  isValid: boolean;
  errors: string[];
  score: number;
} => {
  const errors: string[] = [];
  let score = 0;

  // Length check
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else {
    score += 1;
  }

  // Uppercase check
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else {
    score += 1;
  }

  // Lowercase check
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else {
    score += 1;
  }

  // Number check
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  } else {
    score += 1;
  }

  // Special character check
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  } else {
    score += 1;
  }

  // Additional length bonus
  if (password.length >= 12) {
    score += 1;
  }

  return {
    isValid: errors.length === 0,
    errors,
    score: Math.min(score, 5), // Max score of 5
  };
};

// Secure random string generation
export const generateSecureToken = (length: number = 32): string => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }

  return result;
};

// Input validation schemas
export const ValidationSchemas = {
  displayName: {
    minLength: 1,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s\-_]+$/,
  },
  gameCode: {
    length: 6,
    pattern: /^[A-Z0-9]{6}$/,
  },
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    maxLength: 255,
  },
  password: {
    minLength: 8,
    maxLength: 128,
  },
};

// Export singleton rate limiter instance
export const rateLimiter = new RateLimiter();

export default {
  generateUUID,
  generateCorrelationId,
  generateSessionId,
  isValidUUID,
  isValidGameCode,
  isValidEmail,
  sanitizeInput,
  sanitizeDisplayName,
  sanitizeGameSettings,
  RateLimiter,
  rateLimiter,
  createSecurityContext,
  validatePasswordStrength,
  generateSecureToken,
  ValidationSchemas,
};