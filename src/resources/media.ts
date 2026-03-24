import type { WordPressMedia } from '../schemas.js';
import type { WordPressMediaUploadInput } from '../types/client.js';
import type { WordPressRequestOverrides, PaginatedResponse } from '../types/resources.js';
import type { MediaFilter } from '../types/filters.js';
import type { ExtensibleFilter } from '../types/resources.js';
import type { WordPressWritePayload } from '../types/payloads.js';
import { mediaSchema } from '../standard-schemas.js';
import { BaseCrudResource } from '../core/resource-base.js';
import { applyRequestOverrides } from '../core/request-overrides.js';
import type { WordPressRuntime } from '../core/transport.js';

/**
 * WordPress media resource with full CRUD and upload support.
 * 
 * @example
 * ```typescript
 * const media = MediaResource.create(runtime);
 * const allMedia = await media.getMedia();
 * const uploaded = await media.upload({ file: blob, filename: 'image.jpg' });
 * ```
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
    return new MediaResource({
      runtime,
      endpoint: '/media',
      defaultSchema: mediaSchema,
    });
  }

  /**
   * Alias for list() - gets media items matching filter.
   */
  getMedia(filter?: ExtensibleFilter<MediaFilter>, options?: WordPressRequestOverrides): Promise<WordPressMedia[]> {
    return this.list(filter, options);
  }

  /**
   * Alias for listAll() - gets all media via pagination.
   */
  getAllMedia(
    filter?: Omit<ExtensibleFilter<MediaFilter>, 'page'>,
    options?: WordPressRequestOverrides,
  ): Promise<WordPressMedia[]> {
    return this.listAll(filter, options);
  }

  /**
   * Alias for listPaginated() - gets media with pagination metadata.
   */
  getMediaPaginated(
    filter?: ExtensibleFilter<MediaFilter>,
    options?: WordPressRequestOverrides,
  ): Promise<PaginatedResponse<WordPressMedia>> {
    return this.listPaginated(filter, options);
  }

  /**
   * Alias for getById() - gets media by ID.
   */
  getMediaItem(id: number, options?: WordPressRequestOverrides): Promise<WordPressMedia> {
    return this.getById(id, options);
  }

  /**
   * Alias for getBySlug() - gets media by slug.
   */
  getMediaBySlug(slug: string, options?: WordPressRequestOverrides): Promise<WordPressMedia | undefined> {
    return this.getBySlug(slug, options);
  }

  /**
   * Gets the URL for a specific image size.
   */
  getImageUrl(media: WordPressMedia, size: string = 'full'): string {
    if (size === 'full' || !media.media_details.sizes[size]) {
      return media.source_url;
    }
    return media.media_details.sizes[size].source_url;
  }

  /**
   * Uploads a file to WordPress media library.
   */
  async upload(input: WordPressMediaUploadInput, requestOptions?: WordPressRequestOverrides): Promise<WordPressMedia> {
    const fileBody = input.file instanceof Blob
      ? input.file
      : input.file instanceof Uint8Array
        ? new Blob([new Uint8Array(input.file)], { type: input.mimeType ?? 'application/octet-stream' })
        : input.file instanceof ArrayBuffer
          ? new Blob([new Uint8Array(input.file)], { type: input.mimeType ?? 'application/octet-stream' })
          : input.file;

    const safeFilename = input.filename.replace(/[\x00-\x1F\x7F"]/g, '');
    const uploadHeaders: Record<string, string> = {
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
    };

    if (input.mimeType) {
      uploadHeaders['Content-Type'] = input.mimeType;
    }

    const created = await this.executeMutation<WordPressMedia>(
      applyRequestOverrides({
        endpoint: '/media',
        method: 'POST',
        rawBody: fileBody,
        headers: uploadHeaders,
        omitContentType: true,
      }, requestOptions, 'Mutation helper options'),
      mediaSchema,
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
