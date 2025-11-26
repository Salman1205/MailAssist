/**
 * Get a specific email by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidTokens } from '@/lib/token-refresh';
import { getEmailById } from '@/lib/gmail';
import { loadStoredEmails, storeReceivedEmail } from '@/lib/storage';

type RouteContext =
  | { params: { id: string } }
  | { params: Promise<{ id: string }> };

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const paramsData = await Promise.resolve((context as any).params);
    let emailId = paramsData?.id;
    if (!emailId) {
      const segments = request.nextUrl.pathname.split('/');
      emailId = decodeURIComponent(segments[segments.length - 1] || '');
    }
    if (!emailId) {
      return NextResponse.json(
        { error: 'Missing email id' },
        { status: 400 }
      );
    }

    // Check local storage first
    const storedEmails = await loadStoredEmails();
    const cachedEmail = storedEmails.find((email) => email.id === emailId);

    if (cachedEmail) {
      return NextResponse.json({ email: cachedEmail });
    }

    // Load and refresh tokens if needed
    const tokens = await getValidTokens();

    if (!tokens || !tokens.access_token) {
      return NextResponse.json(
        { error: 'Not authenticated. Please connect Gmail first.' },
        { status: 401 }
      );
    }

    // Fetch the specific email
    const email = await getEmailById(tokens, emailId);
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email not found' },
        { status: 404 }
      );
    }

    // Store for future requests (without embeddings)
    await storeReceivedEmail(email);

    return NextResponse.json({ email });
  } catch (error) {
    console.error('Error fetching email:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch email', 
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}


