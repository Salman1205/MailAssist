-- Add user_email column to all tables for per-user data scoping

-- Add user_email to emails table
ALTER TABLE public.emails 
ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Add user_email to tokens table
ALTER TABLE public.tokens 
ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Add user_email to drafts table
ALTER TABLE public.drafts 
ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Add user_email to sync_state table
ALTER TABLE public.sync_state 
ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_emails_user_email ON public.emails(user_email);
CREATE INDEX IF NOT EXISTS idx_tokens_user_email ON public.tokens(user_email);
CREATE INDEX IF NOT EXISTS idx_drafts_user_email ON public.drafts(user_email);
CREATE INDEX IF NOT EXISTS idx_sync_state_user_email ON public.sync_state(user_email);

-- Update composite primary keys/unique constraints if needed
-- Note: You may need to adjust these based on your existing constraints

