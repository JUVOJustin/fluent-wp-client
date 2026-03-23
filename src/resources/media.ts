import type { WordPressMedia } from '../schemas.js';
import type { WordPressMediaUploadInput } from '../types/client.js';
import type { WordPressRequestOverrides } from '../types/resources.js';
import type { MediaFilter } from '../types/filters.js';
import type { ExtensibleFilter, FetchResult, SerializedQueryParams, WordPressDeleteResult } from '../types/resources.js';
import type { WordPressWritePayload } from '../types/payloads.js';
import type { WordPressStandardSchema } from '../core/validation.js';
import { mediaSchema } from '../standard-schemas.js';
import {
  createCollectionResourceFactory,
  createCollectionCrudFactory,
  resolveMutationArguments,
  type ResourceDependencies,
  type CrudMethods,
} from '../core/resource-factories.js';
import { applyRequestOverrides } from '../core/request-overrides.js';

/**
 * Media methods including read operations, CRUD, and upload.
 */
export interface MediaMethods extends CrudMethods<WordPressMedia, WordPressWritePayload> {
  getMedia: (filter?: ExtensibleFilter<MediaFilter>, options?: WordPressRequestOverrides) => Promise<WordPressMedia[]>;
  getAllMedia: (filter?: Omit<ExtensibleFilter<MediaFilter>, 'page'>, options?: WordPressRequestOverrides) => Promise<WordPressMedia[]>;
  getMediaPaginated: (filter?: ExtensibleFilter<MediaFilter>, options?: WordPressRequestOverrides) => Promise<import('../types/resources.js').PaginatedResponse<WordPressMedia>>;
  getMediaItem: (id: number, options?: WordPressRequestOverrides) => Promise<WordPressMedia>;
  getMediaBySlug: (slug: string, options?: WordPressRequestOverrides) => Promise<WordPressMedia | undefined>;
  getImageUrl: (media: WordPressMedia, size?: string) => string;
  upload: (input: WordPressMediaUploadInput, requestOptions?: WordPressRequestOverrides) => Promise<WordPressMedia>;
}

/**
 * Creates all media resource methods (read + CRUD + upload).
 */
export function createMediaResource(deps: ResourceDependencies): MediaMethods {
  const readCore = createCollectionResourceFactory<WordPressMedia, ExtensibleFilter<MediaFilter>>('/media')(deps.fetchAPI, deps.fetchAPIPaginated);
  const baseCrud = createCollectionCrudFactory<WordPressMedia, WordPressWritePayload>('/media', mediaSchema as WordPressStandardSchema<WordPressMedia>)(deps);

  return {
    getMedia: readCore.list,
    getAllMedia: readCore.listAll,
    getMediaPaginated: readCore.listPaginated,
    getMediaItem: readCore.getById,
    getMediaBySlug: readCore.getBySlug,
    
    getImageUrl(media: WordPressMedia, size: string = 'full'): string {
      if (size === 'full' || !media.media_details.sizes[size]) {
        return media.source_url;
      }
      return media.media_details.sizes[size].source_url;
    },

    create: baseCrud.create,
    update: baseCrud.update,
    delete: baseCrud.delete,

    async upload(input: WordPressMediaUploadInput, requestOptions?: WordPressRequestOverrides): Promise<WordPressMedia> {
      const fileBody = input.file instanceof Blob
        ? input.file
        : input.file instanceof Uint8Array
          ? new Blob([new Uint8Array(input.file)], { type: input.mimeType ?? 'application/octet-stream' })
          : input.file instanceof ArrayBuffer
            ? new Blob([new Uint8Array(input.file)], { type: input.mimeType ?? 'application/octet-stream' })
          : input.file;

      const safeFilename = input.filename.replace(/"/g, '');
      const uploadHeaders: Record<string, string> = {
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
      };

      if (input.mimeType) {
        uploadHeaders['Content-Type'] = input.mimeType;
      }

      const created = await deps.executeMutation<WordPressMedia>(
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

      return baseCrud.update(created.id, metadata, undefined, requestOptions);
    },
  };
}
