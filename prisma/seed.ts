import "dotenv/config";

import { database } from "../lib/database";
import { hashPassword } from "../lib/security/password";

const initialEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;

if (!initialEmail || !initialPassword || initialPassword.startsWith("replace-with-")) {
  console.log(
    "Initial admin seed skipped: configure INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD."
  );
} else {
  const existingAdmin = await database.adminUser.findUnique({
    where: { email: initialEmail }
  });

  if (existingAdmin) {
    console.log(`Initial admin already exists: ${initialEmail}`);
  } else {
    await database.adminUser.create({
      data: {
        email: initialEmail,
        name: "JANVIER Owner",
        passwordHash: await hashPassword(initialPassword),
        role: "OWNER"
      }
    });
    console.log(`Initial admin created: ${initialEmail}`);
  }
}

await database.$disconnect();
