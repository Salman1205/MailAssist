# Email AI Draft Backend - MVP

A backend system that connects to Gmail, stores sent emails with embeddings, and generates AI-powered draft replies using Groq API that match your writing style.

## Features

- **Gmail OAuth2 Integration**: Secure authentication with Gmail
- **Email Fetching**: Retrieve inbox and sent emails
- **Embedding Storage**: Store sent emails with vector embeddings for style matching
- **AI Draft Generation**: Generate contextual email drafts using Groq API
- **Style Matching**: Uses similarity search to match your past email writing style

## Setup

### 1. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory and add the following variables:

```env
# Gmail OAuth2 Credentials
GMAIL_CLIENT_ID=your_gmail_client_id_here
GMAIL_CLIENT_SECRET=your_gmail_client_secret_here
GMAIL_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback

# Groq API Key
GROQ_API_KEY=your_groq_api_key_here

# Embedding API Key (Optional - leave empty for free Hugging Face API)
EMBEDDING_API_KEY=

# Frontend URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Getting API Keys

#### Gmail OAuth2 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Set application type to "Web application"
6. Add authorized redirect URI: `http://localhost:3000/api/auth/gmail/callback` (or your production URL)
7. Copy the Client ID and Client Secret to your `.env.local`

#### Groq API Key

1. Go to [Groq Console](https://console.groq.com/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy it to your `.env.local`

#### Embedding API Key (Optional)

- **Free Option**: Leave `EMBEDDING_API_KEY` empty to use Hugging Face's free Inference API
- **OpenAI Option**: Provide an OpenAI API key (starts with `sk-`) for OpenAI embeddings
- **Hugging Face Option**: Provide a Hugging Face API key for authenticated requests

## Performance Optimizations

### Fast Embedding Generation

The backend includes several optimizations for fast embedding generation:

1. **Batch Processing**: Embeddings are generated in parallel batches (default: 10 at a time)
2. **Background Processing**: Use `/api/emails/sync` to process emails in the background
3. **Rate Limiting**: Automatic delays between batches to respect API rate limits
4. **Error Handling**: Failed embeddings don't block the entire process
5. **Caching**: Already processed emails are skipped

### Initial Setup (Bulk Processing)

For the first time setup with many sent emails, use the sync endpoint:

```bash
POST /api/emails/sync?maxResults=500
```

This will:
- Fetch all sent emails
- Process them in the background (returns immediately)
- Generate embeddings asynchronously
- Store them for future draft generation

Check sync status:
```bash
GET /api/emails/sync
```

## API Endpoints

### Authentication

#### `GET /api/auth/gmail`
Get the OAuth2 authorization URL for Gmail authentication.

**Response:**
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

#### `GET /api/auth/gmail/callback`
OAuth callback endpoint. Handles the redirect from Google after authentication.

**Query Parameters:**
- `code`: Authorization code from Google
- `error`: Error message if authentication failed

**Response:** Redirects to frontend with `?auth=success` or `?auth=error`

#### `POST /api/auth/logout`
Clear stored authentication tokens.

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Emails

#### `GET /api/emails`
Fetch emails from Gmail.

**Query Parameters:**
- `type`: `"inbox"` (default) or `"sent"`
- `maxResults`: Number of emails to fetch (default: 50)

**Response:**
```json
{
  "emails": [
    {
      "id": "email_id",
      "threadId": "thread_id",
      "subject": "Email subject",
      "from": "sender@example.com",
      "to": "recipient@example.com",
      "date": "Date string",
      "body": "Email body text",
      "snippet": "Email snippet",
      "labels": ["INBOX", "UNREAD"]
    }
  ],
  "count": 10
}
```

#### `GET /api/emails/[id]`
Get a specific email by ID.

**Response:**
```json
{
  "email": {
    "id": "email_id",
    "subject": "Email subject",
    "from": "sender@example.com",
    "to": "recipient@example.com",
    "date": "Date string",
    "body": "Email body text",
    "snippet": "Email snippet"
  }
}
```

#### `POST /api/emails/[id]/draft`
Generate an AI draft reply for a specific email.

**Response:**
```json
{
  "draft": "Generated draft reply text...",
  "emailId": "email_id",
  "subject": "Re: Original subject"
}
```

#### `POST /api/emails/sync`
Background sync endpoint for bulk processing sent emails with embeddings.

**Query Parameters:**
- `maxResults`: Number of sent emails to process (default: 100)

**Response:**
```json
{
  "message": "Email processing started in background",
  "queued": 50,
  "total": 100
}
```

**Usage:** Call this endpoint once after initial Gmail connection to process all sent emails in the background.

#### `GET /api/emails/sync`
Get sync status and statistics.

**Response:**
```json
{
  "totalStored": 150,
  "sentWithEmbeddings": 100,
  "lastSync": 1704067200000
}
```

## How It Works

### 1. Authentication Flow

1. Frontend calls `GET /api/auth/gmail` to get authorization URL
2. User is redirected to Google to authorize
3. Google redirects back to `/api/auth/gmail/callback` with authorization code
4. Backend exchanges code for access/refresh tokens
5. Tokens are stored locally in `data/tokens.json`

### 2. Email Storage

- **Sent Emails**: When fetched, sent emails are stored in `data/emails.json` with embeddings
- **Received Emails**: Inbox emails are stored without embeddings (for reference only)
- Embeddings are generated using Hugging Face (free) or OpenAI API

### 3. Draft Generation

1. User requests a draft for an incoming email
2. System generates embedding for the incoming email
3. Finds most similar past sent emails using cosine similarity
4. Uses Groq API to generate a draft that matches the user's writing style
5. Returns plain text draft ready for review

## File Structure

```
├── app/
│   └── api/
│       ├── auth/
│       │   ├── gmail/
│       │   │   ├── route.ts          # Get auth URL
│       │   │   └── callback/
│       │   │       └── route.ts      # OAuth callback
│       │   └── logout/
│       │       └── route.ts          # Logout
│       └── emails/
│           ├── route.ts              # Fetch emails
│           └── [id]/
│               └── draft/
│                   └── route.ts      # Generate draft
├── lib/
│   ├── gmail.ts                      # Gmail API utilities
│   ├── embeddings.ts                 # Embedding generation
│   ├── similarity.ts                 # Similarity search
│   ├── ai-draft.ts                   # AI draft generation
│   └── storage.ts                    # Local storage
└── data/                             # Generated at runtime
    ├── emails.json                   # Stored emails with embeddings
    └── tokens.json                    # OAuth tokens
```

## Data Storage

The backend uses file-based storage (JSON files) in the `data/` directory:

- **`data/emails.json`**: Stores all emails with embeddings
- **`data/tokens.json`**: Stores OAuth2 tokens

**Note**: For production, consider migrating to a proper database (PostgreSQL, MongoDB, etc.) for better performance and scalability.

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `400`: Bad request (missing parameters)
- `401`: Unauthorized (not authenticated)
- `404`: Not found
- `500`: Server error

Error responses include a `details` field with more information.

## Development

Run the development server:

```bash
npm run dev
# or
pnpm dev
```

The API will be available at `http://localhost:3000/api/...`

## Production Considerations

1. **Database**: Replace file-based storage with a proper database
2. **Token Refresh**: Implement automatic token refresh for expired access tokens
3. **Rate Limiting**: Add rate limiting to prevent API abuse
4. **Error Logging**: Implement proper error logging and monitoring
5. **Security**: Ensure `.env.local` and `data/` directory are in `.gitignore`
6. **CORS**: Configure CORS if frontend is on a different domain

## Troubleshooting

### "Missing Gmail OAuth2 credentials"
- Ensure all Gmail environment variables are set in `.env.local`

### "Not authenticated"
- User needs to complete OAuth flow first by calling `/api/auth/gmail`

### "No past emails found for style matching"
- User needs to send some emails first so the system can learn their writing style

### Embedding generation fails
- Check your `EMBEDDING_API_KEY` if using a paid service
- Free Hugging Face API may have rate limits

### Groq API errors
- Verify your `GROQ_API_KEY` is correct
- Check Groq API status and rate limits

