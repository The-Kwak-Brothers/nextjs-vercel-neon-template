#!/usr/bin/env tsx
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { items } from "../src/lib/db/schema";

async function main() {
  const url =
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL or DATABASE_URL_UNPOOLED required");
  }
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);
  const existing = await db.select().from(items).limit(1);
  if (existing.length === 0) {
    await db.insert(items).values({ name: "seed-item" });
    console.log("Seeded items.");
  } else {
    console.log("Items already present — skip seed.");
  }
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
