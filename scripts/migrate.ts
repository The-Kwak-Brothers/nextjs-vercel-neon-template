#!/usr/bin/env tsx
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url =
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL or DATABASE_URL_UNPOOLED required");
  }
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "db/migrations" });
  await client.end();
  console.log("Migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
