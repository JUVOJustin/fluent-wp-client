import { z } from 'zod';
import type { WordPressBlockType, WordPressParsedBlock } from './schemas.js';
import type { WordPressJsonSchema } from './types/discovery.js';

export type { WordPressBlockType, WordPressParsedBlock } from './schemas.js';

type WordPressBlockAttributeDefinition = NonNullable<NonNullable<WordPressBlockType['attributes']>[string]>;
type WordPressBlockValidationPath = Array<string | number>;

const JSON_SCHEMA_DRAFT_2020_12 = 'https://json-schema.org/draft/2020-12/schema';
const BLOCK_NAME_PATTERN = /^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/;
const JSON_SCHEMA_TYPE_NAMES = new Set(['array', 'boolean', 'integer', 'null', 'number', 'object', 'string']);

/**
 * Function signature for one Gutenberg block parser implementation.
 */
export type WordPressBlockParser = (rawContent: string) => WordPressParsedBlock[];

/**
 * JSON Schema for one block node, including vendor extensions used by the block validator.
 */
export interface WordPressBlockJsonSchema extends WordPressJsonSchema {
  $schema: typeof JSON_SCHEMA_DRAFT_2020_12;
  $id?: string;
  title?: string;
  description?: string;
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: boolean;
  $defs?: Record<string, unknown>;
  'x-wordpress-block-name': string;
  'x-wordpress-parent'?: string[];
  'x-wordpress-ancestor'?: string[];
}

/**
 * Optional overrides supported by parsed block reads.
 */
export interface WordPressGetBlocksOptions {
  parser?: WordPressBlockParser;
  schemas?: WordPressBlockJsonSchema[];
  validate?: boolean;
}

/**
 * One validation issue detected while preparing a block tree for saving.
 */
export interface WordPressBlockValidationIssue {
  code: 'invalid_shape' | 'invalid_name' | 'unknown_block' | 'invalid_parent' | 'invalid_ancestor' | 'schema_validation' | 'roundtrip_mismatch';
  message: string;
  path: WordPressBlockValidationPath;
  blockName: string | null;
}

/**
 * Result returned by the standalone block validation helper.
 */
export interface WordPressBlockValidationResult {
  valid: boolean;
  issues: WordPressBlockValidationIssue[];
}

/**
 * Optional inputs for block validation helpers.
 */
export interface WordPressValidateBlocksOptions {
  parser?: WordPressBlockParser;
  schemas?: WordPressBlockJsonSchema[];
}

/**
 * Optional overrides supported by parsed block writes.
 */
export interface WordPressSetBlocksOptions extends WordPressValidateBlocksOptions {
  validate?: boolean;
}

/**
 * Error thrown when block content cannot be safely serialized.
 */
export class WordPressBlockValidationError extends Error {
  readonly issues: WordPressBlockValidationIssue[];

  constructor(issues: WordPressBlockValidationIssue[]) {
    super(formatBlockValidationMessage(issues));
    this.name = 'WordPressBlockValidationError';
    this.issues = issues;
  }
}

interface RuntimeWordPressDefaultParserModule {
  parse: (content: string) => WordPressParsedBlock[];
}

interface SerializeRawBlockOptions {
  isCommentDelimited?: boolean;
}

const blockSchemaValidatorCache = new WeakMap<WordPressBlockJsonSchema, z.ZodTypeAny>();

/**
 * Detects plain object records and excludes arrays from block payload validation.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Loads the WordPress raw block parser on demand.
 * Requires `@wordpress/block-serialization-default-parser` as an optional peer dependency.
 */
async function loadDefaultParserModule(): Promise<RuntimeWordPressDefaultParserModule> {
  try {
    const parserModule = await import('@wordpress/block-serialization-default-parser');
    return parserModule as unknown as RuntimeWordPressDefaultParserModule;
  } catch {
    throw new Error(
      'Block parsing requires the `@wordpress/block-serialization-default-parser` package. '
      + 'Install it with: npm install @wordpress/block-serialization-default-parser',
    );
  }
}

/**
 * Detects parser artifacts that only represent whitespace between top-level blocks.
 */
function isIgnorableWhitespaceBlock(block: WordPressParsedBlock): boolean {
  return block.blockName === null
    && block.innerBlocks.length === 0
    && (block.attrs === null || Object.keys(block.attrs).length === 0)
    && block.innerContent.every((item) => item === null || item.trim().length === 0);
}

/**
 * Removes whitespace-only freeform nodes while preserving meaningful classic content blocks.
 */
function normalizeParsedBlocks(blocks: WordPressParsedBlock[]): WordPressParsedBlock[] {
  return blocks
    .filter((block) => !isIgnorableWhitespaceBlock(block))
    .map((block) => ({
      ...block,
      innerBlocks: normalizeParsedBlocks(block.innerBlocks),
    }));
}

/**
 * Lazily loads the default WordPress block parser implementation.
 */
export async function loadDefaultWordPressBlockParser(): Promise<WordPressBlockParser> {
  const parserModule = await loadDefaultParserModule();
  return (rawContent: string): WordPressParsedBlock[] => normalizeParsedBlocks(parserModule.parse(rawContent));
}

/**
 * Parses serialized Gutenberg content into structured block data.
 */
export async function parseWordPressBlocks(
  rawContent: string,
  parser?: WordPressBlockParser,
): Promise<WordPressParsedBlock[]> {
  const runtimeParser = parser ?? await loadDefaultWordPressBlockParser();
  return runtimeParser(rawContent);
}

/**
 * Escapes serialized block attributes so the JSON stays safe inside HTML comments.
 */
export function serializeWordPressBlockAttributes(attributes: Record<string, unknown>): string {
  return JSON.stringify(attributes)
    .replaceAll('\\"', '\\u0022')
    .replaceAll('\\', '\\u005c')
    .replaceAll('--', '\\u002d\\u002d')
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

/**
 * Normalizes core block names to the compact comment-delimited form used by WordPress.
 */
function toSerializedBlockName(blockName: string): string {
  return blockName.startsWith('core/') ? blockName.slice(5) : blockName;
}

/**
 * Wraps serialized inner block content in standard Gutenberg comment delimiters.
 */
export function serializeWordPressBlockComment(
  blockName: string,
  attributes: Record<string, unknown> | null,
  content: string,
): string {
  const normalizedName = toSerializedBlockName(blockName);
  const serializedAttributes = attributes && Object.keys(attributes).length > 0
    ? `${serializeWordPressBlockAttributes(attributes)} `
    : '';

  if (!content) {
    return `<!-- wp:${normalizedName} ${serializedAttributes}/-->`;
  }

  return `<!-- wp:${normalizedName} ${serializedAttributes}-->\n${content}\n<!-- /wp:${normalizedName} -->`;
}

/**
 * Serializes one parsed raw block node using the Gutenberg raw block format.
 */
function serializeRawBlock(
  block: WordPressParsedBlock,
  options: SerializeRawBlockOptions = {},
): string {
  const { isCommentDelimited = true } = options;
  const attrs = isRecord(block.attrs) ? block.attrs : {};
  let childIndex = 0;

  const content = block.innerContent
    .map((item) => item !== null
      ? item
      : serializeRawBlock(block.innerBlocks[childIndex++]!, options))
    .join('');

  if (!isCommentDelimited || block.blockName === null) {
    return content;
  }

  return serializeWordPressBlockComment(block.blockName, attrs, content);
}

/**
 * Serializes the raw parsed block tree back into `post_content` markup.
 */
export function serializeWordPressBlocks(blocks: WordPressParsedBlock[]): string {
  return blocks
    .map((block) => serializeRawBlock(block, { isCommentDelimited: block.blockName !== null }))
    .join('\n\n');
}

/**
 * Keeps only JSON Schema primitive type names supported by Gutenberg attribute definitions.
 */
function normalizeJsonSchemaTypeNames(type: unknown): string | string[] | undefined {
  if (typeof type === 'string') {
    return JSON_SCHEMA_TYPE_NAMES.has(type) ? type : undefined;
  }

  if (!Array.isArray(type)) {
    return undefined;
  }

  const typeNames = type.filter((value): value is string => typeof value === 'string' && JSON_SCHEMA_TYPE_NAMES.has(value));

  if (typeNames.length === 0) {
    return undefined;
  }

  return typeNames.length === 1 ? typeNames[0]! : typeNames;
}

/**
 * Builds a permissive recursive schema for nested raw block nodes.
 */
function createGenericParsedBlockJsonSchema(): WordPressJsonSchema {
  return {
    type: 'object',
    properties: {
      blockName: {
        type: ['string', 'null'],
      },
      attrs: {
        type: ['object', 'null'],
        additionalProperties: true,
      },
      innerBlocks: {
        type: 'array',
        items: {
          $ref: '#/$defs/parsedBlock',
        },
      },
      innerHTML: {
        type: 'string',
      },
      innerContent: {
        type: 'array',
        items: {
          type: ['string', 'null'],
        },
      },
    },
    required: ['blockName', 'attrs', 'innerBlocks', 'innerHTML', 'innerContent'],
    additionalProperties: false,
  };
}

/**
 * Converts one nested query attribute definition object to JSON Schema object properties.
 */
function createWordPressBlockAttributeProperties(
  attributes: Record<string, WordPressBlockAttributeDefinition> | null | undefined,
): Record<string, WordPressJsonSchema> {
  return Object.fromEntries(
    Object.entries(attributes ?? {}).map(([attributeName, definition]) => [
      attributeName,
      createWordPressBlockAttributeJsonSchema(definition),
    ]),
  );
}

/**
 * Converts one block attribute definition into the closest JSON Schema fragment available from block metadata.
 */
function createWordPressBlockAttributeJsonSchema(
  definition: WordPressBlockAttributeDefinition,
): WordPressJsonSchema {
  const schema: WordPressJsonSchema = {};
  const type = normalizeJsonSchemaTypeNames(definition.type);

  if (type !== undefined) {
    schema.type = type;
  }

  if (Array.isArray(definition.enum) && definition.enum.length > 0) {
    schema.enum = definition.enum;
  }

  if (definition.default !== undefined) {
    schema.default = definition.default;
  }

  if (typeof definition.role === 'string') {
    schema['x-wordpress-role'] = definition.role;
  }

  if (typeof definition.source === 'string') {
    schema['x-wordpress-source'] = definition.source;
  }

  if (typeof definition.selector === 'string') {
    schema['x-wordpress-selector'] = definition.selector;
  }

  if (typeof definition.attribute === 'string') {
    schema['x-wordpress-attribute'] = definition.attribute;
  }

  if (typeof definition.meta === 'string') {
    schema['x-wordpress-meta'] = definition.meta;
  }

  if (definition.source === 'query' && isRecord(definition.query)) {
    schema.type = 'array';
    schema.items = {
      type: 'object',
      properties: createWordPressBlockAttributeProperties(
        definition.query as Record<string, WordPressBlockAttributeDefinition>,
      ),
      additionalProperties: false,
    };

    return schema;
  }

  if (isRecord(definition.items)) {
    schema.items = definition.items;
  }

  if (isRecord(definition.properties)) {
    schema.properties = definition.properties;
    schema.additionalProperties = false;
  } else if (type === 'object' || (Array.isArray(type) && type.includes('object'))) {
    schema.additionalProperties = true;
  }

  return schema;
}

/**
 * Builds the JSON Schema used for the `attrs` payload of one block type.
 */
function createWordPressBlockAttrsJsonSchema(
  blockType: WordPressBlockType,
): WordPressJsonSchema {
  const attributes = blockType.attributes ?? {};

  return {
    anyOf: [
      {
        type: 'null',
      },
      {
        type: 'object',
        properties: createWordPressBlockAttributeProperties(attributes),
        additionalProperties: false,
      },
    ],
  };
}

/**
 * Builds a stable identifier for one generated block JSON Schema.
 */
function createWordPressBlockSchemaId(blockName: string): string {
  return `https://fluent-wp-client.dev/schemas/blocks/${encodeURIComponent(blockName)}`;
}

/**
 * Generates one JSON Schema document for one available block type.
 */
export function createWordPressBlockJsonSchema(blockType: WordPressBlockType): WordPressBlockJsonSchema {
  return {
    $schema: JSON_SCHEMA_DRAFT_2020_12,
    $id: createWordPressBlockSchemaId(blockType.name),
    title: blockType.title,
    description: blockType.description,
    type: 'object',
    properties: {
      blockName: {
        const: blockType.name,
      },
      attrs: createWordPressBlockAttrsJsonSchema(blockType),
      innerBlocks: {
        type: 'array',
        items: {
          $ref: '#/$defs/parsedBlock',
        },
      },
      innerHTML: {
        type: 'string',
      },
      innerContent: {
        type: 'array',
        items: {
          type: ['string', 'null'],
        },
      },
    },
    required: ['blockName', 'attrs', 'innerBlocks', 'innerHTML', 'innerContent'],
    additionalProperties: false,
    $defs: {
      parsedBlock: createGenericParsedBlockJsonSchema(),
    },
    'x-wordpress-block-name': blockType.name,
    ...(Array.isArray(blockType.parent) && blockType.parent.length > 0
      ? { 'x-wordpress-parent': blockType.parent }
      : {}),
    ...(Array.isArray(blockType.ancestor) && blockType.ancestor.length > 0
      ? { 'x-wordpress-ancestor': blockType.ancestor }
      : {}),
  };
}

/**
 * Generates JSON Schema documents for a list of available block types.
 */
export function createWordPressBlockJsonSchemas(
  blockTypes: WordPressBlockType[],
): WordPressBlockJsonSchema[] {
  return blockTypes.map(createWordPressBlockJsonSchema);
}

/**
 * Resolves the block name encoded by one block schema definition.
 */
function resolveWordPressBlockSchemaName(schema: WordPressBlockJsonSchema): string | undefined {
  if (typeof schema['x-wordpress-block-name'] === 'string') {
    return schema['x-wordpress-block-name'];
  }

  const properties = isRecord(schema.properties) ? schema.properties : undefined;
  const blockNameProperty = properties && isRecord(properties.blockName) ? properties.blockName : undefined;

  if (!blockNameProperty) {
    return undefined;
  }

  if (typeof blockNameProperty.const === 'string') {
    return blockNameProperty.const;
  }

  if (Array.isArray(blockNameProperty.enum) && blockNameProperty.enum.length === 1 && typeof blockNameProperty.enum[0] === 'string') {
    return blockNameProperty.enum[0];
  }

  return undefined;
}

/**
 * Reads a string-array vendor extension from one generated block schema.
 */
function readWordPressBlockSchemaExtension(
  schema: WordPressBlockJsonSchema,
  key: 'x-wordpress-parent' | 'x-wordpress-ancestor',
): string[] | undefined {
  const value = schema[key];

  if (!Array.isArray(value)) {
    return undefined;
  }

  const names = value.filter((item): item is string => typeof item === 'string');
  return names.length > 0 ? names : undefined;
}

/**
 * Lazily compiles one block JSON Schema with Zod so repeated validations stay cheap.
 */
function getWordPressBlockSchemaValidator(schema: WordPressBlockJsonSchema): z.ZodTypeAny {
  const cached = blockSchemaValidatorCache.get(schema);

  if (cached) {
    return cached;
  }

  const validator = z.fromJSONSchema(schema as Parameters<typeof z.fromJSONSchema>[0]);
  blockSchemaValidatorCache.set(schema, validator);
  return validator;
}

/**
 * Recursively flattens nested Zod union issues into path-aware validation messages.
 */
function flattenZodIssues(
  issues: readonly z.core.$ZodIssue[],
  prefix: WordPressBlockValidationPath = [],
): Array<{ path: WordPressBlockValidationPath; message: string }> {
  const flattened: Array<{ path: WordPressBlockValidationPath; message: string }> = [];

  for (const issue of issues) {
    const normalizedIssuePath = issue.path.filter(
      (segment): segment is string | number => typeof segment === 'string' || typeof segment === 'number',
    );
    const issuePath = [...prefix, ...normalizedIssuePath];

    if (issue.code === 'invalid_union' && Array.isArray(issue.errors)) {
      for (const nestedIssues of issue.errors) {
        flattened.push(...flattenZodIssues(nestedIssues, issuePath));
      }

      continue;
    }

    flattened.push({
      path: issuePath,
      message: issue.message,
    });
  }

  return flattened;
}

/**
 * Validates serializer shape rules that JSON Schema cannot express across sibling fields.
 */
function validateBlockTreeStructure(
  blocks: WordPressParsedBlock[],
  issues: WordPressBlockValidationIssue[],
  path: WordPressBlockValidationPath = [],
): void {
  for (const [index, block] of blocks.entries()) {
    const currentPath = [...path, index];
    const blockName = block.blockName;
    const nullPlaceholderCount = block.innerContent.filter((item) => item === null).length;

    if (!Array.isArray(block.innerBlocks)) {
      issues.push({
        code: 'invalid_shape',
        message: 'Block `innerBlocks` must be an array.',
        path: currentPath,
        blockName,
      });
      continue;
    }

    if (!Array.isArray(block.innerContent)) {
      issues.push({
        code: 'invalid_shape',
        message: 'Block `innerContent` must be an array.',
        path: currentPath,
        blockName,
      });
      continue;
    }

    if (nullPlaceholderCount !== block.innerBlocks.length) {
      issues.push({
        code: 'invalid_shape',
        message: 'Block `innerContent` must contain one `null` placeholder for each nested block.',
        path: currentPath,
        blockName,
      });
    }

    if (blockName !== null && !BLOCK_NAME_PATTERN.test(blockName)) {
      issues.push({
        code: 'invalid_name',
        message: 'Block names must use the `namespace/name` format.',
        path: currentPath,
        blockName,
      });
    }

    if (block.attrs !== null && !isRecord(block.attrs)) {
      issues.push({
        code: 'invalid_shape',
        message: 'Block `attrs` must be an object or null.',
        path: currentPath,
        blockName,
      });
    }

    validateBlockTreeStructure(block.innerBlocks, issues, currentPath);
  }
}

/**
 * Builds a block-name keyed schema map while surfacing malformed custom schemas as validation issues.
 */
function createWordPressBlockSchemaMap(
  schemas: WordPressBlockJsonSchema[],
  issues: WordPressBlockValidationIssue[],
): Map<string, WordPressBlockJsonSchema> {
  const schemaMap = new Map<string, WordPressBlockJsonSchema>();

  for (const schema of schemas) {
    const blockName = resolveWordPressBlockSchemaName(schema);

    if (!blockName) {
      issues.push({
        code: 'schema_validation',
        message: 'Block schema must declare a single block name using `x-wordpress-block-name` or `properties.blockName.const`.',
        path: [],
        blockName: null,
      });
      continue;
    }

    schemaMap.set(blockName, schema);
  }

  return schemaMap;
}

/**
 * Validates each named block node against one matching block JSON Schema and its parent/ancestor metadata.
 */
function validateBlocksAgainstSchemas(
  blocks: WordPressParsedBlock[],
  issues: WordPressBlockValidationIssue[],
  schemaMap: Map<string, WordPressBlockJsonSchema>,
  path: WordPressBlockValidationPath = [],
  parentBlockName: string | null = null,
  ancestorBlockNames: string[] = [],
): void {
  for (const [index, block] of blocks.entries()) {
    const currentPath = [...path, index];
    const blockName = block.blockName;

    if (blockName !== null) {
      const schema = schemaMap.get(blockName);

      if (!schema) {
        issues.push({
          code: 'unknown_block',
          message: `Block type \`${blockName}\` is not allowed by the provided block schemas.`,
          path: currentPath,
          blockName,
        });
      } else {
        try {
          const validator = getWordPressBlockSchemaValidator(schema);
          const result = validator.safeParse(block);

          if (!result.success) {
            for (const issue of flattenZodIssues(result.error.issues, currentPath)) {
              issues.push({
                code: 'schema_validation',
                message: issue.message,
                path: issue.path,
                blockName,
              });
            }
          }
        } catch (error) {
          issues.push({
            code: 'schema_validation',
            message: error instanceof Error
              ? error.message
              : `Block schema for \`${blockName}\` could not be compiled.`,
            path: currentPath,
            blockName,
          });
        }

        const allowedParents = readWordPressBlockSchemaExtension(schema, 'x-wordpress-parent');

        if (allowedParents && (!parentBlockName || !allowedParents.includes(parentBlockName))) {
          issues.push({
            code: 'invalid_parent',
            message: `Block type \`${blockName}\` must be nested directly inside one of: ${allowedParents.join(', ')}.`,
            path: currentPath,
            blockName,
          });
        }

        const allowedAncestors = readWordPressBlockSchemaExtension(schema, 'x-wordpress-ancestor');

        if (allowedAncestors && !ancestorBlockNames.some((ancestorName) => allowedAncestors.includes(ancestorName))) {
          issues.push({
            code: 'invalid_ancestor',
            message: `Block type \`${blockName}\` requires one of these ancestors: ${allowedAncestors.join(', ')}.`,
            path: currentPath,
            blockName,
          });
        }
      }
    }

    validateBlocksAgainstSchemas(
      block.innerBlocks,
      issues,
      schemaMap,
      currentPath,
      blockName,
      blockName ? [...ancestorBlockNames, blockName] : ancestorBlockNames,
    );
  }
}

/**
 * Formats a compact validation summary for `WordPressBlockValidationError`.
 */
function formatBlockValidationMessage(issues: WordPressBlockValidationIssue[]): string {
  const preview = issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join(' ');

  return issues.length > 3
    ? `WordPress block validation failed with ${issues.length} issues. ${preview}`
    : `WordPress block validation failed. ${preview}`;
}

/**
 * Validates a parsed block tree against structural rules, optional schema allowlists, and parser round-trips.
 */
export async function validateWordPressBlocks(
  blocks: WordPressParsedBlock[],
  options: WordPressValidateBlocksOptions = {},
): Promise<WordPressBlockValidationResult> {
  const issues: WordPressBlockValidationIssue[] = [];

  validateBlockTreeStructure(blocks, issues);

  if (options.schemas) {
    const schemaMap = createWordPressBlockSchemaMap(options.schemas, issues);
    validateBlocksAgainstSchemas(blocks, issues, schemaMap);
  }

  if (issues.length > 0) {
    return {
      valid: false,
      issues,
    };
  }

  try {
    const serialized = serializeWordPressBlocks(blocks);
    const reparsed = await parseWordPressBlocks(serialized, options.parser);
    const reserialized = serializeWordPressBlocks(reparsed);

    if (reserialized !== serialized) {
      issues.push({
        code: 'roundtrip_mismatch',
        message: 'Block serialization does not round-trip cleanly through the WordPress raw block parser.',
        path: [],
        blockName: null,
      });
    }
  } catch (error) {
    issues.push({
      code: 'roundtrip_mismatch',
      message: error instanceof Error
        ? error.message
        : 'Block serialization does not round-trip cleanly through the WordPress raw block parser.',
      path: [],
      blockName: null,
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Throws a typed validation error when a block tree cannot be safely serialized.
 */
export async function assertValidWordPressBlocks(
  blocks: WordPressParsedBlock[],
  options: WordPressValidateBlocksOptions = {},
): Promise<void> {
  const result = await validateWordPressBlocks(blocks, options);

  if (!result.valid) {
    throw new WordPressBlockValidationError(result.issues);
  }
}
