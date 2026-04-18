/**
 * Shared payload shape used for create/update operations.
 */
export type WordPressWritePayload = Record<string, unknown>;

/**
 * Payload for creating/updating term resources.
 */
export interface TermWriteInput {
  description?: string;
  meta?: Record<string, unknown>;
  name?: string;
  parent?: number;
  slug?: string;
  [key: string]: unknown;
}

/**
 * Payload for creating/updating users.
 */
export interface UserWriteInput {
  description?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  nickname?: string;
  password?: string;
  roles?: string[];
  url?: string;
  username?: string;
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
