-- ============================================
-- PHASE 1: Business Registration & Authentication Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. BUSINESSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  business_email TEXT UNIQUE NOT NULL, -- Primary business contact email
  business_phone TEXT,
  owner_name TEXT NOT NULL,
  
  -- Auth fields
  password_hash TEXT NOT NULL, -- Use bcrypt
  is_email_verified BOOLEAN DEFAULT FALSE,
  
  -- Subscription (future-proof)
  subscription_tier TEXT DEFAULT 'free', -- free, starter, pro, enterprise
  
  -- Legacy flag for existing accounts
  is_legacy BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_businesses_email ON public.businesses(business_email);
CREATE INDEX IF NOT EXISTS idx_businesses_legacy ON public.businesses(is_legacy);

-- ============================================
-- 2. EMAIL VERIFICATION TOKENS
-- ============================================
CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  otp_code TEXT NOT NULL, -- 6-digit OTP (e.g., "123456")
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON public.email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_email ON public.email_verification_tokens(email);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_otp ON public.email_verification_tokens(otp_code);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires ON public.email_verification_tokens(expires_at);

-- ============================================
-- 3. AGENT INVITATION TOKENS (for Requirement 3)
-- ============================================
CREATE TABLE IF NOT EXISTS public.agent_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'agent',
  token TEXT UNIQUE NOT NULL,
  invited_by UUID REFERENCES public.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(business_id, email)
);

CREATE INDEX IF NOT EXISTS idx_agent_invitations_token ON public.agent_invitations(token);
CREATE INDEX IF NOT EXISTS idx_agent_invitations_business ON public.agent_invitations(business_id);
CREATE INDEX IF NOT EXISTS idx_agent_invitations_email ON public.agent_invitations(email);

-- ============================================
-- 4. USER SESSIONS (for cookie-based auth)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON public.user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_business_id ON public.user_sessions(business_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON public.user_sessions(expires_at);

-- ============================================
-- 5. UPDATE USERS TABLE
-- ============================================
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS password_hash TEXT, -- For agents who accept invites
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_business_id ON public.users(business_id);
CREATE INDEX IF NOT EXISTS idx_users_email_lookup ON public.users(email) WHERE email IS NOT NULL;

-- Update constraint: email must be unique within a business
-- Drop the old constraint first (this will automatically drop the index)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS unique_name_per_account;
-- Drop any existing unique_email_per_business constraint if it exists
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS unique_email_per_business;
-- Now add the new constraint
ALTER TABLE public.users 
  ADD CONSTRAINT unique_email_per_business UNIQUE (business_id, email);

-- ============================================
-- 6. UPDATE TOKENS TABLE TO LINK TO BUSINESSES
-- ============================================
ALTER TABLE public.tokens 
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tokens_business_id ON public.tokens(business_id);

-- ============================================
-- 7. TRIGGERS FOR UPDATED_AT
-- ============================================
CREATE TRIGGER update_businesses_updated_at 
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. ENABLE RLS ON NEW TABLES
-- ============================================
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 9. RLS POLICIES
-- ============================================

-- Businesses: Users can only see their own business
DROP POLICY IF EXISTS "Users can view their own business" ON public.businesses;
CREATE POLICY "Users can view their own business"
  ON public.businesses FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT business_id FROM public.users WHERE users.id = auth.uid()
    )
  );

-- Sessions: Users can only access their own sessions
DROP POLICY IF EXISTS "Users can access their own sessions" ON public.user_sessions;
CREATE POLICY "Users can access their own sessions"
  ON public.user_sessions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Email verification tokens: Public can insert/read (for registration flow)
DROP POLICY IF EXISTS "Anyone can create verification tokens" ON public.email_verification_tokens;
CREATE POLICY "Anyone can create verification tokens"
  ON public.email_verification_tokens FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read verification tokens" ON public.email_verification_tokens;
CREATE POLICY "Anyone can read verification tokens"
  ON public.email_verification_tokens FOR SELECT
  TO anon, authenticated
  USING (true);

-- Agent invitations: Only admins can create, anyone can read their own
DROP POLICY IF EXISTS "Admins can create invitations" ON public.agent_invitations;
CREATE POLICY "Admins can create invitations"
  ON public.agent_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
      AND users.business_id = agent_invitations.business_id
    )
  );

DROP POLICY IF EXISTS "Anyone can view invitations by token" ON public.agent_invitations;
CREATE POLICY "Anyone can view invitations by token"
  ON public.agent_invitations FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================
-- 10. MIGRATION: CREATE LEGACY BUSINESS FOR EXISTING SETUP
-- ============================================
-- This creates a legacy business account for your existing shared Gmail setup
-- Run this ONLY if you have existing data

DO $$
DECLARE
  legacy_business_id UUID;
  existing_user_email TEXT;
BEGIN
  -- Get existing user_email from tokens table
  SELECT user_email INTO existing_user_email 
  FROM public.tokens 
  WHERE user_email IS NOT NULL 
  LIMIT 1;

  -- Only proceed if we found an existing email
  IF existing_user_email IS NOT NULL THEN
    -- Create legacy business
    INSERT INTO public.businesses (
      business_name,
      business_email,
      owner_name,
      password_hash,
      is_email_verified,
      is_legacy
    )
    VALUES (
      'Legacy Account',
      existing_user_email,
      'Admin',
      'legacy', -- They'll use old user-selector flow
      TRUE,
      TRUE
    )
    ON CONFLICT (business_email) DO UPDATE 
      SET is_legacy = TRUE
    RETURNING id INTO legacy_business_id;

    -- Link existing users to legacy business
    UPDATE public.users
    SET business_id = legacy_business_id
    WHERE business_id IS NULL;

    -- Link existing tokens to legacy business
    UPDATE public.tokens
    SET business_id = legacy_business_id
    WHERE business_id IS NULL;

    RAISE NOTICE 'Legacy business created with ID: %', legacy_business_id;
  ELSE
    RAISE NOTICE 'No existing user_email found in tokens table. Skipping legacy migration.';
  END IF;
END $$;

-- ============================================
-- 11. CLEANUP FUNCTION: Delete expired tokens daily
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM public.email_verification_tokens
  WHERE expires_at < NOW() AND verified_at IS NULL;
  
  DELETE FROM public.agent_invitations
  WHERE expires_at < NOW() AND accepted_at IS NULL;
  
  DELETE FROM public.user_sessions
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Run cleanup function (you can schedule this with pg_cron or run it periodically)
-- SELECT cleanup_expired_tokens();
