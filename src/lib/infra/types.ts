/**
 * Provider-agnostic infra contract.
 * Cloud: Neon branches + Vercel --prebuilt.
 * Selfhosted: Postgres CREATE DATABASE + compose project.
 *
 * Env-var contract emitted to ci-outputs.env:
 *   DATABASE_URL, DATABASE_URL_UNPOOLED (optional),
 *   EPHEMERAL_DB_ID, PREVIEW_URL, DEPLOYMENT_ID, DEPLOY_TARGET
 */

export type DeployTarget = "cloud" | "selfhosted";

export type EphemeralDb = {
  /** Pooled or primary connection string for the app. */
  databaseUrl: string;
  /** Unpooled URL for migrations (Neon). Optional on selfhosted. */
  databaseUrlUnpooled?: string;
  /** Neon branch id OR postgres database name (pr_N). */
  id: string;
};

export type PreviewDeploy = {
  previewUrl: string;
  /** REQUIRED: Vercel deployment id OR compose project name (preview-pr-N). */
  deploymentId: string;
};

export type EphemeralDbContext = {
  prNumber: number;
  sha: string;
};

export type DeployPreviewContext = {
  sha: string;
  prNumber: number;
  env: Record<string, string>;
};

export type DestroyDbContext = {
  prNumber: number;
  id: string;
};

export type TeardownPreviewContext = {
  prNumber: number;
  deploymentId: string;
};

export interface InfraAdapter {
  createEphemeralDb(ctx: EphemeralDbContext): Promise<EphemeralDb>;
  destroyEphemeralDb(ctx: DestroyDbContext): Promise<void>;
  deployPreview(ctx: DeployPreviewContext): Promise<PreviewDeploy>;
  teardownPreview(ctx: TeardownPreviewContext): Promise<void>;
}
