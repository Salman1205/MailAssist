-- Add department_ids column to agent_invitations table
-- This allows storing department assignments when inviting agents

ALTER TABLE agent_invitations
ADD COLUMN IF NOT EXISTS department_ids uuid[] DEFAULT '{}';

-- Add a comment for documentation
COMMENT ON COLUMN agent_invitations.department_ids IS 'Array of department IDs to assign to the agent after they accept the invitation';
