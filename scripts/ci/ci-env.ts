/**
 * Normalize PR/MR context from GitHub Actions or GitLab CI into one shape.
 */
import { readFileSync } from "node:fs";

export type CiEnv = {
  prNumber: number | null;
  sha: string;
  branch: string;
  isFork: boolean;
  event: string;
  provider: "github" | "gitlab" | "local";
};

function parsePrNumber(value: string | number | undefined): number | null {
  if (value === undefined) return null;
  const serialized = String(value);
  if (!/^[1-9]\d*$/.test(serialized)) return null;
  const number = Number(serialized);
  return Number.isSafeInteger(number) ? number : null;
}

export function resolveCiEnv(env: NodeJS.ProcessEnv = process.env): CiEnv {
  if (env.GITHUB_ACTIONS === "true") {
    if (env.GITHUB_EVENT_PATH) {
      try {
        const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")) as {
          pull_request?: {
            number?: number;
            head?: {
              sha?: string;
              repo?: { full_name?: string };
            };
            base?: { repo?: { full_name?: string } };
          };
        };
        const headRepo = event.pull_request?.head?.repo?.full_name;
        const baseRepo = event.pull_request?.base?.repo?.full_name;
        const isFork = Boolean(headRepo && baseRepo && headRepo !== baseRepo);
        return {
          prNumber: parsePrNumber(event.pull_request?.number),
          sha: event.pull_request?.head?.sha ?? env.GITHUB_SHA ?? "unknown",
          branch: env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || "unknown",
          isFork,
          event: env.GITHUB_EVENT_NAME ?? "unknown",
          provider: "github",
        };
      } catch (error) {
        throw new Error(
          `Unable to parse GITHUB_EVENT_PATH=${env.GITHUB_EVENT_PATH}`,
          { cause: error },
        );
      }
    }

    const fromRef = env.GITHUB_REF?.match(/refs\/pull\/(\d+)/)?.[1];
    return {
      prNumber: parsePrNumber(env.PR_NUMBER) ?? parsePrNumber(fromRef),
      sha: env.GITHUB_SHA ?? "unknown",
      branch: env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || "unknown",
      isFork: env.GITHUB_HEAD_REPOSITORY
        ? env.GITHUB_HEAD_REPOSITORY !== env.GITHUB_REPOSITORY
        : false,
      event: env.GITHUB_EVENT_NAME ?? "unknown",
      provider: "github",
    };
  }

  if (env.GITLAB_CI === "true") {
    return {
      prNumber: parsePrNumber(env.CI_MERGE_REQUEST_IID),
      sha: env.CI_COMMIT_SHA ?? "unknown",
      branch:
        env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME ||
        env.CI_COMMIT_REF_NAME ||
        "unknown",
      isFork: Boolean(
        env.CI_MERGE_REQUEST_SOURCE_PROJECT_ID &&
          env.CI_MERGE_REQUEST_PROJECT_ID &&
          env.CI_MERGE_REQUEST_SOURCE_PROJECT_ID !==
            env.CI_MERGE_REQUEST_PROJECT_ID,
      ),
      event: env.CI_PIPELINE_SOURCE ?? "unknown",
      provider: "gitlab",
    };
  }

  return {
    prNumber: parsePrNumber(env.PR_NUMBER),
    sha: env.CI_COMMIT_SHA || env.GITHUB_SHA || "local",
    branch: env.BRANCH || "local",
    isFork: false,
    event: "local",
    provider: "local",
  };
}
