-- Verify and fix schema for Plan Switching
-- Run this in Supabase SQL Editor

-- 1. Ensure businesses table has subscription_tier
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'subscription_tier') THEN
        ALTER TABLE public.businesses ADD COLUMN subscription_tier TEXT DEFAULT 'free';
    END IF;
END $$;

-- 2. Ensure tokens table has business_id and it is nullable
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tokens' AND column_name = 'business_id') THEN
        ALTER TABLE public.tokens ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Ensure unique index for personal emails exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_personal_email_unique 
ON public.users(email) 
WHERE business_id IS NULL;

SELECT 'Schema verification completed.' as message;
