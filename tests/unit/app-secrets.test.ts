import {
  chmodSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadDecryptedAppSecrets } from "../../scripts/ci/app-secrets";

const temporaryDirectories: string[] = [];

function writeSecrets(value: unknown): string {
  const directory = mkdtempSync(path.join(tmpdir(), "app-secrets-test-"));
  temporaryDirectories.push(directory);
  const filePath = path.join(directory, "secrets.json");
  writeFileSync(filePath, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  return filePath;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("loadDecryptedAppSecrets", () => {
  it("loads a flat app environment", () => {
    const filePath = writeSecrets({ APP_FEATURE: "enabled" });

    expect(loadDecryptedAppSecrets({ required: true, filePath })).toEqual({
      APP_FEATURE: "enabled",
    });
  });

  it("rejects infrastructure bootstrap credentials", () => {
    const filePath = writeSecrets({ VERCEL_TOKEN: "not-an-app-secret" });

    expect(() =>
      loadDecryptedAppSecrets({ required: true, filePath }),
    ).toThrow(/infrastructure state/);
  });

  it.runIf(process.platform !== "win32")(
    "rejects files readable by other users",
    () => {
      const filePath = writeSecrets({ APP_FEATURE: "enabled" });
      chmodSync(filePath, 0o644);

      expect(() =>
        loadDecryptedAppSecrets({ required: true, filePath }),
      ).toThrow(/group or other users/);
    },
  );
});
