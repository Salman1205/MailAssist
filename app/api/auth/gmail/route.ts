/**
 * Gmail OAuth authentication endpoint
 * Returns the authorization URL for the user to authenticate
 */

import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/gmail';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // Default to 'login' for new user signups and personal accounts
    // Use 'connect' explicitly when adding Gmail to existing business account
    const mode = searchParams.get('mode') || 'login';

    // Create state object to pass through OAuth
    const state = JSON.stringify({ mode });
    const authUrl = getAuthUrl(state);

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication URL', details: (error as Error).message },
      { status: 500 }
    );
  }
}


