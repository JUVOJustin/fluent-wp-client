<?php
/**
 * Registers one custom collection filter used to verify extensible client query params.
 */
function fluent_wp_register_title_search_collection_param( $params ) {
	$params['title_search'] = [
		'description' => 'Limit the result set to items whose title matches one search string.',
		'type'        => 'string',
	];

	return $params;
}

add_filter( 'rest_post_collection_params', 'fluent_wp_register_title_search_collection_param' );
add_filter( 'rest_book_collection_params', 'fluent_wp_register_title_search_collection_param' );

/**
 * Maps the custom `title_search` REST param to one title-only WordPress query.
 */
function fluent_wp_apply_title_search_collection_param( $args, $request ) {
	$title_search = $request->get_param( 'title_search' );

	if ( ! is_string( $title_search ) || '' === $title_search ) {
		return $args;
	}

	$args['s']              = $title_search;
	$args['search_columns'] = [ 'post_title' ];

	return $args;
}

add_filter( 'rest_post_query', 'fluent_wp_apply_title_search_collection_param', 10, 2 );
add_filter( 'rest_book_query', 'fluent_wp_apply_title_search_collection_param', 10, 2 );
