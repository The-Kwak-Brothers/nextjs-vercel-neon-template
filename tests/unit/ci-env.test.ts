import { describe, expect, it } from "vitest";
import { resolveCiEnv } from "../../scripts/ci/ci-env";
import { resolveDeployTarget } from "@/lib/infra/index";

describe("resolveCiEnv", () => {
  it("reads GitLab MR context", () => {
    const env = resolveCiEnv({
      GITLAB_CI: "true",
      CI_MERGE_REQUEST_IID: "42",
      CI_COMMIT_SHA: "abc",
      CI_MERGE_REQUEST_SOURCE_BRANCH_NAME: "feat",
      CI_PIPELINE_SOURCE: "merge_request_event",
    } as unknown as NodeJS.ProcessEnv);
    expect(env.provider).toBe("gitlab");
    expect(env.prNumber).toBe(42);
    expect(env.sha).toBe("abc");
  });

  it("falls back to local", () => {
    const env = resolveCiEnv({ PR_NUMBER: "7" } as unknown as NodeJS.ProcessEnv);
    expect(env.provider).toBe("local");
    expect(env.prNumber).toBe(7);
  });
});

describe("resolveDeployTarget", () => {
  it("requires an explicit target", () => {
    expect(() => resolveDeployTarget("")).toThrow(
      /DEPLOY_TARGET must be set explicitly/,
    );
  });

  it("accepts cloud", () => {
    expect(resolveDeployTarget("cloud")).toBe("cloud");
  });

  it("accepts selfhosted", () => {
    expect(resolveDeployTarget("selfhosted")).toBe("selfhosted");
  });

  it("rejects unknown", () => {
    expect(() => resolveDeployTarget("neon-oss")).toThrow(
      /DEPLOY_TARGET must be set explicitly/,
    );
  });
});
