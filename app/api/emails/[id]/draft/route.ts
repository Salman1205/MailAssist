/**
 * Generate draft reply for a specific email
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidTokens } from '@/lib/token-refresh';
import { getEmailById, getThreadById } from '@/lib/gmail';
import { getSentEmails, storeDraft, loadStoredEmails } from '@/lib/storage';
import { generateDraftReply } from '@/lib/ai-draft';

type RouteContext =
  | { params: { id: string } }
  | { params: Promise<{ id: string }> };

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const paramsData = await Promise.resolve((context as any).params);
    let emailId = paramsData?.id;
    if (!emailId) {
      const segments = request.nextUrl.pathname.split('/');
      emailId = decodeURIComponent(segments[segments.length - 2] || '');
    }

    if (!emailId) {
      return NextResponse.json(
        { error: 'Missing email id' },
        { status: 400 }
      );
    }

    const groqApiKey = process.env.GROQ_API_KEY;

    if (!groqApiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Load and refresh tokens if needed
    const tokens = await getValidTokens();
    
    if (!tokens || !tokens.access_token) {
      return NextResponse.json(
        { error: 'Not authenticated. Please connect Gmail first.' },
        { status: 401 }
      );
    }

    // Fetch the specific email
    const incomingEmail = await getEmailById(tokens, emailId);
    
    if (!incomingEmail) {
      return NextResponse.json(
        { error: 'Email not found' },
        { status: 404 }
      );
    }

    // Get past sent emails for style matching
    const pastEmails = await getSentEmails();
    
    // Debug logging
    const allStored = await loadStoredEmails();
    const sentWithEmbeddings = allStored.filter(e => e.isSent && e.embedding.length > 0);
    const sentWithoutEmbeddings = allStored.filter(e => e.isSent && e.embedding.length === 0);
    const repliesWithEmbeddings = allStored.filter(e => e.isSent && e.isReply && e.embedding.length > 0);
    
    console.log(`[Draft] Total stored: ${allStored.length}, Sent with embeddings: ${sentWithEmbeddings.length}, Sent without embeddings: ${sentWithoutEmbeddings.length}, Replies with embeddings: ${repliesWithEmbeddings.length}, Past emails for matching: ${pastEmails.length}`);

    // If no past emails, return a simple fallback draft (same as before)
    if (pastEmails.length === 0) {
      console.warn(`[Draft] No past emails with embeddings found. Total stored: ${allStored.length}, Sent: ${allStored.filter(e => e.isSent).length}`);
      return NextResponse.json(
        { 
          error: 'No past emails found for style matching. Please send some emails first.',
          draft: 'I received your email and will get back to you soon.' // Fallback draft
        },
        { status: 200 }
      );
    }
    
    // Ensure pastEmails have valid structure (safety check)
    const validPastEmails = pastEmails.filter(e => e && e.id && (e.embedding?.length > 0 || true)); // Allow emails without embeddings as fallback
    if (validPastEmails.length === 0) {
      console.warn(`[Draft] No valid past emails found after filtering`);
      return NextResponse.json(
        { 
          error: 'No valid past emails found for style matching.',
          draft: 'I received your email and will get back to you soon.'
        },
        { status: 200 }
      );
    }

    // Load conversation history (full thread) for better context
    let conversationMessages: {
      id: string;
      subject: string;
      from: string;
      to: string;
      body: string;
      date?: string;
    }[] = [];
    try {
      const threadIdForContext = incomingEmail.threadId || incomingEmail.id;
      const thread = await getThreadById(tokens, threadIdForContext);
      conversationMessages = thread.messages || [];
    } catch (threadError) {
      console.warn('[Draft] Could not load conversation thread for context:', threadError);
    }

    // Generate draft reply
    let draft: string;
    try {
      draft = await generateDraftReply(incomingEmail, pastEmails, groqApiKey, conversationMessages);
    } catch (draftError) {
      console.error('[Draft] Error in generateDraftReply:', draftError);
      const errorMessage = draftError instanceof Error ? draftError.message : String(draftError);
      
      // If it's a Groq API error, provide more details
      if (errorMessage.includes('Groq API') || errorMessage.includes('401') || errorMessage.includes('403')) {
        return NextResponse.json(
          { 
            error: 'Failed to generate draft',
            details: errorMessage,
            hint: 'Please check your GROQ_API_KEY environment variable'
          },
          { status: 500 }
        );
      }
      
      throw draftError; // Re-throw to be caught by outer catch
    }

    // Save draft
    let savedDraft;
    try {
      savedDraft = await storeDraft({
        emailId: incomingEmail.id || emailId,
        subject: incomingEmail.subject || '',
        from: incomingEmail.from || '',
        to: incomingEmail.to || '',
        originalBody: incomingEmail.body || incomingEmail.snippet || '',
        draftText: draft,
      });
    } catch (storeError) {
      console.error('[Draft] Error storing draft:', storeError);
      // Still return the draft even if storing fails
      return NextResponse.json({ 
        draft,
        emailId: incomingEmail.id,
        subject: incomingEmail.subject,
        draftId: null,
        warning: 'Draft generated but could not be saved'
      });
    }

    return NextResponse.json({ 
      draft,
      emailId: incomingEmail.id,
      subject: incomingEmail.subject,
      draftId: savedDraft.id,
    });
  } catch (error) {
    console.error('[Draft] Unexpected error generating draft:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json(
      { 
        error: 'Failed to generate draft',
        details: errorMessage,
        ...(errorStack && { stack: errorStack })
      },
      { status: 500 }
    );
  }
}

