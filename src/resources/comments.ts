import { BaseCrudResource } from "../core/resource-base.js";
import type { WordPressRuntime } from "../core/transport.js";
import type { WordPressComment } from "../schemas.js";
import type { WordPressResourceDescription } from "../types/discovery.js";
import type { CommentsFilter } from "../types/filters.js";
import type { WordPressWritePayload } from "../types/payloads.js";
import type {
  CommentsResourceClient,
  ExtensibleFilter,
  WordPressRequestOverrides,
} from "../types/resources.js";
import { createSchemaValueGetter, describeUnavailable } from "./describe.js";

/**
 * WordPress comments resource with full CRUD support.
 */
export class CommentsResource extends BaseCrudResource<
  WordPressComment,
  ExtensibleFilter<CommentsFilter>,
  WordPressWritePayload,
  WordPressWritePayload
> {
  /**
   * Creates a comments resource instance.
   */
  static create(runtime: WordPressRuntime): CommentsResource {
    return new CommentsResource({ endpoint: "/comments", runtime });
  }
}

/**
 * Creates a typed comments client.
 */
export function createCommentsClient(
  resource: CommentsResource,
  describeFn?: (
    options?: WordPressRequestOverrides,
  ) => Promise<WordPressResourceDescription>,
): CommentsResourceClient<
  WordPressComment,
  ExtensibleFilter<CommentsFilter>,
  WordPressWritePayload,
  WordPressWritePayload
> {
  const describe = describeFn ?? describeUnavailable;

  return {
    create: (input, options) => resource.create(input, options),
    delete: (id, options) => resource.delete(id, options),
    describe,
    getSchemaValue: createSchemaValueGetter(describe),
    item: (id, options) => resource.getById(id, options),
    list: (filter = {}, options) => resource.list(filter, options),
    listAll: (filter = {}, options, listOptions) =>
      resource.listAll(filter, options, listOptions),
    listPaginated: (filter = {}, options) =>
      resource.listPaginated(filter, options),
    update: (id, input, options) => resource.update(id, input, options),
  };
}
