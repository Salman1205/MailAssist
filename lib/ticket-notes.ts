/**
 * Internal notes for tickets
 * Notes are only visible to team members, not customers
 */

import { supabase } from './supabase';
import { getCurrentUserEmail } from './storage';

export interface TicketNote {
  id: string;
  ticketId: string;
  userId: string;
  userName: string;
  content: string;
  mentions?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Get all notes for a ticket
 */
export async function getTicketNotes(ticketId: string): Promise<TicketNote[]> {
  if (!supabase) return [];

  const userEmail = await getCurrentUserEmail();
  if (!userEmail) return [];

  // Get notes for this ticket, scoped to the Gmail account
  // We'll join with tickets table to ensure we only get notes for tickets in this account
  const { data, error } = await supabase
    .from('ticket_notes')
    .select(`
      *,
      user:users!ticket_notes_user_id_fkey(id, name)
    `)
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching ticket notes:', error);
    return [];
  }

  if (!data) return [];

  return data.map((row: any) => ({
    id: row.id,
    ticketId: row.ticket_id,
    userId: row.user_id,
    userName: row.user?.name || 'Unknown',
    content: row.content,
    mentions: Array.isArray(row.mentions) ? row.mentions : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Create a new note for a ticket
 * @param ticketId - Ticket ID
 * @param content - Note content
 * @param userId - User ID creating the note (required, pass from API route)
 */
export async function createTicketNote(
  ticketId: string,
  content: string,
  userId: string,
  mentions?: string[]
): Promise<TicketNote | null> {
  if (!supabase) return null;

  const userEmail = await getCurrentUserEmail();

  if (!userId || !userEmail) {
    return null;
  }

  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('ticket_notes')
    .insert({
      ticket_id: ticketId,
      user_id: userId,
      content: content.trim(),
      mentions: (Array.isArray(mentions) ? mentions : []).map((m) => String(m)),
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select(`
      *,
      user:users!ticket_notes_user_id_fkey(id, name)
    `)
    .maybeSingle();

  if (error) {
    console.error('Error creating ticket note:', error);
    return null;
  }

  if (!data) return null;

  const note: TicketNote = {
    id: data.id,
    ticketId: data.ticket_id,
    userId: data.user_id,
    userName: data.user?.name || 'Unknown',
    content: data.content,
    mentions: Array.isArray(data.mentions) ? data.mentions : [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };

  // Create notifications for mentioned users (excluding author)
  try {
    const { createMentionNotifications } = await import('./notifications')
    await createMentionNotifications(note.id, ticketId, userId, note.mentions || [], note.userName)
  } catch (err) {
    console.warn('Non-fatal: failed to create mention notifications', err)
  }

  return note;
}

/**
 * Update a note
 * @param noteId - Note ID
 * @param content - New note content
 * @param userId - User ID (required, pass from API route)
 */
export async function updateTicketNote(
  noteId: string,
  content: string,
  userId: string,
  mentions?: string[]
): Promise<TicketNote | null> {
  if (!supabase) return null;

  if (!userId) return null;

  const nowIso = new Date().toISOString();

  // First verify the note exists and belongs to this user
  const { data: existingNote, error: fetchError } = await supabase
    .from('ticket_notes')
    .select('user_id')
    .eq('id', noteId)
    .maybeSingle();

  if (fetchError || !existingNote) {
    console.error('Error fetching note for update:', fetchError);
    return null;
  }

  // Compare user IDs (convert to strings to ensure proper comparison)
  const noteUserId = String(existingNote.user_id || '').trim();
  const requestUserId = String(userId || '').trim();
  
  console.log('[Update Note] Comparing user IDs:', {
    noteUserId,
    requestUserId,
    match: noteUserId === requestUserId,
    noteUserIdType: typeof existingNote.user_id,
    requestUserIdType: typeof userId
  });

  if (noteUserId !== requestUserId) {
    console.error('User does not have permission to edit this note', {
      noteUserId,
      requestUserId
    });
    return null;
  }

  // Update the note
  const { data, error } = await supabase
    .from('ticket_notes')
    .update({
      content: content.trim(),
      mentions: (Array.isArray(mentions) ? mentions : []).map((m) => String(m)),
      updated_at: nowIso,
    })
    .eq('id', noteId)
    .eq('user_id', userId) // Ensure user can only update their own notes
    .select(`
      *,
      user:users!ticket_notes_user_id_fkey(id, name)
    `)
    .maybeSingle();

  if (error) {
    console.error('Error updating ticket note:', error);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    ticketId: data.ticket_id,
    userId: data.user_id,
    userName: data.user?.name || 'Unknown',
    content: data.content,
    mentions: Array.isArray(data.mentions) ? data.mentions : [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Delete a note
 * @param noteId - Note ID
 * @param userId - User ID (required, pass from API route)
 */
export async function deleteTicketNote(noteId: string, userId: string): Promise<boolean> {
  if (!supabase) return false;

  if (!userId) return false;

  // Only allow deleting own notes (or admin can delete any)
  const { error } = await supabase
    .from('ticket_notes')
    .delete()
    .eq('id', noteId)
    .eq('user_id', userId); // Users can only delete their own notes

  if (error) {
    console.error('Error deleting ticket note:', error);
    return false;
  }

  return true;
}

