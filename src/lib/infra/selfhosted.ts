import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client, escapeLiteral } from "pg";
import type {
  DeployPreviewContext,
  DestroyDbContext,
  EphemeralDb,
  EphemeralDbContext,
  InfraAdapter,
  PreviewDeploy,
  TeardownPreviewContext,
} from "./types";

const MANAGED_ROLE_COMMENT = "next-neon-ci-template managed preview role";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for selfhosted adapter`);
  }
  return value;
}

function assertPrNumber(prNumber: number): void {
  if (!Number.isSafeInteger(prNumber) || prNumber <= 0) {
    throw new Error(`Invalid PR/MR number: ${prNumber}`);
  }
}

export function selfhostedDatabaseName(prNumber: number): string {
  assertPrNumber(prNumber);
  return `pr_${prNumber}`;
}

export function selfhostedComposeProject(prNumber: number): string {
  assertPrNumber(prNumber);
  return `preview-pr-${prNumber}`;
}

export function selfhostedDatabaseRole(prNumber: number): string {
  assertPrNumber(prNumber);
  return `pr_${prNumber}_app`;
}

export function assertSafeDatabaseName(name: string): void {
  if (!/^pr_[1-9]\d*$/.test(name)) {
    throw new Error(`Refusing unsafe database name: ${name}`);
  }
}

export function assertSafeDatabaseRole(name: string): void {
  if (!/^pr_[1-9]\d*_app$/.test(name)) {
    throw new Error(`Refusing unsafe database role: ${name}`);
  }
}

function quotedDatabaseName(name: string): string {
  assertSafeDatabaseName(name);
  return `"${name}"`;
}

function quotedDatabaseRole(name: string): string {
  assertSafeDatabaseRole(name);
  return `"${name}"`;
}

function postgresAdminUrl(): string {
  const raw = requireEnv("POSTGRES_ADMIN_URL");
  const parsed = new URL(raw);
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("POSTGRES_ADMIN_URL must be a PostgreSQL URL");
  }
  return raw;
}

function appUrlForDatabase(
  name: string,
  role: string,
  password: string,
): string {
  assertSafeDatabaseName(name);
  assertSafeDatabaseRole(role);
  const url = new URL(postgresAdminUrl());
  url.username = role;
  url.password = password;
  url.pathname = `/${name}`;
  return url.toString();
}

async function withDatabaseLock<T>(
  name: string,
  action: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: postgresAdminUrl() });
  await client.connect();
  const lockName = `next-neon-ci-template:${name}`;
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [lockName]);
    return await action(client);
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockName]);
    } finally {
      await client.end();
    }
  }
}

type DatabaseRoleState = {
  rolbypassrls: boolean;
  rolcreatedb: boolean;
  rolcreaterole: boolean;
  rolinherit: boolean;
  rolreplication: boolean;
  rolsuper: boolean;
  hasMemberships: boolean;
  roleComment: string | null;
};

async function getDatabaseRoleState(
  client: Client,
  role: string,
): Promise<DatabaseRoleState | undefined> {
  assertSafeDatabaseRole(role);
  const result = await client.query<DatabaseRoleState>(
    `
      SELECT
        r.rolbypassrls,
        r.rolcreatedb,
        r.rolcreaterole,
        r.rolinherit,
        r.rolreplication,
        r.rolsuper,
        shobj_description(r.oid, 'pg_authid') AS "roleComment",
        EXISTS (
          SELECT 1
          FROM pg_auth_members m
          WHERE m.member = r.oid OR m.roleid = r.oid
        ) AS "hasMemberships"
      FROM pg_roles r
      WHERE r.rolname = $1
    `,
    [role],
  );
  return result.rows[0];
}

function assertUnprivilegedDatabaseRole(
  role: string,
  state: DatabaseRoleState,
): void {
  if (
    state.rolbypassrls ||
    state.rolcreatedb ||
    state.rolcreaterole ||
    state.rolinherit ||
    state.rolreplication ||
    state.rolsuper ||
    state.hasMemberships ||
    state.roleComment !== MANAGED_ROLE_COMMENT
  ) {
    throw new Error(
      `Refusing to reuse or remove unmanaged or privileged database role ${role}`,
    );
  }
}

function resolveComposeFile(): string {
  const root = process.cwd();
  const configured =
    process.env.SELFHOSTED_COMPOSE_FILE ?? "docker-compose.ci.yml";
  const resolved = path.resolve(root, configured);
  if (
    !resolved.startsWith(`${root}${path.sep}`) ||
    !/\.ya?ml$/.test(resolved) ||
    !existsSync(resolved)
  ) {
    throw new Error(
      "SELFHOSTED_COMPOSE_FILE must be an existing YAML file inside the repository",
    );
  }
  return resolved;
}

type PreviewAddress = {
  isFixed: boolean;
  previewHost: string;
  previewUrl: string;
};

function resolvePreviewAddress(prNumber: number): PreviewAddress {
  const mode = process.env.SELFHOSTED_PREVIEW_MODE ?? "dynamic";
  if (mode === "fixed") {
    const raw = requireEnv("SELFHOSTED_FIXED_PREVIEW_URL");
    const parsed = new URL(raw);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error(
        "SELFHOSTED_FIXED_PREVIEW_URL must be an HTTP(S) origin without credentials, path, query, or hash",
      );
    }
    return {
      isFixed: true,
      previewHost: parsed.host,
      previewUrl: parsed.origin,
    };
  }
  if (mode !== "dynamic") {
    throw new Error(
      "SELFHOSTED_PREVIEW_MODE must be either dynamic or fixed",
    );
  }

  const domain = requireEnv("PREVIEW_BASE_DOMAIN");
  if (
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(
      domain,
    )
  ) {
    throw new Error("PREVIEW_BASE_DOMAIN must be a DNS hostname");
  }
  const previewHost = `pr-${prNumber}.${domain.toLowerCase()}`;
  return {
    isFixed: false,
    previewHost,
    previewUrl: `https://${previewHost}`,
  };
}

function resolveFixedHostPort(): string {
  const raw = process.env.SELFHOSTED_FIXED_PORT ?? "3000";
  if (!/^\d{1,5}$/.test(raw)) {
    throw new Error("SELFHOSTED_FIXED_PORT must be an integer from 1 to 65535");
  }
  const port = Number(raw);
  if (port < 1 || port > 65_535) {
    throw new Error("SELFHOSTED_FIXED_PORT must be an integer from 1 to 65535");
  }
  return String(port);
}

function ensurePreviewNetwork(environment: NodeJS.ProcessEnv): void {
  const network = process.env.SELFHOSTED_PREVIEW_NETWORK ?? "preview-proxy";
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(network)) {
    throw new Error("SELFHOSTED_PREVIEW_NETWORK is not a safe Docker network name");
  }
  try {
    execFileSync("docker", ["network", "inspect", network], {
      stdio: "ignore",
      env: environment,
    });
  } catch {
    try {
      execFileSync("docker", ["network", "create", network], {
        stdio: "inherit",
        env: environment,
      });
    } catch {
      // Another preview may have created it after our inspect.
      execFileSync("docker", ["network", "inspect", network], {
        stdio: "ignore",
        env: environment,
      });
    }
  }
}

function serializeEnvFile(environment: Record<string, string>): string {
  return `${Object.entries(environment)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      if (!/^[A-Z_][A-Z0-9_]*$/.test(key) || /[\0\r\n]/.test(value)) {
        throw new Error(`Invalid container environment entry: ${key}`);
      }
      const escaped = value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
      return `${key}='${escaped}'`;
    })
    .join("\n")}\n`;
}

/**
 * Selfhosted adapter: plain Postgres 16 (not Neon OSS) + Docker Compose.
 * Database create/drop is serialized, checks pg_database before mutation, and
 * gives each preview a managed unprivileged owner role with rotated credentials.
 */
export function createSelfhostedAdapter(): InfraAdapter {
  return {
    async createEphemeralDb(ctx: EphemeralDbContext): Promise<EphemeralDb> {
      const name = selfhostedDatabaseName(ctx.prNumber);
      const role = selfhostedDatabaseRole(ctx.prNumber);
      const password = randomBytes(32).toString("base64url");
      await withDatabaseLock(name, async (client) => {
        const database = await client.query<{ owner: string }>(
          `
            SELECT pg_get_userbyid(datdba) AS owner
            FROM pg_database
            WHERE datname = $1
          `,
          [name],
        );
        if (
          (database.rowCount ?? 0) > 0 &&
          database.rows[0]?.owner !== role
        ) {
          throw new Error(
            `Refusing to reuse database ${name}; expected owner ${role}`,
          );
        }

        const roleState = await getDatabaseRoleState(client, role);
        if (roleState) {
          assertUnprivilegedDatabaseRole(role, roleState);
          await client.query(
            `ALTER ROLE ${quotedDatabaseRole(role)} WITH LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${escapeLiteral(password)}`,
          );
        } else {
          await client.query(
            `CREATE ROLE ${quotedDatabaseRole(role)} WITH LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${escapeLiteral(password)}`,
          );
          await client.query(
            `COMMENT ON ROLE ${quotedDatabaseRole(role)} IS ${escapeLiteral(MANAGED_ROLE_COMMENT)}`,
          );
        }

        if ((database.rowCount ?? 0) === 0) {
          await client.query(
            `CREATE DATABASE ${quotedDatabaseName(name)} OWNER ${quotedDatabaseRole(role)}`,
          );
        }
        await client.query(
          `REVOKE ALL ON DATABASE ${quotedDatabaseName(name)} FROM PUBLIC`,
        );
      });

      const databaseUrl = appUrlForDatabase(name, role, password);
      return { id: name, databaseUrl, databaseUrlUnpooled: databaseUrl };
    },

    async destroyEphemeralDb(ctx: DestroyDbContext): Promise<void> {
      const expectedName = selfhostedDatabaseName(ctx.prNumber);
      const expectedRole = selfhostedDatabaseRole(ctx.prNumber);
      if (ctx.id !== expectedName) {
        throw new Error(
          `Refusing to drop ${ctx.id}; expected database ${expectedName}`,
        );
      }

      await withDatabaseLock(expectedName, async (client) => {
        const database = await client.query<{ owner: string }>(
          `
            SELECT pg_get_userbyid(datdba) AS owner
            FROM pg_database
            WHERE datname = $1
          `,
          [expectedName],
        );
        if (
          (database.rowCount ?? 0) > 0 &&
          database.rows[0]?.owner !== expectedRole
        ) {
          throw new Error(
            `Refusing to drop database ${expectedName}; expected owner ${expectedRole}`,
          );
        }

        if ((database.rowCount ?? 0) > 0) {
          await client.query(
            `
              SELECT pg_terminate_backend(pid)
              FROM pg_stat_activity
              WHERE datname = $1 AND pid <> pg_backend_pid()
            `,
            [expectedName],
          );
          await client.query(
            `DROP DATABASE ${quotedDatabaseName(expectedName)}`,
          );
        }

        const roleState = await getDatabaseRoleState(client, expectedRole);
        if (roleState) {
          assertUnprivilegedDatabaseRole(expectedRole, roleState);
          await client.query(`DROP ROLE ${quotedDatabaseRole(expectedRole)}`);
        }
      });
    },

    async deployPreview(ctx: DeployPreviewContext): Promise<PreviewDeploy> {
      const project = selfhostedComposeProject(ctx.prNumber);
      const address = resolvePreviewAddress(ctx.prNumber);
      const composeFile = resolveComposeFile();
      const imageTag =
        process.env.SELFHOSTED_IMAGE_TAG ?? `${project}:latest`;
      if (/[\0\r\n\s]/.test(imageTag)) {
        throw new Error("SELFHOSTED_IMAGE_TAG contains unsafe whitespace");
      }

      const commandEnv: NodeJS.ProcessEnv = {
        ...process.env,
        APP_HOST_PORT: address.isFixed ? resolveFixedHostPort() : "3000",
        APP_IMAGE: imageTag,
        COMPOSE_PROJECT_NAME: project,
        DATABASE_URL: ctx.env.DATABASE_URL,
        DATABASE_URL_UNPOOLED:
          ctx.env.DATABASE_URL_UNPOOLED ?? ctx.env.DATABASE_URL,
        NEXT_PUBLIC_SITE_URL: address.previewUrl,
        PREVIEW_HOST: address.previewHost,
        PR_NUMBER: String(ctx.prNumber),
      };
      if (!commandEnv.DATABASE_URL) {
        throw new Error("DATABASE_URL is required for selfhosted preview");
      }

      ensurePreviewNetwork(commandEnv);
      execFileSync(
        "docker",
        [
          "build",
          "--build-arg",
          `NEXT_PUBLIC_SITE_URL=${address.previewUrl}`,
          "-t",
          imageTag,
          "-f",
          "Dockerfile",
          ".",
        ],
        { stdio: "inherit", env: commandEnv },
      );

      const tempDirectory = mkdtempSync(
        path.join(tmpdir(), "next-neon-preview-"),
      );
      try {
        const appEnvironment = {
          ...ctx.env,
          DEPLOY_TARGET: "selfhosted",
          NEXT_PUBLIC_SITE_URL: address.previewUrl,
        };
        const envFile = path.join(tempDirectory, "app.env");
        const overrideFile = path.join(tempDirectory, "compose.override.json");
        writeFileSync(envFile, serializeEnvFile(appEnvironment), {
          mode: 0o600,
        });
        writeFileSync(
          overrideFile,
          `${JSON.stringify({
            services: { app: { env_file: [envFile] } },
          })}\n`,
          { mode: 0o600 },
        );

        const composeArgs = ["compose", "-f", composeFile];
        if (address.isFixed) {
          composeArgs.push(
            "-f",
            path.resolve("docker-compose.fixed-preview.yml"),
          );
        }
        composeArgs.push(
          "-f",
          overrideFile,
          "-p",
          project,
          "up",
          "-d",
          "--remove-orphans",
        );
        execFileSync("docker", composeArgs, {
          stdio: "inherit",
          env: commandEnv,
        });
      } finally {
        rmSync(tempDirectory, { recursive: true, force: true });
      }

      return {
        previewUrl: address.previewUrl,
        deploymentId: project,
      };
    },

    async teardownPreview(ctx: TeardownPreviewContext): Promise<void> {
      const expectedProject = selfhostedComposeProject(ctx.prNumber);
      if (ctx.deploymentId !== expectedProject) {
        throw new Error(
          `Refusing to tear down ${ctx.deploymentId}; expected ${expectedProject}`,
        );
      }
      const teardownEnv: NodeJS.ProcessEnv = {
        ...process.env,
        DATABASE_URL: "postgresql://cleanup.invalid/cleanup",
        DATABASE_URL_UNPOOLED: "postgresql://cleanup.invalid/cleanup",
        NEXT_PUBLIC_SITE_URL: "http://cleanup.invalid",
        PREVIEW_HOST: "cleanup.invalid",
        PR_NUMBER: String(ctx.prNumber),
      };
      execFileSync(
        "docker",
        [
          "compose",
          "-f",
          resolveComposeFile(),
          "-p",
          expectedProject,
          "down",
          "-v",
          "--remove-orphans",
        ],
        { stdio: "inherit", env: teardownEnv },
      );
    },
  };
}
