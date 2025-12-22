/**
 * Email fetching endpoint
 * Fetches inbox emails and sent emails from Gmail
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidTokens } from '@/lib/token-refresh';
import { fetchInboxEmails, fetchSentEmails } from '@/lib/gmail';
import { storeSentEmail, storeReceivedEmail } from '@/lib/storage';
import { ensureTicketForEmail } from '@/lib/tickets';
import { validateBusinessSession, isAuthenticated } from '@/lib/session';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
// Cache configuration: revalidate every 30 seconds
export const revalidate = 30;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'inbox'; // 'inbox' or 'sent'
    const q = searchParams.get('q'); // optional Gmail query (labels etc.)
    const accountFilter = searchParams.get('account'); // NEW: Filter by specific account email

    // Safely parse maxResults to avoid NaN/invalid values (e.g., "[object Object]")
    const maxResultsRaw = searchParams.get('maxResults');
    const parsedMax = maxResultsRaw ? Number(maxResultsRaw) : 50;
    const maxResults = Number.isFinite(parsedMax)
      ? Math.min(Math.max(parsedMax, 1), 200) // clamp between 1 and 200 to protect API usage
      : 50;

    let emails;

    // Check for business session first
    const businessSession = await validateBusinessSession();
    const { getSessionUserEmail } = await import('@/lib/session');
    const sessionEmail = await getSessionUserEmail();

    if (businessSession) {
      console.log(`[API] Valid business session found: ${businessSession.businessId} (${businessSession.email})`);
    } else {
      console.log(`[API] No business session found. Session email: ${sessionEmail}`);
    }

    // If business session exists, fetch from ALL connected accounts
    // If business session exists, fetch from ALL connected accounts
    if (businessSession) {
      const { fetchAllInboxEmails, fetchAllSentEmails } = await import('@/lib/email-service');

      // For personal accounts (no businessId), use sessionEmail if businessSession.email is not what we want
      const effectiveEmail = businessSession.businessId ? businessSession.email : (sessionEmail || businessSession.email);

      if (type === 'sent') {
        emails = await fetchAllSentEmails(businessSession.businessId, maxResults, effectiveEmail);
      } else {
        emails = await fetchAllInboxEmails(businessSession.businessId, maxResults, q || undefined, effectiveEmail);

        // Apply spam/trash filters (same logic as before)
        const isViewingSpam = q?.includes('label:SPAM') || q?.includes('in:spam');
        const isViewingTrash = q?.includes('label:TRASH') || q?.includes('in:trash');

        if (!isViewingSpam && !isViewingTrash) {
          emails = emails.filter((email: any) => {
            const labels = email.labels || [];
            const blockedLabels = ['SPAM', 'TRASH'];
            return !labels.some((label: string) => blockedLabels.includes(label));
          });
        }
      }

      // NEW: Filter by account if specified
      if (accountFilter) {
        console.log(`[API] Filtering emails by account: ${accountFilter}`);
        emails = emails.filter((email: any) => {
          // Check ownerEmail field (the account that received/sent this email)
          return email.ownerEmail === accountFilter;
        });
        console.log(`[API] After account filter: ${emails.length} emails`);
      }
    } else {
      // Legacy flow: Single account (Gmail tokens)
      const tokens = await getValidTokens();

      if (!tokens || !tokens.access_token) {
        // Check if user is logged in via business session (but no tokens found)
        const isAuth = await isAuthenticated();

        if (isAuth) {
          // User is logged in but hasn't connected Gmail yet
          return NextResponse.json(
            { error: 'Gmail not connected. Please connect your Gmail account.', code: 'GMAIL_NOT_CONNECTED' },
            { status: 400 } // Bad Request instead of Unauthorized
          );
        }

        return NextResponse.json(
          { error: 'Not authenticated. Please connect Gmail first.' },
          { status: 401 }
        );
      }

      if (type === 'sent') {
        emails = await fetchSentEmails(tokens, maxResults, false);
      } else {
        if (q) {
          emails = await fetchInboxEmails(tokens, maxResults, q, false);
        } else {
          emails = await fetchInboxEmails(tokens, maxResults, undefined, false);
        }

        const isViewingSpam = q?.includes('label:SPAM') || q?.includes('in:spam');
        const isViewingTrash = q?.includes('label:TRASH') || q?.includes('in:trash');

        if (!isViewingSpam && !isViewingTrash) {
          emails = emails.filter((email: any) => {
            const labels = email.labels || [];
            const blockedLabels = ['SPAM', 'TRASH'];
            return !labels.some((label: string) => blockedLabels.includes(label));
          });
        }
      }

      // For personal accounts with account filter, filter by ownerEmail
      if (accountFilter) {
        console.log(`[API] Filtering personal account emails by: ${accountFilter}`);
        emails = emails.filter((email: any) => email.ownerEmail === accountFilter);
      }
    }

    // Background processing (ticket creation) - shared logic
    // We only process tickets if we have emails
    if (emails && emails.length > 0) {
      Promise.all(
        emails.map(async (email: any) => {
          try {
            if (type === 'sent') {
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
            } else {
              await storeReceivedEmail(email);
              const labels = email.labels || [];
              const isSpamOrTrash = labels.some((label: string) => ['SPAM', 'TRASH'].includes(label));

              if (!isSpamOrTrash) {
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
              }
            }
          } catch (error) {
            console.error(`Error processing email ${email.id}:`, error);
          }
        })
      ).catch(err => console.error('Background ticket processing error:', err));
    }

    // Return emails immediately - ticket creation happens in background
    console.log(`[EMAILS] Successfully fetched ${emails.length} emails`);
    const response = NextResponse.json({ emails, count: emails.length });

    // Add cache headers for client-side and CDN caching
    // Cache for 30 seconds, allow stale-while-revalidate for up to 60 seconds
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=30, stale-while-revalidate=60, max-age=0'
    );

    return response;
  } catch (error) {
    console.error('[EMAILS] Error fetching emails:', error);
    return NextResponse.json(
      { error: 'Failed to fetch emails', details: (error as Error).message },
      { status: 500 }
    );
  }
}

