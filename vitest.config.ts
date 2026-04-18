import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for standalone wp-client integration coverage.
 */
export default defineConfig({
  resolve: {
    alias: {
      "fluent-wp-client": fileURLToPath(
        new URL("./dist/index.js", import.meta.url),
      ),
      "fluent-wp-client/ai-sdk": fileURLToPath(
        new URL("./dist/ai-sdk/index.js", import.meta.url),
      ),
      "fluent-wp-client/blocks": fileURLToPath(
        new URL("./dist/blocks-entry.js", import.meta.url),
      ),
      "fluent-wp-client/blocks/zod": fileURLToPath(
        new URL("./dist/blocks-zod.js", import.meta.url),
      ),
      "fluent-wp-client/zod": fileURLToPath(
        new URL("./dist/zod.js", import.meta.url),
      ),
    },
  },
  root: fileURLToPath(new URL(".", import.meta.url)),
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
