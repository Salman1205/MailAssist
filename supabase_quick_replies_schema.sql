-- Quick Replies Table
-- Stores pre-written response templates for agents
-- Matches existing schema patterns

CREATE TABLE IF NOT EXISTS public.quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_email TEXT, -- For scoping to shared Gmail account
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster category lookups
CREATE INDEX IF NOT EXISTS idx_quick_replies_category ON public.quick_replies(category);

-- Index for faster tag searches
CREATE INDEX IF NOT EXISTS idx_quick_replies_tags ON public.quick_replies USING GIN(tags);

-- Index for user_email scoping
CREATE INDEX IF NOT EXISTS idx_quick_replies_user_email ON public.quick_replies(user_email);

-- Index for created_by lookups
CREATE INDEX IF NOT EXISTS idx_quick_replies_created_by ON public.quick_replies(created_by);

-- Create trigger to update updated_at
CREATE TRIGGER update_quick_replies_updated_at 
BEFORE UPDATE ON public.quick_replies
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS (if you're using RLS)
ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read quick replies for their shared account
CREATE POLICY "Users can read quick replies"
  ON public.quick_replies
  FOR SELECT
  TO authenticated
  USING (
    user_email IN (
      SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL
    )
  );

-- Policy: Only admins/managers can create quick replies
-- Note: This assumes you have a user_roles table or similar role checking mechanism
-- Adjust based on your actual role checking setup
CREATE POLICY "Admins can create quick replies"
  ON public.quick_replies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
      AND users.user_email = quick_replies.user_email
    )
  );

-- Policy: Only admins/managers can update quick replies
CREATE POLICY "Admins can update quick replies"
  ON public.quick_replies
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
      AND users.user_email = quick_replies.user_email
    )
  );

-- Policy: Only admins/managers can delete quick replies
CREATE POLICY "Admins can delete quick replies"
  ON public.quick_replies
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
      AND users.user_email = quick_replies.user_email
    )
  );
