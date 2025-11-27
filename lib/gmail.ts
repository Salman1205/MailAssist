/**
 * Gmail API utilities for fetching emails and managing OAuth tokens
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Initialize OAuth2 client
export function getOAuth2Client(): OAuth2Client {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing Gmail OAuth2 credentials in environment variables');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Get OAuth2 authorization URL for Gmail authentication
 */
export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();
  
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent', // Force consent to get refresh token
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function getTokensFromCode(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Set credentials and get authenticated Gmail client
 */
export function getGmailClient(tokens: { access_token?: string | null; refresh_token?: string | null }) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(tokens);
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

interface SendReplyOptions {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  from?: string;
}

/**
 * Send a reply email through Gmail
 */
export async function sendReplyMessage(
  tokens: { access_token?: string | null; refresh_token?: string | null },
  options: SendReplyOptions
) {
  const gmail = getGmailClient(tokens);
  const {
    to,
    subject,
    body,
    threadId,
    inReplyTo,
    references,
    from,
  } = options;

  const headers = [
    `To: ${to}`,
    from ? `From: ${from}` : null,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
    references ? `References: ${references}` : null,
  ]
    .filter(Boolean)
    .join('\r\n');

  const normalizedBody = body.replace(/\r?\n/g, '\r\n');
  const message = `${headers}\r\n\r\n${normalizedBody}`;
  const encodedMessage = encodeBase64Url(message);

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
      threadId,
    },
  });

  return response.data;
}

/**
 * Fetch latest inbox emails
 */
export async function fetchInboxEmails(
  tokens: { access_token?: string | null; refresh_token?: string | null },
  maxResults: number = 50
) {
  const gmail = getGmailClient(tokens);
  
  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    q: 'in:inbox',
  });

  const messages = response.data.messages || [];
  const emailDetails = await Promise.all(
    messages.map(async (message) => {
      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
        format: 'full',
      });
      return parseEmailMessage(fullMessage.data);
    })
  );

  return emailDetails;
}

/**
 * Fetch sent emails history
 */
export async function fetchSentEmails(
  tokens: { access_token?: string | null; refresh_token?: string | null },
  maxResults: number = 100
) {
  const gmail = getGmailClient(tokens);
  
  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    q: 'in:sent',
  });

  const messages = response.data.messages || [];
  const emailDetails = await Promise.all(
    messages.map(async (message) => {
      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
        format: 'full',
      });
      return parseEmailMessage(fullMessage.data);
    })
  );

  return emailDetails;
}

/**
 * Get a specific email by ID
 */
export async function getEmailById(
  tokens: { access_token?: string | null; refresh_token?: string | null },
  emailId: string
) {
  const gmail = getGmailClient(tokens);
  
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: emailId,
    format: 'full',
  });

  return parseEmailMessage(response.data);
}

/**
 * Get user profile information
 */
export async function getUserProfile(
  tokens: { access_token?: string | null; refresh_token?: string | null }
) {
  const gmail = getGmailClient(tokens);
  
  const response = await gmail.users.getProfile({
    userId: 'me',
  });

  return {
    emailAddress: response.data.emailAddress,
    messagesTotal: response.data.messagesTotal,
    threadsTotal: response.data.threadsTotal,
    historyId: response.data.historyId,
  };
}

/**
 * Parse Gmail message format into a simpler structure
 */
function parseEmailMessage(message: any) {
  const headers = message.payload?.headers || [];
  const getHeader = (name: string) => 
    headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  // Extract body text
  let bodyText = '';
  if (message.payload?.body?.data) {
    bodyText = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
  } else if (message.payload?.parts) {
    // Handle multipart messages
    for (const part of message.payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
        break;
      } else if (part.mimeType === 'text/html' && part.body?.data && !bodyText) {
        // Fallback to HTML if plain text not available
        const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
        // Simple HTML to text conversion (remove tags)
        bodyText = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
      }
    }
  }

  // Determine if this is a reply by checking for inReplyTo or References headers
  // Also check if subject starts with "Re:" or "RE:" or "Fwd:" or "FWD:"
  const inReplyTo = getHeader('in-reply-to');
  const references = getHeader('references');
  const subject = getHeader('subject');
  const messageIdHeader = getHeader('message-id');
  const isReply = Boolean(
    inReplyTo || 
    references || 
    /^(re|fwd?):\s*/i.test(subject)
  );

  return {
    id: message.id,
    threadId: message.threadId,
    messageId: messageIdHeader,
    snippet: message.snippet || '',
    subject,
    from: getHeader('from'),
    to: getHeader('to'),
    date: getHeader('date'),
    body: bodyText,
    labels: message.labelIds || [],
    isReply,
  };
}

function encodeBase64Url(input: string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}


