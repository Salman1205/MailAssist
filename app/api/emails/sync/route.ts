/**
 * Background sync endpoint for processing sent emails and generating embeddings
 * This endpoint processes emails in the background for faster initial setup
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidTokens } from '@/lib/token-refresh';
import { fetchSentEmails } from '@/lib/gmail';
import { loadStoredEmails, storeSentEmail, loadSyncState, saveSyncState, SyncState } from '@/lib/storage';

// Don't use in-memory cache on Vercel (serverless instances don't share memory)
// Always read from Supabase to get the real state
async function getSyncState(): Promise<SyncState> {
  return await loadSyncState();
}

async function setSyncState(state: SyncState) {
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
    const isContinuing = currentSyncState.status === 'running';
    
    console.log(`[SYNC] ${isContinuing ? 'Continuing' : 'Starting new'} sync job. Current state:`, {
      status: currentSyncState.status,
      processed: currentSyncState.processed,
      queued: currentSyncState.queued
    });
    
    // Fetch sent emails
    const sentEmails = await fetchSentEmails(tokens, maxResults);
    
    // Get already stored emails to avoid duplicates
    const storedEmails = await loadStoredEmails();
    const storedIds = new Set(storedEmails.map(e => e.id));

    // Filter out already stored emails
    const newEmails = sentEmails.filter(e => !storedIds.has(e.id));

    if (newEmails.length === 0) {
      // Mark as complete if no new emails
      if (isContinuing) {
        await setSyncState({
          ...currentSyncState,
          status: 'idle',
          finishedAt: Date.now(),
        });
      }
      return NextResponse.json({
        message: 'All emails already processed',
        processed: currentSyncState.processed || 0,
        total: sentEmails.length
      });
    }

    // Use existing job start time if continuing, otherwise create new
    const jobStartedAt = isContinuing ? (currentSyncState.startedAt || Date.now()) : Date.now();
    
    // Only reset processed to 0 when starting a NEW job (not continuing)
    // When continuing, keep the existing processed count
    await setSyncState({
      status: 'running',
      queued: isContinuing ? (currentSyncState.queued || newEmails.length) : newEmails.length,
      processed: isContinuing ? (currentSyncState.processed || 0) : 0,
      errors: isContinuing ? (currentSyncState.errors || 0) : 0,
      startedAt: jobStartedAt,
      finishedAt: null,
    });

    // On Vercel, serverless functions have time limits (~10s free tier)
    // Process a batch synchronously (await it) so it completes within timeout
    // Frontend will call sync again to continue processing remaining emails
    const BATCH_SIZE = 15; // Process 15 emails per request (increased from 5 for speed)
    const batchToProcess = newEmails.slice(0, BATCH_SIZE);
    const remainingEmails = newEmails.slice(BATCH_SIZE);
    
    console.log(`[SYNC] Processing batch: ${batchToProcess.length} emails, ${remainingEmails.length} remaining`);

    let batchProcessed = 0;
    let batchErrors = 0;

    if (batchToProcess.length > 0) {
      // Process this batch synchronously (await it so it completes before function returns)
      try {
        const result = await processEmailsBatch(batchToProcess, jobStartedAt);
        batchProcessed = result.processed;
        batchErrors = result.errors;
      } catch (err) {
        console.error('Email batch processing error:', err);
        batchErrors = batchToProcess.length;
      }
    }

    // Update state with progress
    const currentState = await getSyncState();
    const totalProcessed = (currentState.processed || 0) + batchProcessed;
    const totalErrors = (currentState.errors || 0) + batchErrors;
    const isComplete = remainingEmails.length === 0;

    await setSyncState({
      status: isComplete ? 'idle' : 'running',
      queued: newEmails.length,
      processed: totalProcessed,
      errors: totalErrors,
      startedAt: jobStartedAt,
      finishedAt: isComplete ? Date.now() : null,
    });

    return NextResponse.json({
      message: isComplete 
        ? 'Email processing complete' 
        : `Processed ${batchProcessed} emails. ${remainingEmails.length} remaining.`,
      queued: newEmails.length,
      processed: totalProcessed,
      remaining: remainingEmails.length,
      processing: !isComplete,
      continue: !isComplete, // Signal to frontend to call sync again
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
 * Process a batch of emails with parallel processing (for speed)
 * Returns the number processed so caller can track progress
 */
async function processEmailsBatch(emails: any[], startedAt: number): Promise<{ processed: number; errors: number }> {
  // Determine delay and concurrency based on embedding provider
  const provider = (process.env.EMBEDDING_PROVIDER || 'local').toLowerCase();
  const isLocal = provider === 'local';
  
  // For Hugging Face API, process 6 at a time (increased for speed)
  // For local, process all in parallel
  const CONCURRENCY = isLocal ? emails.length : 6;
  
  let processed = 0;
  let errors = 0;

  // Process emails in parallel batches
  for (let i = 0; i < emails.length; i += CONCURRENCY) {
    const batch = emails.slice(i, i + CONCURRENCY);
    
    // Process this batch in parallel
    const results = await Promise.allSettled(
      batch.map(email => storeSentEmail(email))
    );
    
    // Count successes and errors
    for (let idx = 0; idx < results.length; idx++) {
      const result = results[idx];
      const email = batch[idx];
      
      if (result.status === 'fulfilled') {
        processed++;
      } else {
        const errorMessage = (result.reason as Error)?.message || String(result.reason);
        
        // Only count as error if it's not a recoverable file system error
        const isRecoverableError = 
          errorMessage.includes('ENOENT') ||
          errorMessage.includes('EEXIST') ||
          errorMessage.includes('EPERM') ||
          errorMessage.includes('no such file or directory');
        
        if (!isRecoverableError) {
          errors++;
          console.error(`Error processing email ${email.id}:`, result.reason);
        } else {
          // For recoverable errors, try once more
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
    }
    
    // Small delay between parallel batches (only for API providers to respect rate limits)
    // Reduced delay for faster processing
    if (!isLocal && i + CONCURRENCY < emails.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  return { processed, errors };
}

/**
 * Process emails in the background with embeddings (legacy - kept for compatibility)
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

  // Keep the final processed count when finishing (don't reset to 0)
  // This way the UI shows the actual progress even after job completes
  await setSyncState({
    status: 'idle',
    queued: emails.length, // Keep original queued count
    processed, // Keep final processed count (not 0!)
    errors,
    startedAt,
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


