import { createAuthError } from "../core/errors.js";
import { compactPayload } from "../core/params.js";
import { applyRequestOverrides } from "../core/request-overrides.js";
import type { WordPressRuntime } from "../core/transport.js";
import type { WordPressSettings } from "../schemas.js";
import type { WordPressResourceDescription } from "../types/discovery.js";
import type {
	SettingsResourceClient,
	WordPressRequestOverrides,
} from "../types/resources.js";
import { describeUnavailable } from "./describe.js";

/**
 * WordPress settings singleton resource.
 */
export class SettingsResource {
	private readonly runtime: WordPressRuntime;
	private readonly endpoint = "/settings";

	constructor(runtime: WordPressRuntime) {
		this.runtime = runtime;
	}

	/**
	 * Creates a settings resource instance.
	 */
	static create(runtime: WordPressRuntime): SettingsResource {
		return new SettingsResource(runtime);
	}

	/**
	 * Ensures settings reads and writes only run when authentication is configured.
	 */
	private assertAuthenticated(): void {
		if (!this.runtime.hasAuth()) {
			throw createAuthError(
				"Authentication required for /settings endpoint. Configure auth in client options.",
				{ operation: "settings", endpoint: "/settings" },
			);
		}
	}

	/**
	 * Gets WordPress site settings.
	 */
	async get(
		requestOptions?: WordPressRequestOverrides,
	): Promise<WordPressSettings> {
		this.assertAuthenticated();

		const { data } = await this.runtime.request<unknown>(
			applyRequestOverrides(
				{
					endpoint: this.endpoint,
					method: "GET",
				},
				requestOptions,
			),
		);

		return data as WordPressSettings;
	}

	/**
	 * Updates WordPress site settings.
	 */
	async update(
		input: Partial<WordPressSettings> & Record<string, unknown>,
		options?: WordPressRequestOverrides,
	): Promise<WordPressSettings> {
		this.assertAuthenticated();

		const { data } = await this.runtime.request<unknown>(
			applyRequestOverrides(
				{
					endpoint: this.endpoint,
					method: "POST",
					body: compactPayload(input),
				},
				options,
			),
		);

		return data as WordPressSettings;
	}
}

/**
 * Creates a typed settings client.
 */
export function createSettingsClient(
	resource: SettingsResource,
	describeFn?: (
		options?: WordPressRequestOverrides,
	) => Promise<WordPressResourceDescription>,
): SettingsResourceClient<WordPressSettings> {
	return {
		get: (options) => resource.get(options),
		update: (input, options) => resource.update(input, options),
		describe: describeFn ?? describeUnavailable,
	};
}
