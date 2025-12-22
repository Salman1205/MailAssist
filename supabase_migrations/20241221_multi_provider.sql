-- Add provider and config columns to tokens table
ALTER TABLE public.tokens 
ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'gmail',
ADD COLUMN IF NOT EXISTS imap_config JSONB,
ADD COLUMN IF NOT EXISTS smtp_config JSONB;

-- Update existing records to be 'gmail'
UPDATE public.tokens SET provider = 'gmail' WHERE provider IS NULL;

-- Create index on provider for faster lookups
CREATE INDEX IF NOT EXISTS idx_tokens_provider ON public.tokens(provider);
