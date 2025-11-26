/**
 * Background sync endpoint for processing sent emails and generating embeddings
 * This endpoint processes emails in the background for faster initial setup
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidTokens } from '@/lib/token-refresh';
import { fetchSentEmails } from '@/lib/gmail';
import { loadStoredEmails, storeSentEmail, loadSyncState, saveSyncState, saveStoredEmails, SyncState } from '@/lib/storage';
import { createEmailContext } from '@/lib/similarity';

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
    
    // Only filter out emails that already have embeddings (skip re-embedding)
    // Emails without embeddings will be processed
    const emailsWithEmbeddings = new Set(
      storedEmails
        .filter(e => e.embedding && e.embedding.length > 0)
        .map(e => e.id)
    );

    // Filter out only emails that already have embeddings
    const newEmails = sentEmails.filter(e => !emailsWithEmbeddings.has(e.id));

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
    const BATCH_SIZE = 50; // Process 50 emails per request (maximized for speed)
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
  const embeddingApiKey = process.env.EMBEDDING_API_KEY;
  
  let processed = 0;
  let errors = 0;

  // For Hugging Face, use batch API calls (much faster - one API call for multiple embeddings)
  // For local, process individually
  if (!isLocal && embeddingApiKey && provider === 'huggingface') {
    // Process in batches of 20 for batch API calls (optimal batch size for HF)
    const BATCH_SIZE = 20;
    
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const batch = emails.slice(i, i + BATCH_SIZE);
      
      try {
        // Prepare email contexts for batch embedding
        const { generateEmbeddingsBatchHF } = await import('@/lib/embeddings');
        
        // Helper function to sanitize email body (same as in storage.ts)
        const sanitizeEmailBody = (text: string, maxLength: number): string => {
          if (!text) return '';
          const withoutScripts = text.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
          const withoutTags = withoutScripts.replace(/<\/?[^>]+>/g, ' ');
          const normalized = withoutTags.replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
          return normalized.length <= maxLength ? normalized : normalized.slice(0, maxLength);
        };
        
        const contexts = batch.map(email => {
          const trimmedBody = sanitizeEmailBody(email.body || '', 2000);
          return createEmailContext(email.subject, trimmedBody);
        });
        
        // Generate all embeddings in one API call (much faster!)
        const embeddings = await generateEmbeddingsBatchHF(contexts, embeddingApiKey);
        
        // Store emails with their embeddings
        for (let idx = 0; idx < batch.length; idx++) {
          const email = batch[idx];
          const embedding = embeddings[idx] || [];
          
          try {
            const isReply = email.isReply ?? /^(re|fwd?):\s*/i.test(email.subject || '');
            const trimmedBody = sanitizeEmailBody(email.body || '', 2000);
            
            const storedEmail = {
              ...email,
              body: trimmedBody,
              embedding,
              isSent: true,
              isReply: isReply,
            };
            
            // Save to database (using same logic as storeSentEmail)
            const storedEmails = await loadStoredEmails();
            const existing = storedEmails.find((e) => e.id === email.id);
            
            if (existing) {
              Object.assign(existing, storedEmail);
            } else {
              storedEmails.push(storedEmail);
            }
            
            await saveStoredEmails(storedEmails);
            processed++;
          } catch (saveError) {
            errors++;
            console.error(`Error saving email ${email.id}:`, saveError);
          }
        }
      } catch (batchError) {
        // If batch fails, fall back to individual processing
        console.warn('Batch embedding failed, falling back to individual:', batchError);
        for (const email of batch) {
          try {
            await storeSentEmail(email);
            processed++;
          } catch (err) {
            errors++;
            console.error(`Error processing email ${email.id}:`, err);
          }
        }
      }
    }
  } else {
    // For local or non-HF providers, process individually with high concurrency
    const CONCURRENCY = isLocal ? emails.length : 30;
    
    for (let i = 0; i < emails.length; i += CONCURRENCY) {
      const batch = emails.slice(i, i + CONCURRENCY);
      
      const results = await Promise.allSettled(
        batch.map(email => storeSentEmail(email))
      );
      
      for (let idx = 0; idx < results.length; idx++) {
        const result = results[idx];
        const email = batch[idx];
        
        if (result.status === 'fulfilled') {
          processed++;
        } else {
          errors++;
          console.error(`Error processing email ${email.id}:`, result.reason);
        }
      }
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
    
    // Count ALL sent emails with embeddings (not just replies)
    const allSentWithEmbeddings = storedEmails.filter(e => e.isSent && e.embedding.length > 0);
    // Also count replies separately for backward compatibility
    const repliesWithEmbeddings = storedEmails.filter(e => e.isSent && e.isReply && e.embedding.length > 0);
    
    const syncState = await getSyncState();

    // Use syncState to determine "pending" so the UI isn't stuck if some
    // embeddings fail and are stored without vectors.
    const pendingFromJob =
      syncState.status === 'running'
        ? Math.max(0, syncState.queued - syncState.processed)
        : 0;

    // When sync is running, use the job's processed count
    // When not running, use the actual stored count
    const actualProcessed = syncState.status === 'running' 
      ? (syncState.processed ?? 0)
      : allSentWithEmbeddings.length;

    return NextResponse.json({
      totalStored: storedEmails.length,
      sentWithEmbeddings: allSentWithEmbeddings.length, // All sent emails with embeddings
      completedReplies: repliesWithEmbeddings.length, // Replies with embeddings (for compatibility)
      pendingReplies: pendingFromJob,
      processing: syncState.status === 'running',
      queued: syncState.queued,
      processed: actualProcessed, // Use actual processed count
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


