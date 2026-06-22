<?php
/**
 * Force-enables WordPress Application Passwords over HTTP and provisions a known
 * Application Password for the `admin` user, exposing it to the integration test
 * harness via a local-only REST route.
 *
 * WordPress core requires HTTPS for Application Passwords by default and blocks
 * them over plain HTTP. The wp-env Playground site runs on http://localhost, so
 * this mu-plugin (1) makes Application Passwords available over HTTP and
 * (2) seeds a fresh Application Password for `admin` on demand. wp-cli is not
 * available in the Playground runtime, so the credential is minted here in PHP
 * and read back over HTTP by `tests/setup/global-setup.ts`.
 *
 * Local-only test fixture — DO NOT ship anywhere near production.
 */

// Allow Application Passwords over the local (non-HTTPS) connection.
add_filter( 'wp_is_application_passwords_available', '__return_true' );
add_filter( 'wp_is_application_passwords_available_for_user', '__return_true' );

// Must match the name the integration suite asserts on (introspect test).
const WP_CLIENT_APP_PASSWORD_NAME = 'vitest';

/**
 * Ensures a fresh Application Password exists for the admin user.
 *
 * Application Password hashes are one-way, so an existing one cannot be read back.
 * Any prior integration password is deleted and a new one minted; the plaintext is
 * stored in an option for the harness to fetch via the REST route below.
 *
 * @param WP_User $user Admin user.
 * @return string|null Plaintext Application Password, or null on failure.
 */
function wp_client_provision_app_password( WP_User $user ) {
	if ( ! class_exists( 'WP_Application_Passwords' ) ) {
		return null;
	}

	$existing = WP_Application_Passwords::get_user_application_passwords( $user->ID );
	foreach ( $existing as $item ) {
		if ( isset( $item['name'] ) && WP_CLIENT_APP_PASSWORD_NAME === $item['name'] ) {
			WP_Application_Passwords::delete_application_password( $user->ID, $item['uuid'] );
		}
	}

	$created = WP_Application_Passwords::create_new_application_password(
		$user->ID,
		array( 'name' => WP_CLIENT_APP_PASSWORD_NAME )
	);
	if ( is_wp_error( $created ) ) {
		return null;
	}

	// $created[0] is the plaintext password (spaces are stripped by core on auth).
	$plaintext = $created[0];
	update_option( 'wp_client_app_password', $plaintext, false );
	return $plaintext;
}

/**
 * Expose the seeded credential to the local test harness. Unauthenticated on
 * purpose — this is a throwaway local environment. A fresh password is minted on
 * every call so re-running the suite never relies on a stale (unreadable) hash.
 */
add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'wp-client-test/v1',
			'/app-password',
			array(
				'methods'             => 'GET',
				'permission_callback' => '__return_true',
				'callback'            => function () {
					$user = get_user_by( 'login', 'admin' );
					if ( ! $user ) {
						return new WP_Error( 'no_admin', 'admin user not found', array( 'status' => 500 ) );
					}
					$plaintext = wp_client_provision_app_password( $user );
					if ( ! $plaintext ) {
						return new WP_Error( 'no_password', 'could not provision app password', array( 'status' => 500 ) );
					}
					return array(
						'username' => 'admin',
						'password' => $plaintext,
					);
				},
			)
		);
	}
);
