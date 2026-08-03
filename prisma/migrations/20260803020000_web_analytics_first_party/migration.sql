-- First-party aggregate analytics. No IP address, user agent, query string,
-- cookie value or personal identity is retained in this table.

CREATE TYPE "WebAnalyticsEventType" AS ENUM ('PAGE_VIEW', 'CTA_CLICK', 'OUTBOUND_CLICK');

CREATE TABLE "WebAnalyticsEvent" (
  "id" TEXT NOT NULL,
  "eventType" "WebAnalyticsEventType" NOT NULL,
  "sessionHash" CHAR(64) NOT NULL,
  "path" VARCHAR(240) NOT NULL,
  "target" VARCHAR(160),
  "referrerOrigin" VARCHAR(255),
  "viewport" VARCHAR(24),
  "theme" VARCHAR(16),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WebAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebAnalyticsEvent_createdAt_idx" ON "WebAnalyticsEvent"("createdAt");
CREATE INDEX "WebAnalyticsEvent_eventType_createdAt_idx" ON "WebAnalyticsEvent"("eventType", "createdAt");
CREATE INDEX "WebAnalyticsEvent_path_createdAt_idx" ON "WebAnalyticsEvent"("path", "createdAt");
CREATE INDEX "WebAnalyticsEvent_sessionHash_createdAt_idx" ON "WebAnalyticsEvent"("sessionHash", "createdAt");
