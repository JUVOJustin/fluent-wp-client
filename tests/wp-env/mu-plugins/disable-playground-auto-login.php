<?php
/**
 * Disables the wp-env Playground runtime's per-request auto-login redirect.
 *
 * The Playground runtime ships a `login` blueprint step (hardcoded by
 * `@wordpress/env`) that adds a mu-plugin which, on `init` priority 1, logs the
 * `admin` user in and issues a 302 redirect to the same URL until a
 * `playground_auto_login_already_happened` cookie is present. The REST exemption
 * in that mu-plugin checks `defined('REST_REQUEST')`, but that constant is only
 * defined on `parse_request` (after `init`), so REST requests are NOT exempt and
 * every cookieless request — which is how the integration suite issues public
 * reads — hits a self-redirect loop that Node's fetch aborts with
 * "redirect count exceeded".
 *
 * Customer mu-plugins load before Playground's internal mu-plugins, so seeding
 * the gating cookie here makes `playground_get_username_for_auto_login()` return
 * false, disabling the auto-login + redirect entirely. The integration suite
 * provisions its own credentials (Application Password, JWT, cookie+nonce), so
 * the auto-login is never needed.
 *
 * Local-only test fixture — no effect outside the Playground runtime.
 */

if ( ! isset( $_COOKIE['playground_auto_login_already_happened'] ) ) {
	$_COOKIE['playground_auto_login_already_happened'] = '1';
}
