/**
 * Form validation hooks for G-Poker
 * Provides reusable validation logic with real-time feedback
 */

import { useState, useEffect } from 'react';

export interface ValidationResult {
  isValid: boolean;
  error: string | null;
}

export interface PasswordStrength {
  score: number; // 0-4
  feedback: string[];
  isValid: boolean;
}

// Email validation regex (RFC 2822 compliant)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Validates email format
 */
export function validateEmail(email: string): ValidationResult {
  if (!email.trim()) {
    return { isValid: false, error: 'Email is required' };
  }

  if (!EMAIL_REGEX.test(email)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  return { isValid: true, error: null };
}

/**
 * Validates display name (3-20 characters)
 */
export function validateDisplayName(displayName: string): ValidationResult {
  if (!displayName.trim()) {
    return { isValid: false, error: 'Display name is required' };
  }

  const trimmed = displayName.trim();

  if (trimmed.length < 3) {
    return { isValid: false, error: 'Display name must be at least 3 characters long' };
  }

  if (trimmed.length > 20) {
    return { isValid: false, error: 'Display name must be no more than 20 characters long' };
  }

  // Check for valid characters (alphanumeric, spaces, hyphens, underscores)
  if (!/^[a-zA-Z0-9\s_-]+$/.test(trimmed)) {
    return { isValid: false, error: 'Display name can only contain letters, numbers, spaces, hyphens, and underscores' };
  }

  return { isValid: true, error: null };
}

/**
 * Validates username (3-30 characters, alphanumeric and underscores only)
 */
export function validateUsername(username: string): ValidationResult {
  if (!username.trim()) {
    return { isValid: false, error: 'Username is required' };
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters long' };
  }

  if (trimmed.length > 30) {
    return { isValid: false, error: 'Username must be no more than 30 characters long' };
  }

  // Check for valid characters (alphanumeric and underscores only)
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return { isValid: false, error: 'Username can only contain letters, numbers, and underscores' };
  }

  return { isValid: true, error: null };
}

/**
 * Validates password strength
 */
export function validatePassword(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  if (password.length === 0) {
    return {
      score: 0,
      feedback: ['Password is required'],
      isValid: false,
    };
  }

  // Length check
  if (password.length < 8) {
    feedback.push('Password must be at least 8 characters long');
  } else {
    score += 1;
  }

  // Lowercase check
  if (!/[a-z]/.test(password)) {
    feedback.push('Password must contain at least one lowercase letter');
  } else {
    score += 1;
  }

  // Uppercase check
  if (!/[A-Z]/.test(password)) {
    feedback.push('Password must contain at least one uppercase letter');
  } else {
    score += 1;
  }

  // Number check
  if (!/\d/.test(password)) {
    feedback.push('Password must contain at least one number');
  } else {
    score += 1;
  }

  // Special character check
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    feedback.push('Password should contain at least one special character');
  } else {
    score += 1;
  }

  // Length bonus
  if (password.length >= 12) {
    score += 1;
  }

  return {
    score: Math.min(score, 4),
    feedback,
    isValid: score >= 4, // Require all basic criteria
  };
}

/**
 * Validates password confirmation
 */
export function validatePasswordConfirmation(password: string, confirmation: string): ValidationResult {
  if (!confirmation.trim()) {
    return { isValid: false, error: 'Please confirm your password' };
  }

  if (password !== confirmation) {
    return { isValid: false, error: 'Passwords do not match' };
  }

  return { isValid: true, error: null };
}

/**
 * Hook for real-time form field validation
 */
export function useFieldValidation<T>(
  value: T,
  validator: (value: T) => ValidationResult,
  debounceMs: number = 300
) {
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true, error: null });
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched) return;

    const timer = setTimeout(() => {
      const result = validator(value);
      setValidation(result);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [value, validator, debounceMs, touched]);

  const markTouched = () => setTouched(true);

  return {
    validation,
    touched,
    markTouched,
  };
}

/**
 * Hook for password strength validation with real-time feedback
 */
export function usePasswordValidation(password: string, debounceMs: number = 300) {
  const [strength, setStrength] = useState<PasswordStrength>({
    score: 0,
    feedback: [],
    isValid: false,
  });
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched) return;

    const timer = setTimeout(() => {
      const result = validatePassword(password);
      setStrength(result);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [password, debounceMs, touched]);

  const markTouched = () => setTouched(true);

  return {
    strength,
    touched,
    markTouched,
  };
}

/**
 * Hook for complete form validation
 */
export function useFormValidation() {
  const [isValid, setIsValid] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (fields: Record<string, any>, validators: Record<string, (value: any) => ValidationResult>) => {
    const newErrors: Record<string, string> = {};
    let formIsValid = true;

    Object.keys(validators).forEach(fieldName => {
      const value = fields[fieldName];
      const validator = validators[fieldName];
      const result = validator(value);

      if (!result.isValid && result.error) {
        newErrors[fieldName] = result.error;
        formIsValid = false;
      }
    });

    setErrors(newErrors);
    setIsValid(formIsValid);

    return { isValid: formIsValid, errors: newErrors };
  };

  return {
    isValid,
    errors,
    validateForm,
  };
}