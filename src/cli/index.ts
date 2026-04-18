#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import { stdin, stdout } from "node:process";
import * as readline from "node:readline/promises";
import type { WordPressClientConfig } from "../types/client.js";
import {
  buildResourceSchemas,
  generateJsonSchemas,
  generateZodSchemas,
} from "./codegen.js";
import type { DiscoveryResourceFilters } from "./discover.js";
import { discoverWordPress } from "./discover.js";

// ---------------------------------------------------------------------------
// Interactive prompts
// ---------------------------------------------------------------------------

/**
 * Prompts the user for a value with an optional default.
 */
async function ask(
  rl: readline.Interface,
  question: string,
  defaultValue?: string,
): Promise<string> {
  const suffix = defaultValue ? ` (${defaultValue})` : "";
  const answer = await rl.question(`${question}${suffix}: `);
  return answer.trim() || defaultValue || "";
}

/**
 * Prompts the user to select from numbered options.
 */
async function select(
  rl: readline.Interface,
  question: string,
  options: string[],
): Promise<number> {
  console.log(`\n${question}`);
  for (let i = 0; i < options.length; i++) {
    console.log(`  ${i + 1}. ${options[i]}`);
  }
  const answer = await rl.question("Choice: ");
  const idx = parseInt(answer.trim(), 10) - 1;
  if (idx < 0 || idx >= options.length) {
    console.log("Invalid choice, using first option.");
    return 0;
  }
  return idx;
}

// ---------------------------------------------------------------------------
// Auth configuration
// ---------------------------------------------------------------------------

/**
 * Collects WordPress connection configuration interactively.
 */
async function collectConfig(
  rl: readline.Interface,
): Promise<WordPressClientConfig> {
  const baseUrl = await ask(rl, "WordPress site URL", "http://localhost:8888");

  const authChoice = await select(rl, "Authentication method:", [
    "None (public endpoints only)",
    "Application Password (username + app password)",
    "JWT Token",
    "Basic Auth header string",
  ]);

  const config: WordPressClientConfig = { baseUrl };

  switch (authChoice) {
    case 1: {
      const username = await ask(rl, "Username");
      const password = await ask(rl, "Application password");
      config.auth = { password, username };
      break;
    }
    case 2: {
      const token = await ask(rl, "JWT token");
      config.auth = { token };
      break;
    }
    case 3: {
      const header = await ask(rl, "Authorization header value");
      config.authHeader = header;
      break;
    }
  }

  return config;
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

/**
 * Output format for the `schemas` command.
 *
 * - `zod`         — TypeScript module with JSON Schema literals, Zod schemas,
 *                   and inferred TS types. Best for TypeScript/JavaScript projects.
 * - `json-schema` — JSON file with normalized resource schemas keyed by REST
 *                   base. Portable — works for any language or tooling.
 * - `both`        — Emits both the JSON Schema file and the Zod TypeScript module.
 */
type SchemasFormat = "zod" | "json-schema" | "both";

/**
 * Returns the string value of a named flag from the argv array, or undefined.
 */
function flagValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
}

/**
 * Parses one comma-separated flag value into a normalized string list.
 */
function listFlagValues(args: string[], flag: string): string[] {
  const value = flagValue(args, flag);

  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Builds CLI auth configuration from non-interactive flags.
 */
function cliConfigOverrides(args: string[]): Partial<WordPressClientConfig> {
  const username = flagValue(args, "--username");
  const password = flagValue(args, "--password");
  const token = flagValue(args, "--token");
  const authHeader = flagValue(args, "--auth-header");
  const methodsUsed = [
    username || password ? "application-password" : undefined,
    token ? "jwt" : undefined,
    authHeader ? "auth-header" : undefined,
  ].filter(Boolean);

  if (methodsUsed.length > 1) {
    throw new Error(
      "Choose only one auth mode: --username/--password, --token, or --auth-header.",
    );
  }

  if ((username && !password) || (!username && password)) {
    throw new Error("Provide both --username and --password together.");
  }

  if (username && password) {
    return { auth: { password, username } };
  }

  if (token) {
    return { auth: { token } };
  }

  if (authHeader) {
    return { authHeader };
  }

  return {};
}

/**
 * Collects resource include/exclude filters from CLI flags.
 */
function cliDiscoveryFilters(args: string[]): DiscoveryResourceFilters {
  const include = listFlagValues(args, "--include");
  const exclude = listFlagValues(args, "--exclude");

  return {
    exclude: exclude.length > 0 ? exclude : undefined,
    include: include.length > 0 ? include : undefined,
  };
}

/**
 * Applies non-interactive CLI overrides without leaving conflicting auth state behind.
 */
function mergeCliConfig(
  baseConfig: WordPressClientConfig,
  overrideConfig: Partial<WordPressClientConfig>,
): WordPressClientConfig {
  const nextConfig: WordPressClientConfig = { ...baseConfig };

  if (overrideConfig.auth || overrideConfig.authHeader) {
    delete nextConfig.auth;
    delete nextConfig.authHeader;
  }

  return {
    ...nextConfig,
    ...overrideConfig,
  };
}

/**
 * Writes content to a file, creating parent directories as needed.
 */
function writeFile(filePath: string, content: string): void {
  const resolvedPath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, content, "utf-8");
}

// ---------------------------------------------------------------------------
// Main CLI
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    console.log(`
fluent-wp-client CLI

Usage:
  fluent-wp-client schemas   Generate resource schemas

Options:
  --format <format>     Output format: zod (default), json-schema, both
  --out <file>          Output file for \`zod\` format (default: wp-schemas.ts)
  --zod-out <file>      Output file for Zod module (default: wp-schemas.ts)
  --json-out <file>     Output file for JSON Schema (default: wp-schemas.json)
  --url <url>           WordPress site URL (skips interactive prompt)
  --username <name>     Application-password username for authenticated discovery
  --password <value>    Application password for authenticated discovery
  --token <value>       JWT bearer token for authenticated discovery
  --auth-header <value> Prebuilt Authorization header value
  --include <list>      Comma-separated resource slugs/rest bases to include
  --exclude <list>      Comma-separated resource slugs/rest bases to exclude

Examples:
  npx fluent-wp-client schemas --url https://example.com
  npx fluent-wp-client schemas --url https://example.com --username admin --password "xxxx xxxx xxxx xxxx"
  npx fluent-wp-client schemas --url https://example.com --include posts,books
  npx fluent-wp-client schemas --format json-schema --url https://example.com
  npx fluent-wp-client schemas --format both --url https://example.com
  npx fluent-wp-client schemas --format both --json-out schemas.json --zod-out schemas.ts
`);
    process.exit(0);
  }

  if (command !== "schemas") {
    console.error(`Unknown command: ${command}`);
    console.error('Run "fluent-wp-client --help" for usage.');
    process.exit(1);
  }

  // Resolve WordPress connection config.
  let overrideConfig: Partial<WordPressClientConfig>;
  try {
    overrideConfig = cliConfigOverrides(args);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  const presetUrl = flagValue(args, "--url");
  const resourceFilters = cliDiscoveryFilters(args);
  let config: WordPressClientConfig;

  if (presetUrl) {
    config = mergeCliConfig({ baseUrl: presetUrl }, overrideConfig);
  } else {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    try {
      config = mergeCliConfig(await collectConfig(rl), overrideConfig);
    } finally {
      rl.close();
    }
  }

  console.log(`\nConnecting to ${config.baseUrl}...`);

  let discovery;
  try {
    discovery = await discoverWordPress(config, resourceFilters);
  } catch (err) {
    console.error("Failed to connect to WordPress:", (err as Error).message);
    process.exit(1);
  }

  console.log(`Site: ${discovery.siteName}`);
  console.log(`Discovered ${discovery.resources.length} resources`);

  const resourceSchemas = buildResourceSchemas(discovery.resources);

  if (resourceSchemas.length === 0) {
    console.log("No resources with REST schemas found. Nothing to generate.");
    process.exit(0);
  }

  const format = (flagValue(args, "--format") ?? "zod") as SchemasFormat;

  if (format !== "zod" && format !== "json-schema" && format !== "both") {
    console.error(
      `Unknown --format value: "${format}". Accepted values: zod, json-schema, both.`,
    );
    process.exit(1);
  }

  console.log(
    `Generating ${format} schemas for ${resourceSchemas.length} resources...`,
  );

  if (format === "zod" || format === "both") {
    // --zod-out takes precedence; fall back to --out for backward compatibility.
    const zodOut =
      flagValue(args, "--zod-out") ??
      flagValue(args, "--out") ??
      "wp-schemas.ts";
    writeFile(
      zodOut,
      generateZodSchemas(
        resourceSchemas,
        discovery.siteName,
        discovery.siteUrl,
      ),
    );
    console.log(`Zod schemas written to ${path.resolve(zodOut)}`);
  }

  if (format === "json-schema" || format === "both") {
    const jsonOut = flagValue(args, "--json-out") ?? "wp-schemas.json";
    writeFile(
      jsonOut,
      generateJsonSchemas(
        resourceSchemas,
        discovery.siteName,
        discovery.siteUrl,
      ),
    );
    console.log(`JSON Schema written to ${path.resolve(jsonOut)}`);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
