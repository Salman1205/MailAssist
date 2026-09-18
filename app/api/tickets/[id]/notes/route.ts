/**
 * GET /api/tickets/[id]/notes - Get notes for a ticket
 * POST /api/tickets/[id]/notes - Create a new note
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTicketNotes, createTicketNote, updateTicketNote } from '@/lib/ticket-notes';
import { validateBusinessSession } from '@/lib/session';
import { getUserEmailForTickets } from '@/lib/ticket-helpers';
import { isValidUUID, validateTextInput } from '@/lib/validation';
import { supabase } from '@/lib/supabase';

type RouteContext =
  | { params: { id: string } }
  | { params: Promise<{ id: string }> };

/**
 * Verify a ticket belongs to the caller's tenant (one of their connected
 * mailboxes). The service-role client bypasses RLS, so without this a user in
 * one business could read or write internal notes on another business's ticket
 * just by passing its id.
 */
async function ticketInTenant(
  ticketId: string,
  session: { businessId: string | null; email: string },
): Promise<boolean> {
  if (!supabase) return false;
  const scopeEmails: string[] = [];
  try {
    const { loadBusinessTokens } = await import('@/lib/storage');
    const conn = await loadBusinessTokens(session.businessId || null, session.email || undefined);
    conn.forEach((a: any) => { if (a?.email) scopeEmails.push(String(a.email)); });
  } catch (e) {
    console.warn('[notes] Could not resolve tenant mailboxes:', e);
  }
  if (scopeEmails.length === 0 && session.email) scopeEmails.push(session.email);
  if (scopeEmails.length === 0) return false;
  const { data } = await supabase
    .from('tickets')
    .select('id')
    .eq('id', ticketId)
    .in('user_email', scopeEmails)
    .maybeSingle();
  return !!data;
}

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

    const session = await validateBusinessSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    if (!(await ticketInTenant(ticketId, session))) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
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

    const session = await validateBusinessSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    const userId = session.id;

    if (!(await ticketInTenant(ticketId, session))) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const userEmail = await getUserEmailForTickets();
    if (!userEmail) {
      return NextResponse.json(
        { error: 'No Gmail account connected' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { content, mentions } = body;

    // Validate and sanitize note content
    const contentValidation = validateTextInput(content, 5000, true);
    if (!contentValidation.valid) {
      return NextResponse.json(
        { error: contentValidation.error || 'Invalid note content' },
        { status: 400 }
      );
    }

    const normalizedMentions = Array.isArray(mentions) ? mentions.filter((m: any) => typeof m === 'string') : [];
    const note = await createTicketNote(ticketId, contentValidation.sanitized, userId, normalizedMentions);

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

    const session = await validateBusinessSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    const userId = session.id;

    const body = await request.json();
    const { noteId, content, mentions } = body;

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
    const normalizedMentions = Array.isArray(mentions) ? mentions.filter((m: any) => typeof m === 'string') : [];
    const note = await updateTicketNote(noteId, contentValidation.sanitized, userId, normalizedMentions);

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

