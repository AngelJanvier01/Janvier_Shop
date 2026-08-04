-- Security hardening for v2.0.2. Existing attempts are retained as audit records
-- but invalidated because they predate OIDC nonce binding.
ALTER TABLE "GoogleOAuthAuthorizationAttempt"
  ADD COLUMN "nonceHash" CHAR(64);

UPDATE "GoogleOAuthAuthorizationAttempt"
SET "nonceHash" = repeat('0', 64),
    "consumedAt" = COALESCE("consumedAt", CURRENT_TIMESTAMP),
    "failureCode" = COALESCE("failureCode", 'OIDC_NONCE_UPGRADE');

ALTER TABLE "GoogleOAuthAuthorizationAttempt"
  ALTER COLUMN "nonceHash" SET NOT NULL;
