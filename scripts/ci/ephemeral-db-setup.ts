#!/usr/bin/env tsx
import { getInfraAdapter, resolveDeployTarget } from "../../src/lib/infra/index";
import { resolveCiEnv } from "./ci-env";
import { writeCiOutputs } from "./write-outputs";

async function main() {
  const target = resolveDeployTarget();
  const ci = resolveCiEnv();
  if (ci.prNumber == null) {
    throw new Error("PR/MR number required for ephemeral DB setup (set PR_NUMBER)");
  }
  if (ci.isFork) {
    console.log("Fork PR detected — skipping ephemeral DB (secrets unavailable).");
    process.exit(0);
  }

  const adapter = getInfraAdapter(target);
  const db = await adapter.createEphemeralDb({
    prNumber: ci.prNumber,
    sha: ci.sha,
  });

  process.env.DATABASE_URL = db.databaseUrl;
  if (db.databaseUrlUnpooled) {
    process.env.DATABASE_URL_UNPOOLED = db.databaseUrlUnpooled;
  }

  // Migrate + seed against the ephemeral DB.
  const { execFileSync } = await import("node:child_process");
  execFileSync("npm", ["run", "db:migrate"], {
    stdio: "inherit",
    env: process.env,
  });
  execFileSync("npm", ["run", "db:seed"], {
    stdio: "inherit",
    env: process.env,
  });

  const outPath = writeCiOutputs({
    DATABASE_URL: db.databaseUrl,
    DATABASE_URL_UNPOOLED: db.databaseUrlUnpooled,
    EPHEMERAL_DB_ID: db.id,
    DEPLOY_TARGET: target,
    PR_NUMBER: String(ci.prNumber),
  });
  console.log(`Wrote ${outPath}`);
  console.log(`Ephemeral DB id=${db.id} target=${target}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
