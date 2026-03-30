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
  it('generates CPT-aware types and schemas including custom meta and ACF fields', () => {
    const outputDir = createTempDir();
    const typesPath = path.join(outputDir, 'wp-types.d.ts');
    const schemasPath = path.join(outputDir, 'wp-schemas.ts');

    const typesRun = runCli(['types', '--url', getBaseUrl(), '--out', typesPath]);
    const schemasRun = runCli(['schemas', '--url', getBaseUrl(), '--out', schemasPath]);

    const generatedTypes = fs.readFileSync(typesPath, 'utf-8');
    const generatedSchemas = fs.readFileSync(schemasPath, 'utf-8');

    expect(typesRun.stdout).toContain('Generating TypeScript types');
    expect(typesRun.stdout).toContain('Written to');
    expect(schemasRun.stdout).toContain('Generating zod schemas');
    expect(schemasRun.stdout).toContain('Zod schemas written to');

    expect(generatedTypes).toContain('export interface WPBook');
    expect(generatedTypes).toContain('test_book_isbn');
    expect(generatedTypes).toContain('acf_subtitle');

    expect(generatedSchemas).toContain('export const wpBookSchema = z.fromJSONSchema');
    expect(generatedSchemas).toContain('"test_book_isbn"');
    expect(generatedSchemas).toContain('"acf_subtitle"');
  });

  it('creates missing parent directories for the output path', () => {
    const outputDir = createTempDir();
    const nestedTypesPath = path.join(outputDir, 'generated', 'types', 'wp-types.d.ts');

    const typesRun = runCli(['types', '--url', getBaseUrl(), '--out', nestedTypesPath]);

    expect(typesRun.stdout).toContain('Written to');
    expect(fs.existsSync(nestedTypesPath)).toBe(true);
    expect(fs.readFileSync(nestedTypesPath, 'utf-8')).toContain('export interface WPBook');
  });
});
