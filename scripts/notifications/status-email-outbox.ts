import "dotenv/config";

import { EmailOutboxStatus } from "../../app/generated/prisma/client";
import { database } from "../../lib/database";

const [groups, oldest] = await Promise.all([
  database.emailOutbox.groupBy({ _count: { _all: true }, by: ["status"] }),
  database.emailOutbox.findFirst({
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
    where: { status: { in: ["PENDING", "PROCESSING", "RETRY"] } }
  })
]);

console.log(
  JSON.stringify({
    byStatus: Object.fromEntries(
      Object.values(EmailOutboxStatus).map((status) => [
        status,
        groups.find((group) => group.status === status)?._count._all ?? 0
      ])
    ),
    oldestPendingAt: oldest?.createdAt.toISOString() ?? null
  })
);
await database.$disconnect();
