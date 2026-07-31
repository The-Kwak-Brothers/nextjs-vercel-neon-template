#!/usr/bin/env tsx
import { getInfraAdapter, resolveDeployTarget } from "../../src/lib/infra/index";
import { cloudBranchName } from "../../src/lib/infra/cloud";
import {
  selfhostedComposeProject,
  selfhostedDatabaseName,
} from "../../src/lib/infra/selfhosted";
import { resolveCiEnv } from "./ci-env";
import { readCiOutputs } from "./write-outputs";

async function main() {
  const target = resolveDeployTarget();
  const ci = resolveCiEnv();
  if (ci.prNumber == null) {
    console.log("No PR number — nothing to clean up.");
    return;
  }

  const existing = readCiOutputs();
  if (
    existing.DEPLOY_TARGET &&
    (existing.DEPLOY_TARGET !== target ||
      existing.PR_NUMBER !== String(ci.prNumber))
  ) {
    throw new Error(
      "Refusing cleanup with ci-outputs.env from another target or PR",
    );
  }

  const adapter = getInfraAdapter(target);
  const dbId =
    process.env.EPHEMERAL_DB_ID ||
    existing.EPHEMERAL_DB_ID ||
    (target === "cloud"
      ? cloudBranchName(ci.prNumber)
      : selfhostedDatabaseName(ci.prNumber));
  const deploymentId =
    process.env.DEPLOYMENT_ID ||
    existing.DEPLOYMENT_ID ||
    (target === "selfhosted"
      ? selfhostedComposeProject(ci.prNumber)
      : undefined);

  const errors: unknown[] = [];
  if (deploymentId) {
    try {
      await adapter.teardownPreview({
        prNumber: ci.prNumber,
        deploymentId,
      });
    } catch (error) {
      errors.push(error);
    }
  } else {
    console.log(
      "No Vercel deployment ID is available; skipping optional deployment removal.",
    );
  }

  try {
    await adapter.destroyEphemeralDb({
      prNumber: ci.prNumber,
      id: dbId,
    });
  } catch (error) {
    errors.push(error);
  }

  if (errors.length > 0) {
    throw new AggregateError(errors, `Cleanup failed for PR ${ci.prNumber}`);
  }
  console.log(`Cleanup complete for PR ${ci.prNumber} (${target})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
