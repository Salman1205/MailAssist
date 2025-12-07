/**
 * GET /api/tickets/[id]/thread - Get conversation thread for a ticket
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTicketById } from '@/lib/tickets';
import { getThreadById } from '@/lib/gmail';
import { getValidTokens } from '@/lib/token-refresh';
import { getCurrentUserIdFromRequest } from '@/lib/permissions';
import { canViewAllTickets } from '@/lib/permissions';
import { getCurrentUserEmail } from '@/lib/storage';

type RouteContext =
  | { params: { id: string } }
  | { params: Promise<{ id: string }> };

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const paramsData = await Promise.resolve((context as any).params);
    const ticketId = paramsData?.id;

    if (!ticketId) {
      return NextResponse.json(
        { error: 'Missing ticket ID' },
        { status: 400 }
      );
    }

    const userId = getCurrentUserIdFromRequest(request);
    const userEmail = await getCurrentUserEmail();

    if (!userId || !userEmail) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Check permissions
    const canViewAll = await canViewAllTickets(userId);
    const ticket = await getTicketById(ticketId, userId, canViewAll, userEmail);

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found or access denied' },
        { status: 404 }
      );
    }

    // Get tokens and fetch thread
    const tokens = await getValidTokens();
    if (!tokens || !tokens.access_token) {
      return NextResponse.json(
        { error: 'Not authenticated. Please connect Gmail first.' },
        { status: 401 }
      );
    }

    const thread = await getThreadById(tokens, ticket.threadId);
    
    return NextResponse.json({ messages: thread.messages || [] });
  } catch (error) {
    console.error('Error fetching ticket thread:', error);
    return NextResponse.json(
      { error: 'Failed to fetch thread', details: (error as Error).message },
      { status: 500 }
    );
  }
}





