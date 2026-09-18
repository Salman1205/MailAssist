/**
 * Finds replies that were accidentally addressed to one of our OWN connected
 * mailboxes instead of the customer (the delivery bug fixed in the reply route).
 *
 * Those messages show as "Sent" in Gmail but never reached the customer. This
 * scans each connected mailbox's Sent folder for messages addressed back to us,
 * and maps each one to the customer it SHOULD have gone to (from the ticket for
 * that thread) so support can re-send a precise list instead of hunting through
 * days of closed tickets.
 *
 * Usage: open /api/admin/misrouted-replies?days=30 while logged in.
 * Auth: requires a logged-in business session (validateBusinessSession).
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateBusinessSession } from '@/lib/session';
import { loadBusinessTokens } from '@/lib/storage';
import { getGmailClient } from '@/lib/gmail';
import { extractBareEmail } from '@/lib/personalize-template';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface MisroutedReply {
    mailbox: string;        // which connected mailbox sent it
    date: string | null;    // when it was sent
    subject: string;
    sentTo: string;         // the (wrong) address it went to — one of ours
    customer: string | null;// who it SHOULD have gone to
    threadId: string | null;
    ticketId: string | null;
    gmailLink: string;      // deep link to open the message in Gmail
}

const getHeader = (headers: any[], name: string): string =>
    headers?.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

export async function GET(request: NextRequest) {
    const businessSession = await validateBusinessSession();
    if (!businessSession) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10) || 30, 1), 90);
    const perMailboxCap = 100;

    // Resolve this tenant's connected mailboxes (email + tokens).
    const accounts = await loadBusinessTokens(
        businessSession.businessId || null,
        businessSession.email || undefined,
    );
    const ourAddresses = new Set(
        accounts.map((a: any) => String(a.email || '').toLowerCase()).filter(Boolean),
    );

    if (accounts.length === 0) {
        return NextResponse.json({ error: 'No connected mailboxes found for this account.' }, { status: 400 });
    }

    const results: MisroutedReply[] = [];
    const scanned: { mailbox: string; sentChecked: number; error?: string }[] = [];

    for (const account of accounts) {
        const mailbox = String(account.email || '').toLowerCase();
        if (!mailbox || !account.tokens?.access_token) {
            scanned.push({ mailbox: mailbox || '(unknown)', sentChecked: 0, error: 'no valid token' });
            continue;
        }

        try {
            const gmail = getGmailClient(account.tokens);
            // Sent messages addressed back to this mailbox itself = the misrouted ones.
            const list = await gmail.users.messages.list({
                userId: 'me',
                maxResults: perMailboxCap,
                q: `in:sent to:me newer_than:${days}d`,
            });
            const ids = (list.data.messages || []).map(m => m.id!).filter(Boolean);

            const metas = await Promise.all(ids.map(async (id) => {
                try {
                    const msg = await gmail.users.messages.get({
                        userId: 'me',
                        id,
                        format: 'metadata',
                        metadataHeaders: ['To', 'Subject', 'Date'],
                    });
                    return msg.data;
                } catch {
                    return null;
                }
            }));

            for (const meta of metas) {
                if (!meta) continue;
                const headers = meta.payload?.headers || [];
                const toRaw = getHeader(headers, 'To');
                const toBare = extractBareEmail(toRaw).toLowerCase();
                // Confirm the recipient really is one of OUR mailboxes.
                if (!toBare || !ourAddresses.has(toBare)) continue;

                results.push({
                    mailbox,
                    date: getHeader(headers, 'Date') || null,
                    subject: getHeader(headers, 'Subject') || '(no subject)',
                    sentTo: toRaw,
                    customer: null, // filled in below from the ticket
                    threadId: meta.threadId || null,
                    ticketId: null,
                    gmailLink: `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(mailbox)}#all/${meta.threadId}`,
                });
            }
            scanned.push({ mailbox, sentChecked: ids.length });
        } catch (e) {
            scanned.push({ mailbox, sentChecked: 0, error: e instanceof Error ? e.message : String(e) });
        }
    }

    // Map each misrouted reply to the customer it should have reached, using the
    // ticket for that thread (one batched query rather than per-message lookups).
    const threadIds = Array.from(new Set(results.map(r => r.threadId).filter(Boolean))) as string[];
    if (supabase && threadIds.length > 0) {
        try {
            const { data: tickets } = await supabase
                .from('tickets')
                .select('id, thread_id, customer_email')
                .in('thread_id', threadIds);
            const byThread = new Map<string, { id: string; customer_email: string | null }>();
            (tickets || []).forEach((t: any) => {
                if (t.thread_id && !byThread.has(t.thread_id)) {
                    byThread.set(t.thread_id, { id: t.id, customer_email: t.customer_email });
                }
            });
            for (const r of results) {
                if (r.threadId && byThread.has(r.threadId)) {
                    const t = byThread.get(r.threadId)!;
                    r.ticketId = t.id;
                    // Only surface a customer that isn't one of our own addresses.
                    const custBare = extractBareEmail(t.customer_email || '').toLowerCase();
                    if (t.customer_email && custBare && !ourAddresses.has(custBare)) {
                        r.customer = t.customer_email;
                    }
                }
            }
        } catch (e) {
            console.warn('[misrouted-replies] ticket lookup failed:', e);
        }
    }

    // Newest first.
    results.sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da;
    });

    return NextResponse.json({
        windowDays: days,
        mailboxesScanned: scanned,
        misroutedCount: results.length,
        note: results.length === 0
            ? 'No misrouted replies found in this window. Try a larger ?days= value (max 90) if the affected replies are older.'
            : 'These replies were addressed to your own mailbox and never reached the customer. Re-send each to the listed customer.',
        replies: results,
    });
}
