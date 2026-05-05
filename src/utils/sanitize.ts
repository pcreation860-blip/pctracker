/**
 * Input Sanitization Utilities
 * 
 * Protects against XSS, injection attacks, and malicious input
 */

/**
 * Sanitize text input to prevent XSS attacks
 */
export function sanitizeText(input: string): string {
  if (!input) return '';
  
  return input
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize HTML to remove dangerous tags and attributes
 */
export function sanitizeHTML(html: string): string {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

/**
 * Validate and sanitize URL
 */
export function sanitizeURL(url: string): string | null {
  try {
    const parsed = new URL(url);
    
    // Only allow https URLs
    if (parsed.protocol !== 'https:') {
      return null;
    }
    
    // Check for common XSS patterns in URL
    const dangerous = ['javascript:', 'data:', 'vbscript:', 'file:'];
    const lower = url.toLowerCase();
    if (dangerous.some(d => lower.includes(d))) {
      return null;
    }
    
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Validate image URL
 */
export function validateImageURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Must be HTTPS
    if (parsed.protocol !== 'https:') return false;
    
    // Check file extension
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const hasValidExt = validExtensions.some(ext => 
      parsed.pathname.toLowerCase().endsWith(ext)
    );
    
    return hasValidExt;
  } catch {
    return false;
  }
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .substring(0, 255);
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return null;
  }
  
  // Additional security checks
  if (trimmed.length > 254) return null;
  if (trimmed.includes('..')) return null;
  
  return trimmed;
}

/**
 * Sanitize number input
 */
export function sanitizeNumber(input: string, options?: {
  min?: number;
  max?: number;
  decimals?: number;
}): number | null {
  const cleaned = input.replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  
  if (isNaN(num) || !isFinite(num)) return null;
  
  if (options?.min !== undefined && num < options.min) return null;
  if (options?.max !== undefined && num > options.max) return null;
  
  if (options?.decimals !== undefined) {
    return parseFloat(num.toFixed(options.decimals));
  }
  
  return num;
}

/**
 * Sanitize chemical format (X:YYYkgs)
 */
export function sanitizeChemical(input: string): string | null {
  // Remove all non-numeric characters except : and kgs
  const cleaned = input.replace(/[^0-9:kgs]/gi, '');
  
  // Validate format
  const match = cleaned.match(/^(\d+):(\d{3})kgs$/i);
  if (!match) return null;
  
  return `${match[1]}:${match[2]}kgs`;
}

/**
 * Sanitize date string
 */
export function sanitizeDate(dateString: string): string | null {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    
    // Must be between 2020 and 2050
    if (date.getFullYear() < 2020 || date.getFullYear() > 2050) {
      return null;
    }
    
    return date.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

/**
 * Deep sanitize object (recursively sanitize all string properties)
 */
export function sanitizeObject<T>(obj: T): T {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as unknown as T;
  }
  
  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value);
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Validate production entry data
 */
export function validateProductionEntry(entry: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!entry.date || !sanitizeDate(entry.date)) {
    errors.push('Invalid date');
  }
  
  if (!entry.team || entry.team.trim().length === 0) {
    errors.push('Team is required');
  }
  
  if (!entry.partyName || entry.partyName.trim().length === 0) {
    errors.push('Party name is required');
  }
  
  if (!entry.designNo || entry.designNo.trim().length === 0) {
    errors.push('Design number is required');
  }
  
  const qty = sanitizeNumber(entry.qtyMeters?.toString() || '', { min: 0 });
  if (qty === null || qty <= 0) {
    errors.push('Quantity must be greater than 0');
  }
  
  if (!entry.chemical || !sanitizeChemical(entry.chemical)) {
    errors.push('Invalid chemical format (use X:YYYkgs)');
  }
  
  if (!Array.isArray(entry.colors) || entry.colors.every((c: string) => !c.trim())) {
    errors.push('At least one color is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
