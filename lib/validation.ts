/**
 * Input validation and sanitization utilities
 * Prevents XSS, SQL injection, and other security issues
 */

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string | null | undefined): string {
  if (!input) return '';
  
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

/**
 * Sanitize HTML content (allows safe HTML but removes scripts)
 */
export function sanitizeHTML(input: string | null | undefined): string {
  if (!input) return '';
  
  // Remove script tags and event handlers
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}

/**
 * Validate email format
 */
export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string | null | undefined): boolean {
  if (!uuid) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid.trim());
}

/**
 * Validate ticket status
 */
export function isValidTicketStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const validStatuses = ['open', 'pending', 'on_hold', 'closed'];
  return validStatuses.includes(status.toLowerCase());
}

/**
 * Validate ticket priority
 */
export function isValidTicketPriority(priority: string | null | undefined): boolean {
  if (!priority) return false;
  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  return validPriorities.includes(priority.toLowerCase());
}

/**
 * Validate user role
 */
export function isValidUserRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const validRoles = ['admin', 'manager', 'agent'];
  return validRoles.includes(role.toLowerCase());
}

/**
 * Sanitize array of strings
 */
export function sanitizeStringArray(input: any): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item) => typeof item === 'string')
    .map((item) => sanitizeString(item))
    .filter((item) => item.length > 0);
}

/**
 * Validate and sanitize text input (max length)
 */
export function validateTextInput(
  input: string | null | undefined,
  maxLength: number = 10000,
  required: boolean = false
): { valid: boolean; sanitized: string; error?: string } {
  if (!input) {
    if (required) {
      return { valid: false, sanitized: '', error: 'This field is required' };
    }
    return { valid: true, sanitized: '' };
  }

  const sanitized = sanitizeString(input);
  
  if (sanitized.length > maxLength) {
    return {
      valid: false,
      sanitized: sanitized.substring(0, maxLength),
      error: `Input exceeds maximum length of ${maxLength} characters`,
    };
  }

  return { valid: true, sanitized };
}

/**
 * Validate date string (ISO format)
 */
export function isValidDate(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Sanitize JSON input
 */
export function sanitizeJSON(input: any): any {
  if (typeof input === 'string') {
    try {
      input = JSON.parse(input);
    } catch {
      return null;
    }
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeJSON(item));
  }

  if (input !== null && typeof input === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      const sanitizedKey = sanitizeString(key);
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = sanitizeString(value);
      } else {
        sanitized[sanitizedKey] = sanitizeJSON(value);
      }
    }
    return sanitized;
  }

  return input;
}

/**
 * Validate pagination parameters
 */
export function validatePagination(
  page: any,
  limit: any
): { valid: boolean; page: number; limit: number; error?: string } {
  const pageNum = parseInt(String(page || '1'), 10);
  const limitNum = parseInt(String(limit || '50'), 10);

  if (isNaN(pageNum) || pageNum < 1) {
    return { valid: false, page: 1, limit: 50, error: 'Invalid page number' };
  }

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return { valid: false, page: pageNum, limit: 50, error: 'Invalid limit (must be 1-100)' };
  }

  return { valid: true, page: pageNum, limit: limitNum };
}



