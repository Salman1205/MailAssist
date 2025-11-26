/**
 * Gmail OAuth callback endpoint
 * Handles the OAuth callback and stores tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '@/lib/gmail';
import { saveTokens } from '@/lib/storage';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.json(
        { error: 'Authentication failed', details: error },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: 'No authorization code provided' },
        { status: 400 }
      );
    }

    // Exchange code for tokens
    console.log('Exchanging authorization code for tokens...');
    const tokens = await getTokensFromCode(code);
    
    if (!tokens || !tokens.access_token) {
      throw new Error('Failed to get access token from OAuth provider');
    }
    
    console.log('Tokens received, saving to database...');
    // Store tokens
    await saveTokens(tokens);
    console.log('Tokens saved successfully');

    // Redirect to frontend with success
    const frontendUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${frontendUrl}?auth=success`);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', errorMessage);
    const frontendUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${frontendUrl}?auth=error&message=${encodeURIComponent(errorMessage)}`);
  }
}


