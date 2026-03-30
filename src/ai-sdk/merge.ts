/**
 * Deep-merges tool arguments following the defaultArgs -> modelArgs -> fixedArgs
 * precedence chain. Plain objects are merged recursively; all other values are
 * replaced by the higher-precedence source.
 */
export function mergeToolArgs<T extends Record<string, unknown>>(
  defaults: Partial<T> | undefined,
  model: T,
  fixed: Partial<T> | undefined,
): T {
  const base = defaults ? deepMerge({} as T, defaults as T) : ({} as T);
  const withModel = deepMerge(base, model);
  return fixed ? deepMerge(withModel, fixed as T) : withModel;
}

/**
 * Applies nested input defaults and overrides for mutation tool payloads.
 *
 * `defaultInput` merges under the model's `input` (model wins).
 * `fixedInput` merges over the model's `input` (fixed wins).
 */
export function mergeMutationInput<T extends Record<string, unknown>>(
  args: T & { input?: Record<string, unknown> },
  defaultInput: Record<string, unknown> | undefined,
  fixedInput: Record<string, unknown> | undefined,
): T {
  if (!defaultInput && !fixedInput) return args;

  const input = args.input ?? {};
  const base = defaultInput ? deepMerge({}, defaultInput) : {};
  const withModel = deepMerge(base, input);
  const merged = fixedInput ? deepMerge(withModel, fixedInput) : withModel;

  return { ...args, input: merged };
}

/**
 * Returns true when a value is a plain non-null, non-array object.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Recursively merges `source` into `target`, mutating and returning `target`.
 */
function deepMerge<T extends Record<string, unknown>>(target: T, source: T): T {
  for (const key of Object.keys(source) as Array<keyof T>) {
    const srcVal = source[key];
    const tgtVal = target[key];

    if (isPlainObject(srcVal) && isPlainObject(tgtVal)) {
      target[key] = deepMerge(
        tgtVal as Record<string, unknown>,
        srcVal as Record<string, unknown>,
      ) as T[keyof T];
    } else if (srcVal !== undefined) {
      target[key] = srcVal;
    }
  }

  return target;
}
