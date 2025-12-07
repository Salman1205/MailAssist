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
  priority?: TicketPriority | null; // Optional - only set when ticket is assigned
  assignee?: string | null; // Legacy field (deprecated)
  assigneeUserId?: string | null; // New field - UUID of assigned user
  assigneeName?: string | null; // Name of assigned user (for display)
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
    priority: (row.priority || null) as TicketPriority | null,
    assignee: row.assignee, // Legacy field
    assigneeUserId: row.assignee_user_id || null,
    assigneeName: row.assignee_name || null, // Joined from users table
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
    priority: seed.priority ?? null, // Don't set priority for unassigned tickets
    assignee: null, // Legacy field
    assignee_user_id: null, // New tickets are unassigned
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
    console.error('Ticket payload:', payload);
    return null;
  }

  if (!data) {
    console.warn('No data returned when creating ticket for thread:', threadId);
    return null;
  }

  console.log(`[Ticket] Successfully created ticket ${data.id} for thread ${threadId}`);
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
      priority: null, // Don't set priority for unassigned tickets
      tags: [],
      lastCustomerReplyAt: isFromAgent ? undefined : dateIso,
      lastAgentReplyAt: isFromAgent ? dateIso : undefined,
    })!;
    if (ticket) {
      console.log(`[Ticket] Created ticket ${ticket.id} for email ${email.id}`, {
        threadId,
        lastCustomerReplyAt: ticket.lastCustomerReplyAt,
        createdAt: ticket.createdAt,
        dateIso
      });
    }
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

  let query = supabase
    .from('tickets')
    .update(updates)
    .eq('thread_id', threadId);
  
  if (userEmail) {
    query = query.eq('user_email', userEmail);
  }
  
  const { data, error } = await query
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Error updating ticket timestamps:', error);
    return ticket;
  }

  if (!data) return ticket;

  return mapRowToTicket(data);
}

/**
 * Get tickets with role-based filtering
 * - Agents: see only their own tickets + unassigned tickets
 * - Admin/Manager: see all tickets for the shared Gmail account
 */
export async function getTickets(
  currentUserId: string | null,
  canViewAll: boolean,
  userEmail: string | null
): Promise<Ticket[]> {
  if (!supabase) return [];

  // Build query - we'll fetch assignee names separately for now
  // Supabase foreign key joins can be tricky, so we'll do a simple select
  let query = supabase
    .from('tickets')
    .select('*');

  // Filter by Gmail account
  if (userEmail) {
    query = query.eq('user_email', userEmail);
  }

  // Role-based filtering
  if (!canViewAll && currentUserId) {
    // Agent: only see own tickets + unassigned
    query = query.or(`assignee_user_id.eq.${currentUserId},assignee_user_id.is.null`);
  }
  // Admin/Manager: see all (no additional filter)

  // Order by last_customer_reply_at ascending (oldest customer-waiting first)
  // Tickets that have been waiting longest (oldest last_customer_reply_at) are at the top
  // When a customer replies, last_customer_reply_at updates to now, moving ticket down
  // Tickets with null last_customer_reply_at go to the end
  query = query.order('last_customer_reply_at', { ascending: true, nullsFirst: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching tickets:', error);
    return [];
  }

  if (!data) return [];

  // Fetch assignee names for tickets that have assignees
  const assigneeUserIds = data
    .map((row: any) => row.assignee_user_id)
    .filter((id: string | null) => id !== null) as string[];

  const assigneeMap = new Map<string, string>();
  if (assigneeUserIds.length > 0 && supabase) {
    try {
      const { data: users } = await supabase
        .from('users')
        .select('id, name')
        .in('id', assigneeUserIds);
      
      if (users) {
        users.forEach((user: any) => {
          assigneeMap.set(user.id, user.name);
        });
      }
    } catch (err) {
      console.error('Error fetching assignee names:', err);
    }
  }

  // Map rows to tickets, adding assignee names
  return data.map((row: any) => {
    const ticket = mapRowToTicket(row);
    if (row.assignee_user_id && assigneeMap.has(row.assignee_user_id)) {
      ticket.assigneeName = assigneeMap.get(row.assignee_user_id) || null;
    }
    return ticket;
  });
}

/**
 * Get a single ticket by ID
 */
export async function getTicketById(
  ticketId: string,
  currentUserId: string | null,
  canViewAll: boolean,
  userEmail: string | null
): Promise<Ticket | null> {
  if (!supabase) return null;

  let query = supabase
    .from('tickets')
    .select('*')
    .eq('id', ticketId)
    .limit(1)
    .maybeSingle();

  // Filter by Gmail account
  if (userEmail) {
    query = query.eq('user_email', userEmail);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching ticket by ID:', error);
    return null;
  }

  if (!data) return null;

  // Check permissions: Agents can only view their own tickets or unassigned
  if (!canViewAll && currentUserId) {
    const assigneeUserId = data.assignee_user_id;
    if (assigneeUserId && assigneeUserId !== currentUserId) {
      // Agent trying to view someone else's assigned ticket
      return null;
    }
  }

  const ticket = mapRowToTicket(data);
  
  // Fetch assignee name if ticket is assigned
  if (data.assignee_user_id && supabase) {
    try {
      const { data: user } = await supabase
        .from('users')
        .select('name')
        .eq('id', data.assignee_user_id)
        .limit(1)
        .maybeSingle();
      
      if (user) {
        ticket.assigneeName = user.name;
      }
    } catch (err) {
      console.error('Error fetching assignee name:', err);
    }
  }

  return ticket;
}

/**
 * Assign a ticket to a user
 * @param ticketId - Ticket ID
 * @param assigneeUserId - User ID to assign to (null to unassign)
 * @param userEmail - Gmail account email for scoping
 */
export async function assignTicket(
  ticketId: string,
  assigneeUserId: string | null,
  userEmail: string | null
): Promise<Ticket | null> {
  if (!supabase) return null;

  const updates: any = {
    assignee_user_id: assigneeUserId,
    updated_at: new Date().toISOString(),
  };

  let query = supabase
    .from('tickets')
    .update(updates)
    .eq('id', ticketId)
    .select('*');

  // Filter by Gmail account for security
  if (userEmail) {
    query = query.eq('user_email', userEmail);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('Error assigning ticket:', error);
    return null;
  }

  if (!data) return null;

  const ticket = mapRowToTicket(data);
  
  // Fetch assignee name if ticket is assigned
  if (data.assignee_user_id && supabase) {
    try {
      const { data: user } = await supabase
        .from('users')
        .select('name')
        .eq('id', data.assignee_user_id)
        .limit(1)
        .maybeSingle();
      
      if (user) {
        ticket.assigneeName = user.name;
      }
    } catch (err) {
      console.error('Error fetching assignee name:', err);
    }
  }

  return ticket;
}

/**
 * Update ticket status
 */
export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus,
  userEmail: string | null
): Promise<Ticket | null> {
  if (!supabase) return null;

  const updates: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  let query = supabase
    .from('tickets')
    .update(updates)
    .eq('id', ticketId)
    .select('*');

  if (userEmail) {
    query = query.eq('user_email', userEmail);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('Error updating ticket status:', error);
    return null;
  }

  if (!data) return null;

  return mapRowToTicket(data);
}

/**
 * Update ticket priority
 */
export async function updateTicketPriority(
  ticketId: string,
  priority: TicketPriority,
  userEmail: string | null
): Promise<Ticket | null> {
  if (!supabase) return null;

  const updates: any = {
    priority,
    updated_at: new Date().toISOString(),
  };

  let query = supabase
    .from('tickets')
    .update(updates)
    .eq('id', ticketId)
    .select('*');

  if (userEmail) {
    query = query.eq('user_email', userEmail);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('Error updating ticket priority:', error);
    return null;
  }

  if (!data) return null;

  return mapRowToTicket(data);
}

/**
 * Update ticket tags
 */
export async function updateTicketTags(
  ticketId: string,
  tags: string[],
  userEmail: string | null
): Promise<Ticket | null> {
  if (!supabase) return null;

  const updates: any = {
    tags,
    updated_at: new Date().toISOString(),
  };

  let query = supabase
    .from('tickets')
    .update(updates)
    .eq('id', ticketId)
    .select('*');

  if (userEmail) {
    query = query.eq('user_email', userEmail);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('Error updating ticket tags:', error);
    return null;
  }

  if (!data) return null;

  return mapRowToTicket(data);
}

