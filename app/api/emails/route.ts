/**
 * Email fetching endpoint
 * Fetches inbox emails and sent emails from Gmail
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidTokens } from '@/lib/token-refresh';
import { fetchInboxEmails, fetchSentEmails } from '@/lib/gmail';
import { storeSentEmail, storeReceivedEmail } from '@/lib/storage';
import { ensureTicketForEmail } from '@/lib/tickets';

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
    const q = searchParams.get('q'); // optional Gmail query (labels etc.)
    const maxResults = parseInt(searchParams.get('maxResults') || '50');

    let emails;
    
    if (type === 'sent') {
      // Fetch sent emails
      emails = await fetchSentEmails(tokens, maxResults);
      
      // Process sent emails in parallel: store metadata/embeddings (if needed)
      // and update ticket timestamps. This significantly reduces latency when
      // compared to serial processing.
      await Promise.all(
        emails.map(async (email: any) => {
          try {
            await storeSentEmail(email);
            await ensureTicketForEmail(
              {
                id: email.id,
                threadId: email.threadId,
                subject: email.subject,
                from: email.from,
                to: email.to,
                date: email.date,
              },
              true
            );
          } catch (error) {
            console.error(`Error processing sent email ${email.id}:`, error);
          }
        })
      );
    } else {
      // Fetch inbox emails (optionally with query for specific labels)
      if (q) {
        // When a search query is provided, pass it through to Gmail
        emails = await fetchInboxEmails(tokens, maxResults, q);
      } else {
        emails = await fetchInboxEmails(tokens, maxResults);
      }
      
      // Filter out obvious spam/trash so we don't create tickets for them
      emails = emails.filter((email) => {
        const labels = email.labels || [];
        const blockedLabels = ['SPAM', 'TRASH'];
        return !labels.some((label) => blockedLabels.includes(label));
      });
      
      // Store received emails (without embeddings) and ensure tickets exist/are updated
      await Promise.all(
        emails.map(async (email: any) => {
          try {
            await storeReceivedEmail(email);
            await ensureTicketForEmail(
              {
                id: email.id,
                threadId: email.threadId,
                subject: email.subject,
                from: email.from,
                to: email.to,
                date: email.date,
              },
              false
            );
          } catch (error) {
            console.error(`Error processing received email ${email.id}:`, error);
          }
        })
      );
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

