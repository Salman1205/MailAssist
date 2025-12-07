/**
 * PATCH /api/tickets/[id]/status - Update ticket status
 */

import { NextRequest, NextResponse } from 'next/server';
import { updateTicketStatus } from '@/lib/tickets';
import { getCurrentUserEmail } from '@/lib/storage';
import { getCurrentUserIdFromRequest } from '@/lib/permissions';

type RouteContext =
  | { params: { id: string } }
  | { params: Promise<{ id: string }> };

export async function PATCH(
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
    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const userEmail = await getCurrentUserEmail();
    if (!userEmail) {
      return NextResponse.json(
        { error: 'No Gmail account connected' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !['open', 'pending', 'on_hold', 'closed'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: open, pending, on_hold, or closed' },
        { status: 400 }
      );
    }

    const ticket = await updateTicketStatus(ticketId, status, userEmail);

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error('Error updating ticket status:', error);
    return NextResponse.json(
      { error: 'Failed to update ticket status', details: (error as Error).message },
      { status: 500 }
    );
  }
}





