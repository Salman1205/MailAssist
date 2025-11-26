/**
 * Background sync endpoint for processing sent emails and generating embeddings
 * This endpoint processes emails in the background for faster initial setup
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidTokens } from '@/lib/token-refresh';
import { fetchSentEmails } from '@/lib/gmail';
import { loadStoredEmails, storeSentEmail, loadSyncState, saveSyncState, SyncState } from '@/lib/storage';

let syncStateCache: SyncState | null = null;

async function getSyncState(): Promise<SyncState> {
  if (!syncStateCache) {
    syncStateCache = await loadSyncState();
  }
  return syncStateCache;
}

async function setSyncState(state: SyncState) {
  syncStateCache = state;
  await saveSyncState(state);
}

export async function POST(request: NextRequest) {
  try {
    // Load and refresh tokens if needed
    const tokens = await getValidTokens();
    
    if (!tokens || !tokens.access_token) {
      return NextResponse.json(
        { error: 'Not authenticated. Please connect Gmail first.' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const maxResults = parseInt(searchParams.get('maxResults') || '100');

    const currentSyncState = await getSyncState();
    if (currentSyncState.status === 'running') {
      return NextResponse.json(
        {
          message: 'Sync already running',
          processing: true,
          queued: currentSyncState.queued,
          processed: currentSyncState.processed,
        },
        { status: 202 }
      );
    }

    // Fetch sent emails
    const sentEmails = await fetchSentEmails(tokens, maxResults);
    
    // Get already stored emails to avoid duplicates
    const storedEmails = await loadStoredEmails();
    const storedIds = new Set(storedEmails.map(e => e.id));

    // Filter out already stored emails
    const newEmails = sentEmails.filter(e => !storedIds.has(e.id));

    if (newEmails.length === 0) {
      return NextResponse.json({
        message: 'All emails already processed',
        processed: 0,
        total: sentEmails.length
      });
    }

    const jobStartedAt = Date.now();

    await setSyncState({
      status: 'running',
      queued: newEmails.length,
      processed: 0,
      errors: 0,
      startedAt: jobStartedAt,
      finishedAt: null,
    });

    // Process emails in background (don't await, return immediately)
    processEmailsInBackground(newEmails, jobStartedAt).catch(err => {
      console.error('Background email processing error:', err);
    });

    return NextResponse.json({
      message: 'Email processing started in background',
      queued: newEmails.length,
      total: sentEmails.length,
      processing: true,
    });
  } catch (error) {
    console.error('Error syncing emails:', error);
    return NextResponse.json(
      { error: 'Failed to sync emails', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Process emails in the background with embeddings
 * This runs asynchronously so the API can return immediately
 * Optimized for parallel processing with local embeddings
 */
async function processEmailsInBackground(emails: any[], startedAt: number) {
  console.log(`Processing ${emails.length} emails in background...`);
  
  let processed = 0;
  let errors = 0;
  
  // Determine delay based on embedding provider
  const provider = (process.env.EMBEDDING_PROVIDER || 'local').toLowerCase();
  const isLocal = provider === 'local';
  const delayMs = isLocal ? 100 : 500; // Small delay between emails to prevent file conflicts

  // Process emails sequentially to avoid file write conflicts
  // This prevents corruption and ENOENT errors from concurrent writes
  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    
    try {
      await storeSentEmail(email);
      processed++;
    } catch (error) {
      const errorMessage = (error as Error)?.message || String(error);
      
      // Only count as error if it's not a recoverable file system error
      const isRecoverableError = 
        errorMessage.includes('ENOENT') ||
        errorMessage.includes('EEXIST') ||
        errorMessage.includes('EPERM') ||
        errorMessage.includes('no such file or directory');
      
      if (!isRecoverableError) {
        errors++;
        console.error(`Error processing email ${email.id}:`, error);
      } else {
        console.warn(`Recoverable error processing email ${email.id}:`, errorMessage);
        // Retry once for recoverable errors
        try {
          await new Promise(resolve => setTimeout(resolve, 200));
          await storeSentEmail(email);
          processed++;
        } catch (retryError) {
          errors++;
          console.error(`Error processing email ${email.id} after retry:`, retryError);
        }
      }
    }
    
    // Update sync state every 10 emails or at the end
    if (processed % 10 === 0 || i === emails.length - 1) {
      await setSyncState({
        status: 'running',
        queued: emails.length,
        processed,
        errors,
        startedAt,
        finishedAt: null,
      });
      console.log(`Processed ${processed}/${emails.length} emails...`);
    }
    
    // Small delay between emails to prevent file system conflicts
    if (i < emails.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  await setSyncState({
    status: 'idle',
    queued: 0,
    processed: 0,
    errors: 0,
    startedAt: null,
    finishedAt: Date.now(),
  });

  console.log(`Background processing complete: ${processed} processed, ${errors} errors`);
}

/**
 * Get sync status
 */
export async function GET() {
  try {
    const storedEmails = await loadStoredEmails();
    const sentEmails = storedEmails.filter(e => e.isSent && e.isReply && e.embedding.length > 0);
    const syncState = await getSyncState();

    // Use syncState to determine "pending" so the UI isn't stuck if some
    // embeddings fail and are stored without vectors.
    const pendingFromJob =
      syncState.status === 'running'
        ? Math.max(0, syncState.queued - syncState.processed)
        : 0;

    return NextResponse.json({
      totalStored: storedEmails.length,
      sentWithEmbeddings: sentEmails.length,
      completedReplies: sentEmails.length,
      pendingReplies: pendingFromJob,
      processing: syncState.status === 'running',
      queued: syncState.queued,
      processed: syncState.processed,
      errors: syncState.errors,
      startedAt: syncState.startedAt,
      finishedAt: syncState.finishedAt,
      lastSync: storedEmails.length > 0 
        ? Math.max(...storedEmails.map(e => new Date(e.date).getTime()))
        : null
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status', details: (error as Error).message },
      { status: 500 }
    );
  }
}


