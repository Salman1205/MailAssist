/**
 * Session management utilities
 * Uses cookies to track which user is logged in on each device
 */

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'gmail_user_email';
const CURRENT_USER_ID_COOKIE_NAME = 'current_user_id';

/**
 * Get the current user's email from the session cookie
 */
export async function getSessionUserEmail(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    return userEmail || null;
  } catch (error) {
    // Cookies might not be available in all contexts
    return null;
  }
}

/**
 * Get the current user's email from request cookies (for use in API routes)
 */
export function getSessionUserEmailFromRequest(request: NextRequest): string | null {
  try {
    const userEmail = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    return userEmail || null;
  } catch (error) {
    return null;
  }
}

/**
 * Set the session cookie with user email
 * Works in both development and production (Vercel)
 */
export async function setSessionUserEmail(userEmail: string): Promise<void> {
  try {
    // In Vercel production, all requests are HTTPS, so secure should be true
    // Use VERCEL env var or NODE_ENV to detect production
    const isProduction = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, userEmail, {
      httpOnly: true,
      secure: isProduction, // true on Vercel (HTTPS), false in local dev (HTTP)
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    });
  } catch (error) {
    console.error('Error setting session cookie:', error);
  }
}

/**
 * Set the session cookie from a NextResponse (for use in API routes)
 * Works in both development and production (Vercel)
 */
export function setSessionUserEmailInResponse(
  response: NextResponse,
  userEmail: string
): NextResponse {
  try {
    // In Vercel production, all requests are HTTPS, so secure should be true
    // Use VERCEL env var or NODE_ENV to detect production
    const isProduction = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    
    response.cookies.set(SESSION_COOKIE_NAME, userEmail, {
      httpOnly: true,
      secure: isProduction, // true on Vercel (HTTPS), false in local dev (HTTP)
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    });
  } catch (error) {
    console.error('Error setting session cookie in response:', error);
  }
  return response;
}

/**
 * Clear the session cookie (logout)
 */
export async function clearSession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch (error) {
    console.error('Error clearing session cookie:', error);
  }
}

/**
 * Clear the session cookie from a NextResponse (for use in API routes)
 */
export function clearSessionInResponse(response: NextResponse): NextResponse {
  try {
    response.cookies.delete(SESSION_COOKIE_NAME);
    response.cookies.delete(CURRENT_USER_ID_COOKIE_NAME);
  } catch (error) {
    console.error('Error clearing session cookie in response:', error);
  }
  return response;
}

/**
 * Get current user ID from session cookie
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get(CURRENT_USER_ID_COOKIE_NAME)?.value;
    return userId || null;
  } catch (error) {
    return null;
  }
}

/**
 * Get current user ID from request cookies
 */
export function getCurrentUserIdFromRequest(request: NextRequest): string | null {
  try {
    const userId = request.cookies.get(CURRENT_USER_ID_COOKIE_NAME)?.value;
    return userId || null;
  } catch (error) {
    return null;
  }
}

/**
 * Set current user ID in session cookie
 */
export async function setCurrentUserId(userId: string): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(CURRENT_USER_ID_COOKIE_NAME, userId, {
      httpOnly: true,
      secure: process.env.VERCEL === '1' || process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    });
  } catch (error) {
    console.error('Error setting current user ID cookie:', error);
  }
}

/**
 * Set current user ID in NextResponse
 */
export function setCurrentUserIdInResponse(
  response: NextResponse,
  userId: string
): NextResponse {
  try {
    const isProduction = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    response.cookies.set(CURRENT_USER_ID_COOKIE_NAME, userId, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    });
  } catch (error) {
    console.error('Error setting current user ID in response:', error);
  }
  return response;
}

