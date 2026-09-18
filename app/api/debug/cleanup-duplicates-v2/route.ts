import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * DISABLED. This debug endpoint scanned and DELETED tickets across EVERY tenant
 * with no authentication — an unauthenticated destructive, cross-tenant operation.
 * It now returns 404 unconditionally. If a duplicate cleanup is ever needed it
 * must be run as an authenticated, tenant-scoped admin task.
 */
export async function GET() {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
