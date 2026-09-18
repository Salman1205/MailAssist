/**
 * GET /api/proxy/image - Proxy external images to bypass CORS/auth issues
 * Gmail/Outlook-style image proxy with privacy protection and caching
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateBusinessSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

// A 1x1 transparent GIF returned instead of proxying when a request is rejected.
const TRANSPARENT_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const transparentPixel = (extraHeaders: Record<string, string> = {}) =>
    new NextResponse(TRANSPARENT_GIF, {
        status: 200,
        headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store', ...extraHeaders },
    });

/**
 * SSRF guard: reject hosts that point at the local machine, the cloud metadata
 * service, or private/link-local network ranges. Without this the proxy will
 * happily fetch http://169.254.169.254/... or internal services and return the
 * response to any caller.
 */
function isBlockedHost(hostname: string): boolean {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, ''); // strip IPv6 brackets
    if (!host) return true;
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) return true;
    if (host === 'metadata.google.internal') return true;
    if (host === '::1' || host === '0.0.0.0') return true;
    // IPv4 literal in a private / loopback / link-local / reserved range.
    const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (m) {
        const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
        if (a === 10) return true;                          // 10.0.0.0/8
        if (a === 127) return true;                         // loopback
        if (a === 0) return true;                           // 0.0.0.0/8
        if (a === 169 && b === 254) return true;            // link-local / cloud metadata
        if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
        if (a === 192 && b === 168) return true;            // 192.168.0.0/16
        if (a === 100 && b >= 64 && b <= 127) return true;  // carrier-grade NAT 100.64/10
        if (a >= 224) return true;                          // multicast / reserved
    }
    // IPv6 unique-local / link-local literals.
    if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) return true;
    return false;
}

// Blocklist of known tracking domains (Gmail blocks these)
const TRACKING_DOMAINS = [
    'pixel.', 'track.', 'open.', 'click.', 'beacon.',
    'mailchimp.com/track', 'list-manage.com/track',
    'sendgrid.net/wf/', 'mandrillapp.com/track',
    'hubspot.com/e2t', 'mailgun.org/track',
];

// Size limit for proxied images (10MB like Gmail)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export async function GET(request: NextRequest) {
    try {
        // AUTH: only logged-in users may use the proxy. Without this, anyone on the
        // internet could use our server to fetch arbitrary URLs (SSRF / open proxy).
        const session = await validateBusinessSession();
        if (!session) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const url = request.nextUrl.searchParams.get('url');

        if (!url) {
            return new NextResponse('Missing url parameter', { status: 400 });
        }

        // Decode the URL
        const decodedUrl = decodeURIComponent(url);

        // Validate it's an image URL (basic check)
        if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://')) {
            return new NextResponse('Invalid URL', { status: 400 });
        }

        // SSRF guard: refuse to fetch internal / private / metadata hosts.
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(decodedUrl);
        } catch {
            return new NextResponse('Invalid URL', { status: 400 });
        }
        if (isBlockedHost(parsedUrl.hostname)) {
            return transparentPixel({ 'X-Proxy-Blocked': 'ssrf' });
        }

        // Check if it's a known tracking pixel domain
        const isTracker = TRACKING_DOMAINS.some(domain => decodedUrl.toLowerCase().includes(domain));
        if (isTracker) {
            // Return transparent pixel without fetching (privacy protection)
            const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
            return new NextResponse(transparentGif, {
                status: 200,
                headers: {
                    'Content-Type': 'image/gif',
                    'Cache-Control': 'public, max-age=86400',
                    'X-Proxy-Blocked': 'tracking',
                },
            });
        }

        // Fetch the image with browser-like headers (Gmail-style)
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(decodedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': new URL(decodedUrl).origin,
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site',
            },
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            // Return a transparent 1x1 gif for failed images
            const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
            return new NextResponse(transparentGif, {
                status: 200,
                headers: {
                    'Content-Type': 'image/gif',
                    'Cache-Control': 'public, max-age=86400',
                },
            });
        }

        // Check content type
        const contentType = response.headers.get('content-type') || 'image/png';
        const isImage = contentType.startsWith('image/') || contentType === 'application/octet-stream';
        
        if (!isImage) {
            // Not an image, return transparent pixel
            const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
            return new NextResponse(transparentGif, {
                status: 200,
                headers: {
                    'Content-Type': 'image/gif',
                    'Cache-Control': 'public, max-age=3600',
                },
            });
        }

        // Check content length if available
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > MAX_IMAGE_SIZE) {
            return new NextResponse('Image too large', { status: 413 });
        }

        const buffer = await response.arrayBuffer();
        
        // Double-check size after download
        if (buffer.byteLength > MAX_IMAGE_SIZE) {
            return new NextResponse('Image too large', { status: 413 });
        }

        // Return with aggressive caching (Gmail caches images for weeks)
        return new NextResponse(Buffer.from(buffer), {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=604800, immutable', // 7 days
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Don't log abort errors (timeouts)
        if (errorMessage !== 'This operation was aborted') {
            console.error('[ImageProxy] Error:', errorMessage);
        }
        
        // Return a transparent 1x1 gif for any errors
        const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        return new NextResponse(transparentGif, {
            status: 200,
            headers: {
                'Content-Type': 'image/gif',
                'Cache-Control': 'public, max-age=3600',
            },
        });
    }
}
