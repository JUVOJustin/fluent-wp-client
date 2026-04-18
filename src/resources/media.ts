import { applyRequestOverrides } from "../core/request-overrides.js";
import { BaseCrudResource } from "../core/resource-base.js";
import type { WordPressRuntime } from "../core/transport.js";
import type { WordPressMedia } from "../schemas.js";
import type { WordPressMediaUploadInput } from "../types/client.js";
import type { WordPressResourceDescription } from "../types/discovery.js";
import type { MediaFilter } from "../types/filters.js";
import type { WordPressWritePayload } from "../types/payloads.js";
import type {
	ExtensibleFilter,
	MediaResourceClient,
	WordPressRequestOverrides,
} from "../types/resources.js";
import { describeUnavailable } from "./describe.js";

/**
 * WordPress media resource with CRUD operations and binary uploads.
 */
export class MediaResource extends BaseCrudResource<
	WordPressMedia,
	ExtensibleFilter<MediaFilter>,
	WordPressWritePayload,
	WordPressWritePayload
> {
	/**
	 * Creates a media resource instance.
	 */
	static create(runtime: WordPressRuntime): MediaResource {
		return new MediaResource({ runtime, endpoint: "/media" });
	}

	/**
	 * Gets the URL for a specific image size.
	 */
	getImageUrl(media: WordPressMedia, size: string = "full"): string {
		const sizedMedia = media.media_details?.sizes?.[size];

		if (size === "full" || !sizedMedia) {
			return media.source_url;
		}

		return sizedMedia.source_url;
	}

	/**
	 * Uploads a file to the WordPress media library and optionally applies metadata in a second request.
	 */
	async upload(
		input: WordPressMediaUploadInput,
		requestOptions?: WordPressRequestOverrides,
	): Promise<WordPressMedia> {
		const fileBody =
			input.file instanceof Blob
				? input.file
				: input.file instanceof Uint8Array
					? new Blob([new Uint8Array(input.file)], {
							type: input.mimeType ?? "application/octet-stream",
						})
					: input.file instanceof ArrayBuffer
						? new Blob([new Uint8Array(input.file)], {
								type: input.mimeType ?? "application/octet-stream",
							})
						: input.file;

		const safeFilename = input.filename.replace(/[\x00-\x1F\x7F"]/g, "");
		const uploadHeaders: Record<string, string> = {
			"Content-Disposition": `attachment; filename="${safeFilename}"`,
		};

		if (input.mimeType) {
			uploadHeaders["Content-Type"] = input.mimeType;
		}

		const created = await this.executeMutation<WordPressMedia>(
			applyRequestOverrides(
				{
					endpoint: "/media",
					method: "POST",
					rawBody: fileBody,
					headers: uploadHeaders,
					omitContentType: true,
				},
				requestOptions,
			),
		);

		const metadata: Record<string, unknown> = {};

		if (input.title) metadata.title = input.title;
		if (input.caption) metadata.caption = input.caption;
		if (input.description) metadata.description = input.description;
		if (input.alt_text) metadata.alt_text = input.alt_text;
		if (input.status) metadata.status = input.status;

		if (Object.keys(metadata).length === 0) {
			return created;
		}

		return this.update(created.id, metadata, requestOptions);
	}
}

/**
 * Creates a typed media client.
 */
export function createMediaClient(
	resource: MediaResource,
	describeFn?: (
		options?: WordPressRequestOverrides,
	) => Promise<WordPressResourceDescription>,
): MediaResourceClient<
	WordPressMedia,
	ExtensibleFilter<MediaFilter>,
	WordPressWritePayload,
	WordPressWritePayload
> {
	const item = ((
		idOrSlug: number | string,
		options?: WordPressRequestOverrides,
	): Promise<WordPressMedia | undefined> => {
		return typeof idOrSlug === "number"
			? resource.getById(idOrSlug, options)
			: resource.getBySlug(idOrSlug, options);
	}) as MediaResourceClient<
		WordPressMedia,
		ExtensibleFilter<MediaFilter>,
		WordPressWritePayload,
		WordPressWritePayload
	>["item"];

	return {
		list: (filter = {}, options) => resource.list(filter, options),
		listAll: (filter = {}, options, listOptions) =>
			resource.listAll(filter, options, listOptions),
		listPaginated: (filter = {}, options) =>
			resource.listPaginated(filter, options),
		create: (input, options) => resource.create(input, options),
		update: (id, input, options) => resource.update(id, input, options),
		item,
		upload: (input, options) => resource.upload(input, options),
		delete: (id, options) => resource.delete(id, options),
		getImageUrl: (media, size) => resource.getImageUrl(media, size),
		describe: describeFn ?? describeUnavailable,
	};
}
