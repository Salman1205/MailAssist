/**
 * Send a previously generated draft as a reply via Gmail
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidTokens } from '@/lib/token-refresh';
import { getEmailById, getUserProfile, sendReplyMessage } from '@/lib/gmail';
import { storeSentEmail, loadDrafts, deleteDraft } from '@/lib/storage';
import { logAIUsage } from '@/lib/analytics';
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

    let body: { draftText?: string; draftId?: string } | null = null;
    try {
      body = await request.json();
    } catch {
      // ignore - body stays null
    }

    const sentDraftText = body?.draftText ?? '';
    const draftText = sentDraftText.trim();
    if (!draftText) {
      return NextResponse.json(
        { error: 'Draft text is required to send a reply' },
        { status: 400 }
      );
    }

    // Get user info for logging
    const userEmail = getSessionUserEmailFromRequest(request as any);
    const userId = getCurrentUserIdFromRequest(request as any);
    
    // Find the original draft to compare if it was edited
    let originalDraftText = '';
    let draftId = body?.draftId || null;
    let wasEdited = false;
    
    if (draftId && userEmail) {
      try {
        const drafts = await loadDrafts(userId || null);
        const originalDraft = drafts.find(d => d.id === draftId);
        if (originalDraft) {
          originalDraftText = originalDraft.draftText;
          // Compare original vs sent to determine if edited
          wasEdited = originalDraftText.trim() !== draftText.trim();
        }
      } catch (error) {
        console.warn('[Reply] Could not load original draft for comparison:', error);
      }
    }

    const tokens = await getValidTokens();
    if (!tokens || !tokens.access_token) {
      return NextResponse.json(
        { error: 'Not authenticated. Please connect Gmail first.' },
        { status: 401 }
      );
    }

    const incomingEmail = await getEmailById(tokens, emailId);
    if (!incomingEmail) {
      return NextResponse.json(
        { error: 'Email not found' },
        { status: 404 }
      );
    }

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
      console.warn('[Reply] Could not find ticket for logging:', ticketError);
    }

    const replyRecipient = incomingEmail.from || incomingEmail.to;
    if (!replyRecipient) {
      return NextResponse.json(
        { error: 'Unable to determine reply recipient for this email' },
        { status: 400 }
      );
    }

    const baseSubject = incomingEmail.subject?.trim() || '(No subject)';
    const replySubject = /^re:/i.test(baseSubject)
      ? baseSubject
      : `Re: ${baseSubject}`;

    let fromAddress: string | undefined;
    try {
      const profile = await getUserProfile(tokens);
      fromAddress = profile?.emailAddress || undefined;
    } catch {
      // best-effort, fallback handled below
    }

    const sentMessage = await sendReplyMessage(tokens, {
      to: replyRecipient,
      from: fromAddress,
      subject: replySubject,
      body: draftText,
      threadId: incomingEmail.threadId,
      inReplyTo: incomingEmail.messageId,
      references: incomingEmail.messageId,
    });

    if (sentMessage?.id) {
      const storedFrom = fromAddress || incomingEmail.to || 'me';
      try {
        await storeSentEmail({
          id: sentMessage.id,
          threadId: sentMessage.threadId ?? incomingEmail.threadId,
          subject: replySubject,
          from: storedFrom,
          to: replyRecipient,
          body: draftText,
          date: new Date().toISOString(),
          labels: sentMessage.labelIds ?? [],
          isReply: true,
        });
      } catch (storeError) {
        console.warn('[Reply] Unable to store sent email metadata:', storeError);
      }

      // Log AI usage: draft sent
      if (userEmail) {
        logAIUsage({
          userEmail,
          userId: userId || null,
          ticketId,
          action: 'draft_sent',
          draftId: draftId || null,
          wasEdited,
          wasSent: true,
          draftLength: draftText.length,
        }).catch((error) => {
          console.error('[Reply] Failed to log AI usage:', error);
          // Don't throw - logging failures shouldn't break the app
        });
      }

      // Delete the draft after successful send
      if (draftId) {
        try {
          await deleteDraft(draftId, userId || null);
        } catch (deleteError) {
          console.warn('[Reply] Failed to delete draft after sending:', deleteError);
          // Don't throw - draft deletion failure shouldn't break the send
        }
      }
    }

    return NextResponse.json({
      success: true,
      messageId: sentMessage?.id ?? null,
      threadId: sentMessage?.threadId ?? incomingEmail.threadId ?? null,
    });
  } catch (error) {
    console.error('[Reply] Failed to send draft reply:', error);
    return NextResponse.json(
      {
        error: 'Failed to send reply',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}


