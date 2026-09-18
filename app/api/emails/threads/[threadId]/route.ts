import { NextRequest, NextResponse } from 'next/server';
import { getThreadById } from '@/lib/gmail';
import { validateBusinessSession } from '@/lib/session';
import { withMailboxFallback } from '@/lib/mailbox-resolver';

type RouteContext =
  | { params: { threadId: string } }
  | { params: Promise<{ threadId: string }> };

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const paramsData = await Promise.resolve((context as any).params);
    let threadId = paramsData?.threadId;

    if (!threadId) {
      const segments = request.nextUrl.pathname.split('/');
      threadId = decodeURIComponent(segments[segments.length - 1] || '');
    }

    if (!threadId) {
      return NextResponse.json(
        { error: 'Missing thread id' },
        { status: 400 }
      );
    }

    // SECURITY: require a logged-in session. This endpoint previously had NO auth
    // and fetched the thread using the mailbox OWNER's own Gmail token looked up
    // from the DB by threadId — so anyone with a thread id could read any
    // business's email content. We now (a) require a session and (b) fetch ONLY
    // through the CALLER's own connected mailboxes. If the thread doesn't live in
    // one of the caller's mailboxes, they get 404 — never another tenant's mail.
    const session = await validateBusinessSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { result: thread, candidateCount } = await withMailboxFallback<{ messages: any[] }>(
      { businessId: session.businessId || null, sessionEmail: session.email },
      async (tok) => {
        const t = await getThreadById(tok, threadId);
        return (t && t.messages?.length) ? t : null;
      }
    );

    if (candidateCount === 0) {
      return NextResponse.json(
        { error: 'No connected Gmail account. Please reconnect Gmail.' },
        { status: 401 }
      );
    }

    if (!thread) {
      // Either the thread isn't in any of the caller's mailboxes (not theirs) or
      // it genuinely has no messages. Either way, do not expose anything.
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      );
    }

    const response = NextResponse.json({ thread });
    // Private cache only — this is per-user email content, never shared/CDN cached.
    response.headers.set('Cache-Control', 'private, max-age=30');
    return response;
  } catch (error) {
    console.error('Error fetching email thread:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch email thread',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
