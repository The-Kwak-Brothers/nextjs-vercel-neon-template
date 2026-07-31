import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { items } from "./schema";

/** Schema-as-contract from Drizzle tables (drizzle-zod). */
export const insertItemSchema = createInsertSchema(items).omit({
  id: true,
  createdAt: true,
});

export const selectItemSchema = createSelectSchema(items);

export const createItemBodySchema = z.object({
  name: z.string().min(1).max(200),
});

export type CreateItemBody = z.infer<typeof createItemBodySchema>;
