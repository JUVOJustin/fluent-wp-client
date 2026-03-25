import type { QueryParamValue, QueryParams } from '../types/resources.js';

interface EmbeddableQueryParams extends QueryParams {
  embed?: boolean;
  _embed?: QueryParamValue;
}

/**
 * Normalizes the public `embed` toggle to the WordPress `_embed` query param.
 */
export function resolveEmbedQueryParams(
  params: QueryParams = {},
  options: {
    defaultEmbed?: boolean;
  } = {},
): QueryParams {
  const { defaultEmbed = false } = options;
  const { embed, _embed, ...rest } = params as EmbeddableQueryParams;

  if (embed === true) {
    return {
      ...rest,
      _embed: 'true',
    };
  }

  if (embed === false) {
    return rest;
  }

  if (_embed !== undefined) {
    return {
      ...rest,
      _embed,
    };
  }

  if (defaultEmbed) {
    return {
      ...rest,
      _embed: 'true',
    };
  }

  return rest;
}
