import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';

/**
 * Vitest configuration for standalone wp-client integration coverage.
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: {
    alias: {
      'fluent-wp-client': fileURLToPath(new URL('./dist/index.js', import.meta.url)),
      'fluent-wp-client/zod': fileURLToPath(new URL('./dist/zod.js', import.meta.url)),
    },
  },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    globalSetup: './tests/setup/global-setup.ts',
    setupFiles: ['./tests/setup/env-loader.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    reporters: ['verbose'],
  },
});
