import {
  type WordPressBlocksClient,
  withBlocks,
} from "../../dist/blocks-entry.js";
import { WordPressClient } from "../../dist/index.js";

/**
 * Resolves the WP base URL from the integration test environment.
 */
export function getBaseUrl(): string {
  return process.env.WP_BASE_URL || "http://localhost:8888";
}

/**
 * Creates an unauthenticated client for public endpoint tests.
 */
export function createPublicClient(): WordPressClient {
  return new WordPressClient({ baseUrl: getBaseUrl() });
}

/**
 * Creates an unauthenticated block-aware client wrapper for public endpoint tests.
 */
export function createPublicBlocksClient(): WordPressBlocksClient {
  return withBlocks(createPublicClient());
}

/**
 * Creates a basic-authenticated client for privileged endpoint tests.
 */
export function createAuthClient(): WordPressClient {
  const password = process.env.WP_APP_PASSWORD;

  if (!password) {
    throw new Error("WP_APP_PASSWORD not set — did global-setup run?");
  }

  return new WordPressClient({
    auth: { password, username: "admin" },
    baseUrl: getBaseUrl(),
  });
}

/**
 * Creates a block-aware authenticated client for privileged block endpoint tests.
 */
export function createAuthBlocksClient(): WordPressBlocksClient {
  return withBlocks(createAuthClient());
}

/**
 * Creates a JWT-authenticated client for token-based endpoint tests.
 */
export function createJwtAuthClient(): WordPressClient {
  const token = process.env.WP_JWT_TOKEN;

  if (!token) {
    throw new Error("WP_JWT_TOKEN not set — did global-setup run?");
  }

  return new WordPressClient({
    auth: { token },
    baseUrl: getBaseUrl(),
  });
}

/**
 * Creates a cookie+nonce-authenticated client for browser-style request tests.
 */
export function createCookieAuthClient(): WordPressClient {
  const nonce = process.env.WP_REST_NONCE;
  const cookieHeader = process.env.WP_COOKIE_AUTH_HEADER;

  if (!nonce) {
    throw new Error("WP_REST_NONCE not set — did global-setup run?");
  }

  if (!cookieHeader) {
    throw new Error("WP_COOKIE_AUTH_HEADER not set — did global-setup run?");
  }

  return new WordPressClient({
    auth: { credentials: "include", nonce },
    baseUrl: getBaseUrl(),
    cookies: cookieHeader,
    credentials: "include",
  });
}
