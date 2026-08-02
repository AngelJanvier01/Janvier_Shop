-- Add the transient state in its own migration. PostgreSQL requires this enum
-- value to be committed before it is used by a subsequent repair migration.
ALTER TYPE "ProposalMarkdownParseStatus" ADD VALUE IF NOT EXISTS 'PENDING_VALIDATION';
