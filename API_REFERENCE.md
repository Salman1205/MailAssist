# API Reference

Quick reference for all backend API endpoints.

## Base URL

All endpoints are prefixed with `/api`

## Authentication Endpoints

### Get Gmail Auth URL
```
GET /api/auth/gmail
```

Returns the OAuth2 authorization URL.

**Response:**
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

**Usage:**
```javascript
const response = await fetch('/api/auth/gmail');
const { authUrl } = await response.json();
window.location.href = authUrl; // Redirect user to Google
```

---

### OAuth Callback
```
GET /api/auth/gmail/callback?code=...&error=...
```

Handles OAuth callback from Google. Automatically redirects to frontend.

**Query Parameters:**
- `code`: Authorization code (provided by Google)
- `error`: Error message if authentication failed

**Response:** Redirects to frontend with `?auth=success` or `?auth=error&message=...`

---

### Logout
```
POST /api/auth/logout
```

Clears stored authentication tokens.

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## Email Endpoints

### Fetch Emails
```
GET /api/emails?type=inbox&maxResults=50
```

Fetches emails from Gmail (inbox or sent).

**Query Parameters:**
- `type`: `"inbox"` (default) or `"sent"`
- `maxResults`: Number of emails to fetch (default: 50)

**Response:**
```json
{
  "emails": [
    {
      "id": "18c1234567890abc",
      "threadId": "18c1234567890def",
      "subject": "Meeting Tomorrow",
      "from": "sender@example.com",
      "to": "you@example.com",
      "date": "Mon, 1 Jan 2024 10:00:00 -0800",
      "body": "Email body text...",
      "snippet": "Email preview snippet...",
      "labels": ["INBOX", "UNREAD"]
    }
  ],
  "count": 10
}
```

**Usage:**
```javascript
// Fetch inbox emails
const response = await fetch('/api/emails?type=inbox&maxResults=20');
const { emails } = await response.json();

// Fetch sent emails
const response = await fetch('/api/emails?type=sent&maxResults=100');
const { emails } = await response.json();
```

---

### Generate Draft Reply
```
POST /api/emails/[emailId]/draft
```

Generates an AI-powered draft reply for a specific email.

**Path Parameters:**
- `emailId`: The Gmail message ID

**Response:**
```json
{
  "draft": "Hi,\n\nThanks for your email. I'll get back to you soon.\n\nBest regards",
  "emailId": "18c1234567890abc",
  "subject": "Re: Meeting Tomorrow"
}
```

**Error Response (no past emails):**
```json
{
  "error": "No past emails found for style matching. Please send some emails first.",
  "draft": "I received your email and will get back to you soon."
}
```

**Usage:**
```javascript
const emailId = "18c1234567890abc";
const response = await fetch(`/api/emails/${emailId}/draft`, {
  method: 'POST'
});
const { draft, subject } = await response.json();
```

---

## Error Responses

All endpoints may return error responses with the following format:

```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

**Common Status Codes:**
- `200`: Success
- `400`: Bad Request (missing/invalid parameters)
- `401`: Unauthorized (not authenticated)
- `404`: Not Found
- `500`: Internal Server Error

---

## Frontend Integration Example

```typescript
// 1. Authenticate
async function connectGmail() {
  const res = await fetch('/api/auth/gmail');
  const { authUrl } = await res.json();
  window.location.href = authUrl;
}

// 2. Fetch inbox emails
async function getInboxEmails() {
  const res = await fetch('/api/emails?type=inbox');
  if (!res.ok) {
    if (res.status === 401) {
      // Not authenticated, redirect to connect
      connectGmail();
      return;
    }
    throw new Error('Failed to fetch emails');
  }
  const { emails } = await res.json();
  return emails;
}

// 3. Generate draft
async function generateDraft(emailId: string) {
  const res = await fetch(`/api/emails/${emailId}/draft`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to generate draft');
  const { draft } = await res.json();
  return draft;
}

// 4. Logout
async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
}
```

---

### Sync Endpoint (Bulk Processing)

#### `POST /api/emails/sync?maxResults=100`
Background sync for processing sent emails with embeddings. Returns immediately and processes in background.

**Response:**
```json
{
  "message": "Email processing started in background",
  "queued": 50,
  "total": 100
}
```

#### `GET /api/emails/sync`
Get sync status.

**Response:**
```json
{
  "totalStored": 150,
  "sentWithEmbeddings": 100,
  "lastSync": 1704067200000
}
```

**Usage:**
```javascript
// After initial Gmail connection, sync all sent emails
await fetch('/api/emails/sync?maxResults=500', { method: 'POST' });

// Check sync status
const status = await fetch('/api/emails/sync');
const { sentWithEmbeddings } = await status.json();
```

---

## Notes

- All endpoints automatically refresh OAuth tokens if expired
- Sent emails are automatically stored with embeddings when fetched via `/api/emails?type=sent`
- **For fast initial setup**: Use `/api/emails/sync` to process all sent emails in the background
- Draft generation requires at least one sent email with embedding for style matching
- Embeddings are generated in batches (10 at a time) with rate limiting
- The `data/` directory is created automatically and stores:
  - `emails.json`: All stored emails with embeddings
  - `tokens.json`: OAuth tokens (sensitive, excluded from git)

## Performance Tips

1. **First Time Setup**: After connecting Gmail, call `POST /api/emails/sync?maxResults=500` to process all sent emails in the background
2. **Regular Use**: New sent emails are automatically processed when fetched via `/api/emails?type=sent`
3. **Check Status**: Use `GET /api/emails/sync` to see how many emails have embeddings ready
4. **Free Embedding API**: Uses Hugging Face free tier by default (no API key needed, but has rate limits)
5. **Paid Option**: Set `EMBEDDING_API_KEY` to use OpenAI for faster, unlimited embeddings

