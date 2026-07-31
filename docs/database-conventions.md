# Database conventions

ORM: **Drizzle**. Migrations are **forward-only** and additive by default.

## Never

- Hand-edit applied files under `db/migrations/`
- Skip or rewrite `_journal.json` entries
- Ship destructive DDL without an ADR + human sign-off

## Generate migrations

```bash
nix develop -c npx drizzle-kit generate
nix develop -c npm run db:migrate
```

## Relationship → route shapes

| Shape | Drizzle | Route |
|-------|---------|-------|
| One-to-many | FK on child + `relations()` | Nested list `/api/collections/:id/items`; direct `/api/items/:id` |
| Self-ref tree | self `foreignKey` | Query param `/api/items?parentId=` (not deep path nesting) |
| Many-to-many | Join table + two `relations()` | `/api/items/:id/tags` |

**Rule:** every FK in `src/lib/db/schema.ts` has a matching `relations()` export in `src/lib/db/relations.ts`.

CI: `npm run ci:check-relations`.

## Demo schema

The starter ships a single `items` table (no FKs) to prove migrate → seed → API. When you add the second table with an FK, the relations drift check becomes mandatory signal.
