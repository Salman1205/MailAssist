-- ============================================
-- MIGRATION: Fix Conflicts Between Gmail OAuth and Business Auth
-- ============================================

-- ============================================
-- 1. FIX AGENT_INVITATIONS TABLE
-- ============================================
-- Add missing columns to agent_invitations
ALTER TABLE public.agent_invitations 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  ADD COLUMN IF NOT EXISTS invitation_token TEXT;

-- Rename token column if it exists separately (or ensure it's named correctly)
-- Drop the old unique constraint and recreate with correct column name
DROP INDEX IF EXISTS agent_invitations_token_key;
ALTER TABLE public.agent_invitations DROP CONSTRAINT IF EXISTS agent_invitations_token_key;

-- Create unique index on invitation_token
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_invitations_invitation_token ON public.agent_invitations(invitation_token);

-- Update existing rows to have 'pending' status
UPDATE public.agent_invitations 
SET status = 'pending' 
WHERE status IS NULL;

-- ============================================
-- 2. CREATE LEGACY BUSINESSES FOR EXISTING GMAIL OAUTH USERS
-- ============================================
-- For each unique user_email in tokens, create a legacy business
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
  COALESCE(t.user_email, 'Legacy Business') as business_name,
  t.user_email as business_email,
  'Legacy Owner' as owner_name,
  'LEGACY_NO_PASSWORD' as password_hash, -- Placeholder, won't be used for login
  true as is_email_verified,
  true as is_legacy,
  NOW() as created_at
FROM public.tokens t
WHERE t.user_email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.businesses b 
    WHERE b.business_email = t.user_email
  )
ON CONFLICT (business_email) DO NOTHING;

-- ============================================
-- 3. BACKFILL business_id IN TOKENS TABLE
-- ============================================
UPDATE public.tokens t
SET business_id = b.id
FROM public.businesses b
WHERE t.user_email = b.business_email
  AND t.business_id IS NULL;

-- ============================================
-- 4. BACKFILL business_id IN USERS TABLE
-- ============================================
-- Link existing users to their legacy business via shared_gmail_email or user_email
UPDATE public.users u
SET business_id = b.id
FROM public.businesses b
WHERE (
  u.shared_gmail_email = b.business_email 
  OR u.user_email = b.business_email
)
AND u.business_id IS NULL
AND b.is_legacy = true;

-- ============================================
-- 5. FIX UNIQUE CONSTRAINT ON USERS
-- ============================================
-- Drop old constraint (if still exists)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS unique_name_per_account;

-- Keep the new constraint but make it conditional
-- Remove the constraint if it causes issues with existing data
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS unique_email_per_business;

-- Add new constraint that handles both NULL and non-NULL business_id
-- This allows legacy users (no business_id) and new users (with business_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_per_business 
  ON public.users(business_id, email) 
  WHERE business_id IS NOT NULL AND email IS NOT NULL;

-- Keep unique constraint for legacy users on shared_gmail_email
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_legacy_name_gmail 
  ON public.users(name, shared_gmail_email) 
  WHERE shared_gmail_email IS NOT NULL AND business_id IS NULL;

-- ============================================
-- 6. UPDATE RLS POLICIES TO SUPPORT BOTH AUTH METHODS
-- ============================================

-- Helper function to check if user has access to a business
CREATE OR REPLACE FUNCTION user_has_business_access(check_business_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is authenticated via session and belongs to business
  RETURN EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND u.business_id = check_business_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's email (Gmail OAuth)
CREATE OR REPLACE FUNCTION get_user_email()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT user_email FROM public.tokens 
    WHERE user_email IS NOT NULL 
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. UPDATE RLS POLICIES FOR KEY TABLES
-- ============================================

-- EMAILS TABLE
DROP POLICY IF EXISTS "Users can access emails" ON public.emails;
CREATE POLICY "Users can access emails" ON public.emails
  FOR ALL TO authenticated
  USING (
    -- Gmail OAuth: match user_email
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
    OR
    -- Business auth: match via business_id
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.businesses b ON u.business_id = b.id
      WHERE u.id = auth.uid()
      AND b.business_email = emails.user_email
    )
  );

-- TICKETS TABLE
DROP POLICY IF EXISTS "Users can access tickets" ON public.tickets;
CREATE POLICY "Users can access tickets" ON public.tickets
  FOR ALL TO authenticated
  USING (
    -- Gmail OAuth: match user_email
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
    OR
    -- Business auth: match via business_id
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.businesses b ON u.business_id = b.id
      WHERE u.id = auth.uid()
      AND b.business_email = tickets.user_email
    )
  );

-- DRAFTS TABLE
DROP POLICY IF EXISTS "Users can access their own drafts" ON public.drafts;
DROP POLICY IF EXISTS "Users can read their own drafts" ON public.drafts;
DROP POLICY IF EXISTS "Users can create drafts" ON public.drafts;
DROP POLICY IF EXISTS "Users can update their own drafts" ON public.drafts;
DROP POLICY IF EXISTS "Users can delete their own drafts" ON public.drafts;

CREATE POLICY "Users can access drafts" ON public.drafts
  FOR ALL TO authenticated
  USING (
    -- Gmail OAuth: match user_email
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
    OR
    -- Business auth: match via business_id
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.businesses b ON u.business_id = b.id
      WHERE u.id = auth.uid()
      AND b.business_email = drafts.user_email
    )
  );

-- QUICK_REPLIES TABLE
DROP POLICY IF EXISTS "Users can read quick replies" ON public.quick_replies;
DROP POLICY IF EXISTS "Users can create quick replies" ON public.quick_replies;
DROP POLICY IF EXISTS "Users can update quick replies" ON public.quick_replies;
DROP POLICY IF EXISTS "Users can delete quick replies" ON public.quick_replies;

CREATE POLICY "Users can access quick replies" ON public.quick_replies
  FOR ALL TO authenticated
  USING (
    -- Gmail OAuth: match user_email
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
    OR
    -- Business auth: match via business_id
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.businesses b ON u.business_id = b.id
      WHERE u.id = auth.uid()
      AND b.business_email = quick_replies.user_email
    )
  );

-- GUARDRAILS TABLE
DROP POLICY IF EXISTS "Users can read guardrails" ON public.guardrails;
DROP POLICY IF EXISTS "Users can insert guardrails" ON public.guardrails;
DROP POLICY IF EXISTS "Users can update guardrails" ON public.guardrails;
DROP POLICY IF EXISTS "Users can delete guardrails" ON public.guardrails;

CREATE POLICY "Users can access guardrails" ON public.guardrails
  FOR ALL TO authenticated
  USING (
    -- Gmail OAuth: match user_email
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
    OR
    -- Business auth: match via business_id
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.businesses b ON u.business_id = b.id
      WHERE u.id = auth.uid()
      AND b.business_email = guardrails.user_email
    )
  );

-- KNOWLEDGE_ITEMS TABLE
DROP POLICY IF EXISTS "Users can read knowledge items" ON public.knowledge_items;
DROP POLICY IF EXISTS "Users can insert knowledge items" ON public.knowledge_items;
DROP POLICY IF EXISTS "Users can update knowledge items" ON public.knowledge_items;
DROP POLICY IF EXISTS "Users can delete knowledge items" ON public.knowledge_items;

CREATE POLICY "Users can access knowledge items" ON public.knowledge_items
  FOR ALL TO authenticated
  USING (
    -- Gmail OAuth: match user_email
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
    OR
    -- Business auth: match via business_id
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.businesses b ON u.business_id = b.id
      WHERE u.id = auth.uid()
      AND b.business_email = knowledge_items.user_email
    )
  );

-- ============================================
-- 8. ADD INDEXES FOR BETTER PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_business_email_lookup 
  ON public.users(business_id, email) 
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_is_legacy 
  ON public.businesses(is_legacy, business_email);

CREATE INDEX IF NOT EXISTS idx_tokens_business_user 
  ON public.tokens(business_id, user_email);

-- ============================================
-- 9. DATA VALIDATION QUERIES (Run these to check for issues)
-- ============================================

-- Check for users without business_id (should only be old data)
-- SELECT id, name, email, shared_gmail_email, user_email 
-- FROM public.users 
-- WHERE business_id IS NULL;

-- Check for tokens without business_id
-- SELECT id, user_email, business_id 
-- FROM public.tokens 
-- WHERE user_email IS NOT NULL AND business_id IS NULL;

-- Check for orphaned data
-- SELECT 'Users with invalid business_id' as issue, COUNT(*) as count
-- FROM public.users u
-- WHERE u.business_id IS NOT NULL 
-- AND NOT EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = u.business_id);

-- ============================================
-- 10. NOTES FOR NEXT STEPS
-- ============================================

-- IMPORTANT: After running this migration:
-- 1. Update your API authentication logic to check BOTH:
--    - Session cookies (business auth) via user_sessions table
--    - Gmail tokens (OAuth) via tokens table
--
-- 2. When a business user connects Gmail:
--    - Create a new row in tokens table
--    - Set tokens.business_id = user.business_id
--    - Set tokens.user_email = gmail_account_email
--
-- 3. For legacy Gmail OAuth users (is_legacy = true):
--    - They can continue using Gmail OAuth
--    - OR migrate them to business auth by:
--      a) Setting users.password_hash
--      b) Creating user_sessions entry
--      c) Marking businesses.is_legacy = false
--
-- 4. Deprecation path:
--    - Phase 1: Support both auth methods (current)
--    - Phase 2: Migrate all legacy users to business auth
--    - Phase 3: Remove shared_gmail_email and user_email columns from users table
--    - Phase 4: Make business_id NOT NULL in users table
