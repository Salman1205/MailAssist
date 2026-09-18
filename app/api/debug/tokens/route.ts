import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * DISABLED. This debug endpoint previously returned EVERY business's connected
 * mailboxes (user_email + business_id) with no authentication — a cross-tenant
 * information disclosure. It has no legitimate production use, so it now returns
 * 404 unconditionally.
 */
export async function GET() {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
