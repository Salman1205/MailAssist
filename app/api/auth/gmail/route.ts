/**
 * Gmail OAuth authentication endpoint
 * Returns the authorization URL for the user to authenticate
 */

import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/gmail';

export async function GET() {
  try {
    const authUrl = getAuthUrl();
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication URL', details: (error as Error).message },
      { status: 500 }
    );
  }
}


