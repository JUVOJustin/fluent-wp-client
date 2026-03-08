<?php
/**
 * Registers a 'genre' taxonomy for custom taxonomy integration coverage.
 *
 * The taxonomy is exposed through the REST API at /wp-json/wp/v2/genre so the
 * client can exercise generic term CRUD helpers and WPAPI-style route chains.
 */
if ( function_exists( 'add_action' ) ) {
	$add_action = 'add_action';
	$add_action( 'init', function () {
		if ( ! function_exists( 'register_taxonomy' ) ) {
			return;
		}

		$register_taxonomy = 'register_taxonomy';
		$register_taxonomy( 'genre', [ 'book' ], [
			'label'        => 'Genres',
			'public'       => true,
			'hierarchical' => false,
			'show_in_rest' => true,
			'rest_base'    => 'genre',
		] );
	} );
}
