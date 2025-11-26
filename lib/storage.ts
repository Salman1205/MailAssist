/**
 * Local storage handling for emails and embeddings
 * Uses file system to store data (JSON files)
 */

import crypto from 'crypto';
import { generateEmbedding } from './embeddings';
import { createEmailContext } from './similarity';
import { supabase } from './supabase';
import { getValidTokens } from './token-refresh';
import { getUserProfile } from './gmail';

/**
 * Get current user's email address for data scoping
 */
async function getCurrentUserEmail(): Promise<string | null> {
  try {
    const tokens = await getValidTokens();
    if (!tokens || !tokens.access_token) {
      return null;
    }
    const profile = await getUserProfile(tokens);
    return profile?.emailAddress || null;
  } catch (error) {
    console.error('Error getting user email:', error);
    return null;
  }
}

export interface StoredEmail {
  id: string;
  threadId?: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  date: string;
  embedding: number[];
  labels?: string[];
  isSent: boolean; // true for sent emails, false for received
  isReply?: boolean;
}

export interface StoredDraft {
  id: string;
  emailId: string;
  subject: string;
  from: string;
  to: string;
  originalBody: string;
  draftText: string;
  createdAt: string;
}

export interface StoredTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
  token_type?: string | null;
  scope?: string | null;
  [key: string]: any;
}

export interface SyncState {
  status: 'idle' | 'running';
  queued: number;
  processed: number;
  errors: number;
  startedAt: number | null;
  finishedAt: number | null;
}

export const defaultSyncState: SyncState = {
  status: 'idle',
  queued: 0,
  processed: 0,
  errors: 0,
  startedAt: null,
  finishedAt: null,
};

/**
 * Load stored emails
 */
export async function loadStoredEmails(): Promise<StoredEmail[]> {
  if (!supabase) {
    return [];
  }

  const userEmail = await getCurrentUserEmail();
  if (!userEmail) {
    return [];
  }

  const { data, error } = await supabase
    .from('emails')
    .select('*')
    .eq('is_sent', true)
    .eq('user_email', userEmail)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error loading stored emails from Supabase:', error);
    return [];
  }

  // Map DB columns (snake_case) to StoredEmail (camelCase)
  return (data || []).map((row: any) => ({
    id: row.id,
    threadId: row.thread_id ?? undefined,
    subject: row.subject,
    from: row.from_address,
    to: row.to_address,
    body: row.body,
    date: row.date,
    embedding: row.embedding || [],
    labels: row.labels || [],
    isSent: row.is_sent,
    isReply: row.is_reply ?? undefined,
  }));
}

/**
 * Save emails
 */
export async function saveStoredEmails(emails: StoredEmail[], retries = 1) {
  if (!supabase) {
    return;
  }

  const userEmail = await getCurrentUserEmail();
  if (!userEmail) {
    console.error('Cannot save emails: no user email');
    return;
  }

  // Upsert each email by id
  for (const email of emails) {
    const { error } = await supabase
      .from('emails')
      .upsert(
        {
          id: email.id,
          user_email: userEmail,
          thread_id: email.threadId ?? null,
          subject: email.subject,
          from_address: email.from,
          to_address: email.to,
          body: email.body,
          date: email.date,
          embedding: email.embedding,
          labels: email.labels ?? [],
          is_sent: email.isSent,
          is_reply: email.isReply ?? null,
        },
        { onConflict: 'id' }
      );

    if (error) {
      console.error('Error saving stored email to Supabase:', error, 'for email id', email.id);
    }
  }
}

export async function loadDrafts(): Promise<StoredDraft[]> {
  if (!supabase) {
    return [];
  }

  const userEmail = await getCurrentUserEmail();
  if (!userEmail) {
    return [];
  }

  const { data, error } = await supabase
    .from('drafts')
    .select('*')
    .eq('user_email', userEmail)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading drafts from Supabase:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    emailId: row.email_id,
    subject: row.subject,
    from: row.from,
    to: row.to,
    originalBody: row.original_body,
    draftText: row.draft_text,
    createdAt: row.created_at,
  }));
}

export async function saveDrafts(drafts: StoredDraft[]) {
  if (!supabase) {
    return;
  }

  const userEmail = await getCurrentUserEmail();
  if (!userEmail) {
    console.error('Cannot save drafts: no user email');
    return;
  }

  const payload = drafts.map((draft) => ({
    id: draft.id,
    user_email: userEmail,
    email_id: draft.emailId,
    subject: draft.subject,
    from: draft.from,
    to: draft.to,
    original_body: draft.originalBody,
    draft_text: draft.draftText,
    created_at: draft.createdAt,
  }));

  const { error } = await supabase.from('drafts').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('Error saving drafts to Supabase:', error);
  }
}

/**
 * Store a sent email with its embedding
 * Optimized to handle errors gracefully
 */
export async function storeSentEmail(email: {
  id: string;
  threadId?: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  date: string;
  labels?: string[];
  isReply?: boolean;
}) {
  const storedEmails = await loadStoredEmails();
  
  // Check if email already exists
  const existing = storedEmails.find((e) => e.id === email.id);
  
  // Determine if this is a reply (check email.isReply or infer from subject)
  const isReply = email.isReply ?? /^(re|fwd?):\s*/i.test(email.subject || '');
  
  if (existing) {
    if (existing.embedding.length > 0) {
      return existing; // Already processed with embedding
    }
    // If existing email has no embedding, we should process it
    // (We now generate embeddings for all sent emails, not just replies)
  }

  const trimmedBody = sanitizeEmailBody(email.body || '', 2000);

  // Generate embeddings for ALL sent emails (not just replies)
  // This allows the AI to learn from the user's complete writing style
  try {
    const context = createEmailContext(email.subject, trimmedBody);
    const embedding = await generateEmbeddingWithRetry(context);

    const storedEmail: StoredEmail = {
      ...email,
      body: trimmedBody,
      embedding,
      isSent: true,
      isReply: isReply,
    };

    // Update existing or add new
    if (existing) {
      Object.assign(existing, storedEmail);
    } else {
      storedEmails.push(storedEmail);
    }

    await saveStoredEmails(storedEmails);
    return storedEmail;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[STORAGE] Error generating embedding for email ${email.id}:`, errorMessage);
    console.error('[STORAGE] Full error details:', error);
    console.error('[STORAGE] Stack trace:', error instanceof Error ? error.stack : 'N/A');
    
    // Store without embedding if embedding generation fails
    // This allows the app to continue working even if some embeddings fail
    const storedEmail: StoredEmail = {
      ...email,
      body: trimmedBody,
      embedding: [],
      isSent: true,
      isReply: isReply,
    };
    
    if (existing) {
      Object.assign(existing, storedEmail);
    } else {
      storedEmails.push(storedEmail);
    }
    
    await saveStoredEmails(storedEmails);
    return storedEmail;
  }
}

/**
 * Store received emails (for reference, but don't generate embeddings for them)
 */
export async function storeReceivedEmail(email: {
  id: string;
  threadId?: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  date: string;
  labels?: string[];
  isReply?: boolean;
}) {
  // We no longer persist inbound email bodies; callers can fetch fresh copies
  // directly from Gmail when needed for the UI.
  return null;
}

/**
 * Store a generated draft for later viewing
 */
export async function storeDraft(entry: {
  emailId: string;
  subject: string;
  from: string;
  to: string;
  originalBody: string;
  draftText: string;
}) {
  const drafts = await loadDrafts();
  const newDraft: StoredDraft = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...entry,
  };

  drafts.unshift(newDraft);
  await saveDrafts(drafts);
  return newDraft;
}

/**
 * Get all sent emails (for style matching)
 */
export async function getSentEmails(): Promise<StoredEmail[]> {
  const storedEmails = await loadStoredEmails();
  return storedEmails.filter((email) => email.isSent && email.embedding.length > 0);
}

/**
 * Load stored OAuth tokens
 */
export async function loadTokens(): Promise<StoredTokens | null> {
  if (!supabase) {
    return null;
  }

  const userEmail = await getCurrentUserEmail();
  if (!userEmail) {
    return null;
  }

  const { data, error } = await supabase
    .from('tokens')
    .select('*')
    .eq('user_email', userEmail)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error loading tokens from Supabase:', error);
    return null;
  }

  if (!data) {
    return null;
  }

  const tokens: StoredTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: data.expiry_date,
    token_type: data.token_type,
    scope: data.scope,
  };

  return tokens;
}

/**
 * Save OAuth tokens
 */
export async function saveTokens(tokens: StoredTokens) {
  if (!supabase) {
    return;
  }

  const userEmail = await getCurrentUserEmail();
  if (!userEmail) {
    console.error('Cannot save tokens: no user email');
    return;
  }

  // Delete existing tokens for this user first, then insert new ones
  await supabase.from('tokens').delete().eq('user_email', userEmail);

  const { error } = await supabase.from('tokens').insert({
    user_email: userEmail,
    access_token: tokens.access_token ?? null,
    refresh_token: tokens.refresh_token ?? null,
    expiry_date: tokens.expiry_date ?? null,
    token_type: tokens.token_type ?? null,
    scope: tokens.scope ?? null,
  });

  if (error) {
    console.error('Error saving tokens to Supabase:', error);
  }
}

/**
 * Clear stored tokens (for logout)
 */
export async function clearTokens() {
  if (!supabase) {
    return;
  }

  const userEmail = await getCurrentUserEmail();
  if (!userEmail) {
    return;
  }

  const { error } = await supabase.from('tokens').delete().eq('user_email', userEmail);
  if (error) {
    console.error('Error clearing tokens from Supabase:', error);
  }
}

/**
 * Clear all stored data (emails, drafts, sync state, tokens)
 * Used when logging out to remove all user data
 */
export async function clearAllData() {
  if (!supabase) {
    return;
  }

  const userEmail = await getCurrentUserEmail();
  if (!userEmail) {
    return;
  }

  const tables = ['emails', 'drafts', 'sync_state', 'tokens'];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq('user_email', userEmail);
    if (error) {
      console.error(`Error clearing table ${table} in Supabase:`, error);
    }
  }
}

async function generateEmbeddingWithRetry(text: string, attempts = 3): Promise<number[]> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await generateEmbedding(text);
    } catch (error) {
      lastError = error;
      const delay = 1500 * attempt;
      console.warn(`Embedding attempt ${attempt} failed; retrying in ${delay}ms`);
      await wait(delay);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to generate embedding');
}

function sanitizeEmailBody(text: string, maxLength: number): string {
  if (!text) return '';
  const withoutScripts = text.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const withoutTags = withoutScripts.replace(/<\/?[^>]+>/g, ' ');
  const normalized = withoutTags.replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
  return truncateText(normalized, maxLength);
}

function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  return text.length <= maxLength ? text : text.slice(0, maxLength);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loadSyncState(): Promise<SyncState> {
  if (!supabase) {
    return { ...defaultSyncState };
  }

  const userEmail = await getCurrentUserEmail();
  if (!userEmail) {
    return { ...defaultSyncState };
  }

  const { data, error } = await supabase
    .from('sync_state')
    .select('*')
    .eq('user_email', userEmail)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error loading sync state from Supabase:', error);
    return { ...defaultSyncState };
  }

  if (!data) {
    return { ...defaultSyncState };
  }

  return {
    status: (data.status as SyncState['status']) ?? defaultSyncState.status,
    queued: data.queued ?? defaultSyncState.queued,
    processed: data.processed ?? defaultSyncState.processed,
    errors: data.errors ?? defaultSyncState.errors,
    startedAt: data.started_at ? new Date(data.started_at).getTime() : null,
    finishedAt: data.finished_at ? new Date(data.finished_at).getTime() : null,
  };
}

export async function saveSyncState(state: SyncState) {
  if (!supabase) {
    return;
  }

  const userEmail = await getCurrentUserEmail();
  if (!userEmail) {
    console.error('Cannot save sync state: no user email');
    return;
  }

  const { data, error } = await supabase
    .from('sync_state')
    .select('id')
    .eq('user_email', userEmail)
    .limit(1)
    .maybeSingle();

  const payload = {
    user_email: userEmail,
    status: state.status,
    queued: state.queued,
    processed: state.processed,
    errors: state.errors,
    started_at: state.startedAt ? new Date(state.startedAt).toISOString() : null,
    finished_at: state.finishedAt ? new Date(state.finishedAt).toISOString() : null,
  };

  if (data && data.id) {
    const { error: updateError } = await supabase
      .from('sync_state')
      .update(payload)
      .eq('id', data.id);

    if (updateError) {
      console.error('Error updating sync state in Supabase:', updateError);
    }
  } else {
    const { error: insertError } = await supabase
      .from('sync_state')
      .insert(payload);

    if (insertError) {
      console.error('Error inserting sync state in Supabase:', insertError);
    }
  }
}

