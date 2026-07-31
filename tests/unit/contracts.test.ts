import { describe, expect, it } from "vitest";
import { createItemBodySchema } from "@/lib/db/contracts";

describe("createItemBodySchema", () => {
  it("accepts a valid name", () => {
    const result = createItemBodySchema.safeParse({ name: "widget" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createItemBodySchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = createItemBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
