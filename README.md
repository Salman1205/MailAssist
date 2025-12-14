# Customer Support Email Platform

A modern, AI-powered customer support platform that integrates with Gmail to manage support tickets, generate intelligent responses, and streamline customer service operations with advanced features like Shopify integration, real-time collaboration, and analytics.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![React](https://img.shields.io/badge/React-19.2-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Supabase](https://img.shields.io/badge/Supabase-Enabled-green)

## ✨ Features

### 🎯 Core Functionality
- **Gmail Integration**: Seamless OAuth2 authentication and email synchronization
- **Smart Ticketing System**: Convert emails into actionable support tickets
- **AI-Powered Drafts**: Generate contextual email responses using Groq AI that match your writing style
- **Real-time Collaboration**: Live updates, typing indicators, and @mentions
- **Multi-user Support**: Role-based access control (Admin, Manager, Agent)

### 🚀 Advanced Features
- **Quick Replies**: Pre-written response templates organized by category
- **Knowledge Base**: Semantic search across your documentation with vector embeddings
- **Shopify Integration**: View customer orders, products, and history inline
- **Analytics Dashboard**: Track response times, ticket volume, and team performance
- **Conversation Summaries**: AI-generated summaries of long email threads
- **Guardrails**: Content validation and tone enforcement for outgoing messages

### 💪 Productivity Tools
- **Bulk Operations**: Update multiple tickets simultaneously
- **Smart Filters**: Advanced filtering by status, priority, assignee, tags, date
- **Keyboard Shortcuts**: Gmail-style navigation (j/k, r, a, c, s)
- **Resizable Panels**: Customizable workspace layout with persistent preferences
- **Auto-save Drafts**: Never lose your work with automatic draft saving
- **Optimistic Updates**: Instant UI feedback with automatic rollback on errors

### 📊 Team Management
- **User Management**: Invite and manage team members with role assignments
- **Ticket Assignment**: Assign tickets to specific agents or teams
- **Priority Levels**: Low, Medium, High, Urgent
- **Tags System**: Organize tickets with custom tags
- **Notes & Mentions**: Internal collaboration with @mentions and notifications
- **Ticket Views**: Personalized views tracking last-viewed timestamps

## 🏗️ Tech Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **UI**: React 19.2 with TypeScript
- **Styling**: Tailwind CSS 4
- **Components**: Radix UI primitives
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts

### Backend & Services
- **Database**: Supabase (PostgreSQL)
- **Realtime**: Supabase Realtime subscriptions
- **Authentication**: Gmail OAuth2 via Google APIs
- **AI**: Groq API (llama-3.3-70b-versatile)
- **Embeddings**: Local transformers.js (all-MiniLM-L6-v2) or OpenAI/HuggingFace
- **E-commerce**: Shopify Admin API

### Infrastructure
- **Email API**: Gmail API (googleapis)
- **State Management**: React hooks with optimistic updates
- **Storage**: LocalStorage for preferences, Supabase for data
- **Real-time**: WebSocket channels for live collaboration

## 📋 Prerequisites

Before you begin, ensure you have:
- Node.js 18+ installed
- A Google Cloud project with Gmail API enabled
- A Supabase account and project
- A Groq API key
- (Optional) Shopify store for e-commerce integration

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd email-support-platform
```

### 2. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 3. Environment Setup

Copy the environment template and fill in your credentials:

```bash
cp env-template.txt .env.local
```

Required environment variables:

```env
# Gmail OAuth2 (from Google Cloud Console)
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret
GMAIL_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback

# Groq AI
GROQ_API_KEY=your_groq_api_key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Embeddings (Optional - defaults to local)
EMBEDDING_PROVIDER=local
EMBEDDING_API_KEY=

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Shopify (Optional)
SHOPIFY_STORE_URL=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=your_admin_api_token
```

### 4. Database Setup

Run the Supabase schema files to set up your database:

```sql
-- Core schemas (run in order)
supabase_schema_updates.sql
supabase_roles_schema.sql
supabase_user_scoping.sql
supabase_ticket_notes_schema.sql
supabase_quick_replies_schema.sql
supabase_guardrails_schema.sql
supabase_analytics_schema.sql
supabase_shopify_schema.sql
```

Or use the Supabase Dashboard to execute these migrations.

### 5. Run Development Server

```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Initial Setup

1. **Connect Gmail**: Click "Connect Gmail" and authorize the application
2. **Set Up User**: Create your admin user account
3. **Sync Emails**: Initial sync will fetch recent emails and create tickets
4. **Configure Settings**: Set up guardrails, quick replies, and knowledge base

## 🔑 Getting API Keys

### Gmail OAuth2 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Gmail API
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URI: `http://localhost:3000/api/auth/gmail/callback`
6. Copy Client ID and Secret to `.env.local`

### Groq API Key

1. Visit [Groq Console](https://console.groq.com/)
2. Sign up or log in
3. Generate API key
4. Copy to `.env.local`

### Supabase Setup

1. Create account at [Supabase](https://supabase.com/)
2. Create new project
3. Copy Project URL and Anon Key from Settings → API
4. Run database migrations from `/supabase_*.sql` files

### Shopify Integration (Optional)

1. In Shopify Admin, go to Apps → Develop apps
2. Create custom app with Admin API access
3. Grant permissions: `read_orders`, `read_products`, `read_customers`
4. Copy Admin API access token to `.env.local`

## 📖 Usage Guide

### Managing Tickets

- **View Tickets**: Navigate to Tickets in the sidebar
- **Filter**: Use collapsible filters for status, priority, assignee, tags, date
- **Search**: Full-text search across subject and customer info
- **Assign**: Click ticket → Assign dropdown (Admins/Managers can assign to anyone)
- **Update Status**: Open, Pending, On Hold, Closed
- **Bulk Actions**: Select mode → Check multiple tickets → Bulk assign/close

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `j` / `k` | Navigate tickets (down/up) |
| `r` | Reply to ticket |
| `a` | Assign ticket |
| `c` | Close ticket |
| `s` | Focus search |
| `Ctrl+K` | Toggle select mode |
| `Ctrl+A` | Select all (in select mode) |
| `Esc` | Exit select/close dialogs |
| `?` | Show shortcuts help |

### AI Draft Generation

1. Open a ticket
2. Click "Generate Draft" (Sparkles icon)
3. AI analyzes conversation and your past emails
4. Review and edit generated draft
5. Send or save for later

### Quick Replies

- Create templates in Quick Replies view
- Organize by categories and tags
- Insert into tickets with one click
- Search across all templates
- Available to all user roles

### Knowledge Base

- Add articles/docs in Knowledge Base view
- Content is automatically embedded for semantic search
- AI references relevant articles when generating drafts
- Search by keywords or semantic similarity

### Analytics

- View ticket volume trends
- Monitor average response times
- Track team performance metrics
- Filter by date range and team member
- Export data for reporting

## 🏛️ Architecture

### Directory Structure

```
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   │   ├── ai/           # AI draft generation
│   │   ├── analytics/    # Analytics endpoints
│   │   ├── auth/         # Gmail OAuth
│   │   ├── emails/       # Email sync
│   │   ├── tickets/      # Ticket CRUD
│   │   └── shopify/      # Shopify integration
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Main app page
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── tickets-view.tsx  # Main tickets interface
│   ├── email-detail.tsx  # Email thread viewer
│   └── ...
├── lib/                   # Utilities and helpers
│   ├── gmail.ts          # Gmail API client
│   ├── ai-draft.ts       # AI generation logic
│   ├── embeddings.ts     # Vector embeddings
│   ├── supabase-client.ts # Supabase client
│   └── ...
└── public/               # Static assets
```

### Key Components

- **`tickets-view.tsx`**: Main ticketing interface with filters, bulk actions, real-time updates
- **`email-detail.tsx`**: Email thread display with reply composer and AI drafts
- **`top-nav.tsx`**: Global navigation with notifications and user menu
- **`sidebar.tsx`**: Main navigation sidebar
- **`analytics-dashboard.tsx`**: Metrics and reporting

### Data Flow

1. **Email Sync**: Gmail API → `/api/emails` → Supabase tickets table
2. **AI Drafts**: Ticket context → Embeddings search → Groq API → Draft generation
3. **Real-time**: Supabase triggers → WebSocket → Component updates
4. **Shopify**: Ticket email → Shopify API → Customer/order data

## 🔒 Security

- **OAuth2**: Secure Gmail authentication with token refresh
- **RLS**: Row-level security in Supabase for multi-tenant data
- **Role-based Access**: Admins, Managers, and Agents with different permissions
- **Input Validation**: Zod schemas for all API inputs
- **Content Guardrails**: AI-powered content validation before sending

## 🚀 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Build for Production

```bash
npm run build
npm run start
```

### Environment Variables

Update redirect URIs and app URLs for production:

```env
GMAIL_REDIRECT_URI=https://your-domain.com/api/auth/gmail/callback
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## 📊 Performance

- **Optimistic UI**: Instant feedback for all actions
- **Batch Processing**: Efficient bulk operations
- **Local Embeddings**: Fast, free vector search without API calls
- **Debounced Search**: Reduced API calls during typing
- **Lazy Loading**: Components loaded on demand
- **Cached Data**: LocalStorage for preferences and frequently accessed data

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is private and proprietary.

## 🐛 Troubleshooting

### Common Issues

**Gmail connection fails**
- Verify OAuth credentials in Google Cloud Console
- Check redirect URI matches exactly
- Ensure Gmail API is enabled

**AI drafts not generating**
- Confirm Groq API key is valid
- Check console for API errors
- Verify embeddings are generated for sent emails

**Supabase errors**
- Run all schema migrations in order
- Check RLS policies are configured
- Verify environment variables

**Shopify integration not working**
- Confirm Admin API token has correct permissions
- Check store URL format (no https://)
- Verify customer email matches

### Debug Mode

Enable detailed logging:

```typescript
// In browser console
localStorage.setItem('debug', 'true')
```

## 📞 Support

For issues and questions:
- Check existing documentation files (README_BACKEND.md, FEATURE_CHECKLIST.md)
- Review API endpoint documentation
- Check browser console for errors

## 🗺️ Roadmap

- [ ] Email templates with variables
- [ ] Scheduled sends
- [ ] SLA tracking and alerts
- [ ] Mobile responsive improvements
- [ ] Multi-language support
- [ ] Slack/Discord integrations
- [ ] Custom reporting dashboards
- [ ] Automated ticket routing

---

Built with ❤️ using Next.js, React, and Supabase
