import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Vitest configuration for standalone wp-client integration coverage.
 */
export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^fluent-wp-client\/ai-sdk$/,
        replacement: resolve(__dirname, "./dist/ai-sdk/index.js"),
      },
      {
        find: /^fluent-wp-client\/blocks\/zod$/,
        replacement: resolve(__dirname, "./dist/blocks-zod.js"),
      },
      {
        find: /^fluent-wp-client\/blocks$/,
        replacement: resolve(__dirname, "./dist/blocks-entry.js"),
      },
      {
        find: /^fluent-wp-client\/zod$/,
        replacement: resolve(__dirname, "./dist/zod.js"),
      },
      {
        find: /^fluent-wp-client$/,
        replacement: resolve(__dirname, "./dist/index.js"),
      },
    ],
  },
  root: __dirname,
  test: {
    environment: "node",
    fileParallelism: false,
    globalSetup: "./tests/setup/global-setup.ts",
    hookTimeout: 60_000,
    include: ["tests/integration/**/*.test.ts"],
    reporters: ["verbose"],
    setupFiles: ["./tests/setup/env-loader.ts"],
    testTimeout: 30_000,
  },
});
