import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    deployTarget: process.env.DEPLOY_TARGET ?? "unset",
    timestamp: new Date().toISOString(),
  });
}
