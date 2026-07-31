import { execFileSync } from "node:child_process";
import type {
  DeployPreviewContext,
  DestroyDbContext,
  EphemeralDb,
  EphemeralDbContext,
  InfraAdapter,
  PreviewDeploy,
  TeardownPreviewContext,
} from "./types";

type NeonBranch = {
  id: string;
  name: string;
  project_id: string;
};

type VercelDeployment = {
  id: string;
  projectId?: string;
  url?: string;
};

class ApiError extends Error {
  constructor(
    service: string,
    readonly status: number,
    requestId: string | null,
  ) {
    super(
      `${service} API request failed with status ${status}` +
        (requestId ? ` (request ${requestId})` : ""),
    );
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for cloud adapter`);
  }
  return value;
}

function assertPrNumber(prNumber: number): void {
  if (!Number.isSafeInteger(prNumber) || prNumber <= 0) {
    throw new Error(`Invalid PR/MR number: ${prNumber}`);
  }
}

export function cloudBranchName(prNumber: number): string {
  assertPrNumber(prNumber);
  return `preview/pr-${prNumber}`;
}

async function neonFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${requireEnv("NEON_API_KEY")}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`https://console.neon.tech/api/v2${path}`, {
    ...init,
    headers,
    signal: init?.signal ?? AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new ApiError(
      "Neon",
      response.status,
      response.headers.get("x-request-id"),
    );
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

async function findNeonBranch(
  projectId: string,
  name: string,
): Promise<NeonBranch | undefined> {
  const query = new URLSearchParams({ search: name, limit: "100" });
  const result = await neonFetch<{ branches: NeonBranch[] }>(
    `/projects/${encodeURIComponent(projectId)}/branches?${query}`,
  );
  return result.branches.find((branch) => branch.name === name);
}

async function getNeonConnectionUri(
  projectId: string,
  branchId: string,
  pooled: boolean,
): Promise<string> {
  const query = new URLSearchParams({
    branch_id: branchId,
    database_name: process.env.NEON_DB_NAME ?? "neondb",
    role_name: process.env.NEON_DB_ROLE ?? "neondb_owner",
    pooled: String(pooled),
  });
  const result = await neonFetch<{ uri: string }>(
    `/projects/${encodeURIComponent(projectId)}/connection_uri?${query}`,
  );
  const parsed = new URL(result.uri);
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("Neon returned a non-PostgreSQL connection URI");
  }
  return result.uri;
}

function vercelUrl(path: string): URL {
  const url = new URL(path, "https://api.vercel.com");
  url.searchParams.set("teamId", requireEnv("VERCEL_ORG_ID"));
  return url;
}

async function vercelFetch<T>(
  path: string,
  init?: RequestInit & { allowNotFound?: boolean },
): Promise<T | null> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${requireEnv("VERCEL_TOKEN")}`);

  const response = await fetch(vercelUrl(path), {
    ...init,
    headers,
    signal: init?.signal ?? AbortSignal.timeout(30_000),
  });
  if (init?.allowNotFound && response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new ApiError(
      "Vercel",
      response.status,
      response.headers.get("x-vercel-id"),
    );
  }
  return (await response.json()) as T;
}

function parsePreviewUrl(output: string): string {
  for (const line of output.split(/\r?\n/).reverse()) {
    const candidate = line.trim();
    if (!candidate.startsWith("https://")) continue;
    const parsed = new URL(candidate);
    if (parsed.username || parsed.password || parsed.pathname !== "/") continue;
    return parsed.origin;
  }
  throw new Error("Vercel CLI did not return a valid HTTPS preview URL");
}

function vercelEnvironmentArgs(
  environment: Record<string, string>,
): string[] {
  const args: string[] = [];
  for (const [key, value] of Object.entries(environment).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (!value) continue;
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key) || /[\0\r\n]/.test(value)) {
      throw new Error(`Invalid Vercel environment entry: ${key}`);
    }
    args.push("--env", `${key}=${value}`);
  }
  return args;
}

async function getVercelDeployment(
  idOrUrl: string,
  allowNotFound = false,
): Promise<VercelDeployment | null> {
  return vercelFetch<VercelDeployment>(
    `/v13/deployments/${encodeURIComponent(idOrUrl)}`,
    { allowNotFound },
  );
}

function assertExpectedVercelProject(deployment: VercelDeployment): void {
  const projectId = requireEnv("VERCEL_PROJECT_ID");
  if (deployment.projectId !== projectId) {
    throw new Error(
      `Refusing deployment operation outside VERCEL_PROJECT_ID=${projectId}`,
    );
  }
}

/**
 * Cloud adapter: Neon check-before-create branches + CI-owned Vercel --prebuilt.
 * Vercel Git auto-deploy must remain disabled for this project.
 */
export function createCloudAdapter(): InfraAdapter {
  return {
    async createEphemeralDb(ctx: EphemeralDbContext): Promise<EphemeralDb> {
      assertPrNumber(ctx.prNumber);
      const projectId = requireEnv("NEON_PROJECT_ID");
      const name = cloudBranchName(ctx.prNumber);
      let branch = await findNeonBranch(projectId, name);

      if (!branch) {
        try {
          const created = await neonFetch<{ branch: NeonBranch }>(
            `/projects/${encodeURIComponent(projectId)}/branches`,
            {
              method: "POST",
              body: JSON.stringify({
                branch: { name },
                endpoints: [{ type: "read_write" }],
              }),
            },
          );
          branch = created.branch;
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 409) {
            throw error;
          }
          branch = await findNeonBranch(projectId, name);
        }
      }

      if (!branch || branch.name !== name) {
        throw new Error(`Unable to create or recover Neon branch ${name}`);
      }

      const [databaseUrl, databaseUrlUnpooled] = await Promise.all([
        getNeonConnectionUri(projectId, branch.id, true),
        getNeonConnectionUri(projectId, branch.id, false),
      ]);
      return { id: branch.id, databaseUrl, databaseUrlUnpooled };
    },

    async destroyEphemeralDb(ctx: DestroyDbContext): Promise<void> {
      assertPrNumber(ctx.prNumber);
      const projectId = requireEnv("NEON_PROJECT_ID");
      const expectedName = cloudBranchName(ctx.prNumber);
      const branch = await findNeonBranch(projectId, expectedName);
      if (!branch) return;
      if (ctx.id !== expectedName && ctx.id !== branch.id) {
        throw new Error(
          `Refusing to delete Neon branch ${ctx.id}; expected ${branch.id}`,
        );
      }

      try {
        await neonFetch(
          `/projects/${encodeURIComponent(projectId)}/branches/${encodeURIComponent(branch.id)}`,
          { method: "DELETE" },
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return;
        throw error;
      }
    },

    async deployPreview(ctx: DeployPreviewContext): Promise<PreviewDeploy> {
      assertPrNumber(ctx.prNumber);
      const token = requireEnv("VERCEL_TOKEN");
      requireEnv("VERCEL_ORG_ID");
      requireEnv("VERCEL_PROJECT_ID");

      const childEnv = { ...process.env, ...ctx.env };
      execFileSync(
        "vercel",
        ["pull", "--yes", "--environment=preview", `--token=${token}`],
        { stdio: "inherit", env: childEnv },
      );
      execFileSync(
        "vercel",
        ["build", "--yes", `--token=${token}`],
        { stdio: "inherit", env: childEnv },
      );

      const deployOutput = execFileSync(
        "vercel",
        [
          "deploy",
          "--prebuilt",
          "--yes",
          `--token=${token}`,
          ...vercelEnvironmentArgs(ctx.env),
          "--meta",
          `ciCommitSha=${ctx.sha}`,
          "--meta",
          `pullRequestNumber=${ctx.prNumber}`,
        ],
        {
          encoding: "utf8",
          env: childEnv,
          stdio: ["ignore", "pipe", "inherit"],
        },
      );
      const previewUrl = parsePreviewUrl(deployOutput);
      const deployment = await getVercelDeployment(new URL(previewUrl).host);
      if (!deployment || !/^dpl_[A-Za-z0-9]+$/.test(deployment.id)) {
        throw new Error("Vercel did not return a required deployment ID");
      }
      assertExpectedVercelProject(deployment);
      return { previewUrl, deploymentId: deployment.id };
    },

    async teardownPreview(ctx: TeardownPreviewContext): Promise<void> {
      assertPrNumber(ctx.prNumber);
      if (!/^dpl_[A-Za-z0-9]+$/.test(ctx.deploymentId)) {
        throw new Error("Refusing to remove an invalid Vercel deployment ID");
      }

      const deployment = await getVercelDeployment(ctx.deploymentId, true);
      if (!deployment) return;
      assertExpectedVercelProject(deployment);
      await vercelFetch(
        `/v13/deployments/${encodeURIComponent(ctx.deploymentId)}`,
        { method: "DELETE", allowNotFound: true },
      );
    },
  };
}
