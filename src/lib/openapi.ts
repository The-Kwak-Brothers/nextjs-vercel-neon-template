import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { createItemBodySchema, selectItemSchema } from "@/lib/db/contracts";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const HealthSchema = z
  .object({
    ok: z.boolean(),
    deployTarget: z.string(),
    timestamp: z.string(),
  })
  .openapi("Health");

const ItemsListSchema = z
  .object({
    items: z.array(selectItemSchema),
  })
  .openapi("ItemsList");

const ItemResponseSchema = z
  .object({
    item: selectItemSchema,
  })
  .openapi("ItemResponse");

registry.registerPath({
  method: "get",
  path: "/api/health",
  summary: "Health check",
  responses: {
    200: {
      description: "Service is healthy",
      content: { "application/json": { schema: HealthSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/items",
  summary: "List items",
  responses: {
    200: {
      description: "Items list",
      content: { "application/json": { schema: ItemsListSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/items",
  summary: "Create item",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: createItemBodySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Created",
      content: { "application/json": { schema: ItemResponseSchema } },
    },
    400: { description: "Validation error" },
  },
});

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "Next Neon CI Template API",
      version: "0.1.0",
      description:
        "Minimal demo API proving DEPLOY_TARGET cloud|selfhosted pipeline.",
    },
    servers: [{ url: "/" }],
  });
}
