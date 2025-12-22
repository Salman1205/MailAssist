import { StoredEmail } from './storage';

export interface EmailAddress {
    name?: string;
    address: string;
}

export interface EmailAttachment {
    filename: string;
    contentType: string;
    content: Buffer | string; // Base64 string or Buffer
}

export interface OutboundEmail {
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    text?: string;
    html?: string;
    attachments?: EmailAttachment[];
    replyTo?: string;
    inReplyTo?: string;
    references?: string;
}

export interface FetchOptions {
    limit?: number;
    since?: Date;
    folder?: string; // 'INBOX', 'Sent', etc.
    query?: string;
}

export interface UserProfile {
    email: string;
    name?: string;
}

export interface EmailProvider {
    /**
     * Fetch emails from the inbox
     */
    fetchInbox(options?: FetchOptions): Promise<StoredEmail[]>;

    /**
     * Fetch sent emails
     */
    fetchSent(options?: FetchOptions): Promise<StoredEmail[]>;

    /**
     * Send an email
     */
    sendEmail(email: OutboundEmail): Promise<{ messageId: string }>;

    /**
     * Get the user's profile information
     */
    getProfile(): Promise<UserProfile>;

    /**
     * Verify connection settings
     */
    verifyConnection(): Promise<boolean>;
}
