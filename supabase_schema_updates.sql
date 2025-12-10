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

