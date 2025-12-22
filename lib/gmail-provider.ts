import { EmailProvider, FetchOptions, OutboundEmail, UserProfile } from './email-provider';
import { StoredEmail, StoredTokens } from './storage';
import { fetchInboxEmails, fetchSentEmails, getUserProfile, sendNewEmail, sendReplyMessage } from './gmail';

export class GmailProvider implements EmailProvider {
    private tokens: StoredTokens;

    constructor(tokens: StoredTokens) {
        this.tokens = tokens;
    }

    async verifyConnection(): Promise<boolean> {
        try {
            await getUserProfile(this.tokens);
            return true;
        } catch (error) {
            return false;
        }
    }

    async getProfile(): Promise<UserProfile> {
        const profile = await getUserProfile(this.tokens);
        return {
            email: profile.emailAddress || '',
            name: undefined, // Gmail API profile doesn't always return name directly in this call
        };
    }

    async fetchInbox(options?: FetchOptions): Promise<StoredEmail[]> {
        // Map options to Gmail query
        let query = options?.query;
        if (options?.folder && options.folder !== 'INBOX') {
            query = `${query || ''} label:${options.folder}`.trim();
        }

        // Gmail API uses maxResults, not limit/offset in the same way, but we map it
        const maxResults = options?.limit || 50;

        // We need to map the result from gmail.ts (which returns a specific format) to StoredEmail
        // The existing fetchInboxEmails returns objects that are compatible with StoredEmail mostly
        const emails = await fetchInboxEmails(this.tokens, maxResults, query);

        return emails.map(e => ({
            id: e.id!,
            threadId: e.threadId!,
            subject: e.subject,
            from: e.from,
            to: e.to,
            body: e.body,
            date: e.date,
            embedding: [], // Generated later
            labels: e.labels,
            isSent: false,
            isReply: e.isReply,
            snippet: e.snippet,
        }));
    }

    async fetchSent(options?: FetchOptions): Promise<StoredEmail[]> {
        const maxResults = options?.limit || 50;
        const emails = await fetchSentEmails(this.tokens, maxResults);

        return emails.map(e => ({
            id: e.id!,
            threadId: e.threadId!,
            subject: e.subject,
            from: e.from,
            to: e.to,
            body: e.body,
            date: e.date,
            embedding: [],
            labels: e.labels,
            isSent: true,
            isReply: e.isReply,
            snippet: e.snippet,
        }));
    }

    async sendEmail(email: OutboundEmail): Promise<{ messageId: string }> {
        // Check if it's a reply or new email
        if (email.inReplyTo || email.references) {
            // It's a reply
            const result = await sendReplyMessage(this.tokens, {
                to: Array.isArray(email.to) ? email.to.join(', ') : email.to,
                subject: email.subject,
                body: email.text || '',
                bodyHtml: email.html,
                threadId: undefined, // We might need to pass threadId if available in context
                inReplyTo: email.inReplyTo,
                references: email.references,
                from: undefined, // 'me'
                attachments: email.attachments?.map(a => ({
                    filename: a.filename,
                    mimeType: a.contentType,
                    data: a.content.toString('base64'),
                })),
            });
            return { messageId: result.id! };
        } else {
            // New email
            // Note: sendNewEmail in gmail.ts is a bit limited (doesn't support HTML/attachments well yet)
            // We might need to enhance it or use the more generic sendReplyMessage structure which supports everything
            // For now, we'll use sendReplyMessage structure but without reply headers, effectively sending a new email
            const result = await sendReplyMessage(this.tokens, {
                to: Array.isArray(email.to) ? email.to.join(', ') : email.to,
                subject: email.subject,
                body: email.text || '',
                bodyHtml: email.html,
                attachments: email.attachments?.map(a => ({
                    filename: a.filename,
                    mimeType: a.contentType,
                    data: a.content.toString('base64'),
                })),
            });
            return { messageId: result.id! };
        }
    }
}
