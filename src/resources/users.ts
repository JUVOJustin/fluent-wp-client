import { createAuthError } from "../core/errors.js";
import { normalizeDeleteResult } from "../core/params.js";
import { applyRequestOverrides } from "../core/request-overrides.js";
import { BaseCrudResource } from "../core/resource-base.js";
import type { WordPressRuntime } from "../core/transport.js";
import type { WordPressAuthor } from "../schemas.js";
import type { WordPressResourceDescription } from "../types/discovery.js";
import type { UsersFilter } from "../types/filters.js";
import type { UserDeleteOptions, UserWriteInput } from "../types/payloads.js";
import type {
  ExtensibleFilter,
  UsersResourceClient,
  WordPressRequestOverrides,
} from "../types/resources.js";
import { describeUnavailable } from "./describe.js";

/**
 * WordPress users resource with CRUD support and `/me` access.
 */
export class UsersResource extends BaseCrudResource<
  WordPressAuthor,
  ExtensibleFilter<UsersFilter>,
  UserWriteInput,
  UserWriteInput
> {
  /**
   * Creates a users resource instance.
   */
  static create(runtime: WordPressRuntime): UsersResource {
    return new UsersResource({ endpoint: "/users", runtime });
  }

  /**
   * Gets the current authenticated user.
   */
  async me(
    requestOptions?: WordPressRequestOverrides,
  ): Promise<WordPressAuthor> {
    if (!this.runtime.hasAuth()) {
      throw createAuthError(
        "Authentication required for /users/me endpoint. Configure auth in client options.",
        { endpoint: "/users/me", operation: "users.me" },
      );
    }

    return this.runtime.fetchAPI<WordPressAuthor>(
      "/users/me",
      undefined,
      requestOptions,
    );
  }

  /**
   * Deletes a user with optional reassignment behavior.
   */
  override async delete(
    id: number,
    options: WordPressRequestOverrides & UserDeleteOptions = {},
  ) {
    const params: Record<string, string> = {};

    if (options.force) {
      params.force = "true";
    }

    if (typeof options.reassign === "number") {
      params.reassign = String(options.reassign);
    }

    const { data } = await this.runtime.request<unknown>(
      applyRequestOverrides(
        {
          endpoint: `${this.endpoint}/${id}`,
          method: "DELETE",
          params: Object.keys(params).length > 0 ? params : undefined,
        },
        options,
      ),
    );

    return normalizeDeleteResult(id, data);
  }
}

/**
 * Creates a typed users client.
 */
export function createUsersClient(
  resource: UsersResource,
  describeFn?: (
    options?: WordPressRequestOverrides,
  ) => Promise<WordPressResourceDescription>,
): UsersResourceClient<
  WordPressAuthor,
  ExtensibleFilter<UsersFilter>,
  UserWriteInput,
  UserWriteInput
> {
  const item = ((
    idOrSlug: number | string,
    options?: WordPressRequestOverrides,
  ): Promise<WordPressAuthor | undefined> => {
    return typeof idOrSlug === "number"
      ? resource.getById(idOrSlug, options)
      : resource.getBySlug(idOrSlug, options);
  }) as UsersResourceClient<
    WordPressAuthor,
    ExtensibleFilter<UsersFilter>,
    UserWriteInput,
    UserWriteInput
  >["item"];

  return {
    create: (input, options) => resource.create(input, options),
    delete: (id, options) => resource.delete(id, options),
    describe: describeFn ?? describeUnavailable,
    item,
    list: (filter = {}, options) => resource.list(filter, options),
    listAll: (filter = {}, options, listOptions) =>
      resource.listAll(filter, options, listOptions),
    listPaginated: (filter = {}, options) =>
      resource.listPaginated(filter, options),
    me: (options) => resource.me(options),
    update: (id, input, options) => resource.update(id, input, options),
  };
}
