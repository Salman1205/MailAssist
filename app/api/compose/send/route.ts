/**
 * Send new email and create ticket
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendNewEmail } from '@/lib/gmail';
import { getCurrentUserIdFromRequest } from '@/lib/permissions';
import { getCurrentUserEmail } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // CRITICAL FIX: getCurrentUserEmail() already handles business accounts correctly
    // It returns the connected Gmail account email (e.g., support@company.com) for business accounts
    // and the user's Gmail email for personal accounts
    const userEmail = await getCurrentUserEmail();
    if (!userEmail) {
      return NextResponse.json(
        { error: 'No Gmail account connected. Please connect Gmail or ensure your business has connected email accounts.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { recipientEmail, recipientName, subject, body: emailBody, bodyHtml } = body;

    // Normalize attachments exactly like the reply route does. The compose UI
    // sends an `attachments` array; without this normalization + pass-through,
    // sendNewEmail silently dropped every attachment while reporting success.
    const rawAttachments: {
      filename?: string;
      name?: string;
      mimeType?: string;
      type?: string;
      data?: string;
      dataUrl?: string;
    }[] = Array.isArray(body?.attachments) ? body.attachments : [];

    const attachments: { filename: string; mimeType: string; data: string }[] = rawAttachments.map((att) => {
      const filename = att.filename || att.name || 'attachment';
      const mimeType = att.mimeType || att.type || 'application/octet-stream';

      let rawData = att.data || '';
      if (!rawData && att.dataUrl) {
        const parts = att.dataUrl.split(',');
        rawData = parts.length > 1 ? parts[1] : parts[0];
      }

      if (!rawData) {
        throw new Error(`Attachment ${filename} is missing data`);
      }

      return {
        filename,
        mimeType,
        data: rawData,
      };
    });

    if (!recipientEmail || !subject || !emailBody) {
      return NextResponse.json(
        { error: 'Missing required fields: recipientEmail, subject, body' },
        { status: 400 }
      );
    }

    // CRITICAL: Always ensure plain text body has NO HTML tags
    // Import htmlToText for proper HTML to text conversion
    const { htmlToText } = await import('@/lib/html-to-text');
    
    let plainTextBody = emailBody;
    let htmlBody = bodyHtml;
    
    // If emailBody contains HTML tags, strip them completely
    if (plainTextBody && /<[^>]+>/.test(plainTextBody)) {
      // Use htmlToText for proper conversion, preserving formatting
      plainTextBody = htmlToText(plainTextBody);
      // If no separate HTML body was provided, use original as HTML
      if (!htmlBody) {
        htmlBody = emailBody;
      }
    }
    
    // Normalize non-breaking spaces in outgoing HTML to regular spaces
    if (htmlBody) {
      htmlBody = htmlBody.replace(/&nbsp;?/gi, ' ').replace(/\u00A0/g, ' ');
    }

    // If only HTML is provided, extract plain text
    if (htmlBody && (!plainTextBody || plainTextBody.trim() === '')) {
      plainTextBody = htmlToText(htmlBody);
    }
    
    // Final safety check: ensure plain text has no HTML tags
    if (plainTextBody && /<[^>]+>/.test(plainTextBody)) {
      // Strip any remaining HTML tags
      plainTextBody = plainTextBody.replace(/<[^>]+>/g, '').trim();
    }

    // Send email and create ticket
    const result = await sendNewEmail(recipientEmail, recipientName || null, subject, plainTextBody, userId, htmlBody, attachments);

    return NextResponse.json({
      success: true,
      ticketId: result.ticketId,
      messageId: result.messageId,
      message: result.ticketId 
        ? 'Email sent successfully and ticket created!' 
        : 'Email sent successfully, but ticket creation encountered an issue. Please check your sent folder and refresh tickets.',
      partialSuccess: !result.ticketId
    });
  } catch (error) {
    console.error('Error sending email:', error);
    
    // Check if this is a network error that might have still sent the email
    const errorMessage = (error as Error).message;
    if (errorMessage.includes('ECONNRESET') || errorMessage.includes('timeout')) {
      return NextResponse.json(
        { 
          error: 'Email may have been sent but connection was interrupted. Please check your sent folder and refresh tickets.',
          partialSuccess: true
        },
        { status: 207 } // 207 Multi-Status for partial success
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to send email', details: errorMessage },
      { status: 500 }
    );
  }
}