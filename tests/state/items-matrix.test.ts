import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db/client";
import { GET, POST } from "@/app/api/items/route";

vi.mock("@/lib/db/client", () => ({ getDb: vi.fn() }));

const mockedGetDb = vi.mocked(getDb);
const seededItem = {
  id: 1,
  name: "seed item",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

function mockListResult(rows: (typeof seededItem)[]) {
  mockedGetDb.mockReturnValue({
    select: () => ({
      from: () => ({
        orderBy: () => Promise.resolve(rows),
      }),
    }),
  } as never);
}

function mockInsertResult(row: typeof seededItem) {
  mockedGetDb.mockReturnValue({
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([row]),
      }),
    }),
  } as never);
}

describe("items route state matrix", () => {
  beforeEach(() => {
    mockedGetDb.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["empty", []],
    ["seeded", [seededItem]],
  ])("returns the %s database state", async (_state, rows) => {
    mockListResult(rows);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  });

  it("returns a generic 500 when the database is unavailable", async () => {
    mockedGetDb.mockImplementation(() => {
      throw new Error("postgresql://user:secret@database.internal/app");
    });

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });
    expect(console.error).toHaveBeenCalled();
  });

  it("rejects malformed JSON without opening a database connection", async () => {
    const request = new Request("http://localhost/api/items", {
      method: "POST",
      body: "{",
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON" });
    expect(mockedGetDb).not.toHaveBeenCalled();
  });

  it("rejects an invalid payload without opening a database connection", async () => {
    const request = new Request("http://localhost/api/items", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Validation failed" });
    expect(mockedGetDb).not.toHaveBeenCalled();
  });

  it("creates an item from a valid payload", async () => {
    mockInsertResult(seededItem);
    const request = new Request("http://localhost/api/items", {
      method: "POST",
      body: JSON.stringify({ name: seededItem.name }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      item: {
        ...seededItem,
        createdAt: seededItem.createdAt.toISOString(),
      },
    });
  });

  it("does not expose database errors from item creation", async () => {
    mockedGetDb.mockImplementation(() => {
      throw new Error("password authentication failed for secret-user");
    });
    const request = new Request("http://localhost/api/items", {
      method: "POST",
      body: JSON.stringify({ name: "safe item" }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });
    expect(console.error).toHaveBeenCalled();
  });
});
