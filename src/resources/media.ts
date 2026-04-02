import type {
  WordPressAuthor,
  WordPressMedia,
  WordPressPostLike,
} from '../schemas.js';
import type { WordPressMediaUploadInput } from '../types/client.js';
import type {
  AllMediaRelations,
  MediaResourceClient,
  WordPressRequestOverrides,
} from '../types/resources.js';
import type { MediaFilter } from '../types/filters.js';
import type { ExtensibleFilter } from '../types/resources.js';
import type { WordPressWritePayload } from '../types/payloads.js';
import type { WordPressResourceDescription } from '../types/discovery.js';
import { BaseCrudResource } from '../core/resource-base.js';
import { applyRequestOverrides } from '../core/request-overrides.js';
import { throwIfWordPressError } from '../core/errors.js';
import type { WordPressRuntime } from '../core/transport.js';
import { ResourceItemQueryBuilder } from '../builders/resource-item-relations.js';
import {
  extractEmbeddedData,
  type PostRelationClient,
} from '../builders/relation-contracts.js';
import {
  extractEmbeddedAuthor,
  extractEmbeddedPost,
  resolveAuthorById,
} from '../builders/item-relation-resolver.js';

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
    return new MediaResource({ runtime, endpoint: '/media' });
  }

  /**
   * Gets the URL for a specific image size.
   */
  getImageUrl(media: WordPressMedia, size: string = 'full'): string {
    const sizedMedia = media.media_details?.sizes?.[size];

    if (size === 'full' || !sizedMedia) {
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
      }, requestOptions),
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
  relationClient: PostRelationClient,
  describeFn?: (options?: WordPressRequestOverrides) => Promise<WordPressResourceDescription>,
): MediaResourceClient<WordPressMedia, ExtensibleFilter<MediaFilter>, WordPressWritePayload, WordPressWritePayload> {
  const builtInRelations = new Set<AllMediaRelations>(['author', 'post']);

  const resolveAuthorRelation = async (media: WordPressMedia): Promise<WordPressAuthor | null> => {
    const embeddedAuthor = extractEmbeddedAuthor(extractEmbeddedData(media, 'author'));

    if (embeddedAuthor) {
      return embeddedAuthor;
    }

    return resolveAuthorById(relationClient, (media as WordPressMedia).author);
  };

  const resolvePostRelation = async (media: WordPressMedia): Promise<WordPressPostLike | null> => {
    const embeddedPost = extractEmbeddedPost(extractEmbeddedData(media, 'post'))
      ?? extractEmbeddedPost(extractEmbeddedData(media, 'up'));

    if (embeddedPost) {
      return embeddedPost;
    }

    const links = (media as { _links?: Record<string, unknown> })._links;
    const linkedPostGroups = [links?.post, links?.up] as Array<unknown>;
    const linkedPostGroup = linkedPostGroups.find(Array.isArray) as Array<Record<string, unknown>> | undefined;
    const linkedPost = linkedPostGroup?.[0];

    if (linkedPost && relationClient.request && typeof linkedPost.href === 'string') {
      try {
        const { data, response } = await relationClient.request<WordPressPostLike>({
          endpoint: linkedPost.href,
          method: 'GET',
        });

        if (response.ok) {
          return data;
        }
      } catch {
        // Ignore link fetch failures and fall back to typed resource lookup when possible.
      }
    }

    const postId = (media as WordPressMedia & { post?: number }).post;
    const postType = typeof linkedPost?.post_type === 'string' ? linkedPost.post_type : undefined;

    if (typeof postId === 'number' && postId > 0 && postType) {
      try {
        const post = await relationClient.content(postType).item(postId);
        return post ?? null;
      } catch {
        return null;
      }
    }

    if (typeof postId === 'number' && postId > 0) {
      for (const resource of ['posts', 'pages']) {
        try {
          const post = await relationClient.content(resource).item(postId);

          if (post) {
            return post;
          }
        } catch {
          continue;
        }
      }
    }

    return null;
  };

  const item = ((
    idOrSlug: number | string,
    options?: WordPressRequestOverrides,
  ) => new ResourceItemQueryBuilder(
    relationClient,
    async () => {
      const loaded = typeof idOrSlug === 'number'
        ? await resource.getById(idOrSlug, options)
        : await resource.getBySlug(idOrSlug, options);
      return loaded;
    },
    builtInRelations,
    async (media, relationSet) => {
      const related: Record<string, unknown> = {};

      if (relationSet.has('author')) {
        related.author = await resolveAuthorRelation(media);
      }

      if (relationSet.has('post')) {
        related.post = await resolvePostRelation(media);
      }

      return related;
    },
  )) as MediaResourceClient<WordPressMedia, ExtensibleFilter<MediaFilter>, WordPressWritePayload, WordPressWritePayload>['item'];

  return {
    list: (filter = {}, options) => resource.list(filter, options),
    listAll: (filter = {}, options, listOptions) => resource.listAll(filter, options, listOptions),
    listPaginated: (filter = {}, options) => resource.listPaginated(filter, options),
    create: (input, options) => resource.create(input, options),
    update: (id, input, options) => resource.update(id, input, options),
    item,
    upload: (input, options) => resource.upload(input, options),
    delete: (id, options) => resource.delete(id, options),
    getImageUrl: (media, size) => resource.getImageUrl(media, size),
    describe: describeFn ?? (() => Promise.reject(new Error('describe() not available for this resource'))),
  };
}
