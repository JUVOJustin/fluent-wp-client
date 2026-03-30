#!/usr/bin/env node
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { WordPressClientConfig } from '../types/client.js';
import { discoverWordPress } from './discover.js';
import {
  buildResourceSchemas,
  generateTypes,
  generateJsonSchemas,
  generateZodSchemas,
} from './codegen.js';

// ---------------------------------------------------------------------------
// Interactive prompts
// ---------------------------------------------------------------------------

/**
 * Prompts the user for a value with an optional default.
 */
async function ask(rl: readline.Interface, question: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` (${defaultValue})` : '';
  const answer = await rl.question(`${question}${suffix}: `);
  return answer.trim() || defaultValue || '';
}

/**
 * Prompts the user to select from numbered options.
 */
async function select(rl: readline.Interface, question: string, options: string[]): Promise<number> {
  console.log(`\n${question}`);
  for (let i = 0; i < options.length; i++) {
    console.log(`  ${i + 1}. ${options[i]}`);
  }
  const answer = await rl.question('Choice: ');
  const idx = parseInt(answer.trim(), 10) - 1;
  if (idx < 0 || idx >= options.length) {
    console.log('Invalid choice, using first option.');
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
async function collectConfig(rl: readline.Interface): Promise<WordPressClientConfig> {
  const baseUrl = await ask(rl, 'WordPress site URL', 'http://localhost:8888');

  const authChoice = await select(rl, 'Authentication method:', [
    'None (public endpoints only)',
    'Application Password (username + app password)',
    'JWT Token',
    'Basic Auth header string',
  ]);

  const config: WordPressClientConfig = { baseUrl };

  switch (authChoice) {
    case 1: {
      const username = await ask(rl, 'Username');
      const password = await ask(rl, 'Application password');
      config.auth = { username, password };
      break;
    }
    case 2: {
      const token = await ask(rl, 'JWT token');
      config.auth = { token };
      break;
    }
    case 3: {
      const header = await ask(rl, 'Authorization header value');
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
type SchemasFormat = 'zod' | 'json-schema' | 'both';

/**
 * Returns the string value of a named flag from the argv array, or undefined.
 */
function flagValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
}

/**
 * Writes content to a file, creating parent directories as needed.
 */
function writeFile(filePath: string, content: string): void {
  const resolvedPath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, content, 'utf-8');
}

// ---------------------------------------------------------------------------
// Main CLI
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(`
fluent-wp-client CLI

Usage:
  fluent-wp-client schemas   Generate resource schemas (recommended)
  fluent-wp-client types     Generate TypeScript type declarations (legacy)

Options for \`schemas\`:
  --format <format>     Output format: zod (default), json-schema, both
  --out <file>          Output file for \`zod\` format (default: wp-schemas.ts)
  --zod-out <file>      Output file for Zod module (default: wp-schemas.ts)
  --json-out <file>     Output file for JSON Schema (default: wp-schemas.json)
  --url <url>           WordPress site URL (skips interactive prompt)

Options for \`types\`:
  --out <file>          Output file (default: wp-types.d.ts)
  --url <url>           WordPress site URL (skips interactive prompt)

Examples:
  npx fluent-wp-client schemas --url https://example.com
  npx fluent-wp-client schemas --format json-schema --url https://example.com
  npx fluent-wp-client schemas --format both --url https://example.com
  npx fluent-wp-client schemas --format both --json-out schemas.json --zod-out schemas.ts
  npx fluent-wp-client types --url https://example.com
`);
    process.exit(0);
  }

  if (command !== 'types' && command !== 'schemas') {
    console.error(`Unknown command: ${command}`);
    console.error('Run "fluent-wp-client --help" for usage.');
    process.exit(1);
  }

  // Resolve WordPress connection config.
  const presetUrl = flagValue(args, '--url');
  let config: WordPressClientConfig;

  if (presetUrl) {
    config = { baseUrl: presetUrl };
  } else {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    try {
      config = await collectConfig(rl);
    } finally {
      rl.close();
    }
  }

  console.log(`\nConnecting to ${config.baseUrl}...`);

  let discovery;
  try {
    discovery = await discoverWordPress(config);
  } catch (err) {
    console.error('Failed to connect to WordPress:', (err as Error).message);
    process.exit(1);
  }

  console.log(`Site: ${discovery.siteName}`);
  console.log(`Discovered ${discovery.resources.length} resources`);

  // --- Legacy `types` command ---
  if (command === 'types') {
    const resourcesWithSchema = discovery.resources.filter((r) => r.schema?.properties);

    if (resourcesWithSchema.length === 0) {
      console.log('No resources with REST schemas found. Nothing to generate.');
      process.exit(0);
    }

    const outFile = flagValue(args, '--out') ?? 'wp-types.d.ts';
    console.log(`Generating TypeScript types for ${resourcesWithSchema.length} resources...`);

    writeFile(outFile, generateTypes(resourcesWithSchema, discovery.siteName, discovery.siteUrl));
    console.log(`Written to ${path.resolve(outFile)}`);
    return;
  }

  // --- `schemas` command ---
  const resourceSchemas = buildResourceSchemas(discovery.resources);

  if (resourceSchemas.length === 0) {
    console.log('No resources with REST schemas found. Nothing to generate.');
    process.exit(0);
  }

  const format = (flagValue(args, '--format') ?? 'zod') as SchemasFormat;

  if (format !== 'zod' && format !== 'json-schema' && format !== 'both') {
    console.error(`Unknown --format value: "${format}". Accepted values: zod, json-schema, both.`);
    process.exit(1);
  }

  console.log(`Generating ${format} schemas for ${resourceSchemas.length} resources...`);

  if (format === 'zod' || format === 'both') {
    // --zod-out takes precedence; fall back to --out for backward compatibility.
    const zodOut = flagValue(args, '--zod-out') ?? flagValue(args, '--out') ?? 'wp-schemas.ts';
    writeFile(zodOut, generateZodSchemas(resourceSchemas, discovery.siteName, discovery.siteUrl));
    console.log(`Zod schemas written to ${path.resolve(zodOut)}`);
  }

  if (format === 'json-schema' || format === 'both') {
    const jsonOut = flagValue(args, '--json-out') ?? 'wp-schemas.json';
    writeFile(jsonOut, generateJsonSchemas(resourceSchemas, discovery.siteName, discovery.siteUrl));
    console.log(`JSON Schema written to ${path.resolve(jsonOut)}`);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
