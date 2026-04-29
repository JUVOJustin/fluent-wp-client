import { BaseCrudResource } from "../core/resource-base.js";
import type { WordPressCategory } from "../schemas.js";
import type { WordPressResourceDescription } from "../types/discovery.js";
import type {
  TermWriteInput,
  WordPressWritePayload,
} from "../types/payloads.js";
import type {
  PaginatedResponse,
  PaginationParams,
  QueryParams,
  TermsResourceClient,
  WordPressRequestOverrides,
} from "../types/resources.js";
import { createSchemaValueGetter, describeUnavailable } from "./describe.js";

/**
 * Generic term resource for custom taxonomies.
 */
export class GenericTermResource<
  TTerm = WordPressCategory,
  TCreate extends WordPressWritePayload = TermWriteInput,
  TUpdate extends WordPressWritePayload = TCreate,
> extends BaseCrudResource<
  TTerm,
  QueryParams & PaginationParams,
  TCreate,
  TUpdate
> {
  /**
   * Gets one term by ID or slug.
   */
  async item(
    idOrSlug: number | string,
    options?: WordPressRequestOverrides & { fields?: string[] },
  ): Promise<TTerm | undefined> {
    return typeof idOrSlug === "number"
      ? this.getById(idOrSlug, options)
      : this.getBySlug(idOrSlug, options);
  }
}

/**
 * Creates a typed term client from one generic taxonomy resource.
 */
export function createTermsClient<TTerm>(
  resource: GenericTermResource<TTerm>,
  describeFn?: (
    options?: WordPressRequestOverrides,
  ) => Promise<WordPressResourceDescription>,
): TermsResourceClient<
  TTerm,
  QueryParams & PaginationParams,
  TermWriteInput,
  TermWriteInput
> {
  const describe = describeFn ?? describeUnavailable;

  return {
    create: (input, options) =>
      resource.create(input as TermWriteInput, options) as Promise<TTerm>,
    delete: (id, options) => resource.delete(id, options),
    describe,
    getSchemaValue: createSchemaValueGetter(describe),
    item: (idOrSlug, options) =>
      resource.item(idOrSlug, options) as Promise<TTerm | undefined>,
    list: (filter = {}, options) =>
      resource.list(
        filter as QueryParams & PaginationParams,
        options,
      ) as Promise<TTerm[]>,
    listAll: (filter = {}, options, listOptions) =>
      resource.listAll(
        filter as Omit<QueryParams & PaginationParams, "page">,
        options,
        listOptions,
      ) as Promise<TTerm[]>,
    listPaginated: (filter = {}, options) =>
      resource.listPaginated(
        filter as QueryParams & PaginationParams,
        options,
      ) as Promise<PaginatedResponse<TTerm>>,
    update: (id, input, options) =>
      resource.update(id, input as TermWriteInput, options) as Promise<TTerm>,
  };
}
