/**
 * AI SDK `describeResourceTool` factory.
 *
 * Exposes one generic AI tool that lets the model introspect the live
 * WordPress schema for any discoverable resource or ability. The tool
 * delegates to the existing client describe methods, which means it is
 * backed by the discovery cache for free: callers that seed the catalog via
 * `wp.explore()` or `wp.useCatalog()` get in-memory lookups without extra
 * HTTP round-trips.
 *
 * The tool is deliberately thin: it returns the raw
 * `WordPressResourceDescription` or `WordPressAbilityDescription` DTO. The
 * AI SDK layer does not summarize, remap, or reshape the schema so the model
 * can read exactly what WordPress published, including any plugin-added
 * properties such as ACF field descriptions or choice keywords.
 */
import { tool } from "ai";
import { type ZodType, z } from "zod";
import type { WordPressClient } from "../client.js";
import { createInvalidRequestError } from "../core/errors.js";
import type {
  WordPressAbilityDescription,
  WordPressDiscoveryCatalog,
  WordPressResourceDescription,
} from "../types/discovery.js";
import { asToolArgs, withToolErrorHandling } from "./factories.js";

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

/**
 * Set of first-class resources that expose `.describe()` through the client.
 */
const RESOURCE_KINDS = ["media", "comments", "users", "settings"] as const;
export type DescribeResourceResourceKind = (typeof RESOURCE_KINDS)[number];

/**
 * Allowlist shape for the `describeResourceTool` factory.
 *
 * Each field is optional. When a field is provided, the tool's input schema
 * is narrowed so the model can only request that subset. When a field is
 * omitted, all catalog-discovered names for that kind are available.
 */
export interface DescribeResourceToolInclude {
  ability?: ReadonlyArray<string>;
  content?: ReadonlyArray<string>;
  resource?: ReadonlyArray<DescribeResourceResourceKind>;
  term?: ReadonlyArray<string>;
}

/**
 * Options for `describeResourceTool`.
 */
export interface DescribeResourceToolOptions {
  /**
   * Optional catalog override. Defaults to `client.getCachedCatalog()` when
   * the client has one seeded via `wp.explore()` / `wp.useCatalog()`.
   */
  catalog?: WordPressDiscoveryCatalog;
  /**
   * Allowlist that narrows the valid `kind` / `name` combinations exposed
   * to the model.
   */
  include?: DescribeResourceToolInclude;
}

/**
 * Describes a WordPress resource or ability schema.
 *
 * @example
 * ```ts
 * const tool = describeResourceTool(wp);
 *
 * // Only expose describe for two custom post types.
 * const narrow = describeResourceTool(wp, {
 *   include: { content: ['posts', 'books'] },
 * });
 * ```
 */
export function describeResourceTool(
  client: WordPressClient,
  options?: DescribeResourceToolOptions,
): ReturnType<typeof tool> {
  const catalog = options?.catalog ?? client.getCachedCatalog();
  const allowedNames = collectAllowedNames(catalog, options?.include);
  const inputSchema = buildInputSchema(allowedNames);

  return tool({
    description:
      "Describe the live WordPress schema for a resource or ability. Returns the raw discovery DTO, including JSON Schemas for `item`, `collection`, `create`, and `update` (or `input` / `output` for abilities). Use this before composing calls to other WordPress tools when the available fields, required properties, or plugin-specific metadata are unknown.",
    execute: withToolErrorHandling(async (args: unknown) => {
      const { kind, name } = parseDescribeArgs(
        asToolArgs(args as Record<string, unknown>),
      );

      assertAllowed(allowedNames, kind, name);

      return dispatchDescribe(client, kind, name);
    }) as never,
    inputSchema: inputSchema as never,
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Per-kind allowlist state used internally.
 *
 * - `ReadonlyArray<string>` — enum-restricted list of valid names.
 * - `"any"` — kind is exposed without an enum (no catalog, no caller filter).
 * - missing key / `undefined` — kind is not exposed at all.
 */
type AllowedEntry<T extends string = string> = ReadonlyArray<T> | "any";

interface AllowedNames {
  ability?: AllowedEntry;
  content?: AllowedEntry;
  resource?: AllowedEntry<DescribeResourceResourceKind>;
  term?: AllowedEntry;
}

type DescribeKind = "content" | "term" | "resource" | "ability";

/**
 * Resolves the effective allowlist per kind.
 *
 * The precedence rules are:
 *
 * 1. When `include` is not provided at all, every kind stays available and
 *    every catalog-discovered name within that kind is accepted.
 * 2. When `include` is provided, it acts as an explicit allowlist over
 *    kinds. Any kind missing from `include` is removed from the tool's
 *    input surface entirely, even if the catalog knows about names for it.
 * 3. Within an allowed kind, the explicit list wins over catalog-derived
 *    names. An empty array disables the kind. An undefined entry (when
 *    other keys are present on `include`) also disables the kind because it
 *    was not opted in.
 */
function collectAllowedNames(
  catalog: WordPressDiscoveryCatalog | undefined,
  include: DescribeResourceToolInclude | undefined,
): AllowedNames {
  if (!include) {
    return {
      ability: namesFromCatalog(catalog?.abilities),
      content: namesFromCatalog(catalog?.content),
      resource: catalog
        ? (namesFromCatalog(
            catalog.resources,
          ) as AllowedEntry<DescribeResourceResourceKind>)
        : RESOURCE_KINDS,
      term: namesFromCatalog(catalog?.terms),
    };
  }

  return {
    ability: include.ability,
    content: include.content,
    resource: include.resource,
    term: include.term,
  };
}

function namesFromCatalog<T extends string>(
  entries: Record<string, unknown> | undefined,
): AllowedEntry<T> {
  if (!entries) return "any";
  return Object.keys(entries) as unknown as ReadonlyArray<T>;
}

/**
 * Builds the Zod input schema the AI tool exposes to the model.
 *
 * Each kind is included only when it is reachable according to the
 * allowlist. `"any"` means the kind is exposed but accepts any string name.
 */
function buildInputSchema(allowed: AllowedNames): ZodType {
  const variants: ZodType[] = [];

  for (const kind of ["content", "term", "resource", "ability"] as const) {
    const entry = allowed[kind];
    if (entry === undefined) continue;
    if (Array.isArray(entry) && entry.length === 0) continue;

    variants.push(
      z.object({
        kind: z.literal(kind).describe(describeKindDescription(kind)),
        name: buildNameSchema(kind, entry),
      }),
    );
  }

  if (variants.length === 0) {
    throw createInvalidRequestError(
      "describeResourceTool(): the include filter removed every available kind. At least one of `content`, `term`, `resource`, or `ability` must permit at least one name.",
    );
  }

  if (variants.length === 1) return variants[0];

  return z.discriminatedUnion(
    "kind",
    variants as [
      z.ZodObject<z.ZodRawShape>,
      z.ZodObject<z.ZodRawShape>,
      ...z.ZodObject<z.ZodRawShape>[],
    ],
  );
}

function buildNameSchema(kind: DescribeKind, entry: AllowedEntry) {
  const description = describeNameDescription(kind);

  if (entry === "any") {
    return z.string().min(1).describe(description);
  }

  if (entry.length === 1) {
    return z.literal(entry[0]).describe(description);
  }

  return z
    .enum(entry as unknown as [string, ...string[]])
    .describe(description);
}

function describeKindDescription(kind: DescribeKind): string {
  switch (kind) {
    case "content":
      return "Post-like resource kind such as posts, pages, or custom post types.";
    case "term":
      return "Taxonomy resource kind such as categories, tags, or custom taxonomies.";
    case "resource":
      return "First-class resource kind (media, comments, users, or settings).";
    case "ability":
      return "Named WordPress ability exposed by the Abilities REST API.";
  }
}

function describeNameDescription(kind: DescribeKind): string {
  switch (kind) {
    case "content":
      return "Content type slug, e.g. 'posts', 'pages', 'books'.";
    case "term":
      return "Taxonomy slug, e.g. 'categories', 'tags', 'genre'.";
    case "resource":
      return "Resource slug: one of 'media', 'comments', 'users', 'settings'.";
    case "ability":
      return "Fully qualified ability name, e.g. 'myapp/send_email'.";
  }
}

function parseDescribeArgs(args: Record<string, unknown>): {
  kind: DescribeKind;
  name: string;
} {
  const kind = args.kind;
  const name = args.name;

  if (
    kind !== "content" &&
    kind !== "term" &&
    kind !== "resource" &&
    kind !== "ability"
  ) {
    throw createInvalidRequestError(
      "describeResourceTool(): `kind` must be one of 'content', 'term', 'resource', or 'ability'.",
    );
  }

  if (typeof name !== "string" || name.length === 0) {
    throw createInvalidRequestError(
      "describeResourceTool(): `name` must be a non-empty string.",
    );
  }

  return { kind, name };
}

function assertAllowed(
  allowed: AllowedNames,
  kind: DescribeKind,
  name: string,
): void {
  const entry = allowed[kind];

  if (entry === undefined) {
    throw createInvalidRequestError(
      `describeResourceTool(): kind '${kind}' is not enabled for this tool instance.`,
    );
  }

  if (entry === "any") return;
  if (entry.includes(name as never)) return;

  throw createInvalidRequestError(
    `describeResourceTool(): '${name}' is not available for kind '${kind}'. Allowed values: ${entry.join(", ")}.`,
  );
}

async function dispatchDescribe(
  client: WordPressClient,
  kind: DescribeKind,
  name: string,
): Promise<WordPressResourceDescription | WordPressAbilityDescription> {
  if (kind === "content") return client.content(name).describe();
  if (kind === "term") return client.terms(name).describe();
  if (kind === "ability") return client.ability(name).describe();

  switch (name as DescribeResourceResourceKind) {
    case "media":
      return client.media().describe();
    case "comments":
      return client.comments().describe();
    case "users":
      return client.users().describe();
    case "settings":
      return client.settings().describe();
  }

  throw createInvalidRequestError(
    `describeResourceTool(): unsupported resource kind '${name}'. Expected one of media, comments, users, settings.`,
  );
}
