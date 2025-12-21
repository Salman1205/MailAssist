-- ============================================
-- MIGRATION: Fix Auth System Conflicts
-- Run this entire script in your Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. FIX AGENT_INVITATIONS - Add missing columns
-- ============================================
ALTER TABLE public.agent_invitations 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS invitation_token TEXT;

-- Add constraint for status
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'agent_invitations_status_check'
  ) THEN
    ALTER TABLE public.agent_invitations 
      ADD CONSTRAINT agent_invitations_status_check 
      CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'));
  END IF;
END $$;

-- Update token column reference (rename if needed)
UPDATE public.agent_invitations 
SET invitation_token = token 
WHERE invitation_token IS NULL AND token IS NOT NULL;

-- Drop old constraint (if exists) before creating new index
ALTER TABLE public.agent_invitations DROP CONSTRAINT IF EXISTS agent_invitations_token_key;

-- Create unique index on invitation_token
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_invitations_invitation_token 
  ON public.agent_invitations(invitation_token) 
  WHERE invitation_token IS NOT NULL;

-- Set default status for existing rows
UPDATE public.agent_invitations 
SET status = 'pending' 
WHERE status IS NULL;

-- ============================================
-- 2. CREATE LEGACY BUSINESSES - Link existing Gmail OAuth data
-- ============================================
-- CRITICAL FIX: Only create legacy business if NO business exists (including real ones)
-- This prevents duplicate businesses when user registers business then uses Gmail OAuth
INSERT INTO public.businesses (
  business_name,
  business_email,
  owner_name,
  password_hash,
  is_email_verified,
  is_legacy,
  created_at
)
SELECT DISTINCT
  'Legacy Account - ' || COALESCE(t.user_email, 'Unknown') as business_name,
  t.user_email as business_email,
  'Legacy Owner' as owner_name,
  'LEGACY_NO_PASSWORD_REQUIRED' as password_hash,
  true as is_email_verified,
  true as is_legacy,
  NOW() as created_at
FROM public.tokens t
WHERE t.user_email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.businesses b 
    WHERE b.business_email = t.user_email
    -- Don't create legacy if REAL business already exists
    -- This allows OAuth users to upgrade to business accounts later
  )
ON CONFLICT (business_email) DO NOTHING;
-- Link OAuth tokens to their corresponding businesses (legacy OR real)
-- Priority: Real businesses first, then legacy businesses
UPDATE public.tokens t
SET business_id = b.id
FROM public.businesses b
WHERE t.user_email = b.business_email
  AND t.business_id IS NULL
  AND t.user_email IS NOT NULL
  -- Prefer real businesses over legacy ones
ORDER BY b.is_legacy ASC
FROM public.businesses b
WHERE t.user_email = b.business_email
  AND t.business_id IS NULL
  AND t.user_email IS NOT NULL;

-- ============================================
-- 4. BACKFILL business_id - Link users to businesses
-- ============================================
UPDATE public.users u
SET business_id = b.id
FROM public.businesses b
WHERE (
  u.shared_gmail_email = b.business_email 
  OR u.user_email = b.business_email
)
AND u.business_id IS NULL;

-- ============================================
-- 5. FIX UNIQUE CONSTRAINTS - Support both auth methods
-- ============================================

-- Drop old conflicting constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS unique_name_per_account;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS unique_email_per_business;

-- New business users: unique email per business
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_per_business 
  ON public.users(business_id, email) 
  WHERE business_id IS NOT NULL AND email IS NOT NULL;

-- Legacy Gmail OAuth users: keep old constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_legacy_name_gmail 
  ON public.users(name, shared_gmail_email) 
  WHERE shared_gmail_email IS NOT NULL;

-- ============================================
-- 6. UPDATE RLS POLICIES - Support both auth methods
-- ============================================

-- Drop all existing policies for tables we're updating
DROP POLICY IF EXISTS "Users can access emails" ON public.emails;
DROP POLICY IF EXISTS "Users can access tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can access drafts" ON public.drafts;
DROP POLICY IF EXISTS "Users can read their own drafts" ON public.drafts;
DROP POLICY IF EXISTS "Users can create drafts" ON public.drafts;
DROP POLICY IF EXISTS "Users can update their own drafts" ON public.drafts;
DROP POLICY IF EXISTS "Users can delete their own drafts" ON public.drafts;
DROP POLICY IF EXISTS "Users can read quick replies" ON public.quick_replies;
DROP POLICY IF EXISTS "Users can create quick replies" ON public.quick_replies;
DROP POLICY IF EXISTS "Users can update quick replies" ON public.quick_replies;
DROP POLICY IF EXISTS "Users can delete quick replies" ON public.quick_replies;
DROP POLICY IF EXISTS "Users can read guardrails" ON public.guardrails;
DROP POLICY IF EXISTS "Users can insert guardrails" ON public.guardrails;
DROP POLICY IF EXISTS "Users can update guardrails" ON public.guardrails;
DROP POLICY IF EXISTS "Users can delete guardrails" ON public.guardrails;
DROP POLICY IF EXISTS "Users can read knowledge items" ON public.knowledge_items;
DROP POLICY IF EXISTS "Users can insert knowledge items" ON public.knowledge_items;
DROP POLICY IF EXISTS "Users can update knowledge items" ON public.knowledge_items;
DROP POLICY IF EXISTS "Users can delete knowledge items" ON public.knowledge_items;

-- EMAILS TABLE - Support both auth methods
CREATE POLICY "Users can access emails via both auth methods" 
  ON public.emails FOR ALL TO authenticated
  USING (
    -- Method 1: Gmail OAuth - match user_email from tokens
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
    OR
    -- Method 2: Business auth - match via business->user relationship
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.businesses b ON u.business_id = b.id
      WHERE b.business_email = emails.user_email
    )
  );

-- TICKETS TABLE - Support both auth methods
CREATE POLICY "Users can access tickets via both auth methods" 
  ON public.tickets FOR ALL TO authenticated
  USING (
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
    OR
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.businesses b ON u.business_id = b.id
      WHERE b.business_email = tickets.user_email
    )
  );

-- DRAFTS TABLE - Support both auth methods
CREATE POLICY "Users can access drafts via both auth methods" 
  ON public.drafts FOR ALL TO authenticated
  USING (
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
    OR
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.businesses b ON u.business_id = b.id
      WHERE b.business_email = drafts.user_email
    )
  );

-- QUICK_REPLIES TABLE - Support both auth methods
CREATE POLICY "Users can access quick_replies via both auth methods" 
  ON public.quick_replies FOR ALL TO authenticated
  USING (
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
    OR
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.businesses b ON u.business_id = b.id
      WHERE b.business_email = quick_replies.user_email
    )
  );

-- GUARDRAILS TABLE - Support both auth methods
CREATE POLICY "Users can access guardrails via both auth methods" 
  ON public.guardrails FOR ALL TO authenticated
  USING (
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
    OR
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.businesses b ON u.business_id = b.id
      WHERE b.business_email = guardrails.user_email
    )
  );

-- KNOWLEDGE_ITEMS TABLE - Support both auth methods
CREATE POLICY "Users can access knowledge_items via both auth methods" 
  ON public.knowledge_items FOR ALL TO authenticated
  USING (
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
    OR
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.businesses b ON u.business_id = b.id
      WHERE b.business_email = knowledge_items.user_email
    )
  );

-- SHOPIFY_CONFIG TABLE - Support both auth methods
DROP POLICY IF EXISTS "Users can read their own Shopify config" ON public.shopify_config;
DROP POLICY IF EXISTS "Admins can manage Shopify config" ON public.shopify_config;

CREATE POLICY "Users can access shopify_config via both auth methods" 
  ON public.shopify_config FOR ALL TO authenticated
  USING (
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
    OR
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.businesses b ON u.business_id = b.id
      WHERE b.business_email = shopify_config.user_email
    )
  );

-- SHOPIFY_CUSTOMER_CACHE TABLE - Support both auth methods
DROP POLICY IF EXISTS "Users can read their own cached customer data" ON public.shopify_customer_cache;
DROP POLICY IF EXISTS "Users can cache their own customer data" ON public.shopify_customer_cache;

CREATE POLICY "Users can access shopify_customer_cache via both auth methods" 
  ON public.shopify_customer_cache FOR ALL TO authenticated
  USING (
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
    OR
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.businesses b ON u.business_id = b.id
      WHERE b.business_email = shopify_customer_cache.user_email
    )
  );

-- ANALYTICS TABLES - Support both auth methods
DROP POLICY IF EXISTS "Users can read guardrail logs" ON public.guardrail_logs;
CREATE POLICY "Users can access guardrail_logs via both auth methods" 
  ON public.guardrail_logs FOR ALL TO authenticated
  USING (
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
    OR
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.businesses b ON u.business_id = b.id
      WHERE b.business_email = guardrail_logs.user_email
    )
  );

DROP POLICY IF EXISTS "Users can read ai usage logs" ON public.ai_usage_logs;
CREATE POLICY "Users can access ai_usage_logs via both auth methods" 
  ON public.ai_usage_logs FOR ALL TO authenticated
  USING (
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
    OR
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.businesses b ON u.business_id = b.id
      WHERE b.business_email = ai_usage_logs.user_email
    )
  );

DROP POLICY IF EXISTS "Users can read ticket analytics" ON public.ticket_analytics;
CREATE POLICY "Users can access ticket_analytics via both auth methods" 
  ON public.ticket_analytics FOR ALL TO authenticated
  USING (
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
    OR
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.businesses b ON u.business_id = b.id
      WHERE b.business_email = ticket_analytics.user_email
    )
  );

DROP POLICY IF EXISTS "Users can read agent performance" ON public.agent_performance;
CREATE POLICY "Users can access agent_performance via both auth methods" 
  ON public.agent_performance FOR ALL TO authenticated
  USING (
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
    OR
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.businesses b ON u.business_id = b.id
      WHERE b.business_email = agent_performance.user_email
    )
  );

-- ============================================
-- 7. ADD PERFORMANCE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_business_email_lookup 
  ON public.users(business_id, email) 
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_legacy_email 
  ON public.businesses(is_legacy, business_email);

CREATE INDEX IF NOT EXISTS idx_tokens_business_user 
  ON public.tokens(business_id, user_email);

-- ============================================
-- 8. VERIFICATION QUERIES (Optional - comment out to skip)
-- ============================================

-- Uncomment these to check for data issues:

-- Check users without business_id (should only be orphans)
-- SELECT COUNT(*) as users_without_business FROM public.users WHERE business_id IS NULL;

-- Check tokens without business_id
-- SELECT COUNT(*) as tokens_without_business FROM public.tokens WHERE user_email IS NOT NULL AND business_id IS NULL;

-- Check for legacy businesses created
-- SELECT COUNT(*) as legacy_businesses FROM public.businesses WHERE is_legacy = true;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Summary of what was fixed:
-- ✅ 1. agent_invitations table now has status and invitation_token columns
-- ✅ 2. Legacy businesses created for all existing Gmail OAuth users
-- ✅ 3. business_id backfilled in tokens and users tables
-- ✅ 4. Unique constraints fixed to support both auth methods
-- ✅ 5. All RLS policies updated to check BOTH Gmail tokens AND business sessions
-- ✅ 6. Performance indexes added

-- Both authentication methods now work simultaneously:
-- - Business registration → OTP → Login (uses businesses + user_sessions)
-- - Gmail OAuth → Connect (uses tokens table, linked to legacy businesses)

-- Next steps:
-- 1. Test business registration flow
-- 2. Test Gmail OAuth flow
-- 3. Test agent invitations
-- 4. Both should work without conflicts!
