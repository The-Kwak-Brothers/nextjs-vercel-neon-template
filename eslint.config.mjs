import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "tools/schemathesis/.venv/**",
    "next-env.d.ts",
    "openapi.json",
  ]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  nextPlugin.configs["core-web-vitals"],
  reactHooks.configs.flat.recommended,
);
