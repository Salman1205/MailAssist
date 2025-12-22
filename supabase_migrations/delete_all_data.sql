-- ============================================
-- DELETE ALL DATA FROM DATABASE
-- WARNING: This will delete ALL data!
-- Run this in your Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: ADD MISSING SNIPPET COLUMN FIRST
-- ============================================
ALTER TABLE public.emails 
ADD COLUMN IF NOT EXISTS snippet TEXT;

-- ============================================
-- STEP 2: DELETE ALL DATA (in correct order to respect foreign keys)
-- ============================================

-- Delete analytics and logs first (no dependencies)
DELETE FROM public.guardrail_logs;
DELETE FROM public.ai_usage_logs;
DELETE FROM public.ticket_analytics;
DELETE FROM public.agent_performance;

-- Delete notifications
DELETE FROM public.notifications;

-- Delete ticket-related data
DELETE FROM public.ticket_notes;
DELETE FROM public.ticket_views;
DELETE FROM public.ticket_updates;
DELETE FROM public.tickets;

-- Delete knowledge and quick replies
DELETE FROM public.knowledge_items;
DELETE FROM public.quick_replies;

-- Delete guardrails
DELETE FROM public.guardrails;

-- Delete Shopify data
DELETE FROM public.shopify_customer_cache;
DELETE FROM public.shopify_config;

-- Delete agent invitations
DELETE FROM public.agent_invitations;

-- Delete email verification tokens
DELETE FROM public.email_verification_tokens;

-- Delete user sessions
DELETE FROM public.user_sessions;

-- Delete drafts and emails
DELETE FROM public.drafts;
DELETE FROM public.emails;

-- Delete sync state
DELETE FROM public.sync_state;

-- Delete users (this will cascade to many tables)
DELETE FROM public.users;

-- Delete tokens
DELETE FROM public.tokens;

-- Delete businesses (this will cascade to users if not already deleted)
DELETE FROM public.businesses;

-- ============================================
-- STEP 3: VERIFY ALL TABLES ARE EMPTY
-- ============================================
SELECT 
  'emails' as table_name, COUNT(*) as count FROM public.emails
UNION ALL
SELECT 'tokens', COUNT(*) FROM public.tokens
UNION ALL
SELECT 'tickets', COUNT(*) FROM public.tickets
UNION ALL
SELECT 'drafts', COUNT(*) FROM public.drafts
UNION ALL
SELECT 'sync_state', COUNT(*) FROM public.sync_state
UNION ALL
SELECT 'users', COUNT(*) FROM public.users
UNION ALL
SELECT 'businesses', COUNT(*) FROM public.businesses
UNION ALL
SELECT 'user_sessions', COUNT(*) FROM public.user_sessions
ORDER BY table_name;

-- ============================================
-- DONE!
-- All data has been deleted.
-- You can now start fresh with your app.
-- ============================================
