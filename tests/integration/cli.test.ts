import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { getBaseUrl } from "../helpers/wp-client";

/**
 * Tracks temporary output directories created by the CLI integration suite.
 */
const tempDirs: string[] = [];

interface CliResult {
  status: number | null;
  stderr: string;
  stdout: string;
}

/**
 * Builds one isolated output path for generated CLI artifacts.
 */
function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluent-wp-client-cli-"));
  tempDirs.push(dir);
  return dir;
}

/**
 * Executes the built CLI and fails fast when generation exits unsuccessfully.
 */
function runCliRaw(args: string[], env?: NodeJS.ProcessEnv): CliResult {
  const result = spawnSync(
    process.execPath,
    [path.resolve("dist/cli/index.js"), ...args],
    {
      cwd: path.resolve("."),
      encoding: "utf-8",
      env: env ? { ...process.env, ...env } : process.env,
    },
  );

  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

/**
 * Executes the built CLI and fails fast when generation exits unsuccessfully.
 */
function runCli(
  args: string[],
  env?: NodeJS.ProcessEnv,
): { stdout: string; stderr: string } {
  const result = runCliRaw(args, env);

  if (result.status !== 0) {
    throw new Error(
      [
        `CLI exited with status ${result.status ?? "unknown"}.`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return {
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

afterAll(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});

/**
 * End-to-end coverage for CLI discovery and code generation against wp-env.
 */
describe("CLI: code generation", () => {
  it("generates CPT-aware Zod schemas including custom meta and ACF fields", () => {
    const outputDir = createTempDir();
    const schemasPath = path.join(outputDir, "wp-schemas.ts");

    const schemasRun = runCli([
      "schemas",
      "--url",
      getBaseUrl(),
      "--out",
      schemasPath,
    ]);

    const generatedSchemas = fs.readFileSync(schemasPath, "utf-8");

    expect(schemasRun.stdout).toContain("Generating schemas");
    expect(schemasRun.stdout).toContain("Zod schemas written to");

    expect(generatedSchemas).toContain(
      "export const wpBookSchema = z.fromJSONSchema",
    );
    expect(generatedSchemas).toContain('"test_book_isbn"');
    expect(generatedSchemas).toContain('"acf_subtitle"');
  });

  it("creates missing parent directories for the output path", () => {
    const outputDir = createTempDir();
    const nestedSchemasPath = path.join(
      outputDir,
      "generated",
      "schemas",
      "wp-schemas.ts",
    );

    const schemasRun = runCli([
      "schemas",
      "--url",
      getBaseUrl(),
      "--out",
      nestedSchemasPath,
    ]);

    expect(schemasRun.stdout).toContain("Zod schemas written to");
    expect(fs.existsSync(nestedSchemasPath)).toBe(true);
    expect(fs.readFileSync(nestedSchemasPath, "utf-8")).toContain(
      "export const wpBookSchema",
    );
  });

  it("supports authenticated discovery flags and resource filters", () => {
    const password = process.env.WP_APP_PASSWORD;

    if (!password) {
      throw new Error("WP_APP_PASSWORD not set — did global-setup run?");
    }

    const outputDir = createTempDir();
    const schemasPath = path.join(outputDir, "filtered-schemas.ts");

    runCli([
      "schemas",
      "--url",
      getBaseUrl(),
      "--username",
      "admin",
      "--password",
      password,
      "--include",
      "books,pages",
      "--exclude",
      "pages",
      "--out",
      schemasPath,
    ]);

    const generatedSchemas = fs.readFileSync(schemasPath, "utf-8");

    expect(generatedSchemas).toContain("export const wpBookSchema");
    expect(generatedSchemas).not.toContain("export const wpPageSchema");
    expect(generatedSchemas).not.toContain("export const wpPostSchema");
  });

  it("supports authenticated discovery via environment variables", () => {
    const password = process.env.WP_APP_PASSWORD;

    if (!password) {
      throw new Error("WP_APP_PASSWORD not set — did global-setup run?");
    }

    const outputDir = createTempDir();
    const schemasPath = path.join(outputDir, "env-auth-schemas.ts");

    runCli(
      [
        "schemas",
        "--url",
        getBaseUrl(),
        "--include",
        "books",
        "--out",
        schemasPath,
      ],
      {
        FLUENT_WP_PASSWORD: password,
        FLUENT_WP_USERNAME: "admin",
      },
    );

    const generatedSchemas = fs.readFileSync(schemasPath, "utf-8");

    expect(generatedSchemas).toContain("export const wpBookSchema");
    expect(generatedSchemas).not.toContain("export const wpPostSchema");
  });

  it("gives CLI flags precedence over environment variables", () => {
    const password = process.env.WP_APP_PASSWORD;

    if (!password) {
      throw new Error("WP_APP_PASSWORD not set — did global-setup run?");
    }

    const outputDir = createTempDir();
    const schemasPath = path.join(outputDir, "flag-precedence-schemas.ts");

    // Provide env vars for posts but flags for books — flags should win
    runCli(
      [
        "schemas",
        "--url",
        getBaseUrl(),
        "--username",
        "admin",
        "--password",
        password,
        "--include",
        "books",
        "--out",
        schemasPath,
      ],
      {
        FLUENT_WP_PASSWORD: "wrong-password",
        FLUENT_WP_USERNAME: "wrong-user",
      },
    );

    const generatedSchemas = fs.readFileSync(schemasPath, "utf-8");

    expect(generatedSchemas).toContain("export const wpBookSchema");
    expect(generatedSchemas).not.toContain("export const wpPostSchema");
  });

  it("generates dependency-free TypeScript interfaces", () => {
    const outputDir = createTempDir();
    const typesPath = path.join(outputDir, "wp-types.d.ts");

    const typesRun = runCli([
      "schemas",
      "--url",
      getBaseUrl(),
      "--include",
      "books",
      "--types-out",
      typesPath,
    ]);

    const generatedTypes = fs.readFileSync(typesPath, "utf-8");

    expect(typesRun.stdout).toContain("TypeScript types written to");
    expect(generatedTypes).toContain("export interface WPBook");
    expect(generatedTypes).toContain("test_book_isbn?: string");
    expect(generatedTypes).toContain("acf_subtitle?: string");
    expect(generatedTypes).not.toContain("from 'zod'");
    expect(generatedTypes).not.toContain("z.infer");
  });

  it("generates runtime JavaScript for Zod module js outputs", () => {
    const outputDir = createTempDir();
    const schemasPath = path.join(outputDir, "wp-schemas.mjs");

    const schemasRun = runCli([
      "schemas",
      "--url",
      getBaseUrl(),
      "--include",
      "books",
      "--zod-out",
      schemasPath,
    ]);

    const generatedSchemas = fs.readFileSync(schemasPath, "utf-8");

    expect(schemasRun.stdout).toContain("Zod schemas written to");
    expect(generatedSchemas).toContain("export const wpBookSchema");
    expect(generatedSchemas).not.toContain(" as const");
    expect(generatedSchemas).not.toContain("export type WPBook");
    expect(generatedSchemas).not.toContain("z.infer");
  });

  it("infers requested artifacts from explicit output paths", () => {
    const outputDir = createTempDir();
    const schemasPath = path.join(outputDir, "wp-schemas.mjs");
    const jsonPath = path.join(outputDir, "wp-schemas.json");
    const typesPath = path.join(outputDir, "wp-types.d.ts");

    const pathsRun = runCli([
      "schemas",
      "--url",
      getBaseUrl(),
      "--include",
      "books",
      "--zod-out",
      schemasPath,
      "--json-out",
      jsonPath,
      "--types-out",
      typesPath,
    ]);

    expect(pathsRun.stdout).toContain("Zod schemas written to");
    expect(pathsRun.stdout).toContain("JSON Schema written to");
    expect(pathsRun.stdout).toContain("TypeScript types written to");
    expect(fs.readFileSync(schemasPath, "utf-8")).toContain(
      "export const wpBookSchema",
    );
    expect(fs.readFileSync(jsonPath, "utf-8")).toContain('"books"');
    expect(fs.readFileSync(typesPath, "utf-8")).toContain(
      "export interface WPBook",
    );
  });

  it("rejects unsupported generated artifact extensions", () => {
    const outputDir = createTempDir();

    const invalidZodRun = runCliRaw([
      "schemas",
      "--url",
      getBaseUrl(),
      "--include",
      "books",
      "--zod-out",
      path.join(outputDir, "wp-schemas.js"),
    ]);
    const invalidJsonRun = runCliRaw([
      "schemas",
      "--url",
      getBaseUrl(),
      "--include",
      "books",
      "--json-out",
      path.join(outputDir, "wp-schemas.txt"),
    ]);
    const invalidTypesRun = runCliRaw([
      "schemas",
      "--url",
      getBaseUrl(),
      "--include",
      "books",
      "--types-out",
      path.join(outputDir, "wp-types.ts"),
    ]);

    expect(invalidZodRun.status).not.toBe(0);
    expect(invalidZodRun.stderr).toContain(
      "Zod output must use a .ts or .mjs file extension.",
    );
    expect(invalidJsonRun.status).not.toBe(0);
    expect(invalidJsonRun.stderr).toContain(
      "JSON Schema output must use a .json file extension.",
    );
    expect(invalidTypesRun.status).not.toBe(0);
    expect(invalidTypesRun.stderr).toContain(
      "TypeScript declaration output must use a .d.ts file extension.",
    );
  });

  it("can emit standalone types alongside Zod schemas", () => {
    const outputDir = createTempDir();
    const schemasPath = path.join(outputDir, "wp-schemas.ts");
    const typesPath = path.join(outputDir, "wp-types.d.ts");

    runCli([
      "schemas",
      "--url",
      getBaseUrl(),
      "--include",
      "books",
      "--out",
      schemasPath,
      "--types-out",
      typesPath,
    ]);

    expect(fs.readFileSync(schemasPath, "utf-8")).toContain(
      "export const wpBookSchema",
    );
    expect(fs.readFileSync(typesPath, "utf-8")).toContain(
      "export interface WPBook",
    );
  });

  it("generates every artifact from explicit output paths", () => {
    const outputDir = createTempDir();
    const schemasPath = path.join(outputDir, "wp-schemas.ts");
    const jsonPath = path.join(outputDir, "wp-schemas.json");
    const typesPath = path.join(outputDir, "wp-types.d.ts");

    const allRun = runCli([
      "schemas",
      "--url",
      getBaseUrl(),
      "--include",
      "books",
      "--zod-out",
      schemasPath,
      "--json-out",
      jsonPath,
      "--types-out",
      typesPath,
    ]);

    expect(allRun.stdout).toContain("Zod schemas written to");
    expect(allRun.stdout).toContain("JSON Schema written to");
    expect(allRun.stdout).toContain("TypeScript types written to");
    expect(fs.readFileSync(schemasPath, "utf-8")).toContain(
      "export const wpBookSchema",
    );
    expect(fs.readFileSync(jsonPath, "utf-8")).toContain('"books"');
    expect(fs.readFileSync(typesPath, "utf-8")).toContain(
      "export interface WPBook",
    );
  });
});
