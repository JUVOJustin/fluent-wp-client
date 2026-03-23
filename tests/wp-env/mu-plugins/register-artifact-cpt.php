<?php
/**
 * Registers an `artifact` custom post type for sparse REST coverage.
 *
 * Exposes a post-like resource that deliberately disables title, editor,
 * excerpt, author, comments, and page-attribute supports so integration tests
 * can verify the client's flexible custom-post schema defaults.
 */
add_action( 'init', function () {
	register_post_type( 'artifact', [
		'label'        => 'Artifacts',
		'public'       => true,
		'show_in_rest' => true,
		'rest_base'    => 'artifacts',
		'supports'     => [],
	] );
} );

/**
 * Removes content-bearing fields from the sparse artifact REST schema.
 *
 * WordPress still exposes several post-style fields for generic post types, so
 * the test fixture trims them explicitly to model ACF-only resources.
 */
add_filter( 'rest_artifact_item_schema', function ( $schema ) {
	if ( ! isset( $schema['properties'] ) || ! is_array( $schema['properties'] ) ) {
		return $schema;
	}

	foreach ( [
		'title',
		'author',
		'content',
		'excerpt',
		'featured_media',
		'comment_status',
		'ping_status',
		'template',
		'class_list',
	] as $field ) {
		unset( $schema['properties'][ $field ] );
	}

	return $schema;
} );
