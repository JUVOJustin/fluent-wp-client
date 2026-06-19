import { createAuthError } from "../core/errors.js";
import {
  compactPayload,
  filterToParams,
  normalizeDeleteResult,
} from "../core/params.js";
import { applyRequestOverrides } from "../core/request-overrides.js";
import { BaseCrudResource } from "../core/resource-base.js";
import type { WordPressRuntime } from "../core/transport.js";
import type {
  WordPressApplicationPassword,
  WordPressAuthor,
} from "../schemas.js";
import type { WordPressResourceDescription } from "../types/discovery.js";
import type { UsersFilter } from "../types/filters.js";
import type {
  ApplicationPasswordCreateInput,
  ApplicationPasswordUpdateInput,
  UserDeleteOptions,
  UserWriteInput,
} from "../types/payloads.js";
import type {
  ApplicationPasswordRequestOptions,
  ApplicationPasswordsResourceClient,
  ExtensibleFilter,
  QueryParams,
  UsersResourceClient,
  WordPressApplicationPasswordDeleteResult,
  WordPressApplicationPasswordsDeleteAllResult,
  WordPressRequestOverrides,
  WordPressUserRef,
} from "../types/resources.js";
import { createSchemaValueGetter, describeUnavailable } from "./describe.js";
import { createSchemaToolMethods } from "./schema-tools.js";

/**
 * WordPress Application Passwords sub-resource scoped to one user.
 */
export class ApplicationPasswordsResource {
  private readonly endpoint: string;
  private readonly runtime: WordPressRuntime;

  /**
   * Creates a scoped Application Passwords resource instance.
   */
  constructor(context: { endpoint: string; runtime: WordPressRuntime }) {
    this.endpoint = context.endpoint;
    this.runtime = context.runtime;
  }

  /**
   * Creates an Application Passwords resource instance for one user reference.
   */
  static create(
    runtime: WordPressRuntime,
    userRef: WordPressUserRef,
  ): ApplicationPasswordsResource {
    return new ApplicationPasswordsResource({
      endpoint: `/users/${encodeURIComponent(String(userRef))}/application-passwords`,
      runtime,
    });
  }

  /**
   * Lists Application Passwords for the scoped user.
   */
  async list(
    options?: ApplicationPasswordRequestOptions,
  ): Promise<WordPressApplicationPassword[]> {
    const { params, requestOverrides } = this.resolveReadOptions(options);

    return this.runtime.fetchAPI<WordPressApplicationPassword[]>(
      this.endpoint,
      params,
      requestOverrides,
    );
  }

  /**
   * Creates one Application Password for the scoped user.
   */
  async create(
    input: ApplicationPasswordCreateInput,
    options?: WordPressRequestOverrides,
  ): Promise<WordPressApplicationPassword> {
    const { data } = await this.runtime.request<unknown>(
      applyRequestOverrides(
        {
          body: compactPayload(input),
          endpoint: this.endpoint,
          method: "POST",
        },
        options,
      ),
    );

    return data as WordPressApplicationPassword;
  }

  /**
   * Gets one Application Password by UUID.
   */
  async get(
    uuid: string,
    options?: ApplicationPasswordRequestOptions,
  ): Promise<WordPressApplicationPassword> {
    const { params, requestOverrides } = this.resolveReadOptions(options);

    return this.runtime.fetchAPI<WordPressApplicationPassword>(
      this.itemEndpoint(uuid),
      params,
      requestOverrides,
    );
  }

  /**
   * Updates one Application Password by UUID.
   */
  async update(
    uuid: string,
    input: ApplicationPasswordUpdateInput,
    options?: WordPressRequestOverrides,
  ): Promise<WordPressApplicationPassword> {
    const { data } = await this.runtime.request<unknown>(
      applyRequestOverrides(
        {
          body: compactPayload(input),
          endpoint: this.itemEndpoint(uuid),
          method: "POST",
        },
        options,
      ),
    );

    return data as WordPressApplicationPassword;
  }

  /**
   * Deletes one Application Password by UUID.
   */
  async delete(
    uuid: string,
    options?: WordPressRequestOverrides,
  ): Promise<WordPressApplicationPasswordDeleteResult> {
    const { data } = await this.runtime.request<unknown>(
      applyRequestOverrides(
        {
          endpoint: this.itemEndpoint(uuid),
          method: "DELETE",
        },
        options,
      ),
    );

    return this.normalizeDeleteResult(uuid, data);
  }

  /**
   * Deletes every Application Password for the scoped user.
   */
  async deleteAll(
    options?: WordPressRequestOverrides,
  ): Promise<WordPressApplicationPasswordsDeleteAllResult> {
    const { data } =
      await this.runtime.request<WordPressApplicationPasswordsDeleteAllResult>(
        applyRequestOverrides(
          {
            endpoint: this.endpoint,
            method: "DELETE",
          },
          options,
        ),
      );

    return data;
  }

  /**
   * Gets the Application Password used for the current authenticated request.
   */
  async introspect(
    options?: ApplicationPasswordRequestOptions,
  ): Promise<WordPressApplicationPassword> {
    const { params, requestOverrides } = this.resolveReadOptions(options);

    return this.runtime.fetchAPI<WordPressApplicationPassword>(
      `${this.endpoint}/introspect`,
      params,
      requestOverrides,
    );
  }

  /**
   * Resolves a UUID-specific Application Password endpoint.
   */
  private itemEndpoint(uuid: string): string {
    return `${this.endpoint}/${encodeURIComponent(uuid)}`;
  }

  /**
   * Normalizes WordPress' UUID-keyed delete response shape.
   */
  private normalizeDeleteResult(
    uuid: string,
    data: unknown,
  ): WordPressApplicationPasswordDeleteResult {
    if (
      typeof data === "object" &&
      data !== null &&
      "deleted" in data &&
      (data as Record<string, unknown>).deleted === true
    ) {
      return {
        deleted: true,
        previous: (data as Record<string, unknown>)
          .previous as WordPressApplicationPassword,
        uuid,
      };
    }

    return { deleted: false, uuid };
  }

  /**
   * Separates read query params from transport-level request overrides.
   */
  private resolveReadOptions(options?: ApplicationPasswordRequestOptions): {
    params: Record<string, string | string[]>;
    requestOverrides?: WordPressRequestOverrides;
  } {
    const { context, fields, ...requestOverrides } = options ?? {};
    const params = filterToParams({ context, fields } as QueryParams, {
      applyPerPageDefault: false,
    });

    return {
      params,
      requestOverrides,
    };
  }
}

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
   * Creates an Application Passwords resource scoped to one user.
   */
  applicationPasswords(
    userRef: WordPressUserRef,
  ): ApplicationPasswordsResource {
    return ApplicationPasswordsResource.create(this.runtime, userRef);
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
    options?: WordPressRequestOverrides & { fields?: string[] },
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

  const describe = describeFn ?? describeUnavailable;

  return {
    ...createSchemaToolMethods(describe),
    applicationPasswords: (userRef) => {
      const passwords = resource.applicationPasswords(userRef);

      return {
        create: (input, options) => passwords.create(input, options),
        delete: (uuid, options) => passwords.delete(uuid, options),
        deleteAll: (options) => passwords.deleteAll(options),
        get: (uuid, options) => passwords.get(uuid, options),
        introspect: (options) => passwords.introspect(options),
        list: (options) => passwords.list(options),
        update: (uuid, input, options) =>
          passwords.update(uuid, input, options),
      } satisfies ApplicationPasswordsResourceClient;
    },
    create: (input, options) => resource.create(input, options),
    delete: (id, options) => resource.delete(id, options),
    describe,
    getSchemaValue: createSchemaValueGetter(describe),
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
