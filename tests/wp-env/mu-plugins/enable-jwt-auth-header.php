<?php
/**
 * Normalizes the Authorization header so App-Password Basic Auth AND JWT bearer
 * auth reach WordPress in the local wp-env Playground runtime.
 *
 * Some front controllers (and the Playground PHP server) drop the `Authorization`
 * header before it reaches PHP, so authenticated writes arrive anonymous and
 * WordPress answers 401. Public GETs still work because they need no auth.
 * Repopulate $_SERVER['HTTP_AUTHORIZATION'] from the redirected variant (Apache
 * mod_rewrite) or, failing that, from the raw request headers via getallheaders()
 * (the Playground PHP built-in server), so authenticated requests reach WordPress.
 */
if (!function_exists('wp_client_sync_authorization_header')) {
    /**
     * Copies fallback Authorization header values into the canonical server key.
     */
    function wp_client_sync_authorization_header(): void
    {
        if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
            return;
        }

        if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $_SERVER['HTTP_AUTHORIZATION'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
            return;
        }

        if (function_exists('getallheaders')) {
            foreach (getallheaders() as $name => $value) {
                if ('authorization' === strtolower((string) $name)) {
                    $_SERVER['HTTP_AUTHORIZATION'] = $value;
                    return;
                }
            }
        }
    }

    wp_client_sync_authorization_header();
}
