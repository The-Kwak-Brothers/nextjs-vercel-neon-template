import { describe, expect, it } from "vitest";
import { generateOpenApiDocument } from "@/lib/openapi";

describe("OpenAPI document", () => {
  it("includes health and items paths", () => {
    const doc = generateOpenApiDocument();
    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.paths?.["/api/health"]).toBeTruthy();
    expect(doc.paths?.["/api/items"]).toBeTruthy();
    expect(doc.paths?.["/api/items"]?.post?.requestBody).toMatchObject({
      required: true,
    });
  });
});
