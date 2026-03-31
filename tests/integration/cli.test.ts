import { afterAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getBaseUrl } from '../helpers/wp-client';

/**
 * Tracks temporary output directories created by the CLI integration suite.
 */
const tempDirs: string[] = [];

/**
 * Builds one isolated output path for generated CLI artifacts.
 */
function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluent-wp-client-cli-'));
  tempDirs.push(dir);
  return dir;
}

/**
 * Executes the built CLI and fails fast when generation exits unsuccessfully.
 */
function runCli(args: string[]): { stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [path.resolve('dist/cli/index.js'), ...args], {
    cwd: path.resolve('.'),
    encoding: 'utf-8',
  });

  if (result.status !== 0) {
    throw new Error([
      `CLI exited with status ${result.status ?? 'unknown'}.`,
      result.stdout,
      result.stderr,
    ].filter(Boolean).join('\n'));
  }

  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

afterAll(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * End-to-end coverage for CLI discovery and code generation against wp-env.
 */
describe('CLI: code generation', () => {
  it('generates CPT-aware Zod schemas including custom meta and ACF fields', () => {
    const outputDir = createTempDir();
    const schemasPath = path.join(outputDir, 'wp-schemas.ts');

    const schemasRun = runCli(['schemas', '--url', getBaseUrl(), '--out', schemasPath]);

    const generatedSchemas = fs.readFileSync(schemasPath, 'utf-8');

    expect(schemasRun.stdout).toContain('Generating zod schemas');
    expect(schemasRun.stdout).toContain('Zod schemas written to');

    expect(generatedSchemas).toContain('export const wpBookSchema = z.fromJSONSchema');
    expect(generatedSchemas).toContain('"test_book_isbn"');
    expect(generatedSchemas).toContain('"acf_subtitle"');
  });

  it('creates missing parent directories for the output path', () => {
    const outputDir = createTempDir();
    const nestedSchemasPath = path.join(outputDir, 'generated', 'schemas', 'wp-schemas.ts');

    const schemasRun = runCli(['schemas', '--url', getBaseUrl(), '--out', nestedSchemasPath]);

    expect(schemasRun.stdout).toContain('Zod schemas written to');
    expect(fs.existsSync(nestedSchemasPath)).toBe(true);
    expect(fs.readFileSync(nestedSchemasPath, 'utf-8')).toContain('export const wpBookSchema');
  });

  it('supports authenticated discovery flags and resource filters', () => {
    const password = process.env.WP_APP_PASSWORD;

    if (!password) {
      throw new Error('WP_APP_PASSWORD not set — did global-setup run?');
    }

    const outputDir = createTempDir();
    const schemasPath = path.join(outputDir, 'filtered-schemas.ts');

    runCli([
      'schemas',
      '--url', getBaseUrl(),
      '--username', 'admin',
      '--password', password,
      '--include', 'books,pages',
      '--exclude', 'pages',
      '--out', schemasPath,
    ]);

    const generatedSchemas = fs.readFileSync(schemasPath, 'utf-8');

    expect(generatedSchemas).toContain('export const wpBookSchema');
    expect(generatedSchemas).not.toContain('export const wpPageSchema');
    expect(generatedSchemas).not.toContain('export const wpPostSchema');
  });
});
