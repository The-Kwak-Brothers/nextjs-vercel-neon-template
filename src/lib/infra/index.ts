import type { DeployTarget, InfraAdapter } from "./types";
import { createCloudAdapter } from "./cloud";
import { createSelfhostedAdapter } from "./selfhosted";

export * from "./types";
export { createCloudAdapter } from "./cloud";
export { createSelfhostedAdapter } from "./selfhosted";

export function resolveDeployTarget(
  raw: string | undefined = process.env.DEPLOY_TARGET,
): DeployTarget {
  if (raw === "cloud" || raw === "selfhosted") {
    return raw;
  }
  throw new Error(
    `DEPLOY_TARGET must be set explicitly to "cloud" or "selfhosted" (received ${JSON.stringify(raw)}).`,
  );
}

export function getInfraAdapter(
  target: DeployTarget = resolveDeployTarget(),
): InfraAdapter {
  switch (target) {
    case "cloud":
      return createCloudAdapter();
    case "selfhosted":
      return createSelfhostedAdapter();
    default: {
      const _exhaustive: never = target;
      throw new Error(`Unhandled DEPLOY_TARGET: ${_exhaustive}`);
    }
  }
}
