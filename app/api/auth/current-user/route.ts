/**
 * Get current user from session
 * Verifies that the user belongs to the current Gmail account
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserIdFromRequest, getSessionUserEmailFromRequest } from '@/lib/session';
import { getUserById } from '@/lib/users';

export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserIdFromRequest(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'No user selected' },
        { status: 404 }
      );
    }

    // Get current Gmail account from session
    const sessionGmailEmail = getSessionUserEmailFromRequest(request);
    if (!sessionGmailEmail) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // CRITICAL: Verify user belongs to current Gmail account
    if (user.userEmail !== sessionGmailEmail) {
      // User doesn't belong to this Gmail account - clear the cookie
      const response = NextResponse.json(
        { error: 'User does not belong to current account' },
        { status: 403 }
      );
      // Clear the invalid user ID cookie
      response.cookies.delete('current_user_id');
      return response;
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch current user', details: (error as Error).message },
      { status: 500 }
    );
  }
}

