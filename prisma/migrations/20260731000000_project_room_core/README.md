# PROJECT_ROOM core migration

This migration establishes only the private data foundation for administrative
users, clients, projects and versioned proposals.

## Apply

1. Configure a real PostgreSQL `DATABASE_URL` in a local or staging `.env`.
2. Review the generated SQL and back up the target database.
3. Run `npm run prisma:deploy`.
4. Run `npm run prisma:generate`.

## Rollback

Do not run a destructive rollback against a database containing proposals.
Restore a verified backup or create a forward migration after assessing the
affected proposals and audit records.
