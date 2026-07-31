import { describe, expect, it } from "vitest";
import {
  assertSafeDatabaseName,
  assertSafeDatabaseRole,
  selfhostedComposeProject,
  selfhostedDatabaseName,
  selfhostedDatabaseRole,
} from "@/lib/infra/selfhosted";

describe("selfhosted resource naming", () => {
  it("derives stable database and Compose identifiers", () => {
    expect(selfhostedDatabaseName(12)).toBe("pr_12");
    expect(selfhostedDatabaseRole(12)).toBe("pr_12_app");
    expect(selfhostedComposeProject(12)).toBe("preview-pr-12");
    expect(() => assertSafeDatabaseName("pr_12")).not.toThrow();
    expect(() => assertSafeDatabaseRole("pr_12_app")).not.toThrow();
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
    "rejects invalid PR number %s",
    (prNumber) => {
      expect(() => selfhostedDatabaseName(prNumber)).toThrow(/Invalid PR/);
      expect(() => selfhostedDatabaseRole(prNumber)).toThrow(/Invalid PR/);
      expect(() => selfhostedComposeProject(prNumber)).toThrow(/Invalid PR/);
    },
  );

  it.each(["postgres", "pr_0", "pr_01", "pr_12;drop", "pr_12\nCREATE"])(
    "rejects unsafe database name %s",
    (name) => {
      expect(() => assertSafeDatabaseName(name)).toThrow(/unsafe/);
    },
  );

  it.each(["postgres", "pr_0_app", "pr_01_app", "pr_12_app;drop"])(
    "rejects unsafe database role %s",
    (name) => {
      expect(() => assertSafeDatabaseRole(name)).toThrow(/unsafe/);
    },
  );
});
