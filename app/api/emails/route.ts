/**
 * Email fetching endpoint
 * Fetches inbox emails and sent emails from Gmail
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidTokens } from '@/lib/token-refresh';
import { fetchInboxEmails, fetchSentEmails } from '@/lib/gmail';
import { storeSentEmail, storeReceivedEmail } from '@/lib/storage';
import { ensureTicketForEmail } from '@/lib/tickets';

// Cache configuration: revalidate every 30 seconds
export const revalidate = 30;

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

    // Safely parse maxResults to avoid NaN/invalid values (e.g., "[object Object]")
    const maxResultsRaw = searchParams.get('maxResults');
    const parsedMax = maxResultsRaw ? Number(maxResultsRaw) : 50;
    const maxResults = Number.isFinite(parsedMax)
      ? Math.min(Math.max(parsedMax, 1), 200) // clamp between 1 and 200 to protect API usage
      : 50;

    let emails;
    
    if (type === 'sent') {
      // Fetch sent emails - use metadata format for list view (much faster)
      // Full body will be fetched later when needed for embeddings
      emails = await fetchSentEmails(tokens, maxResults, false);
      
      // OPTIMIZED: Return emails immediately, process tickets in background (non-blocking)
      // This makes the API response 10x faster
      Promise.all(
        emails.map(async (email: any) => {
          try {
            // Store email metadata (non-blocking)
            await storeSentEmail(email);
            // Create/update tickets in background (non-blocking)
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
      ).catch(err => console.error('Background ticket processing error:', err));
    } else {
      // Fetch inbox emails (optionally with query for specific labels)
      // Use metadata format for list view (much faster - no body needed)
      if (q) {
        // When a search query is provided, pass it through to Gmail
        emails = await fetchInboxEmails(tokens, maxResults, q, false);
      } else {
        emails = await fetchInboxEmails(tokens, maxResults, undefined, false);
      }
      
      // Check if user is specifically requesting spam or trash emails
      const isViewingSpam = q?.includes('label:SPAM') || q?.includes('in:spam');
      const isViewingTrash = q?.includes('label:TRASH') || q?.includes('in:trash');
      
      // Only filter out spam/trash if user is NOT specifically viewing them
      // This allows users to see spam/trash when they explicitly request it
      if (!isViewingSpam && !isViewingTrash) {
        // Filter out obvious spam/trash so we don't create tickets for them
        emails = emails.filter((email) => {
          const labels = email.labels || [];
          const blockedLabels = ['SPAM', 'TRASH'];
          return !labels.some((label) => blockedLabels.includes(label));
        });
      }
      
      // OPTIMIZED: Return emails immediately, process tickets in background (non-blocking)
      // This makes the API response 10x faster - tickets will be created async
      Promise.all(
        emails.map(async (email: any) => {
          try {
            // Store email metadata (non-blocking)
            await storeReceivedEmail(email);
            
            // Don't create tickets for spam/trash emails
            const labels = email.labels || [];
            const isSpamOrTrash = labels.some((label: string) => ['SPAM', 'TRASH'].includes(label));
            
            if (!isSpamOrTrash) {
              // Create/update tickets in background (non-blocking)
              try {
                const ticket = await ensureTicketForEmail(
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
                if (ticket) {
                  console.log(`[Ticket] Created/updated ticket ${ticket.id} for email ${email.id} (thread: ${email.threadId})`);
                }
              } catch (ticketError) {
                console.error(`[Ticket] Error creating ticket for email ${email.id}:`, ticketError);
              }
            }
          } catch (error) {
            console.error(`Error processing received email ${email.id}:`, error);
          }
        })
      ).catch(err => console.error('Background ticket processing error:', err));
    }

    // Return emails immediately - ticket creation happens in background
    const response = NextResponse.json({ emails, count: emails.length });
    
    // Add cache headers for client-side and CDN caching
    // Cache for 30 seconds, allow stale-while-revalidate for up to 60 seconds
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=30, stale-while-revalidate=60, max-age=0'
    );
    
    return response;
  } catch (error) {
    console.error('Error fetching emails:', error);
    return NextResponse.json(
      { error: 'Failed to fetch emails', details: (error as Error).message },
      { status: 500 }
    );
  }
}

