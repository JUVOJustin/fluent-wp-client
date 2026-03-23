import type { WordPressBlockParser } from '../blocks.js';
import type { WordPressPost, WordPressPostWriteBase } from '../schemas.js';
import type { WordPressRequestOverrides } from '../types/resources.js';
import type { ExtensibleFilter, FetchResult, SerializedQueryParams } from '../types/resources.js';
import type { PostsFilter } from '../types/filters.js';
import type { WordPressStandardSchema } from '../core/validation.js';
import { postSchema } from '../standard-schemas.js';
import {
  createPostLikeResourceFactory,
  createCollectionCrudFactory,
  type ResourceDependencies,
  type CrudMethods,
} from '../core/resource-factories.js';

const missingRawPostMessage =
  'Raw post content is unavailable. The current credentials may not have edit capabilities for this post.';

/**
 * Post methods including read operations and CRUD.
 */
export interface PostMethods extends CrudMethods<WordPressPost, WordPressPostWriteBase> {
  getPosts: (filter?: ExtensibleFilter<PostsFilter>, options?: WordPressRequestOverrides) => Promise<WordPressPost[]>;
  getAllPosts: (filter?: Omit<ExtensibleFilter<PostsFilter>, 'page'>, options?: WordPressRequestOverrides) => Promise<WordPressPost[]>;
  getPostsPaginated: (filter?: ExtensibleFilter<PostsFilter>, options?: WordPressRequestOverrides) => Promise<import('../types/resources.js').PaginatedResponse<WordPressPost>>;
  getPost: (id: number, options?: WordPressRequestOverrides) => import('../content-query.js').WordPressContentQuery<WordPressPost>;
  getPostBySlug: (slug: string, options?: WordPressRequestOverrides) => import('../content-query.js').WordPressContentQuery<WordPressPost | undefined>;
}

/**
 * Creates all post resource methods (read + CRUD).
 */
export function createPostsResource(
  deps: ResourceDependencies,
  defaultBlockParser?: WordPressBlockParser,
): PostMethods {
  const readCore = createPostLikeResourceFactory<WordPressPost, ExtensibleFilter<PostsFilter>>('posts', missingRawPostMessage)(
    deps.fetchAPI,
    deps.fetchAPIPaginated,
    defaultBlockParser,
  );

  const crudCore = createCollectionCrudFactory<WordPressPost, WordPressPostWriteBase>('/posts', postSchema as WordPressStandardSchema<WordPressPost>)(deps);

  return {
    getPosts: readCore.list,
    getAllPosts: readCore.listAll,
    getPostsPaginated: readCore.listPaginated,
    getPost: readCore.getById,
    getPostBySlug: readCore.getBySlug,
    create: crudCore.create,
    update: crudCore.update,
    delete: crudCore.delete,
  };
}
