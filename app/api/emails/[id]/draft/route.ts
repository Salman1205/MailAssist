/**
 * Generate draft reply for a specific email
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidTokens } from '@/lib/token-refresh';
import { getEmailById } from '@/lib/gmail';
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

    // Generate draft reply
    const draft = await generateDraftReply(incomingEmail, pastEmails, groqApiKey);

    const savedDraft = await storeDraft({
      emailId: incomingEmail.id || emailId,
      subject: incomingEmail.subject || '',
      from: incomingEmail.from || '',
      to: incomingEmail.to || '',
      originalBody: incomingEmail.body || incomingEmail.snippet || '',
      draftText: draft,
    });

    return NextResponse.json({ 
      draft,
      emailId: incomingEmail.id,
      subject: incomingEmail.subject,
      draftId: savedDraft.id,
    });
  } catch (error) {
    console.error('Error generating draft:', error);
    return NextResponse.json(
      { error: 'Failed to generate draft', details: (error as Error).message },
      { status: 500 }
    );
  }
}

