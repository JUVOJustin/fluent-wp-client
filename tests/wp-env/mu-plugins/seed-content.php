<?php
/**
 * Generates deterministic seed data for integration tests.
 *
 * Replaces the old `wp eval-file wp-content/seed-content.php` wp-cli step. wp-cli
 * is unavailable in the Playground runtime, so seeding runs as a mu-plugin on a
 * late `init` hook (after the test CPTs and ACF fields are registered) and is
 * guarded by an option so it executes exactly once per environment.
 *
 * Creates:
 *  - 5 parent categories (Technology, Science, Travel, Food, Health) + 3 children
 *  - 8 tags (featured, trending, tutorial, review, guide, news, opinion, update)
 *  - 150 posts ("Test Post 001" – "Test Post 150"), 30 per category
 *  - 1 encoding-test post (special characters)
 *  - 10 pages + 3 hierarchical child pages
 *  - 10 books ("Test Book 001" – "Test Book 010") — custom post type
 *  - 3 artifacts ("test-artifact-001" – "test-artifact-003") — sparse CPT
 *  - native + ACF meta on selected entries
 *
 * Deletes the default "Hello world!" post, "Sample Page", and auto-draft content
 * so the DB starts clean. Identical fixture set to the previous wp-cli seed script.
 */

/**
 * Runs the one-time seed, guarded by an atomic lock so it executes exactly once
 * per environment even under concurrent first-boot requests.
 */
function wp_client_maybe_seed(): void {
	// Already finished — nothing to do.
	if ( '1' === get_option( 'wp_client_seed_complete' ) ) {
		return;
	}

	/*
	 * Acquire an atomic lock. `add_option` performs a single INSERT and returns
	 * false if the row already exists, so only one concurrent request wins. This
	 * matters under the Playground runtime: global-setup polls the REST API on a
	 * cold boot and several near-simultaneous requests would otherwise each pass a
	 * plain get/seed/set guard and seed in parallel, producing duplicate posts,
	 * tags, and artifacts (WordPress disambiguates colliding slugs with `-2`).
	 */
	if ( ! add_option( 'wp_client_seed_lock', '1', '', false ) ) {
		return;
	}

	wp_client_seed_content();

	update_option( 'wp_client_seed_complete', '1', false );
}

/*
 * Seeding is deferred until ACF is fully loaded, which matters under the Playground
 * runtime in a way it never did under Docker.
 *
 * ACF resolves `update_field( 'acf_subtitle', ... )` by field NAME via the local
 * field groups registered on `acf/init`. The old wp-cli seed ran against a
 * fully-booted Docker site, so ACF was always present. Under Playground, plugins
 * activated by the blueprint are NOT loaded into the very first HTTP request after
 * boot — `acf/init` does not fire and ACF functions are unavailable on request #1,
 * then load normally from request #2 onward. Seeding on `init`/`wp_loaded` therefore
 * runs before ACF exists on the first request and writes ACF values into the void
 * (native meta still persists; ACF does not).
 *
 * Hooking the seed to `acf/init` (at a late priority, after register-acf-fields.php
 * registers its groups at the default priority) guarantees the seed only runs once
 * ACF is loaded and its fields resolve. global-setup.ts polls the REST API until it
 * responds, which naturally drives the extra request(s) needed for ACF to load and
 * the seed to complete. The suite hard-depends on ACF, so there is no ACF-absent
 * fallback path.
 */
add_action( 'acf/init', 'wp_client_maybe_seed', 20 );

/**
 * Lightweight logger replacing WP_CLI output, which is unavailable outside wp-cli.
 *
 * @param string $message Log line.
 */
function wp_client_seed_log( string $message ): void {
	error_log( '[seed-content] ' . $message );
}

/**
 * Seeds the full deterministic integration-test fixture set. Idempotent at the
 * entry level (each item is skipped if already present), so a partial prior run
 * is safely completed on the next pass.
 */
function wp_client_seed_content(): void {
	/* ------------------------------------------------------------------ */
	/* Clean default content                                              */
	/* ------------------------------------------------------------------ */

	$default_post = get_page_by_path( 'hello-world', OBJECT, 'post' );
	if ( $default_post ) {
		wp_delete_post( $default_post->ID, true );
	}

	$default_page = get_page_by_path( 'sample-page', OBJECT, 'page' );
	if ( $default_page ) {
		wp_delete_post( $default_page->ID, true );
	}

	// Remove auto-drafts
	$auto_drafts = get_posts(
		array(
			'post_status' => 'auto-draft',
			'post_type'   => 'any',
			'numberposts' => -1,
		)
	);
	foreach ( $auto_drafts as $draft ) {
		wp_delete_post( $draft->ID, true );
	}

	/* ------------------------------------------------------------------ */
	/* Categories                                                         */
	/* ------------------------------------------------------------------ */

	// First create parent categories
	$parent_category_names = array( 'Technology', 'Science', 'Travel', 'Food', 'Health' );
	$category_ids          = array();
	$parent_category_ids   = array();

	foreach ( $parent_category_names as $name ) {
		$slug     = sanitize_title( $name );
		$existing = get_term_by( 'slug', $slug, 'category' );

		if ( $existing ) {
			$category_ids[ $slug ]        = $existing->term_id;
			$parent_category_ids[ $slug ] = $existing->term_id;
			continue;
		}

		$result = wp_insert_term(
			$name,
			'category',
			array(
				'slug'        => $slug,
				'description' => "Integration test category: $name",
				'parent'      => 0,
			)
		);

		if ( is_wp_error( $result ) ) {
			wp_client_seed_log( "Failed to create category '$name': " . $result->get_error_message() );
			continue;
		}

		$category_ids[ $slug ]        = $result['term_id'];
		$parent_category_ids[ $slug ] = $result['term_id'];
	}

	wp_client_seed_log( 'Parent categories created: ' . implode( ', ', array_keys( $parent_category_ids ) ) );

	// Then create child categories for hierarchical testing
	$child_categories = array(
		array(
			'name'   => 'Programming',
			'parent' => 'Technology',
			'slug'   => 'programming',
		),
		array(
			'name'   => 'Hardware',
			'parent' => 'Technology',
			'slug'   => 'hardware',
		),
		array(
			'name'   => 'Physics',
			'parent' => 'Science',
			'slug'   => 'physics',
		),
	);

	foreach ( $child_categories as $child ) {
		$parent_id = $parent_category_ids[ $child['parent'] ] ?? 0;

		if ( 0 === $parent_id ) {
			wp_client_seed_log( "Parent category '{$child['parent']}' not found for '{$child['name']}' — skipping." );
			continue;
		}

		$existing = get_term_by( 'slug', $child['slug'], 'category' );

		if ( $existing ) {
			// Ensure correct parent
			if ( $existing->parent !== $parent_id ) {
				wp_update_term( $existing->term_id, 'category', array( 'parent' => $parent_id ) );
			}
			$category_ids[ $child['slug'] ] = $existing->term_id;
			continue;
		}

		$result = wp_insert_term(
			$child['name'],
			'category',
			array(
				'slug'        => $child['slug'],
				'description' => "Child category of {$child['parent']}: {$child['name']}",
				'parent'      => $parent_id,
			)
		);

		if ( is_wp_error( $result ) ) {
			wp_client_seed_log( "Failed to create child category '{$child['name']}': " . $result->get_error_message() );
			continue;
		}

		$category_ids[ $child['slug'] ] = $result['term_id'];
	}

	wp_client_seed_log( 'All categories created/verified: ' . count( $category_ids ) );

	/* ------------------------------------------------------------------ */
	/* Tags                                                               */
	/* ------------------------------------------------------------------ */

	$tag_names = array( 'featured', 'trending', 'tutorial', 'review', 'guide', 'news', 'opinion', 'update' );
	$tag_ids   = array();

	foreach ( $tag_names as $name ) {
		$slug     = sanitize_title( $name );
		$existing = get_term_by( 'slug', $slug, 'post_tag' );

		if ( $existing ) {
			$tag_ids[ $slug ] = $existing->term_id;
			continue;
		}

		$result = wp_insert_term(
			ucfirst( $name ),
			'post_tag',
			array(
				'slug'        => $slug,
				'description' => "Integration test tag: $name",
			)
		);

		if ( is_wp_error( $result ) ) {
			wp_client_seed_log( "Failed to create tag '$name': " . $result->get_error_message() );
			continue;
		}

		$tag_ids[ $slug ] = $result['term_id'];
	}

	wp_client_seed_log( 'Tags created: ' . implode( ', ', array_keys( $tag_ids ) ) );

	/* ------------------------------------------------------------------ */
	/* Posts — 150 total, 30 per category                                 */
	/* ------------------------------------------------------------------ */

	// Get admin user ID for post author
	$admin_user     = get_user_by( 'login', 'admin' );
	$post_author_id = $admin_user ? $admin_user->ID : 1;

	$category_slugs = array_keys( $category_ids );

	// Tag assignment per category group
	$tag_assignments = array(
		array( 'featured', 'tutorial' ),  // Technology  (1-30)
		array( 'trending', 'news' ),      // Science     (31-60)
		array( 'guide', 'review' ),       // Travel      (61-90)
		array( 'opinion', 'update' ),     // Food        (91-120)
		array( 'featured', 'news' ),      // Health      (121-150)
	);

	$post_count = 0;

	for ( $i = 1; $i <= 150; $i++ ) {
		$padded   = str_pad( $i, 3, '0', STR_PAD_LEFT );
		$slug     = "test-post-$padded";
		$existing = get_page_by_path( $slug, OBJECT, 'post' );

		if ( $existing ) {
			++$post_count;
			continue;
		}

		// Determine category group (0-based index)
		$group_index   = intdiv( $i - 1, 30 );
		$cat_slug      = $category_slugs[ $group_index ];
		$cat_id        = $category_ids[ $cat_slug ];
		$assigned_tags = $tag_assignments[ $group_index ];

		$post_id = wp_insert_post(
			array(
				'post_title'   => "Test Post $padded",
				'post_name'    => $slug,
				'post_content' => "<!-- wp:paragraph -->\n<p>Content for test post $padded in category $cat_slug. This is deterministic seed data for integration testing.</p>\n<!-- /wp:paragraph -->",
				'post_excerpt' => "Excerpt for test post $padded",
				'post_status'  => 'publish',
				'post_type'    => 'post',
				'post_author'  => $post_author_id,
				'post_date'    => gmdate( 'Y-m-d H:i:s', strtotime( "2025-01-01 +{$i} hours" ) ),
			),
			true
		);

		if ( is_wp_error( $post_id ) ) {
			wp_client_seed_log( "Failed to create post $padded: " . $post_id->get_error_message() );
			continue;
		}

		// Assign category (replaces default "Uncategorized")
		wp_set_post_categories( $post_id, array( $cat_id ) );

		// Assign tags
		$tag_id_list = array_map( fn( $t ) => $tag_ids[ $t ], $assigned_tags );
		wp_set_post_tags( $post_id, $tag_id_list );

		++$post_count;
	}

	wp_client_seed_log( "Posts created/verified: $post_count" );

	/* ------------------------------------------------------------------ */
	/* Special character post (encoding test)                             */
	/* ------------------------------------------------------------------ */

	$encoding_test_post = get_page_by_path( 'encoding-test-post', OBJECT, 'post' );
	if ( ! $encoding_test_post ) {
		$encoding_post_id = wp_insert_post(
			array(
				'post_title'   => 'Research & Development: Testing <Tags> & "Quotes"',
				'post_name'    => 'encoding-test-post',
				'post_content' => "<!-- wp:paragraph -->\n<p>Content with special chars: A &amp; B, 5 &lt; 10, 10 &gt; 5, and a 'single quote'.</p>\n<!-- /wp:paragraph -->",
				'post_excerpt' => 'Excerpt with &amp; ampersand, &lt; less-than, &gt; greater-than, &quot; quotes &apos; and apostrophe',
				'post_status'  => 'publish',
				'post_type'    => 'post',
				'post_author'  => $post_author_id,
				'post_date'    => gmdate( 'Y-m-d H:i:s', strtotime( '2025-01-01 +151 hours' ) ),
			),
			true
		);

		if ( ! is_wp_error( $encoding_post_id ) ) {
			wp_set_post_categories( $encoding_post_id, array( $category_ids['technology'] ) );
			wp_set_post_tags( $encoding_post_id, array( $tag_ids['featured'], $tag_ids['tutorial'] ) );
			wp_client_seed_log( 'Created encoding test post' );
		} else {
			wp_client_seed_log( 'Failed to create encoding test post: ' . $encoding_post_id->get_error_message() );
		}
	} else {
		wp_client_seed_log( 'Encoding test post already exists' );
	}

	/* ------------------------------------------------------------------ */
	/* Pages                                                              */
	/* ------------------------------------------------------------------ */

	$page_definitions = array(
		array(
			'title'   => 'About',
			'slug'    => 'about',
			'content' => 'Learn more about our organization and mission.',
		),
		array(
			'title'   => 'Contact',
			'slug'    => 'contact',
			'content' => 'Get in touch with us through our contact form.',
		),
		array(
			'title'   => 'Services',
			'slug'    => 'services',
			'content' => 'Explore the services we offer to our clients.',
		),
		array(
			'title'   => 'FAQ',
			'slug'    => 'faq',
			'content' => 'Frequently asked questions and their answers.',
		),
		array(
			'title'   => 'Team',
			'slug'    => 'team',
			'content' => 'Meet the people behind the project.',
		),
		array(
			'title'   => 'Blog',
			'slug'    => 'blog',
			'content' => 'Our latest articles and updates.',
		),
		array(
			'title'   => 'Portfolio',
			'slug'    => 'portfolio',
			'content' => 'A showcase of our recent work and projects.',
		),
		array(
			'title'   => 'Testimonials',
			'slug'    => 'testimonials',
			'content' => 'What our clients say about working with us.',
		),
		array(
			'title'   => 'Privacy Policy',
			'slug'    => 'privacy-policy',
			'content' => 'How we handle and protect your personal data.',
		),
		array(
			'title'   => 'Terms of Service',
			'slug'    => 'terms-of-service',
			'content' => 'The terms and conditions for using our services.',
		),
	);

	$page_count  = 0;
	$page_id_map = array(); // Track page IDs for hierarchical relationships

	foreach ( $page_definitions as $index => $def ) {
		$existing = get_page_by_path( $def['slug'], OBJECT, 'page' );

		if ( $existing ) {
			// Ensure pre-existing pages (e.g. WP's default Privacy Policy draft) are published
			if ( 'publish' !== $existing->post_status ) {
				wp_update_post(
					array(
						'ID'           => $existing->ID,
						'post_status'  => 'publish',
						'post_content' => "<!-- wp:paragraph -->\n<p>{$def['content']}</p>\n<!-- /wp:paragraph -->",
						'menu_order'   => $index + 1,
						'post_parent'  => 0,
					)
				);
			}
			$page_id_map[ $def['slug'] ] = $existing->ID;
			++$page_count;
			continue;
		}

		$page_id = wp_insert_post(
			array(
				'post_title'   => $def['title'],
				'post_name'    => $def['slug'],
				'post_content' => "<!-- wp:paragraph -->\n<p>{$def['content']}</p>\n<!-- /wp:paragraph -->",
				'post_status'  => 'publish',
				'post_type'    => 'page',
				'post_author'  => $post_author_id,
				'menu_order'   => $index + 1,
				'post_date'    => gmdate( 'Y-m-d H:i:s', strtotime( "2025-01-01 +{$index} hours" ) ),
				'post_parent'  => 0,
			),
			true
		);

		if ( is_wp_error( $page_id ) ) {
			wp_client_seed_log( "Failed to create page '{$def['title']}': " . $page_id->get_error_message() );
			continue;
		}

		$page_id_map[ $def['slug'] ] = $page_id;
		++$page_count;
	}

	wp_client_seed_log( "Pages created/verified: $page_count" );

	/* ------------------------------------------------------------------ */
	/* Child Pages (hierarchical)                                         */
	/* ------------------------------------------------------------------ */

	$child_page_definitions = array(
		array(
			'title'   => 'Web Development',
			'slug'    => 'services-web-development',
			'content' => 'Professional web development services including frontend, backend, and full-stack solutions.',
			'parent'  => 'services',
		),
		array(
			'title'   => 'Consulting',
			'slug'    => 'services-consulting',
			'content' => 'Expert technology consulting to help you make informed decisions for your business.',
			'parent'  => 'services',
		),
		array(
			'title'   => 'Support',
			'slug'    => 'services-support',
			'content' => 'Ongoing support and maintenance services to keep your systems running smoothly.',
			'parent'  => 'services',
		),
	);

	$child_page_count = 0;

	foreach ( $child_page_definitions as $index => $def ) {
		$parent_id = $page_id_map[ $def['parent'] ] ?? 0;

		if ( 0 === $parent_id ) {
			wp_client_seed_log( "Parent page '{$def['parent']}' not found for '{$def['title']}' — skipping." );
			continue;
		}

		$existing = get_page_by_path( $def['slug'], OBJECT, 'page' );

		if ( $existing ) {
			// Ensure child page has correct parent
			if ( $existing->post_parent !== $parent_id ) {
				wp_update_post(
					array(
						'ID'          => $existing->ID,
						'post_parent' => $parent_id,
					)
				);
			}
			++$child_page_count;
			continue;
		}

		$page_id = wp_insert_post(
			array(
				'post_title'   => $def['title'],
				'post_name'    => $def['slug'],
				'post_content' => "<!-- wp:paragraph -->\n<p>{$def['content']}</p>\n<!-- /wp:paragraph -->",
				'post_status'  => 'publish',
				'post_type'    => 'page',
				'post_author'  => $post_author_id,
				'post_parent'  => $parent_id,
				'menu_order'   => $index + 1,
				'post_date'    => gmdate( 'Y-m-d H:i:s', strtotime( "2025-01-15 +{$index} hours" ) ),
			),
			true
		);

		if ( is_wp_error( $page_id ) ) {
			wp_client_seed_log( "Failed to create child page '{$def['title']}': " . $page_id->get_error_message() );
			continue;
		}

		++$child_page_count;
	}

	wp_client_seed_log( "Child pages created/verified: $child_page_count" );

	/* ------------------------------------------------------------------ */
	/* Books (custom post type)                                           */
	/* ------------------------------------------------------------------ */

	$book_count = 0;

	for ( $i = 1; $i <= 10; $i++ ) {
		$padded   = str_pad( $i, 3, '0', STR_PAD_LEFT );
		$slug     = "test-book-$padded";
		$existing = get_page_by_path( $slug, OBJECT, 'book' );

		if ( $existing ) {
			++$book_count;
			continue;
		}

		$book_id = wp_insert_post(
			array(
				'post_title'   => "Test Book $padded",
				'post_name'    => $slug,
				'post_content' => "<!-- wp:paragraph -->\n<p>Content for test book $padded. This is deterministic seed data for CPT integration testing.</p>\n<!-- /wp:paragraph -->",
				'post_excerpt' => "Excerpt for test book $padded",
				'post_status'  => 'publish',
				'post_type'    => 'book',
				'post_author'  => $post_author_id,
				'post_date'    => gmdate( 'Y-m-d H:i:s', strtotime( "2025-01-01 +{$i} hours" ) ),
			),
			true
		);

		if ( is_wp_error( $book_id ) ) {
			wp_client_seed_log( "Failed to create book $padded: " . $book_id->get_error_message() );
			continue;
		}

		++$book_count;
	}

	wp_client_seed_log( "Books created/verified: $book_count" );

	/* ------------------------------------------------------------------ */
	/* Artifacts (sparse custom post type)                                */
	/* ------------------------------------------------------------------ */

	$artifact_count = 0;

	for ( $i = 1; $i <= 3; $i++ ) {
		$padded   = str_pad( $i, 3, '0', STR_PAD_LEFT );
		$slug     = "test-artifact-$padded";
		$existing = get_page_by_path( $slug, OBJECT, 'artifact' );

		if ( $existing ) {
			++$artifact_count;
			continue;
		}

		$artifact_id = wp_insert_post(
			array(
				'post_title'   => "Hidden Artifact Title $padded",
				'post_name'    => $slug,
				'post_content' => "Hidden artifact content $padded that should not be exposed by the REST schema.",
				'post_excerpt' => "Hidden artifact excerpt $padded",
				'post_status'  => 'publish',
				'post_type'    => 'artifact',
				'post_author'  => $post_author_id,
				'post_date'    => gmdate( 'Y-m-d H:i:s', strtotime( "2025-02-01 +{$i} hours" ) ),
			),
			true
		);

		if ( is_wp_error( $artifact_id ) ) {
			wp_client_seed_log( "Failed to create artifact $padded: " . $artifact_id->get_error_message() );
			continue;
		}

		++$artifact_count;
	}

	wp_client_seed_log( "Artifacts created/verified: $artifact_count" );

	/* ------------------------------------------------------------------ */
	/* Native WordPress Meta Fields                                       */
	/* ------------------------------------------------------------------ */

	/**
	 * Seeds deterministic native WordPress meta values for key entries.
	 *
	 * Values are always upserted so repeated runs stay in sync with tests.
	 */
	$seed_native_meta = function ( int $post_id, array $meta ): void {
		foreach ( $meta as $key => $value ) {
			update_post_meta( $post_id, $key, $value );
		}
	};

	$native_meta_targets = array(
		array(
			'post_type' => 'post',
			'slug'      => 'test-post-001',
			'meta'      => array(
				'test_string_meta' => 'Seed string meta for test-post-001',
				'test_number_meta' => 11.5,
				'test_array_meta'  => array( 'seed-post-001-a', 'seed-post-001-b' ),
			),
		),
		array(
			'post_type' => 'page',
			'slug'      => 'about',
			'meta'      => array(
				'test_string_meta' => 'Seed string meta for about-page',
				'test_number_meta' => 21.5,
				'test_array_meta'  => array( 'seed-about-a', 'seed-about-b' ),
			),
		),
		array(
			'post_type' => 'book',
			'slug'      => 'test-book-001',
			'meta'      => array(
				'test_string_meta' => 'Seed string meta for test-book-001',
				'test_number_meta' => 31.5,
				'test_array_meta'  => array( 'seed-book-001-a', 'seed-book-001-b' ),
				'test_book_isbn'   => '978-0-11-111111-1',
			),
		),
	);

	$native_meta_seeded = 0;

	foreach ( $native_meta_targets as $target ) {
		$post = get_page_by_path( $target['slug'], OBJECT, $target['post_type'] );

		if ( ! $post ) {
			wp_client_seed_log( "{$target['post_type']} '{$target['slug']}' not found — skipping native meta seeding." );
			continue;
		}

		$seed_native_meta( $post->ID, $target['meta'] );
		++$native_meta_seeded;
	}

	wp_client_seed_log( "Native meta seeded for entries: $native_meta_seeded" );

	/* ------------------------------------------------------------------ */
	/* ACF Fields                                                         */
	/* ------------------------------------------------------------------ */
	/* Always runs (not skipped on existing content) so that values stay  */
	/* in sync with what the tests expect after `wp-env start`.           */

	if ( ! function_exists( 'update_field' ) ) {
		wp_client_seed_log( 'ACF is not active — skipping ACF field seeding.' );
	} else {

		// Posts 1–3: full set of scalar fields, plus relationship and featured post.
		for ( $i = 1; $i <= 3; $i++ ) {
			$padded = str_pad( $i, 3, '0', STR_PAD_LEFT );
			$post   = get_page_by_path( "test-post-$padded", OBJECT, 'post' );

			if ( ! $post ) {
				wp_client_seed_log( "Post test-post-$padded not found — skipping ACF seeding." );
				continue;
			}

			// Related posts: the next two posts in sequence
			$rel_ids = array();
			for ( $j = $i + 1; $j <= $i + 2 && $j <= 150; $j++ ) {
				$rp = get_page_by_path( 'test-post-' . str_pad( $j, 3, '0', STR_PAD_LEFT ), OBJECT, 'post' );
				if ( $rp ) {
					$rel_ids[] = $rp->ID;
				}
			}

			// Featured post: ten positions ahead
			$featured = get_page_by_path( 'test-post-' . str_pad( $i + 10, 3, '0', STR_PAD_LEFT ), OBJECT, 'post' );

			update_field( 'acf_subtitle', "Subtitle for test post $padded", $post->ID );
			update_field( 'acf_summary', "Summary content for test post $padded. Deterministic seed data.", $post->ID );
			update_field( 'acf_priority_score', $i * 10, $post->ID );
			update_field( 'acf_external_url', "https://example.com/test-post-$padded", $post->ID );

			if ( ! empty( $rel_ids ) ) {
				update_field( 'acf_related_posts', $rel_ids, $post->ID );
			}

			if ( $featured ) {
				update_field( 'acf_featured_post', $featured->ID, $post->ID );
			}
		}

		// Pages: about (priority 20) and contact (priority 40).
		$page_acf = array(
			'about'   => array(
				'subtitle' => 'Subtitle for about page',
				'priority' => 20,
				'url'      => 'https://example.com/about',
			),
			'contact' => array(
				'subtitle' => 'Subtitle for contact page',
				'priority' => 40,
				'url'      => 'https://example.com/contact',
			),
		);

		foreach ( $page_acf as $slug => $fields ) {
			$page = get_page_by_path( $slug, OBJECT, 'page' );
			if ( ! $page ) {
				continue;
			}

			// Relate each page to test-post-001 and test-post-002
			$rel_post_1 = get_page_by_path( 'test-post-001', OBJECT, 'post' );
			$rel_post_2 = get_page_by_path( 'test-post-002', OBJECT, 'post' );
			$page_rels  = array_values(
				array_filter(
					array(
						$rel_post_1 ? $rel_post_1->ID : null,
						$rel_post_2 ? $rel_post_2->ID : null,
					)
				)
			);

			update_field( 'acf_subtitle', $fields['subtitle'], $page->ID );
			update_field( 'acf_summary', "Summary for the $slug page. Deterministic seed data.", $page->ID );
			update_field( 'acf_priority_score', $fields['priority'], $page->ID );
			update_field( 'acf_external_url', $fields['url'], $page->ID );

			if ( ! empty( $page_rels ) ) {
				update_field( 'acf_related_posts', $page_rels, $page->ID );
			}
		}

		// Books 1–2: scalar fields plus a featured post reference.
		for ( $i = 1; $i <= 2; $i++ ) {
			$padded = str_pad( $i, 3, '0', STR_PAD_LEFT );
			$book   = get_page_by_path( "test-book-$padded", OBJECT, 'book' );

			if ( ! $book ) {
				continue;
			}

			$featured = get_page_by_path( 'test-post-' . str_pad( $i * 5, 3, '0', STR_PAD_LEFT ), OBJECT, 'post' );

			update_field( 'acf_subtitle', "Subtitle for test book $padded", $book->ID );
			update_field( 'acf_summary', "Summary for test book $padded. Deterministic seed data.", $book->ID );
			update_field( 'acf_priority_score', $i * 15, $book->ID );

			if ( $featured ) {
				update_field( 'acf_featured_post', $featured->ID, $book->ID );
			}
		}

		// Artifacts 1–2: scalar ACF fields on a title/content-less CPT.
		for ( $i = 1; $i <= 2; $i++ ) {
			$padded   = str_pad( $i, 3, '0', STR_PAD_LEFT );
			$artifact = get_page_by_path( "test-artifact-$padded", OBJECT, 'artifact' );

			if ( ! $artifact ) {
				continue;
			}

			update_field( 'acf_subtitle', "Subtitle for test artifact $padded", $artifact->ID );
			update_field( 'acf_summary', "Summary for test artifact $padded. Deterministic seed data.", $artifact->ID );
			update_field( 'acf_priority_score', $i * 25, $artifact->ID );
			update_field( 'acf_external_url', "https://example.com/test-artifact-$padded", $artifact->ID );
		}

		wp_client_seed_log( 'ACF fields seeded.' );
	}

	/* ------------------------------------------------------------------ */
	/* Summary                                                            */
	/* ------------------------------------------------------------------ */

	wp_client_seed_log( 'Seed data generation complete.' );
	wp_client_seed_log( '  Categories:     ' . count( $category_ids ) . ' (including child categories)' );
	wp_client_seed_log( '  Tags:           ' . count( $tag_ids ) );
	wp_client_seed_log( "  Posts:          $post_count" );
	wp_client_seed_log( "  Pages:          $page_count" );
	wp_client_seed_log( "  Child Pages:    $child_page_count" );
	wp_client_seed_log( "  Books:          $book_count" );
	wp_client_seed_log( "  Artifacts:      $artifact_count" );
	wp_client_seed_log( "  Native meta seeded entries: $native_meta_seeded" );
}
