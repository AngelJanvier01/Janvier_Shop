function messageDomain(appUrl: string) {
  const hostname = new URL(appUrl).hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/u.test(
      hostname
    )
  ) {
    throw new Error("APP_URL debe usar un dominio publico valido para Message-ID.");
  }
  return hostname;
}

/**
 * A deterministic MIME identifier gives a retry of one outbox job the exact
 * same Message-ID. It improves traceability and provider-side deduplication,
 * but SMTP still cannot guarantee exactly-once delivery.
 */
export function emailOutboxMessageId(outboxId: string, appUrl: string) {
  if (!/^[a-z0-9_-]{1,96}$/iu.test(outboxId)) {
    throw new Error("EmailOutbox id invalido para Message-ID.");
  }
  return `<email-outbox-${outboxId}@${messageDomain(appUrl)}>`;
}
