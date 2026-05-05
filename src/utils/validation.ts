/**
 * Data validation utilities for form inputs and data integrity
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate required field
 */
export function validateRequired(value: string | number | null | undefined, fieldName: string): ValidationResult {
  if (value === null || value === undefined || String(value).trim() === '') {
    return {
      isValid: false,
      error: `${fieldName} is required`
    };
  }
  return { isValid: true };
}

/**
 * Validate number within range
 */
export function validateNumber(
  value: number,
  fieldName: string,
  options: { min?: number; max?: number } = {}
): ValidationResult {
  if (isNaN(value)) {
    return {
      isValid: false,
      error: `${fieldName} must be a valid number`
    };
  }

  if (options.min !== undefined && value < options.min) {
    return {
      isValid: false,
      error: `${fieldName} must be at least ${options.min}`
    };
  }

  if (options.max !== undefined && value > options.max) {
    return {
      isValid: false,
      error: `${fieldName} must be at most ${options.max}`
    };
  }

  return { isValid: true };
}

/**
 * Validate date format and value
 */
export function validateDate(value: string, fieldName: string): ValidationResult {
  if (!value || value.trim() === '') {
    return {
      isValid: false,
      error: `${fieldName} is required`
    };
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return {
      isValid: false,
      error: `${fieldName} must be a valid date`
    };
  }

  return { isValid: true };
}

/**
 * Validate chemical format (X:YYYkgs)
 */
export function validateChemicalFormat(value: string): ValidationResult {
  if (!value || value.trim() === '') {
    return {
      isValid: false,
      error: 'Chemical amount is required'
    };
  }

  const pattern = /^\d+:\d{3}kgs$/;
  if (!pattern.test(value)) {
    return {
      isValid: false,
      error: 'Chemical must be in format X:YYYkgs (e.g., 1:050kgs)'
    };
  }

  return { isValid: true };
}

/**
 * Validate array not empty
 */
export function validateArrayNotEmpty<T>(
  arr: T[],
  fieldName: string
): ValidationResult {
  if (!arr || arr.length === 0) {
    return {
      isValid: false,
      error: `At least one ${fieldName} is required`
    };
  }

  return { isValid: true };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim() === '') {
    return {
      isValid: false,
      error: 'Email is required'
    };
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return {
      isValid: false,
      error: 'Invalid email format'
    };
  }

  return { isValid: true };
}

/**
 * Validate string length
 */
export function validateLength(
  value: string,
  fieldName: string,
  options: { min?: number; max?: number }
): ValidationResult {
  const length = value?.length || 0;

  if (options.min !== undefined && length < options.min) {
    return {
      isValid: false,
      error: `${fieldName} must be at least ${options.min} characters`
    };
  }

  if (options.max !== undefined && length > options.max) {
    return {
      isValid: false,
      error: `${fieldName} must be at most ${options.max} characters`
    };
  }

  return { isValid: true };
}

/**
 * Batch validate multiple fields
 */
export function validateMultiple(
  validations: (() => ValidationResult)[]
): ValidationResult {
  for (const validate of validations) {
    const result = validate();
    if (!result.isValid) {
      return result;
    }
  }

  return { isValid: true };
}

/**
 * Parse chemical string to number
 */
export function parseChemical(chemStr: string): number {
  if (!chemStr) return 0;
  
  const parts = chemStr.split(':');
  if (parts.length === 2) {
    const whole = parseInt(parts[0]) || 0;
    const decimalPart = parts[1].replace('kgs', '').padStart(3, '0');
    return parseFloat(`${whole}.${decimalPart}`);
  }
  
  return 0;
}

/**
 * Format number to chemical string
 */
export function formatChemical(value: number): string {
  const whole = Math.floor(value);
  const decimal = Math.round((value % 1) * 1000);
  return `${whole}:${String(decimal).padStart(3, '0')}kgs`;
}
