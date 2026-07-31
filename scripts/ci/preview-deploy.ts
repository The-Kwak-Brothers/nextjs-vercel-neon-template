#!/usr/bin/env tsx
import { getInfraAdapter, resolveDeployTarget } from "../../src/lib/infra/index";
import { loadDecryptedAppSecrets } from "./app-secrets";
import { resolveCiEnv } from "./ci-env";
import { readCiOutputs, writeCiOutputs } from "./write-outputs";

async function main() {
  const target = resolveDeployTarget();
  const ci = resolveCiEnv();
  if (ci.prNumber == null) {
    throw new Error("PR/MR number required for preview deploy");
  }
  if (ci.isFork) {
    console.log("Fork PR detected — skipping preview deploy.");
    process.exit(0);
  }

  const existing = readCiOutputs();
  if (
    existing.DEPLOY_TARGET !== target ||
    existing.PR_NUMBER !== String(ci.prNumber)
  ) {
    throw new Error(
      "ci-outputs.env does not match this DEPLOY_TARGET and PR; rerun ci:ephemeral-db-setup",
    );
  }
  const databaseUrl = process.env.DATABASE_URL || existing.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL missing — run ci:ephemeral-db-setup first");
  }
  const ephemeralDbId =
    process.env.EPHEMERAL_DB_ID || existing.EPHEMERAL_DB_ID;
  if (!ephemeralDbId) {
    throw new Error(
      "EPHEMERAL_DB_ID missing — run ci:ephemeral-db-setup first",
    );
  }

  const appSecrets = loadDecryptedAppSecrets({ required: true });
  const env: Record<string, string> = {
    ...appSecrets,
    DATABASE_URL: databaseUrl,
    DATABASE_URL_UNPOOLED:
      process.env.DATABASE_URL_UNPOOLED ||
      existing.DATABASE_URL_UNPOOLED ||
      databaseUrl,
    DEPLOY_TARGET: target,
    NEXT_PUBLIC_SITE_URL:
      appSecrets.NEXT_PUBLIC_SITE_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      "",
  };

  const adapter = getInfraAdapter(target);
  const deploy = await adapter.deployPreview({
    sha: ci.sha,
    prNumber: ci.prNumber,
    env,
  });

  writeCiOutputs({
    DATABASE_URL: databaseUrl,
    DATABASE_URL_UNPOOLED: env.DATABASE_URL_UNPOOLED,
    EPHEMERAL_DB_ID: ephemeralDbId,
    PREVIEW_URL: deploy.previewUrl,
    DEPLOYMENT_ID: deploy.deploymentId,
    DEPLOY_TARGET: target,
    PR_NUMBER: String(ci.prNumber),
  });

  console.log(`PREVIEW_URL=${deploy.previewUrl}`);
  console.log(`DEPLOYMENT_ID=${deploy.deploymentId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
