import { supabase } from './supabase'

export interface Notification {
  id: string
  userId: string
  type: 'mention' | 'assignment'
  ticketId?: string | null
  noteId?: string | null
  message: string
  isRead: boolean
  createdAt: string
}

export async function listNotifications(userId: string): Promise<Notification[]> {
  if (!supabase || !userId) return []
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    ticketId: row.ticket_id,
    noteId: row.note_id,
    message: row.message,
    isRead: !!row.is_read,
    createdAt: row.created_at,
  }))
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId)
  return !error
}

export async function createMentionNotifications(noteId: string, ticketId: string, authorUserId: string, mentionedUserIds: string[], authorName?: string) {
  if (!supabase || !mentionedUserIds?.length) return
  const uniqueTargets = Array.from(new Set(mentionedUserIds)).filter((uid) => uid !== authorUserId)
  if (!uniqueTargets.length) return
  const message = `${authorName || 'Someone'} mentioned you on a ticket`
  const rows = uniqueTargets.map(uid => ({
    user_id: uid,
    type: 'mention' as const,
    ticket_id: ticketId,
    note_id: noteId,
    message,
    is_read: false,
    created_at: new Date().toISOString(),
  }))
  await supabase.from('notifications').insert(rows)
}

export async function createAssignmentNotification(ticketId: string, assigneeUserId: string, assignerName?: string, assignerUserId?: string) {
  if (!supabase || !assigneeUserId) return
  
  // Check if user is assigning to themselves
  const isSelfAssignment = assignerUserId && assignerUserId === assigneeUserId
  const message = isSelfAssignment 
    ? 'You were assigned this ticket'
    : `${assignerName || 'Someone'} assigned you a ticket`
  
  await supabase.from('notifications').insert({
    user_id: assigneeUserId,
    type: 'assignment',
    ticket_id: ticketId,
    note_id: null,
    message,
    is_read: false,
    created_at: new Date().toISOString(),
  })
}