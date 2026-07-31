import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/** Demo table proving migrate → seed → API pipeline. */
export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
