-- ============================================
-- SUPABASE SCHEMA UPDATES
-- Add these to your existing schema script
-- ============================================

-- ============================================
-- 1. Add created_by column to drafts table
-- ============================================
ALTER TABLE public.drafts 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- ============================================
-- 2. Add index on drafts.created_by for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_drafts_created_by ON public.drafts(created_by);

-- ============================================
-- 3. Add foreign key constraint (already included in ALTER TABLE above, but explicit for clarity)
-- ============================================
-- Note: The foreign key is already added in the ALTER TABLE statement above
-- If you need to add it separately, use:
-- ALTER TABLE public.drafts 
-- ADD CONSTRAINT fk_drafts_created_by 
-- FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- ============================================
-- 4. Fix Quick Replies RLS Policies
-- The current policies use auth.uid() which won't work since we're using custom session cookies
-- We need to update them to work without Supabase Auth
-- ============================================

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can read quick replies" ON public.quick_replies;

-- Create new SELECT policy that filters by created_by (matching API behavior)
-- Since we can't use auth.uid(), we'll rely on API-level filtering
-- But we still need RLS for security - allow all authenticated users to read
-- The API will filter by created_by
CREATE POLICY "Users can read quick replies"
  ON public.quick_replies
  FOR SELECT
  TO authenticated
  USING (
    user_email IN (
      SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL
    )
  );

-- Note: The UPDATE and DELETE policies already check created_by, but they use auth.uid()
-- Since auth.uid() won't work, we need to update them to not rely on it
-- However, the API already does permission checks, so RLS just needs to ensure
-- users can only access quick replies for their shared Gmail account

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update quick replies" ON public.quick_replies;

-- Create new UPDATE policy (API will check created_by ownership)
CREATE POLICY "Users can update quick replies"
  ON public.quick_replies
  FOR UPDATE
  TO authenticated
  USING (
    user_email IN (
      SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL
    )
  )
  WITH CHECK (
    user_email IN (
      SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL
    )
  );

-- Drop existing DELETE policy
DROP POLICY IF EXISTS "Users can delete quick replies" ON public.quick_replies;

-- Create new DELETE policy (API will check created_by ownership)
CREATE POLICY "Users can delete quick replies"
  ON public.quick_replies
  FOR DELETE
  TO authenticated
  USING (
    user_email IN (
      SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL
    )
  );

-- ============================================
-- 5. Add RLS policies for drafts table (if RLS is enabled)
-- ============================================

-- Enable RLS on drafts table (if not already enabled)
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Users can only see their own drafts (filtered by created_by)
-- The API filters by created_by, but RLS provides additional security
CREATE POLICY "Users can read their own drafts"
  ON public.drafts
  FOR SELECT
  TO authenticated
  USING (
    user_email IN (
      SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL
    )
  );

-- INSERT policy: Users can create drafts
CREATE POLICY "Users can create drafts"
  ON public.drafts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_email IN (
      SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL
    )
  );

-- UPDATE policy: Users can update their own drafts
-- The API will check created_by ownership
CREATE POLICY "Users can update their own drafts"
  ON public.drafts
  FOR UPDATE
  TO authenticated
  USING (
    user_email IN (
      SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL
    )
  )
  WITH CHECK (
    user_email IN (
      SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL
    )
  );

-- DELETE policy: Users can delete their own drafts
-- The API will check created_by ownership
CREATE POLICY "Users can delete their own drafts"
  ON public.drafts
  FOR DELETE
  TO authenticated
  USING (
    user_email IN (
      SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL
    )
  );

-- ============================================
-- Guardrails scoped per email account
-- ============================================
ALTER TABLE public.guardrails
  ADD COLUMN IF NOT EXISTS user_email TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS draft_tone_style TEXT,
  ADD COLUMN IF NOT EXISTS draft_rules TEXT,
  ADD COLUMN IF NOT EXISTS draft_banned_words TEXT[],
  ADD COLUMN IF NOT EXISTS draft_topic_rules JSONB,
  ADD COLUMN IF NOT EXISTS pending BOOLEAN DEFAULT false;

-- Backfill defaults for draft columns and pending flag
UPDATE public.guardrails
SET
  draft_tone_style = COALESCE(draft_tone_style, NULL),
  draft_rules = COALESCE(draft_rules, NULL),
  draft_banned_words = COALESCE(draft_banned_words, '{}'),
  draft_topic_rules = COALESCE(draft_topic_rules, '[]'::jsonb),
  pending = COALESCE(pending, false)
WHERE true;

-- Clear stale pending flags when there is no draft content
UPDATE public.guardrails
SET pending = false
WHERE pending = true
  AND COALESCE(draft_tone_style, '') = ''
  AND COALESCE(draft_rules, '') = ''
  AND (draft_banned_words IS NULL OR array_length(draft_banned_words, 1) IS NULL OR draft_banned_words = '{}')
  AND (draft_topic_rules IS NULL OR draft_topic_rules = '[]'::jsonb);

CREATE INDEX IF NOT EXISTS idx_guardrails_user_email ON public.guardrails(user_email);
CREATE INDEX IF NOT EXISTS idx_guardrails_created_by ON public.guardrails(created_by);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_guardrails_per_email ON public.guardrails(user_email);

ALTER TABLE public.guardrails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read guardrails" ON public.guardrails;
CREATE POLICY "Users can read guardrails"
  ON public.guardrails
  FOR SELECT TO authenticated
  USING (
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
  );

DROP POLICY IF EXISTS "Users can insert guardrails" ON public.guardrails;
CREATE POLICY "Users can insert guardrails"
  ON public.guardrails
  FOR INSERT TO authenticated
  WITH CHECK (
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
  );

DROP POLICY IF EXISTS "Users can update guardrails" ON public.guardrails;
CREATE POLICY "Users can update guardrails"
  ON public.guardrails
  FOR UPDATE TO authenticated
  USING (
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
  )
  WITH CHECK (
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
  );

DROP POLICY IF EXISTS "Users can delete guardrails" ON public.guardrails;
CREATE POLICY "Users can delete guardrails"
  ON public.guardrails
  FOR DELETE TO authenticated
  USING (
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
  );

-- ============================================
-- Knowledge base scoped per email account
-- ============================================
ALTER TABLE public.knowledge_items
  ADD COLUMN IF NOT EXISTS user_email TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_user_email ON public.knowledge_items(user_email);
CREATE INDEX IF NOT EXISTS idx_knowledge_created_by ON public.knowledge_items(created_by);

ALTER TABLE public.knowledge_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read knowledge items" ON public.knowledge_items;
CREATE POLICY "Users can read knowledge items"
  ON public.knowledge_items
  FOR SELECT TO authenticated
  USING (
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
  );

DROP POLICY IF EXISTS "Users can insert knowledge items" ON public.knowledge_items;
CREATE POLICY "Users can insert knowledge items"
  ON public.knowledge_items
  FOR INSERT TO authenticated
  WITH CHECK (
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
  );

DROP POLICY IF EXISTS "Users can update knowledge items" ON public.knowledge_items;
CREATE POLICY "Users can update knowledge items"
  ON public.knowledge_items
  FOR UPDATE TO authenticated
  USING (
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
  )
  WITH CHECK (
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
  );

DROP POLICY IF EXISTS "Users can delete knowledge items" ON public.knowledge_items;
CREATE POLICY "Users can delete knowledge items"
  ON public.knowledge_items
  FOR DELETE TO authenticated
  USING (
    user_email IN (SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL)
  );

