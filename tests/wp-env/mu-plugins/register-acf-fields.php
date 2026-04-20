<?php
/**
 * Registers ACF field groups for integration testing.
 *
 * Creates a single field group — "Test Content Fields" — applied to posts,
 * pages, the book CPT, and the sparse artifact CPT. The group includes:
 *   - Scalar fields: text (subtitle), textarea (summary), number (priority_score), url (external_url)
 *   - Relationship field: acf_related_posts — returns post objects so the REST
 *     response includes ACF's _link property pointing to each post's REST endpoint.
 *   - Post object field: acf_featured_post — single post object; REST response
 *     similarly includes _link.
 *   - Taxonomy field: acf_related_genres — multi-select custom taxonomy field;
 *     REST response includes ACF term links for related genres.
 *   - Status field: acf_status — select field that exercises the choice-label
 *     enrichment hook below.
 *
 * Only runs when ACF is active (guarded by the acf/init action and an
 * existence check on acf_add_local_field_group). show_in_rest exposes all
 * fields under the `acf` key in WP REST API responses.
 */
add_action( 'acf/init', function () {
	if ( ! function_exists( 'acf_add_local_field_group' ) ) {
		return;
	}

	acf_add_local_field_group( [
		'key'   => 'group_test_content_fields',
		'title' => 'Test Content Fields',

		'fields' => [

			// ── Subtitle (text) ─────────────────────────────────────────────────
			[
				'key'          => 'field_acf_subtitle',
				'name'         => 'acf_subtitle',
				'label'        => 'Subtitle',
				'description'  => 'Short editorial subtitle shown in teasers and supporting headings.',
				'instructions' => 'Short editorial subtitle shown in teasers and supporting headings.',
				'type'         => 'text',
			],

			// ── Summary (textarea) ───────────────────────────────────────────────
			[
				'key'          => 'field_acf_summary',
				'name'         => 'acf_summary',
				'label'        => 'Summary',
				'description'  => 'Brief summary used for condensed editorial previews.',
				'instructions' => 'Brief summary used for condensed editorial previews.',
				'type'         => 'textarea',
				'rows'         => 4,
			],

			// ── Priority Score (number, 0–100) ──────────────────────────────────
			[
				'key'          => 'field_acf_priority_score',
				'name'         => 'acf_priority_score',
				'label'        => 'Priority Score',
				'description'  => 'Editorial priority score from 0 to 100 used to rank featured content.',
				'instructions' => 'Editorial priority score from 0 to 100 used to rank featured content.',
				'type'         => 'number',
				'min'          => 0,
				'max'          => 100,
			],

			// ── External URL (url) ───────────────────────────────────────────────
			[
				'key'          => 'field_acf_external_url',
				'name'         => 'acf_external_url',
				'label'        => 'External URL',
				'description'  => 'Canonical external URL referenced by the content item.',
				'instructions' => 'Canonical external URL referenced by the content item.',
				'type'         => 'url',
			],

			// ── Related Posts (relationship) ─────────────────────────────────────
			// return_format=object causes ACF to format each related post as a
			// full post object in the REST response, including a _link property
			// with the WP REST API URL for that post.
			[
				'key'           => 'field_acf_related_posts',
				'name'          => 'acf_related_posts',
				'label'         => 'Related Posts',
				'description'   => 'Related posts that should appear alongside this item in editorial contexts.',
				'instructions'  => 'Related posts that should appear alongside this item in editorial contexts.',
				'type'          => 'relationship',
				'post_type'     => [ 'post' ],
				'return_format' => 'object',
				'min'           => 0,
				'max'           => 5,
			],

			// ── Featured Post (post_object) ──────────────────────────────────────
			// Single post object reference; REST response includes _link.
			[
				'key'           => 'field_acf_featured_post',
				'name'          => 'acf_featured_post',
				'label'         => 'Featured Post',
				'description'   => 'Primary related post highlighted as the featured recommendation.',
				'instructions'  => 'Primary related post highlighted as the featured recommendation.',
				'type'          => 'post_object',
				'post_type'     => [ 'post' ],
				'return_format' => 'object',
				'allow_null'    => 1,
			],

			// ── Related Genres (taxonomy) ────────────────────────────────────────
			// Multi-select taxonomy relation; REST response includes term links.
			[
				'key'           => 'field_acf_related_genres',
				'name'          => 'acf_related_genres',
				'label'         => 'Related Genres',
				'description'   => 'Genre taxonomy terms related to this content item.',
				'instructions'  => 'Genre taxonomy terms related to this content item.',
				'type'          => 'taxonomy',
				'taxonomy'      => 'genre',
				'field_type'    => 'multi_select',
				'return_format' => 'object',
				'allow_null'    => 1,
				'load_terms'    => 0,
				'save_terms'    => 0,
			],

			// ── Editorial Status (select) ────────────────────────────────────────
			// Exercises the custom choice-label enrichment snippet that the
			// docs ship under "Plugin support → ACF". Without that snippet ACF
			// does not expose the choice slug → label mapping through REST.
			[
				'key'           => 'field_acf_status',
				'name'          => 'acf_status',
				'label'         => 'Editorial Status',
				'description'   => 'Editorial workflow status used to pace publishing decisions.',
				'instructions'  => 'Editorial workflow status used to pace publishing decisions.',
				'type'          => 'select',
				'return_format' => 'value',
				'choices'       => [
					'draft'  => 'Draft',
					'ready'  => 'Ready for review',
					'queued' => 'Queued for publish',
				],
				'default_value' => 'draft',
				'allow_null'    => 0,
			],
		],

		// Applies to posts, pages, the book CPT, and the sparse artifact CPT.
		'location' => [
			[ [ 'param' => 'post_type', 'operator' => '==', 'value' => 'post' ] ],
			[ [ 'param' => 'post_type', 'operator' => '==', 'value' => 'page' ] ],
			[ [ 'param' => 'post_type', 'operator' => '==', 'value' => 'book' ] ],
			[ [ 'param' => 'post_type', 'operator' => '==', 'value' => 'artifact' ] ],
		],

		// Expose all fields in the `acf` key of WP REST API responses.
		'show_in_rest' => 1,
	] );

	/*
	 * Custom enrichment for ACF REST schemas.
	 *
	 * ACF does not surface field descriptions or choice labels through its
	 * default REST schema. This filter mirrors both into the schema so the
	 * fluent-wp-client discovery catalog and AI SDK tool schemas can reason
	 * about them. The same snippet ships in docs/plugin-support/acf.mdx as
	 * the recommended integration for end users.
	 */
	add_filter(
		'acf/rest/get_field_schema',
		static function ( array $schema, array $field ): array {
			if ( ! empty( $field['description'] ) ) {
				$schema['description'] = $field['description'];
			}

			$choice_field_types = [ 'select', 'radio', 'checkbox', 'button_group' ];

			if (
				isset( $field['type'], $field['choices'] )
				&& in_array( $field['type'], $choice_field_types, true )
				&& is_array( $field['choices'] )
				&& ! empty( $field['choices'] )
			) {
				$schema['choices'] = array_map(
					static fn ( $value, $label ): array => [
						'value' => (string) $value,
						'label' => (string) $label,
					],
					array_keys( $field['choices'] ),
					array_values( $field['choices'] )
				);
			}

			return $schema;
		},
		10,
		2
	);
} );
