-- Create ticket_notes table for internal notes
-- Notes are only visible to team members, not customers

CREATE TABLE IF NOT EXISTS public.ticket_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ticket_notes_ticket_id ON public.ticket_notes(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_notes_user_id ON public.ticket_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_notes_created_at ON public.ticket_notes(created_at);

-- Create trigger to update updated_at
CREATE TRIGGER update_ticket_notes_updated_at 
BEFORE UPDATE ON public.ticket_notes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();





