/**
 * GET /api/emails/[id]/attachments/[attachmentId] - Download an email attachment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGmailClient } from '@/lib/gmail';

export const dynamic = 'force-dynamic';
// Large attachments (video "footage", etc.) need headroom to fetch + stream.
export const maxDuration = 60;

/**
 * Properly encode filename for Content-Disposition header
 * Uses RFC 2231 encoding for international characters
 * Provides both filename and filename* for maximum browser compatibility
 */
function encodeFilename(filename: string): string {
    // Sanitize filename - remove any control characters and problematic characters
    let sanitized = filename.replace(/[\x00-\x1F\x7F]/g, '').trim();

    // Ensure we have a valid filename
    if (!sanitized || sanitized.length === 0) {
        sanitized = 'attachment';
    }

    // Check if filename contains non-ASCII characters
    const hasNonAscii = /[^\x00-\x7F]/.test(sanitized);

    if (hasNonAscii) {
        // Use RFC 2231 encoding with UTF-8 for non-ASCII
        const encoded = encodeURIComponent(sanitized).replace(/'/g, "%27");
        // Provide ASCII fallback for older browsers
        const asciiFallback = sanitized.replace(/[^\x20-\x7E]/g, '_').substring(0, 100);
        return `filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
    } else {
        // For ASCII-only filenames, use simple quoted string
        // Escape quotes and backslashes, but keep spaces and other valid chars
        const escaped = sanitized.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        return `filename="${escaped}"`;
    }
}

// Only these MIME types may be served INLINE (rendered in the browser). Anything
// else — critically text/html, image/svg+xml, XML and any text/* — is forced to
// download instead, so a malicious email attachment can never execute script on
// our origin (stored XSS). SVG is deliberately excluded: it can carry scripts.
const INLINE_SAFE_MIME = new Set<string>([
    'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp', 'image/avif',
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
    'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/aac',
    'application/pdf', 'text/plain',
]);

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string; attachmentId: string }> }
) {
    try {
        const { id: messageId, attachmentId } = await context.params;

        if (!messageId || !attachmentId) {
            console.error('[Attachment] Missing required parameters:', { messageId: !!messageId, attachmentId: !!attachmentId });
            return new NextResponse('Missing required parameters', { status: 400 });
        }

        // Log attachment ID length for debugging (very long IDs might cause issues)
        if (attachmentId.length > 200) {
            console.log(`[Attachment] Very long attachment ID detected: ${attachmentId.length} characters`);
        }

        // Resolve the mailbox by fan-out: the message (and thus the attachment)
        // may live in ANY connected mailbox, not just the session's primary one.
        const { validateBusinessSession, getSessionUserEmail } = await import('@/lib/session');
        const { withMailboxFallback } = await import('@/lib/mailbox-resolver');
        const businessSession = await validateBusinessSession();
        const sessionEmail = businessSession ? businessSession.email : await getSessionUserEmail();

        const { result: attachmentData, accountEmail } = await withMailboxFallback<string>(
            { businessId: businessSession?.businessId || null, sessionEmail },
            async (tokens) => {
                const gmail = getGmailClient(tokens);
                const res = await gmail.users.messages.attachments.get({
                    userId: 'me',
                    messageId,
                    id: attachmentId,
                });
                return res?.data?.data || null;
            }
        );

        if (!attachmentData) {
            console.error(`[Attachment] Not found in any connected mailbox: msg ${messageId}, att ${attachmentId}`);
            return new NextResponse('Attachment not found', { status: 404 });
        }
        console.log(`[Attachment] Fetched ${attachmentId} from mailbox ${accountEmail}`);

        // Decode base64url encoded data
        let base64 = attachmentData.replace(/-/g, '+').replace(/_/g, '/');

        // Add padding if needed (base64 strings must be multiples of 4)
        const padding = base64.length % 4;
        if (padding) {
            base64 += '='.repeat(4 - padding);
        }

        let buffer: Buffer;
        try {
            buffer = Buffer.from(base64, 'base64');
        } catch (decodeError) {
            console.error('[Attachment] Base64 decode error:', decodeError);
            return new NextResponse('Failed to decode attachment data', { status: 500 });
        }

        if (!buffer || buffer.length === 0) {
            return new NextResponse('Invalid attachment data', { status: 500 });
        }

        // Get filename from query param if provided (with safe decoding)
        let filename = 'attachment';
        try {
            const filenameParam = request.nextUrl.searchParams.get('filename');
            if (filenameParam) {
                filename = decodeURIComponent(filenameParam);
            }
        } catch (e) {
            // If decoding fails, use the raw parameter or default
            const filenameParam = request.nextUrl.searchParams.get('filename');
            filename = filenameParam || 'attachment';
        }

        const requestedMime = (request.nextUrl.searchParams.get('mimeType') || 'application/octet-stream').toLowerCase().split(';')[0].trim();

        // `?disposition=inline` opens the file in the browser (new tab) — but ONLY
        // for types that cannot execute script. For everything else we force a
        // download, and for the download path we serve a neutral content type so a
        // scriptable file can never be rendered on our origin.
        const wantsInline = request.nextUrl.searchParams.get('disposition') === 'inline';
        const safeInline = wantsInline && INLINE_SAFE_MIME.has(requestedMime);
        const mimeType = safeInline ? requestedMime : 'application/octet-stream';
        const contentDisposition = `${safeInline ? 'inline' : 'attachment'}; ${encodeFilename(filename)}`;

        console.log(`[Attachment] Serving attachment: ${filename} (${buffer.length} bytes, type: ${mimeType}, inline: ${wantsInline})`);

        const SMALL_LIMIT = 4 * 1024 * 1024; // stay under Vercel's ~4.5MB buffered-body cap

        // Small files: return a single buffered body — the simple, reliable path.
        if (buffer.length <= SMALL_LIMIT) {
            return new NextResponse(new Uint8Array(buffer), {
                status: 200,
                headers: {
                    'Content-Type': mimeType,
                    'Content-Disposition': contentDisposition,
                    'Content-Length': String(buffer.length),
                    'Cache-Control': 'private, max-age=3600',
                    'X-Content-Type-Options': 'nosniff',
                },
            });
        }

        // Large files (e.g. video "footage"): a single buffered body exceeds the
        // platform cap and silently fails. Stream the bytes out in chunks. We do
        // NOT set Content-Length here — pinning it to a streamed body is what left
        // the browser's download stuck at "downloading…" with nothing delivered.
        const CHUNK = 256 * 1024;
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                for (let i = 0; i < buffer.length; i += CHUNK) {
                    controller.enqueue(new Uint8Array(buffer.subarray(i, i + CHUNK)));
                }
                controller.close();
            },
        });

        return new NextResponse(stream, {
            status: 200,
            headers: {
                'Content-Type': mimeType,
                'Content-Disposition': contentDisposition,
                'Cache-Control': 'private, max-age=3600',
                'X-Content-Type-Options': 'nosniff',
            },
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Attachment] Error downloading:', errorMessage);
        return new NextResponse(`Error fetching attachment: ${errorMessage}`, { status: 500 });
    }
}
