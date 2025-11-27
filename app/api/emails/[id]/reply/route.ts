/**
 * Send a previously generated draft as a reply via Gmail
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidTokens } from '@/lib/token-refresh';
import { getEmailById, getUserProfile, sendReplyMessage } from '@/lib/gmail';
import { storeSentEmail } from '@/lib/storage';

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

    let body: { draftText?: string } | null = null;
    try {
      body = await request.json();
    } catch {
      // ignore - body stays null
    }

    const originalDraftText = body?.draftText ?? '';
    const draftText = originalDraftText.trim();
    if (!draftText) {
      return NextResponse.json(
        { error: 'Draft text is required to send a reply' },
        { status: 400 }
      );
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
      body: originalDraftText,
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
          body: originalDraftText,
          date: new Date().toISOString(),
          labels: sentMessage.labelIds ?? [],
          isReply: true,
        });
      } catch (storeError) {
        console.warn('[Reply] Unable to store sent email metadata:', storeError);
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


