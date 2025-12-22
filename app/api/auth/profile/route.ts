/**
 * Returns the authenticated user's profile info
 */

import { NextResponse } from 'next/server';
import { getValidTokens } from '@/lib/token-refresh';
import { getUserProfile } from '@/lib/gmail';

export async function GET() {
  try {
    // 1. Try to get user from business session first
    const { getCurrentUser } = await import('@/lib/session');
    const user = await getCurrentUser();

    if (user) {
      return NextResponse.json({
        emailAddress: user.email,
        displayName: user.name,
        picture: null, // Business users might not have a picture yet
        role: user.role,
        businessName: user.businessName
      });
    }

    // 2. Fall back to Gmail tokens (legacy flow)
    const tokens = await getValidTokens();

    if (!tokens || !tokens.access_token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const profile = await getUserProfile(tokens);
    return NextResponse.json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile', details: (error as Error).message },
      { status: 500 }
    );
  }
}

































