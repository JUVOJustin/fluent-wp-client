import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Temp file used to pass env vars from globalSetup to test workers */
const ENV_FILE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../.test-env.json",
);
/** `.wp-env.json` pins the Playground port so setup can address the site directly. */
const WP_ENV_CONFIG = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../.wp-env.json",
);
const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_PASSWORD = "password";
const DEFAULT_PORT = 8896;

/**
 * Resolves the base URL of the running wp-env Playground environment.
 *
 * The Playground runtime serves over a plain PHP built-in server, not a Docker
 * container, so `wp-env status --json` does not report a usable `ports.development`
 * value. Instead the port is pinned in `.wp-env.json` (`"port"`), which we read
 * here. An explicit `WP_BASE_URL` always wins (CI / custom runners).
 */
function resolveBaseUrl(): string {
  if (process.env.WP_BASE_URL) {
    return process.env.WP_BASE_URL;
  }

  try {
    const parsed = JSON.parse(readFileSync(WP_ENV_CONFIG, "utf-8")) as {
      port?: number;
    };
    if (typeof parsed.port === "number") {
      return `http://localhost:${parsed.port}`;
    }
  } catch {
    // Fall through to the default when the config cannot be read.
  }

  return `http://localhost:${DEFAULT_PORT}`;
}

/**
 * Fetches the admin Application Password from the local bootstrap mu-plugin
 * (`tests/wp-env/mu-plugins/enable-app-passwords.php`). wp-cli is unavailable in
 * the Playground runtime, so the credential is minted in PHP and read back over
 * HTTP. A fresh password is provisioned on every call (hashes are one-way).
 */
async function fetchAppPassword(baseUrl: string): Promise<string> {
  const response = await fetch(
    `${baseUrl}/wp-json/wp-client-test/v1/app-password`,
  );

  const data: unknown = await response.json().catch(() => null);

  if (
    !response.ok ||
    typeof data !== "object" ||
    data === null ||
    typeof (data as { password?: unknown }).password !== "string"
  ) {
    throw new Error(
      `Failed to fetch Application Password from bootstrap route (status ${response.status}). ` +
        "Ensure the enable-app-passwords mu-plugin is mapped and WordPress is reachable.",
    );
  }

  return (data as { password: string }).password;
}

/**
 * Requests one JWT token from the local WordPress JWT auth endpoint.
 */
async function createJwtToken(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/wp-json/jwt-auth/v1/token`, {
    body: JSON.stringify({
      password: DEFAULT_ADMIN_PASSWORD,
      username: DEFAULT_ADMIN_USERNAME,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const data: unknown = await response.json().catch(() => null);

  if (
    !response.ok ||
    typeof data !== "object" ||
    data === null ||
    typeof (data as { token?: unknown }).token !== "string"
  ) {
    throw new Error("Failed to create JWT token during global setup.");
  }

  return (data as { token: string }).token;
}

/**
 * Extracts one `name=value` pair from a raw Set-Cookie header value.
 */
function getCookiePair(setCookieValue: string): string {
  return setCookieValue.split(";")[0].trim();
}

/**
 * Reads all Set-Cookie headers from one fetch response.
 */
function getSetCookieHeaders(response: Response): string[] {
  const headersWithSetCookie = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headersWithSetCookie.getSetCookie === "function") {
    return headersWithSetCookie.getSetCookie();
  }

  const fallback = response.headers.get("set-cookie");

  if (!fallback) {
    return [];
  }

  return [fallback];
}

/**
 * Creates one logged-in cookie + REST nonce pair through a real wp-admin login flow.
 */
async function createCookieAuthSession(
  baseUrl: string,
): Promise<{ cookieHeader: string; restNonce: string }> {
  const preflightResponse = await fetch(`${baseUrl}/wp-login.php`, {
    redirect: "manual",
  });
  const preflightCookies = getSetCookieHeaders(preflightResponse)
    .map(getCookiePair)
    .filter((pair) => pair.length > 0)
    .join("; ");

  const loginForm = new URLSearchParams({
    log: DEFAULT_ADMIN_USERNAME,
    pwd: DEFAULT_ADMIN_PASSWORD,
    redirect_to: `${baseUrl}/wp-admin/`,
    testcookie: "1",
    "wp-submit": "Log In",
  });

  const loginResponse = await fetch(`${baseUrl}/wp-login.php`, {
    body: loginForm.toString(),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(preflightCookies ? { Cookie: preflightCookies } : {}),
    },
    method: "POST",
    redirect: "manual",
  });

  const setCookies = [
    ...getSetCookieHeaders(loginResponse),
    ...getSetCookieHeaders(preflightResponse),
  ];

  if (setCookies.length === 0) {
    throw new Error(
      "Failed to create cookie auth session during global setup (missing Set-Cookie headers).",
    );
  }

  const cookieHeader = setCookies
    .map(getCookiePair)
    .filter((pair) => pair.length > 0)
    .join("; ");

  if (!cookieHeader) {
    throw new Error(
      "Failed to create cookie auth session during global setup (empty cookie header).",
    );
  }

  const adminResponse = await fetch(`${baseUrl}/wp-admin/`, {
    headers: {
      Cookie: cookieHeader,
    },
  });

  const adminHtml = await adminResponse.text();
  const nonceMatch = adminHtml.match(/"nonce":"([^"]+)"/);
  const restNonce = nonceMatch?.[1];

  if (!restNonce) {
    throw new Error(
      "Failed to extract wpApiSettings nonce during global setup.",
    );
  }

  return {
    cookieHeader,
    restNonce,
  };
}

/**
 * Returns true once the environment is fully ready for the integration suite.
 *
 * Under the Playground runtime, plugins activated by the blueprint are NOT loaded
 * into the very first HTTP request(s) after boot — ACF and the JWT plugin come up
 * a request or two later, and content seeding (hooked to `acf/init`) completes only
 * once ACF is loaded. So "core REST responds" is not a sufficient readiness signal:
 * we must confirm the full stack the tests depend on is live before collecting
 * credentials. Each probe below also drives the extra requests that warm the stack.
 */
async function isEnvironmentReady(baseUrl: string): Promise<boolean> {
  // 1. Seeding finished AND ACF values are populated: a known seeded post must
  //    exist with its ACF subtitle set (proves ACF loaded and the seed ran).
  const seededRes = await fetch(
    `${baseUrl}/wp-json/wp/v2/posts?slug=test-post-001`,
  );
  if (!seededRes.ok) return false;
  const seeded = (await seededRes.json()) as Array<{
    acf?: { acf_subtitle?: string };
  }>;
  if (!seeded[0]?.acf?.acf_subtitle) return false;

  // 2. The JWT plugin route is registered (returns a non-404 for a real login).
  const jwtRes = await fetch(`${baseUrl}/wp-json/jwt-auth/v1/token`, {
    body: JSON.stringify({
      password: DEFAULT_ADMIN_PASSWORD,
      username: DEFAULT_ADMIN_USERNAME,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (jwtRes.status === 404) return false;
  const jwt = (await jwtRes.json()) as { token?: unknown };
  if (typeof jwt.token !== "string") return false;

  // 3. The app-password bootstrap route is live.
  const appRes = await fetch(
    `${baseUrl}/wp-json/wp-client-test/v1/app-password`,
  );
  return appRes.ok;
}

/**
 * Waits for the full WordPress stack (core REST, ACF + seeded content, JWT plugin,
 * bootstrap route) to come up before running tests. The Playground runtime boots a
 * fresh PHP server and loads plugins lazily, so a generous attempt budget keeps the
 * suite robust on cold starts.
 */
async function waitForApi(baseUrl: string, maxAttempts = 180): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      if (await isEnvironmentReady(baseUrl)) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`WordPress API at ${baseUrl} did not become ready`);
}

/**
 * Global setup: called once before all integration tests.
 *
 * Content seeding, permalinks, ACF + JWT plugin activation, and app-password
 * provisioning are all handled inside the wp-env Playground environment (the
 * `.wp-env.json` `plugins` array plus the mapped mu-plugins). This only needs to
 * resolve the base URL, wait for the API, then collect the app-password, JWT, and
 * cookie+nonce credentials the integration tests consume — all over HTTP, with no
 * wp-cli / Docker dependency.
 */
export async function setup(): Promise<void> {
  const baseUrl = resolveBaseUrl();

  console.log(`[global-setup] Using WordPress base URL: ${baseUrl}`);
  console.log("[global-setup] Waiting for WordPress API...");
  await waitForApi(baseUrl);

  console.log("[global-setup] Fetching application password...");
  const appPassword = await fetchAppPassword(baseUrl);

  console.log("[global-setup] Creating JWT token...");
  const jwtToken = await createJwtToken(baseUrl);

  console.log("[global-setup] Creating cookie auth session...");
  const cookieAuthSession = await createCookieAuthSession(baseUrl);

  // Persist env vars to a file so test workers can read them (globalSetup runs
  // in a separate process — process.env changes are not inherited by workers)
  const envData = {
    WP_APP_PASSWORD: appPassword,
    WP_BASE_URL: baseUrl,
    WP_COOKIE_AUTH_HEADER: cookieAuthSession.cookieHeader,
    WP_JWT_TOKEN: jwtToken,
    WP_REST_NONCE: cookieAuthSession.restNonce,
  };
  writeFileSync(ENV_FILE, JSON.stringify(envData), "utf-8");

  // Also set in this process for convenience
  Object.assign(process.env, envData);

  console.log("[global-setup] Done.");
}

/**
 * Global teardown: called once after all integration tests.
 *
 * The Application Password is provisioned per run inside WordPress, so there is no
 * wp-cli cleanup to perform here — we only remove the temp env file.
 */
export async function teardown(): Promise<void> {
  console.log("[global-teardown] Cleaning up...");

  try {
    unlinkSync(ENV_FILE);
  } catch {
    // File may already be gone
  }

  console.log("[global-teardown] Done.");
}
