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
import { describeUnavailable } from "./describe.js";

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
		return new CommentsResource({ runtime, endpoint: "/comments" });
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
	return {
		list: (filter = {}, options) => resource.list(filter, options),
		listAll: (filter = {}, options, listOptions) =>
			resource.listAll(filter, options, listOptions),
		listPaginated: (filter = {}, options) =>
			resource.listPaginated(filter, options),
		create: (input, options) => resource.create(input, options),
		update: (id, input, options) => resource.update(id, input, options),
		item: (id, options) => resource.getById(id, options),
		delete: (id, options) => resource.delete(id, options),
		describe: describeFn ?? describeUnavailable,
	};
}
