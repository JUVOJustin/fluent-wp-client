import { type ZodType, z } from "zod";
import { createInvalidRequestError } from "../core/errors.js";
import type {
	WordPressAbilityDescription,
	WordPressDiscoveryCatalog,
	WordPressResourceDescription,
} from "../types/discovery.js";
import { zodSchemasFromDescription } from "../zod-helpers.js";
import {
	abilityDeleteInputSchema,
	abilityGetInputSchema,
	abilityRunInputSchema,
	contentCollectionInputSchema,
	contentCreateInputSchema,
	contentGetInputSchema,
	contentUpdateInputSchema,
	deleteInputSchema,
	simpleGetInputSchema,
	termCollectionInputSchema,
	termCreateInputSchema,
	termUpdateInputSchema,
} from "./schemas.js";

type ZodShape = z.ZodRawShape;

function getObjectSchema(
	schema: ZodType | undefined,
	fallback: ZodType,
): ZodType {
	return schema ?? fallback;
}

function createSelectorSchema(
	values: string[],
	fallbackDescription: string,
): ZodType {
	if (values.length === 1) {
		return z.literal(values[0]).describe(fallbackDescription);
	}

	if (values.length > 1) {
		return z
			.enum(values as [string, ...string[]])
			.describe(fallbackDescription);
	}

	return z.string().describe(fallbackDescription);
}

function extendObjectSchema(
	schema: z.ZodObject<ZodShape>,
	shape: ZodShape,
): z.ZodObject<ZodShape> {
	return schema.extend(shape);
}

function withOptionalDescription<T extends ZodType>(
	schema: T,
	description: string,
): T {
	return schema.describe(description) as T;
}

function getContentDescriptions(
	catalog?: WordPressDiscoveryCatalog,
): Array<[string, WordPressResourceDescription]> {
	return Object.entries(catalog?.content ?? {});
}

function getTermDescriptions(
	catalog?: WordPressDiscoveryCatalog,
): Array<[string, WordPressResourceDescription]> {
	return Object.entries(catalog?.terms ?? {});
}

function getAbilityDescriptions(
	catalog?: WordPressDiscoveryCatalog,
): Array<[string, WordPressAbilityDescription]> {
	return Object.entries(catalog?.abilities ?? {});
}

function findContentDescription(
	catalog: WordPressDiscoveryCatalog | undefined,
	contentType: string | undefined,
) {
	return contentType ? catalog?.content?.[contentType] : undefined;
}

function findTermDescription(
	catalog: WordPressDiscoveryCatalog | undefined,
	taxonomyType: string | undefined,
) {
	return taxonomyType ? catalog?.terms?.[taxonomyType] : undefined;
}

function findAbilityDescription(
	catalog: WordPressDiscoveryCatalog | undefined,
	abilityName: string | undefined,
) {
	return abilityName ? catalog?.abilities?.[abilityName] : undefined;
}

function buildDiscriminatedUnion(
	discriminator: string,
	variants: z.ZodObject<ZodShape>[],
): ZodType {
	if (variants.length === 0) {
		throw createInvalidRequestError(
			`Cannot build discriminated union for '${discriminator}' without variants.`,
		);
	}

	if (variants.length === 1) {
		return variants[0];
	}

	return z.discriminatedUnion(
		discriminator,
		variants as [
			z.ZodObject<ZodShape>,
			z.ZodObject<ZodShape>,
			...z.ZodObject<ZodShape>[],
		],
	);
}

export function createContentCollectionInputSchema(config: {
	catalog?: WordPressDiscoveryCatalog;
	contentType?: string;
}): ZodType {
	if (config.contentType) {
		return contentCollectionInputSchema;
	}

	const values = getContentDescriptions(config.catalog).map(
		([contentType]) => contentType,
	);
	return extendObjectSchema(contentCollectionInputSchema, {
		contentType: createSelectorSchema(
			values,
			"Post-like resource to query, such as posts, pages, or books",
		),
	}).describe("Search and filter WordPress content");
}

export function createContentGetInputSchema(config: {
	catalog?: WordPressDiscoveryCatalog;
	contentType?: string;
}): ZodType {
	if (config.contentType) {
		return contentGetInputSchema;
	}

	const values = getContentDescriptions(config.catalog).map(
		([contentType]) => contentType,
	);
	return extendObjectSchema(contentGetInputSchema, {
		contentType: createSelectorSchema(
			values,
			"Post-like resource to read, such as posts, pages, or books",
		),
	}).describe("Get one WordPress content item by ID or slug");
}

export function createContentCreateInputSchema(config: {
	catalog?: WordPressDiscoveryCatalog;
	contentType?: string;
}): ZodType {
	const fixedDescription = findContentDescription(
		config.catalog,
		config.contentType,
	);
	if (config.contentType) {
		const schemas = fixedDescription
			? zodSchemasFromDescription(fixedDescription)
			: undefined;
		const input = getObjectSchema(
			schemas?.create,
			contentCreateInputSchema.shape.input,
		);
		return z
			.object({
				input: withOptionalDescription(
					input,
					`Fields to set on the ${config.contentType} item`,
				),
			})
			.describe(`Create a new WordPress ${config.contentType} item`);
	}

	const variants = getContentDescriptions(config.catalog).map(
		([contentType, description]) => {
			const schemas = zodSchemasFromDescription(description);
			return z.object({
				contentType: z.literal(contentType),
				input: withOptionalDescription(
					getObjectSchema(schemas.create, contentCreateInputSchema.shape.input),
					`Fields to set on the ${contentType} item`,
				),
			});
		},
	);

	if (variants.length > 0) {
		return withOptionalDescription(
			buildDiscriminatedUnion("contentType", variants),
			"Create a new WordPress content item",
		);
	}

	return z
		.object({
			contentType: z
				.string()
				.describe(
					"Post-like resource to create, such as posts, pages, or books",
				),
			input: contentCreateInputSchema.shape.input,
		})
		.describe("Create a new WordPress content item");
}

export function createContentUpdateInputSchema(config: {
	catalog?: WordPressDiscoveryCatalog;
	contentType?: string;
}): ZodType {
	const fixedDescription = findContentDescription(
		config.catalog,
		config.contentType,
	);
	if (config.contentType) {
		const schemas = fixedDescription
			? zodSchemasFromDescription(fixedDescription)
			: undefined;
		const input = getObjectSchema(
			schemas?.update,
			contentUpdateInputSchema.shape.input,
		);
		return z
			.object({
				id: contentUpdateInputSchema.shape.id,
				input: withOptionalDescription(
					input,
					`Fields to update on the ${config.contentType} item`,
				),
			})
			.describe(`Update an existing WordPress ${config.contentType} item`);
	}

	const variants = getContentDescriptions(config.catalog).map(
		([contentType, description]) => {
			const schemas = zodSchemasFromDescription(description);
			return z.object({
				contentType: z.literal(contentType),
				id: contentUpdateInputSchema.shape.id,
				input: withOptionalDescription(
					getObjectSchema(schemas.update, contentUpdateInputSchema.shape.input),
					`Fields to update on the ${contentType} item`,
				),
			});
		},
	);

	if (variants.length > 0) {
		return withOptionalDescription(
			buildDiscriminatedUnion("contentType", variants),
			"Update an existing WordPress content item",
		);
	}

	return z
		.object({
			contentType: z
				.string()
				.describe(
					"Post-like resource to update, such as posts, pages, or books",
				),
			id: contentUpdateInputSchema.shape.id,
			input: contentUpdateInputSchema.shape.input,
		})
		.describe("Update an existing WordPress content item");
}

export function createContentDeleteInputSchema(config: {
	catalog?: WordPressDiscoveryCatalog;
	contentType?: string;
}): ZodType {
	if (config.contentType) {
		return deleteInputSchema;
	}

	const values = getContentDescriptions(config.catalog).map(
		([contentType]) => contentType,
	);
	return extendObjectSchema(deleteInputSchema, {
		contentType: createSelectorSchema(
			values,
			"Post-like resource to delete from, such as posts, pages, or books",
		),
	}).describe("Delete a WordPress content item");
}

export function createTermCollectionInputSchema(config: {
	catalog?: WordPressDiscoveryCatalog;
	taxonomyType?: string;
}): ZodType {
	if (config.taxonomyType) {
		return termCollectionInputSchema;
	}

	const values = getTermDescriptions(config.catalog).map(
		([taxonomyType]) => taxonomyType,
	);
	return extendObjectSchema(termCollectionInputSchema, {
		taxonomyType: createSelectorSchema(
			values,
			"Taxonomy resource to query, such as categories, tags, or genre",
		),
	}).describe("Search and filter WordPress terms");
}

export function createTermGetInputSchema(config: {
	catalog?: WordPressDiscoveryCatalog;
	taxonomyType?: string;
}): ZodType {
	if (config.taxonomyType) {
		return simpleGetInputSchema;
	}

	const values = getTermDescriptions(config.catalog).map(
		([taxonomyType]) => taxonomyType,
	);
	return extendObjectSchema(simpleGetInputSchema, {
		taxonomyType: createSelectorSchema(
			values,
			"Taxonomy resource to read, such as categories, tags, or genre",
		),
	}).describe("Get one WordPress term by ID or slug");
}

export function createTermCreateInputSchema(config: {
	catalog?: WordPressDiscoveryCatalog;
	taxonomyType?: string;
}): ZodType {
	const fixedDescription = findTermDescription(
		config.catalog,
		config.taxonomyType,
	);
	if (config.taxonomyType) {
		const schemas = fixedDescription
			? zodSchemasFromDescription(fixedDescription)
			: undefined;
		const input = getObjectSchema(
			schemas?.create,
			termCreateInputSchema.shape.input,
		);
		return z
			.object({
				input: withOptionalDescription(
					input,
					`Fields to set on the ${config.taxonomyType} term`,
				),
			})
			.describe(`Create a new WordPress ${config.taxonomyType} term`);
	}

	const variants = getTermDescriptions(config.catalog).map(
		([taxonomyType, description]) => {
			const schemas = zodSchemasFromDescription(description);
			return z.object({
				taxonomyType: z.literal(taxonomyType),
				input: withOptionalDescription(
					getObjectSchema(schemas.create, termCreateInputSchema.shape.input),
					`Fields to set on the ${taxonomyType} term`,
				),
			});
		},
	);

	if (variants.length > 0) {
		return withOptionalDescription(
			buildDiscriminatedUnion("taxonomyType", variants),
			"Create a new WordPress term",
		);
	}

	return z
		.object({
			taxonomyType: z
				.string()
				.describe(
					"Taxonomy resource to create in, such as categories, tags, or genre",
				),
			input: termCreateInputSchema.shape.input,
		})
		.describe("Create a new WordPress term");
}

export function createTermUpdateInputSchema(config: {
	catalog?: WordPressDiscoveryCatalog;
	taxonomyType?: string;
}): ZodType {
	const fixedDescription = findTermDescription(
		config.catalog,
		config.taxonomyType,
	);
	if (config.taxonomyType) {
		const schemas = fixedDescription
			? zodSchemasFromDescription(fixedDescription)
			: undefined;
		const input = getObjectSchema(
			schemas?.update,
			termUpdateInputSchema.shape.input,
		);
		return z
			.object({
				id: termUpdateInputSchema.shape.id,
				input: withOptionalDescription(
					input,
					`Fields to update on the ${config.taxonomyType} term`,
				),
			})
			.describe(`Update an existing WordPress ${config.taxonomyType} term`);
	}

	const variants = getTermDescriptions(config.catalog).map(
		([taxonomyType, description]) => {
			const schemas = zodSchemasFromDescription(description);
			return z.object({
				taxonomyType: z.literal(taxonomyType),
				id: termUpdateInputSchema.shape.id,
				input: withOptionalDescription(
					getObjectSchema(schemas.update, termUpdateInputSchema.shape.input),
					`Fields to update on the ${taxonomyType} term`,
				),
			});
		},
	);

	if (variants.length > 0) {
		return withOptionalDescription(
			buildDiscriminatedUnion("taxonomyType", variants),
			"Update an existing WordPress term",
		);
	}

	return z
		.object({
			taxonomyType: z
				.string()
				.describe(
					"Taxonomy resource to update, such as categories, tags, or genre",
				),
			id: termUpdateInputSchema.shape.id,
			input: termUpdateInputSchema.shape.input,
		})
		.describe("Update an existing WordPress term");
}

export function createTermDeleteInputSchema(config: {
	catalog?: WordPressDiscoveryCatalog;
	taxonomyType?: string;
}): ZodType {
	if (config.taxonomyType) {
		return deleteInputSchema;
	}

	const values = getTermDescriptions(config.catalog).map(
		([taxonomyType]) => taxonomyType,
	);
	return extendObjectSchema(deleteInputSchema, {
		taxonomyType: createSelectorSchema(
			values,
			"Taxonomy resource to delete from, such as categories, tags, or genre",
		),
	}).describe("Delete a WordPress term");
}

export function createAbilityGetInputSchema(config: {
	catalog?: WordPressDiscoveryCatalog;
	abilityName?: string;
}): ZodType {
	const fixedDescription = findAbilityDescription(
		config.catalog,
		config.abilityName,
	);
	if (config.abilityName) {
		const schemas = fixedDescription
			? zodSchemasFromDescription(fixedDescription)
			: undefined;
		return z
			.object({
				input: withOptionalDescription(
					getObjectSchema(schemas?.input, abilityGetInputSchema.shape.input),
					"Optional primitive input value for GET execution",
				).optional(),
			})
			.describe(`Execute the ${config.abilityName} WordPress ability via GET`);
	}

	const variants = getAbilityDescriptions(config.catalog).map(
		([abilityName, description]) => {
			const schemas = zodSchemasFromDescription(description);
			return z.object({
				name: z.literal(abilityName),
				input: withOptionalDescription(
					getObjectSchema(schemas.input, abilityGetInputSchema.shape.input),
					"Optional primitive input value for GET execution",
				).optional(),
			});
		},
	);

	if (variants.length > 0) {
		return withOptionalDescription(
			buildDiscriminatedUnion("name", variants),
			"Execute a read-only WordPress ability",
		);
	}

	return abilityGetInputSchema;
}

export function createAbilityRunInputSchema(config: {
	catalog?: WordPressDiscoveryCatalog;
	abilityName?: string;
}): ZodType {
	const fixedDescription = findAbilityDescription(
		config.catalog,
		config.abilityName,
	);
	if (config.abilityName) {
		const schemas = fixedDescription
			? zodSchemasFromDescription(fixedDescription)
			: undefined;
		return z
			.object({
				input: withOptionalDescription(
					getObjectSchema(schemas?.input, abilityRunInputSchema.shape.input),
					"Optional input value for POST execution",
				).optional(),
			})
			.describe(`Execute the ${config.abilityName} WordPress ability via POST`);
	}

	const variants = getAbilityDescriptions(config.catalog).map(
		([abilityName, description]) => {
			const schemas = zodSchemasFromDescription(description);
			return z.object({
				name: z.literal(abilityName),
				input: withOptionalDescription(
					getObjectSchema(schemas.input, abilityRunInputSchema.shape.input),
					"Optional input value for POST execution",
				).optional(),
			});
		},
	);

	if (variants.length > 0) {
		return withOptionalDescription(
			buildDiscriminatedUnion("name", variants),
			"Execute a WordPress ability via POST",
		);
	}

	return abilityRunInputSchema;
}

export function createAbilityDeleteInputSchema(config: {
	catalog?: WordPressDiscoveryCatalog;
	abilityName?: string;
}): ZodType {
	const fixedDescription = findAbilityDescription(
		config.catalog,
		config.abilityName,
	);
	if (config.abilityName) {
		const schemas = fixedDescription
			? zodSchemasFromDescription(fixedDescription)
			: undefined;
		return z
			.object({
				input: withOptionalDescription(
					getObjectSchema(schemas?.input, abilityDeleteInputSchema.shape.input),
					"Optional primitive input value for DELETE execution",
				).optional(),
			})
			.describe(
				`Execute the ${config.abilityName} WordPress ability via DELETE`,
			);
	}

	const variants = getAbilityDescriptions(config.catalog).map(
		([abilityName, description]) => {
			const schemas = zodSchemasFromDescription(description);
			return z.object({
				name: z.literal(abilityName),
				input: withOptionalDescription(
					getObjectSchema(schemas.input, abilityDeleteInputSchema.shape.input),
					"Optional primitive input value for DELETE execution",
				).optional(),
			});
		},
	);

	if (variants.length > 0) {
		return withOptionalDescription(
			buildDiscriminatedUnion("name", variants),
			"Execute a destructive WordPress ability",
		);
	}

	return abilityDeleteInputSchema;
}
