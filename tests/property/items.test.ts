import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { createItemBodySchema } from "@/lib/db/contracts";

describe("POST /api/items contract (property)", () => {
  it("valid names always parse; garbage never looks valid", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 200 }), (name) => {
        const result = createItemBodySchema.safeParse({ name });
        expect(result.success).toBe(true);
      }),
      { numRuns: 50 },
    );

    fc.assert(
      fc.property(fc.anything(), (value) => {
        const result = createItemBodySchema.safeParse(value);
        // Non-objects / missing name → failure; we never treat random junk as success unless it matches shape.
        if (
          value &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          "name" in value &&
          typeof (value as { name: unknown }).name === "string"
        ) {
          const name = (value as { name: string }).name;
          expect(result.success).toBe(name.length >= 1 && name.length <= 200);
        } else {
          expect(result.success).toBe(false);
        }
      }),
      { numRuns: 50 },
    );
  });
});
