/**
 * Drizzle relations exports.
 *
 * Rule (see docs/database-conventions.md): every foreign key in schema.ts
 * must have a matching relations() export here. The demo `items` table has
 * no FKs yet — this file is scaffolding so the drift checker has a home.
 *
 * Example when adding a child table:
 *
 *   export const collectionsRelations = relations(collections, ({ many }) => ({
 *     items: many(items),
 *   }));
 *   export const itemsRelations = relations(items, ({ one }) => ({
 *     collection: one(collections, {
 *       fields: [items.collectionId],
 *       references: [collections.id],
 *     }),
 *   }));
 */

export const relationsRegistry = {
  // intentionally empty until the first FK lands
} as const;
