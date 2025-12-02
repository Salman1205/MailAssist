import { supabase } from './supabase';
import { getCurrentUserEmail } from './storage';

export type TicketStatus = 'open' | 'pending' | 'on_hold' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Ticket {
  id: string;
  threadId: string;
  customerEmail: string;
  customerName?: string | null;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee?: string | null;
  tags: string[];
  lastCustomerReplyAt?: string | null;
  lastAgentReplyAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketSeed {
  subject: string;
  customerEmail: string;
  customerName?: string | null;
  initialStatus?: TicketStatus;
  priority?: TicketPriority;
  tags?: string[];
  lastCustomerReplyAt?: string;
  lastAgentReplyAt?: string;
}

// Lightweight email shape used when creating/updating tickets
export interface TicketEmailLike {
  id: string;
  threadId?: string;
  subject: string;
  from: string;
  to: string;
  date: string;
}

function mapRowToTicket(row: any): Ticket {
  return {
    id: row.id,
    threadId: row.thread_id,
    customerEmail: row.customer_email,
    customerName: row.customer_name,
    subject: row.subject,
    status: (row.status || 'open') as TicketStatus,
    priority: (row.priority || 'medium') as TicketPriority,
    assignee: row.assignee,
    tags: row.tags || [],
    lastCustomerReplyAt: row.last_customer_reply_at,
    lastAgentReplyAt: row.last_agent_reply_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getTicketByThreadId(
  threadId: string,
  userEmail: string | null
): Promise<Ticket | null> {
  if (!supabase) return null;

  let query = supabase
    .from('tickets')
    .select('*')
    .eq('thread_id', threadId)
    .limit(1)
    .maybeSingle();

  if (userEmail) {
    query = query.eq('user_email', userEmail);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching ticket by thread_id:', error);
    return null;
  }

  if (!data) return null;

  return mapRowToTicket(data);
}

export async function getOrCreateTicketForThread(
  threadId: string,
  seed: TicketSeed
): Promise<Ticket | null> {
  if (!supabase) return null;

  const userEmail = await getCurrentUserEmail();

  // 1) Check if ticket already exists
  const existing = await getTicketByThreadId(threadId, userEmail);
  if (existing) {
    return existing;
  }

  const nowIso = new Date().toISOString();

  const payload: any = {
    thread_id: threadId,
    customer_email: seed.customerEmail,
    customer_name: seed.customerName ?? null,
    subject: seed.subject,
    status: seed.initialStatus ?? 'open',
    priority: seed.priority ?? 'medium',
    assignee: null,
    tags: seed.tags ?? [],
    last_customer_reply_at: seed.lastCustomerReplyAt ?? null,
    last_agent_reply_at: seed.lastAgentReplyAt ?? null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  if (userEmail) {
    payload.user_email = userEmail;
  }

  const { data, error } = await supabase
    .from('tickets')
    .insert(payload)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Error creating ticket:', error);
    return null;
  }

  if (!data) return null;

  return mapRowToTicket(data);
}

/**
 * Ensure there is a ticket row for a given email, and update
 * last_customer_reply_at / last_agent_reply_at based on who sent it.
 *
 * isFromAgent:
 * - true  => update last_agent_reply_at, set status to 'pending' (or keep if closed/on_hold)
 * - false => update last_customer_reply_at, set status to 'open'
 */
export async function ensureTicketForEmail(
  email: TicketEmailLike,
  isFromAgent: boolean
): Promise<Ticket | null> {
  if (!supabase) return null;

  const userEmail = await getCurrentUserEmail();
  const threadId = email.threadId || email.id;
  const dateIso = new Date(email.date).toISOString();

  // Guess customer email based on direction
  const customerEmail = isFromAgent ? email.to : email.from;

  // Try to find existing ticket
  let ticket = await getTicketByThreadId(threadId, userEmail);

  if (!ticket) {
    // Create new ticket using this email as seed
    ticket = await getOrCreateTicketForThread(threadId, {
      subject: email.subject,
      customerEmail,
      customerName: null,
      initialStatus: isFromAgent ? 'pending' : 'open',
      priority: 'medium',
      tags: [],
      lastCustomerReplyAt: isFromAgent ? undefined : dateIso,
      lastAgentReplyAt: isFromAgent ? dateIso : undefined,
    })!;
    return ticket;
  }

  // Update existing ticket
  const updates: any = {
    updated_at: dateIso,
  };

  if (isFromAgent) {
    updates.last_agent_reply_at = dateIso;

    // Only bump to pending if ticket is not closed or on hold
    if (ticket.status === 'open' || ticket.status === 'pending') {
      updates.status = 'pending';
    }
  } else {
    updates.last_customer_reply_at = dateIso;
    updates.status = 'open';
  }

  if (userEmail) {
    updates.user_email = userEmail;
  }

  const { data, error } = await supabase
    .from('tickets')
    .update(updates)
    .eq('thread_id', threadId)
    .modify((qb) => {
      if (userEmail) qb.eq('user_email', userEmail);
    })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Error updating ticket timestamps:', error);
    return ticket;
  }

  if (!data) return ticket;

  return mapRowToTicket(data);
}


