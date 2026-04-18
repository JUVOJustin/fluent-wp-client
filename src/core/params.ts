import type { WordPressWritePayload } from "../types/payloads.js";
import type {
	QueryParams,
	QueryParamValue,
	SerializedQueryParams,
	WordPressDeleteResult,
} from "../types/resources.js";

interface EmbeddableQueryParams extends QueryParams {
	embed?: boolean | string[];
	_embed?: QueryParamValue;
}

/**
 * Normalizes the public `embed` option to the WordPress `_embed` query param.
 *
 * - `true` sends `_embed=true` (all embeddable link relations).
 * - A string array sends a comma-separated list, e.g. `_embed=author,wp:term`.
 */
export function resolveEmbedQueryParams(
	params: QueryParams = {},
	options: {
		defaultEmbed?: boolean;
	} = {},
): QueryParams {
	const { defaultEmbed = false } = options;
	const { embed, _embed, ...rest } = params as EmbeddableQueryParams;

	if (Array.isArray(embed) && embed.length > 0) {
		return {
			...rest,
			_embed: embed.join(","),
		};
	}

	if (embed === true) {
		return {
			...rest,
			_embed: "true",
		};
	}

	if (embed === false) {
		return rest;
	}

	if (_embed !== undefined) {
		return {
			...rest,
			_embed,
		};
	}

	if (defaultEmbed) {
		return {
			...rest,
			_embed: "true",
		};
	}

	return rest;
}

/**
 * Converts one filter object to WordPress API query params.
 */
export function filterToParams(
	filter: QueryParams,
	options: {
		applyPerPageDefault?: boolean;
	} = {},
): SerializedQueryParams {
	const params: SerializedQueryParams = {};

	for (const [key, value] of Object.entries(filter)) {
		if (value === undefined || value === null) {
			continue;
		}

		// `fields` maps to the WordPress `_fields` query parameter.
		const apiKey =
			key === "fields"
				? "_fields"
				: key.replace(/([A-Z])/g, "_$1").toLowerCase();

		if (Array.isArray(value)) {
			params[apiKey] = value.map((item) => String(item));
			continue;
		}

		if (typeof value === "boolean") {
			params[apiKey] = value ? "true" : "false";
			continue;
		}

		params[apiKey] = String(value);
	}

	if (options.applyPerPageDefault !== false && params.per_page === undefined) {
		params.per_page = "100";
	}

	return params;
}

/**
 * Normalizes a raw WordPress delete response into a typed WordPressDeleteResult.
 *
 * WordPress returns `{ deleted: true, previous: {...} }` on success and a
 * non-deleted object (or redirect) when the delete was conditional. This helper
 * centralizes that check so individual resource methods don't repeat it.
 */
export function normalizeDeleteResult(
	id: number,
	data: unknown,
): WordPressDeleteResult {
	if (
		typeof data === "object" &&
		data !== null &&
		"deleted" in data &&
		(data as Record<string, unknown>).deleted === true
	) {
		return {
			id,
			deleted: true,
			previous: (data as Record<string, unknown>).previous,
		};
	}

	return { id, deleted: false };
}

/**
 * Removes undefined values before a payload is sent to WordPress.
 */
export function compactPayload<T extends WordPressWritePayload>(input: T): T {
	const payload = {} as T;

	for (const [key, value] of Object.entries(input)) {
		if (value === undefined) {
			continue;
		}

		payload[key as keyof T] = value as T[keyof T];
	}

	return payload;
}
