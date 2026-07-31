import {
  appendFileSync,
  chmodSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

export type CiOutputs = {
  DATABASE_URL: string;
  DATABASE_URL_UNPOOLED?: string;
  EPHEMERAL_DB_ID: string;
  PREVIEW_URL?: string;
  DEPLOYMENT_ID?: string;
  DEPLOY_TARGET: string;
  PR_NUMBER?: string;
};

function assertPortableOutput(key: string, value: string): void {
  if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
    throw new Error(`Invalid CI output key: ${key}`);
  }
  if (/[\0\r\n]/.test(value)) {
    throw new Error(`${key} cannot contain NUL or newline characters`);
  }
}

export function readCiOutputs(
  cwd = process.cwd(),
): Partial<CiOutputs> {
  const filePath = path.join(cwd, "ci-outputs.env");
  if (!existsSync(filePath)) return {};

  const outputs: Record<string, string> = {};
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    if (!line) continue;
    const separator = line.indexOf("=");
    if (separator < 1) {
      throw new Error(`Malformed CI output line in ${filePath}`);
    }
    const key = line.slice(0, separator);
    const value = line.slice(separator + 1);
    assertPortableOutput(key, value);
    if (key in outputs) {
      throw new Error(`Duplicate CI output key: ${key}`);
    }
    outputs[key] = value;
  }
  return outputs as Partial<CiOutputs>;
}

export function writeCiOutputs(
  outputs: CiOutputs,
  cwd = process.cwd(),
): string {
  const filePath = path.join(cwd, "ci-outputs.env");
  const entries = Object.entries(outputs).filter(
    (entry): entry is [string, string] =>
      entry[1] !== undefined && entry[1] !== "",
  );
  for (const [key, value] of entries) {
    assertPortableOutput(key, value);
  }

  const lines = entries.map(([key, value]) => `${key}=${value}`);
  writeFileSync(filePath, `${lines.join("\n")}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  chmodSync(filePath, 0o600);

  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    for (const [key, value] of entries) {
      appendFileSync(githubOutput, `${key}=${value}\n`);
    }
  }

  // Mask secrets in GHA logs when possible.
  if (process.env.GITHUB_ACTIONS === "true") {
    for (const value of [
      outputs.DATABASE_URL,
      outputs.DATABASE_URL_UNPOOLED,
    ]) {
      if (value) console.log(`::add-mask::${value}`);
    }
  }

  return filePath;
}
