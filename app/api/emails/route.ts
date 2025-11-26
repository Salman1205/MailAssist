/**
 * Email fetching endpoint
 * Fetches inbox emails and sent emails from Gmail
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidTokens } from '@/lib/token-refresh';
import { fetchInboxEmails, fetchSentEmails } from '@/lib/gmail';
import { storeSentEmail, storeReceivedEmail } from '@/lib/storage';

export async function GET(request: NextRequest) {
  try {
    // Load and refresh tokens if needed
    const tokens = await getValidTokens();
    
    if (!tokens || !tokens.access_token) {
      return NextResponse.json(
        { error: 'Not authenticated. Please connect Gmail first.' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'inbox'; // 'inbox' or 'sent'
    const maxResults = parseInt(searchParams.get('maxResults') || '50');

    let emails;
    
    if (type === 'sent') {
      // Fetch sent emails
      emails = await fetchSentEmails(tokens, maxResults);
      
      // Store sent emails with embeddings
      for (const email of emails) {
        try {
          await storeSentEmail(email);
        } catch (error) {
          console.error(`Error storing sent email ${email.id}:`, error);
        }
      }
    } else {
      // Fetch inbox emails
      emails = await fetchInboxEmails(tokens, maxResults);
      
      // Store received emails (without embeddings)
      for (const email of emails) {
        try {
          await storeReceivedEmail(email);
        } catch (error) {
          console.error(`Error storing received email ${email.id}:`, error);
        }
      }
    }

    return NextResponse.json({ emails, count: emails.length });
  } catch (error) {
    console.error('Error fetching emails:', error);
    return NextResponse.json(
      { error: 'Failed to fetch emails', details: (error as Error).message },
      { status: 500 }
    );
  }
}

