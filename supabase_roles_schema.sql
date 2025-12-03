-- Task 2: Role & Auth Layer - Supabase Schema
-- Run this SQL in your Supabase SQL editor

-- Create role enum type
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'agent');

-- Create users table for team members
-- All team members share the same Gmail account but have individual identities
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT, -- Optional: personal email (not the shared Gmail)
  role user_role NOT NULL DEFAULT 'agent',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- All users belong to the same shared Gmail account
  -- We'll use user_email from tokens table to link to shared account
  shared_gmail_email TEXT, -- The shared Gmail account email
  CONSTRAINT unique_name_per_account UNIQUE (name, shared_gmail_email)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_shared_gmail ON public.users(shared_gmail_email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON public.users(is_active) WHERE is_active = true;

-- Update tickets table to reference users.id instead of just assignee name
-- First, add user_id column if it doesn't exist
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS assignee_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Create index for assignee lookups
CREATE INDEX IF NOT EXISTS idx_tickets_assignee_user_id ON public.tickets(assignee_user_id);

-- Add user_email to users table for linking to shared Gmail account
-- This allows us to scope users to the correct shared account
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS user_email TEXT;

CREATE INDEX IF NOT EXISTS idx_users_user_email ON public.users(user_email);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_users_updated_at 
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


