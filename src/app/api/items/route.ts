import { NextResponse } from "next/server";
import { createItemBodySchema } from "@/lib/db/contracts";
import { getDb } from "@/lib/db/client";
import { items } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const rows = await db.select().from(items).orderBy(items.id);
    return NextResponse.json({ items: rows });
  } catch (err) {
    console.error("GET /api/items failed", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createItemBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const db = getDb();
    const [row] = await db
      .insert(items)
      .values({ name: parsed.data.name })
      .returning();
    return NextResponse.json({ item: row }, { status: 201 });
  } catch (err) {
    console.error("POST /api/items failed", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
