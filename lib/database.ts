import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../app/generated/prisma/client";

const globalForDatabase = globalThis as unknown as {
  janvierDatabase?: PrismaClient;
};

function createDatabaseClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to use JANVIER data services.");
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const database = globalForDatabase.janvierDatabase ?? createDatabaseClient();

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.janvierDatabase = database;
}
