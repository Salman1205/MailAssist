/**
 * GET /api/tickets/[id]/notes - Get notes for a ticket
 * POST /api/tickets/[id]/notes - Create a new note
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTicketNotes, createTicketNote, updateTicketNote } from '@/lib/ticket-notes';
import { getCurrentUserIdFromRequest } from '@/lib/permissions';
import { getCurrentUserEmail } from '@/lib/storage';
import { isValidUUID, validateTextInput } from '@/lib/validation';

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

    if (!ticketId || !isValidUUID(ticketId)) {
      return NextResponse.json(
        { error: 'Invalid or missing ticket ID' },
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

    const notes = await getTicketNotes(ticketId);
    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Error fetching ticket notes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notes', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const { content } = body;

    // Validate and sanitize note content
    const contentValidation = validateTextInput(content, 5000, true);
    if (!contentValidation.valid) {
      return NextResponse.json(
        { error: contentValidation.error || 'Invalid note content' },
        { status: 400 }
      );
    }

    const note = await createTicketNote(ticketId, contentValidation.sanitized, userId);

    if (!note) {
      return NextResponse.json(
        { error: 'Failed to create note' },
        { status: 500 }
      );
    }

    return NextResponse.json({ note });
  } catch (error) {
    console.error('Error creating ticket note:', error);
    return NextResponse.json(
      { error: 'Failed to create note', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const paramsData = await Promise.resolve((context as any).params);
    const ticketId = paramsData?.id;

    if (!ticketId || !isValidUUID(ticketId)) {
      return NextResponse.json(
        { error: 'Invalid or missing ticket ID' },
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

    const body = await request.json();
    const { noteId, content } = body;

    if (!noteId || !isValidUUID(noteId)) {
      return NextResponse.json(
        { error: 'Invalid or missing note ID' },
        { status: 400 }
      );
    }

    // Validate and sanitize note content
    const contentValidation = validateTextInput(content, 5000, true);
    if (!contentValidation.valid) {
      return NextResponse.json(
        { error: contentValidation.error || 'Invalid note content' },
        { status: 400 }
      );
    }

    console.log('[Update Note API] Request:', { ticketId, noteId, userId, contentLength: contentValidation.sanitized.length });
    const note = await updateTicketNote(noteId, contentValidation.sanitized, userId);

    if (!note) {
      return NextResponse.json(
        { error: 'Failed to update note. You can only edit your own notes.' },
        { status: 403 }
      );
    }

    return NextResponse.json({ note });
  } catch (error) {
    console.error('Error updating ticket note:', error);
    return NextResponse.json(
      { error: 'Failed to update note', details: (error as Error).message },
      { status: 500 }
    );
  }
}

