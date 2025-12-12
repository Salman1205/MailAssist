/**
 * Generate draft reply for a specific email
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidTokens } from '@/lib/token-refresh';
import { getEmailById, getThreadById } from '@/lib/gmail';
import { getSentEmails, storeDraft, loadDrafts, saveDrafts } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { generateDraftReply } from '@/lib/ai-draft';
import { listKnowledge } from '@/lib/knowledge';
import { getGuardrails } from '@/lib/guardrails';
import { getCurrentUserIdFromRequest, getSessionUserEmailFromRequest } from '@/lib/session';

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
    const userEmail = getSessionUserEmailFromRequest(request as any);
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

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

    // Get past sent emails for style matching (already optimized in getSentEmails)
    const pastEmails = await getSentEmails();
    
    // Optimized debug logging - only load minimal data for stats
    const userEmail = getSessionUserEmailFromRequest(request as any);
    if (userEmail && supabase) {
      try {
        const { data: stats } = await supabase
          .from('emails')
          .select('id, is_reply, embedding', { count: 'exact' })
          .eq('is_sent', true)
          .eq('user_email', userEmail)
          .limit(1000); // Reasonable limit for stats
        
        const sentWithEmbeddings = stats?.filter(e => e.embedding && Array.isArray(e.embedding) && e.embedding.length > 0).length || 0;
        const sentWithoutEmbeddings = stats?.filter(e => !e.embedding || !Array.isArray(e.embedding) || e.embedding.length === 0).length || 0;
        const repliesWithEmbeddings = stats?.filter(e => e.is_reply && e.embedding && Array.isArray(e.embedding) && e.embedding.length > 0).length || 0;
        
        console.log(`[Draft] Total stored: ${stats?.length || 0}, Sent with embeddings: ${sentWithEmbeddings}, Sent without embeddings: ${sentWithoutEmbeddings}, Replies with embeddings: ${repliesWithEmbeddings}, Past emails for matching: ${pastEmails.length}`);
      } catch (error) {
        // Non-critical, just skip stats logging
        console.log(`[Draft] Past emails for matching: ${pastEmails.length}`);
      }
    }

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

    // Load knowledge base and guardrails (scoped to current email account)
    const [knowledgeItems, guardrails] = await Promise.all([
      listKnowledge(userEmail),
      getGuardrails(userEmail),
    ])

    // Get current user ID for logging
    const userId = getCurrentUserIdFromRequest(request);
    
    // Try to find associated ticket for logging
    let ticketId: string | null = null;
    try {
      const { getTicketByThreadId } = await import('@/lib/tickets');
      if (incomingEmail.threadId && userEmail) {
        const ticket = await getTicketByThreadId(incomingEmail.threadId, userEmail);
        if (ticket) {
          ticketId = ticket.id;
        }
      }
    } catch (ticketError) {
      // Non-critical - continue without ticket ID
      console.warn('[Draft] Could not find ticket for logging:', ticketError);
    }

    // Check if this is a regeneration (query param or check if draft exists)
    const url = new URL(request.url);
    const isRegeneration = url.searchParams.get('regenerate') === 'true';
    
    // Check for existing draft for this email
    let existingDraftId: string | null = null;
    if (userEmail) {
      try {
        const drafts = await loadDrafts(userId || null);
        const existingDraft = drafts.find(d => d.emailId === (incomingEmail.id || emailId));
        if (existingDraft) {
          existingDraftId = existingDraft.id;
        }
      } catch (error) {
        console.warn('[Draft] Could not check for existing draft:', error);
      }
    }

    // Generate draft reply
    let draft: string;
    try {
      draft = await generateDraftReply(
        incomingEmail,
        pastEmails,
        groqApiKey,
        conversationMessages,
        knowledgeItems || [],
        guardrails,
        {
          userEmail,
          userId: userId || null,
          ticketId,
          draftId: existingDraftId || null, // Use existing draft ID if available
          isRegeneration: isRegeneration || !!existingDraftId, // Mark as regeneration if param set or existing draft found
        }
      );
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

    // Save draft (upsert if regenerating)
    let savedDraft;
    try {
      if (existingDraftId && isRegeneration) {
        // Update existing draft
        const drafts = await loadDrafts(userId || null);
        const draftIndex = drafts.findIndex(d => d.id === existingDraftId);
        if (draftIndex >= 0) {
          drafts[draftIndex] = {
            ...drafts[draftIndex],
            draftText: draft,
            createdAt: new Date().toISOString(),
          };
          await saveDrafts(drafts, userId || null);
          savedDraft = drafts[draftIndex];
        } else {
          // Draft not found, create new one
          savedDraft = await storeDraft({
            emailId: incomingEmail.id || emailId,
            subject: incomingEmail.subject || '',
            from: incomingEmail.from || '',
            to: incomingEmail.to || '',
            originalBody: incomingEmail.body || incomingEmail.snippet || '',
            draftText: draft,
          }, userId || null);
        }
      } else {
        // Create new draft
        savedDraft = await storeDraft({
          emailId: incomingEmail.id || emailId,
          subject: incomingEmail.subject || '',
          from: incomingEmail.from || '',
          to: incomingEmail.to || '',
          originalBody: incomingEmail.body || incomingEmail.snippet || '',
          draftText: draft,
        }, userId || null);
      }
      
      // Update AI usage log with draft ID if we have it
      // Note: The log was created in generateDraftReply, but we can't update it easily
      // In a production system, you might want to query and update the most recent log
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

