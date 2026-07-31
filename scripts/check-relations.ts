#!/usr/bin/env tsx
import { is } from "drizzle-orm";
import {
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
  One,
} from "drizzle-orm/relations";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as relationDefinitions from "../src/lib/db/relations";
import * as schema from "../src/lib/db/schema";

const combinedSchema = { ...schema, ...relationDefinitions };
const relational = extractTablesRelationalConfig(
  combinedSchema,
  createTableRelationsHelpers,
);

let foreignKeyCount = 0;
const missing: string[] = [];

for (const value of Object.values(schema)) {
  if (!is(value, PgTable)) continue;
  const table = getTableConfig(value);
  const relationalTable = Object.values(relational.tables).find(
    (candidate) =>
      candidate.dbName === table.name &&
      (candidate.schema ?? "public") === (table.schema ?? "public"),
  );

  for (const foreignKey of table.foreignKeys) {
    foreignKeyCount += 1;
    const reference = foreignKey.reference();
    const hasMatchingOneRelation = Object.values(
      relationalTable?.relations ?? {},
    ).some((relation) => {
      if (!is(relation, One) || !relation.config) return false;
      return (
        relation.config.fields.length === reference.columns.length &&
        relation.config.fields.every(
          (column, index) => column === reference.columns[index],
        ) &&
        relation.config.references.every(
          (column, index) => column === reference.foreignColumns[index],
        )
      );
    });

    if (!hasMatchingOneRelation) {
      missing.push(`${table.name}.${reference.columns.map((c) => c.name).join("+")}`);
    }
  }
}

if (missing.length > 0) {
  console.error(
    `Foreign keys without matching Drizzle one() relations: ${missing.join(", ")}`,
  );
  process.exit(1);
}

console.log(
  `Relations check OK: ${foreignKeyCount} foreign key(s), all with matching one() relations.`,
);
