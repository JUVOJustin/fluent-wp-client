import type {
  WordPressAuthor,
  WordPressMedia,
  WordPressPostLike,
} from '../schemas.js';
import type { WordPressMediaUploadInput } from '../types/client.js';
import type {
  AllMediaRelations,
  MediaResourceClient,
  PaginatedResponse,
  WordPressRequestOverrides,
} from '../types/resources.js';
import type { MediaFilter } from '../types/filters.js';
import type { ExtensibleFilter } from '../types/resources.js';
import type { WordPressWritePayload } from '../types/payloads.js';
import type { WordPressResourceDescription } from '../types/discovery.js';
import { mediaSchema } from '../standard-schemas.js';
import { BaseCrudResource } from '../core/resource-base.js';
import { applyRequestOverrides } from '../core/request-overrides.js';
import type { WordPressRuntime } from '../core/transport.js';
import {
  validateWithStandardSchema,
  type WordPressStandardSchema,
} from '../core/validation.js';
import { ResourceItemQueryBuilder } from '../builders/resource-item-relations.js';
import { resolveMutationArguments, resolveMutationSchema } from '../core/mutation-helpers.js';
import {
  createSingleExtractor,
  extractEmbeddedData,
  type PostRelationClient,
} from '../builders/relation-contracts.js';
import { createSchemaValidators, shouldSkipValidation } from './schema-validation.js';

const extractEmbeddedAuthor = createSingleExtractor(
  (item: unknown) => item as WordPressAuthor,
);

const extractEmbeddedPost = createSingleExtractor(
  (item: unknown) => item as WordPressPostLike,
);

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
    return new MediaResource({
      runtime,
      endpoint: '/media',
      defaultSchema: mediaSchema,
    });
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
   * Uploads a file to the WordPress media library.
   */
  async upload<TResponse = WordPressMedia>(
    input: WordPressMediaUploadInput,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TResponse> {
    const resolved = resolveMutationArguments<TResponse>(
      responseSchemaOrRequestOptions,
      requestOptions,
    );

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
      }, resolved.requestOptions),
      mediaSchema,
    );

    const metadata: Record<string, unknown> = {};

    if (input.title) metadata.title = input.title;
    if (input.caption) metadata.caption = input.caption;
    if (input.description) metadata.description = input.description;
    if (input.alt_text) metadata.alt_text = input.alt_text;
    if (input.status) metadata.status = input.status;

    if (Object.keys(metadata).length === 0) {
      if (!resolved.responseSchema) {
        return created as TResponse;
      }

      return validateWithStandardSchema(
        resolved.responseSchema,
        created,
        'WordPress mutation response validation failed',
      );
    }

    return this.update(
      created.id,
      metadata,
      resolved.responseSchema,
      resolved.requestOptions,
    );
  }
}

/**
 * Creates a typed media client with optional read and mutation validation.
 */
export function createMediaClient<TResource extends WordPressMedia = WordPressMedia>(
  resource: MediaResource,
  relationClient: PostRelationClient,
  responseSchema?: WordPressStandardSchema<TResource>,
  describeFn?: (options?: WordPressRequestOverrides) => Promise<WordPressResourceDescription>,
): MediaResourceClient<TResource, ExtensibleFilter<MediaFilter>, WordPressWritePayload, WordPressWritePayload> {
  const hasExplicitResponseSchema = responseSchema !== undefined;
  const validators = createSchemaValidators(
    (responseSchema ?? mediaSchema) as WordPressStandardSchema<TResource>,
    'Media response validation failed',
  );

  const builtInRelations = new Set<AllMediaRelations>(['author', 'post']);

  const resolveAuthorRelation = async (media: TResource): Promise<WordPressAuthor | null> => {
    const embeddedAuthor = extractEmbeddedAuthor(extractEmbeddedData(media, 'author'));

    if (embeddedAuthor) {
      return embeddedAuthor;
    }

    const authorId = (media as WordPressMedia).author;

    if (typeof authorId !== 'number' || authorId <= 0) {
      return null;
    }

    const usersClient = relationClient.users();
    let direct: WordPressAuthor | null = null;

    try {
      direct = await usersClient.item(authorId) ?? null;
    } catch {
      direct = null;
    }

    if (direct) {
      return direct;
    }

    const users = await usersClient.list({ include: [authorId], perPage: 1 }).catch(() => []);
    return users[0] ?? null;
  };

  const resolvePostRelation = async (media: TResource): Promise<WordPressPostLike | null> => {
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

  /**
   * Gets one media item by numeric ID or slug.
   */
  const loadMedia = async (
    idOrSlug: number | string,
    options?: WordPressRequestOverrides,
  ) => {
    const item = typeof idOrSlug === 'number'
      ? await resource.getById(idOrSlug, options)
      : await resource.getBySlug(idOrSlug, options);

    if (item === undefined) {
      return undefined;
    }

    return validators.validate(item as unknown);
  };

  const item = ((
    idOrSlug: number | string,
    options?: WordPressRequestOverrides,
  ) => new ResourceItemQueryBuilder(
    relationClient,
    () => loadMedia(idOrSlug, options),
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
  )) as MediaResourceClient<TResource, ExtensibleFilter<MediaFilter>, WordPressWritePayload, WordPressWritePayload>['item'];

  return {
    list: async (filter = {}, options) => {
      const items = await resource.list(filter, options);

      if (shouldSkipValidation(hasExplicitResponseSchema, filter)) {
        return items as TResource[];
      }

      return validators.validateCollection(items as unknown[]);
    },
    listAll: async (filter = {}, options) => {
      const items = await resource.listAll(filter, options);

      if (shouldSkipValidation(hasExplicitResponseSchema, filter)) {
        return items as TResource[];
      }

      return validators.validateCollection(items as unknown[]);
    },
    listPaginated: async (filter = {}, options) => {
      const result = await resource.listPaginated(filter, options);

      if (shouldSkipValidation(hasExplicitResponseSchema, filter)) {
        return result as PaginatedResponse<TResource>;
      }

      return {
        ...result,
        data: await validators.validateCollection(result.data as unknown[]),
      };
    },
    item,
    create: <TResponse = TResource>(
      input: WordPressWritePayload,
      responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
      requestOptions?: WordPressRequestOverrides,
    ) => {
      const resolved = resolveMutationSchema(
        responseSchemaOrRequestOptions,
        requestOptions,
        responseSchema as WordPressStandardSchema<TResponse> | undefined,
      );

      return resource.create<TResponse>(
        input,
        resolved.responseSchema,
        resolved.requestOptions,
      );
    },
    upload: <TResponse = TResource>(
      input: WordPressMediaUploadInput,
      responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
      requestOptions?: WordPressRequestOverrides,
    ) => {
      const resolved = resolveMutationSchema(
        responseSchemaOrRequestOptions,
        requestOptions,
        responseSchema as WordPressStandardSchema<TResponse> | undefined,
      );

      return resource.upload<TResponse>(
        input,
        resolved.responseSchema,
        resolved.requestOptions,
      );
    },
    update: <TResponse = TResource>(
      id: number,
      input: WordPressWritePayload,
      responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
      requestOptions?: WordPressRequestOverrides,
    ) => {
      const resolved = resolveMutationSchema(
        responseSchemaOrRequestOptions,
        requestOptions,
        responseSchema as WordPressStandardSchema<TResponse> | undefined,
      );

      return resource.update<TResponse>(
        id,
        input,
        resolved.responseSchema,
        resolved.requestOptions,
      );
    },
    delete: (id, options) => resource.delete(id, options),
    getImageUrl: (media, size) => resource.getImageUrl(media, size),
    describe: describeFn ?? (() => Promise.reject(new Error('describe() not available for this resource'))),
  };
}
