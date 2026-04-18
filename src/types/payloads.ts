/**
 * Shared payload shape used for create/update operations.
 */
export type WordPressWritePayload = Record<string, unknown>;

/**
 * Payload for creating/updating term resources.
 */
export interface TermWriteInput {
	name?: string;
	slug?: string;
	description?: string;
	parent?: number;
	meta?: Record<string, unknown>;
	[key: string]: unknown;
}

/**
 * Payload for creating/updating users.
 */
export interface UserWriteInput {
	username?: string;
	email?: string;
	password?: string;
	name?: string;
	first_name?: string;
	last_name?: string;
	nickname?: string;
	description?: string;
	roles?: string[];
	url?: string;
	[key: string]: unknown;
}

/**
 * Shared delete options used by endpoints that support force-deleting.
 */
export interface DeleteOptions {
	force?: boolean;
}

/**
 * Payload for deleting users.
 */
export interface UserDeleteOptions extends DeleteOptions {
	reassign?: number;
}
