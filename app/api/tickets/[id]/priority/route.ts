/**
 * PATCH /api/tickets/[id]/priority - Update ticket priority
 */

import { NextRequest, NextResponse } from 'next/server';
import { updateTicketPriority } from '@/lib/tickets';
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
    const { priority } = body;

    if (!priority || !['low', 'medium', 'high', 'urgent'].includes(priority)) {
      return NextResponse.json(
        { error: 'Invalid priority. Must be: low, medium, high, or urgent' },
        { status: 400 }
      );
    }

    const ticket = await updateTicketPriority(ticketId, priority, userEmail);

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error('Error updating ticket priority:', error);
    return NextResponse.json(
      { error: 'Failed to update ticket priority', details: (error as Error).message },
      { status: 500 }
    );
  }
}





