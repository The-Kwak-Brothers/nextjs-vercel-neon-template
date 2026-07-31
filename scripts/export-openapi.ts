#!/usr/bin/env tsx
import { writeFileSync } from "node:fs";
import { generateOpenApiDocument } from "../src/lib/openapi";

const doc = generateOpenApiDocument();
writeFileSync("openapi.json", `${JSON.stringify(doc, null, 2)}\n`);
console.log("Wrote openapi.json");
