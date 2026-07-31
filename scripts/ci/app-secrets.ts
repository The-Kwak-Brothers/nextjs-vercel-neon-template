import { existsSync, lstatSync, readFileSync } from "node:fs";
import path from "node:path";

const APP_ENV_KEY = /^[A-Z_][A-Z0-9_]*$/;
const RESERVED_APP_ENV_KEYS = new Set([
  "CI_JOB_TOKEN",
  "GITHUB_TOKEN",
  "GITLAB_TOKEN",
  "NEON_API_KEY",
  "NEON_CONNECTION_TEMPLATE",
  "NEON_DB_PASSWORD",
  "NEON_PROJECT_ID",
  "POSTGRES_ADMIN_URL",
  "SOPS_AGE_KEY",
  "SOPS_AGE_KEY_FILE",
  "VERCEL_ORG_ID",
  "VERCEL_PROJECT_ID",
  "VERCEL_TOKEN",
]);

export function loadDecryptedAppSecrets(options?: {
  required?: boolean;
  filePath?: string;
}): Record<string, string> {
  const filePath = path.resolve(
    options?.filePath ??
      process.env.SOPS_OUT ??
      "secrets/secrets.dec.json",
  );
  if (!existsSync(filePath)) {
    if (options?.required) {
      throw new Error(
        `Missing decrypted app secrets at ${filePath}; run scripts/ci/sops-decrypt.sh first`,
      );
    }
    return {};
  }

  const stat = lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${filePath} must be a regular, non-symlink file`);
  }
  if (process.platform !== "win32" && (stat.mode & 0o077) !== 0) {
    throw new Error(`${filePath} must not be accessible by group or other users`);
  }

  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${filePath} must contain a flat JSON object`);
  }

  const secrets: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!APP_ENV_KEY.test(key) || typeof value !== "string") {
      throw new Error(`${filePath} contains an invalid app environment entry`);
    }
    if (RESERVED_APP_ENV_KEYS.has(key)) {
      throw new Error(`${key} is infrastructure state, not an app secret`);
    }
    if (value.includes("\0")) {
      throw new Error(`${key} contains a NUL byte`);
    }
    secrets[key] = value;
  }
  return secrets;
}
