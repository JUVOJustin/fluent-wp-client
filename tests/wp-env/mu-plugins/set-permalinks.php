<?php
/**
 * Deterministic environment fixups for the integration suite.
 *
 * Replaces wp-cli setup steps from the old Docker setup (`wp rewrite structure`
 * and the implicit Docker wp-env admin email). wp-cli is unavailable in the
 * Playground runtime, so these run once (guarded by an option) on `init`:
 *
 *  - Set a pretty `/%postname%/` permalink structure and flush rewrite rules.
 *  - Normalise the admin email to `wordpress@example.com`, which the old Docker
 *    wp-env used and the auth integration test asserts on (the Playground runtime
 *    defaults the admin email to `admin@localhost.com`).
 *
 * Idempotent: subsequent requests no-op.
 */
add_action(
	'init',
	function () {
		if ( '1' === get_option( 'wp_client_env_fixups_ready' ) ) {
			return;
		}

		// Permalinks.
		$desired = '/%postname%/';
		update_option( 'permalink_structure', $desired );

		global $wp_rewrite;
		if ( $wp_rewrite instanceof WP_Rewrite ) {
			$wp_rewrite->set_permalink_structure( $desired );
			$wp_rewrite->flush_rules( true );
		} else {
			flush_rewrite_rules( true );
		}

		// Admin email — match the value the auth test expects.
		$admin = get_user_by( 'login', 'admin' );
		if ( $admin && 'wordpress@example.com' !== $admin->user_email ) {
			wp_update_user(
				array(
					'ID'         => $admin->ID,
					'user_email' => 'wordpress@example.com',
				)
			);
		}
		update_option( 'admin_email', 'wordpress@example.com' );

		update_option( 'wp_client_env_fixups_ready', '1', false );
	},
	1
);
