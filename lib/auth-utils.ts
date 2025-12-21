/**
 * Authentication Utilities
 * Handles password hashing, OTP generation, session management
 */

import bcrypt from 'bcryptjs'
import crypto from 'crypto'

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(password, salt)
}

/**
 * Verify a password against its hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Generate a 6-digit OTP code
 */
export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString()
}

/**
 * Generate a secure random token for sessions or invitations
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Generate a session token and expiry date
 * Default: 30 days
 */
export function generateSession(daysValid: number = 30): {
  token: string
  expiresAt: Date
} {
  const token = generateToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + daysValid)
  
  return { token, expiresAt }
}

/**
 * Generate OTP expiry date
 * Default: 10 minutes
 */
export function generateOTPExpiry(minutesValid: number = 10): Date {
  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + minutesValid)
  return expiresAt
}

/**
 * Generate invitation expiry date
 * Default: 7 days
 */
export function generateInvitationExpiry(daysValid: number = 7): Date {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + daysValid)
  return expiresAt
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate password strength
 * Requires: min 8 chars, 1 uppercase, 1 lowercase, 1 number
 */
export function isValidPassword(password: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Sanitize business name (remove special characters)
 */
export function sanitizeBusinessName(name: string): string {
  return name.trim().replace(/[^\w\s-]/g, '')
}

/**
 * Check if OTP has expired
 */
export function isOTPExpired(expiresAt: Date | string): boolean {
  const expiry = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt
  return expiry < new Date()
}

/**
 * Check if session has expired
 */
export function isSessionExpired(expiresAt: Date | string): boolean {
  const expiry = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt
  return expiry < new Date()
}

/**
 * Format error messages for API responses
 */
export function formatAuthError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'An unexpected error occurred'
}

/**
 * Validate business registration input
 */
export function validateBusinessRegistration(data: {
  businessName: string
  businessEmail: string
  ownerName: string
  password: string
  businessPhone?: string
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Business name
  if (!data.businessName || data.businessName.trim().length < 2) {
    errors.push('Business name must be at least 2 characters long')
  }
  
  // Business email
  if (!data.businessEmail || !isValidEmail(data.businessEmail)) {
    errors.push('Valid business email is required')
  }
  
  // Owner name
  if (!data.ownerName || data.ownerName.trim().length < 2) {
    errors.push('Owner name must be at least 2 characters long')
  }
  
  // Password
  const passwordValidation = isValidPassword(data.password)
  if (!passwordValidation.isValid) {
    errors.push(...passwordValidation.errors)
  }
  
  // Phone (optional but validate if provided)
  if (data.businessPhone && data.businessPhone.trim().length > 0) {
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/
    if (!phoneRegex.test(data.businessPhone.trim())) {
      errors.push('Invalid phone number format')
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Validate login input
 */
export function validateLoginInput(data: {
  email: string
  password: string
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!data.email || !isValidEmail(data.email)) {
    errors.push('Valid email is required')
  }
  
  if (!data.password || data.password.length < 1) {
    errors.push('Password is required')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Validate OTP code format
 */
export function validateOTPCode(code: string): boolean {
  return /^\d{6}$/.test(code)
}
