<?php

/*
 * This file is part of ernestdefoe/advanced-cookie-consent.
 *
 * Advanced Cookie Consent for Flarum 2.
 */

use ErnestDefoe\AdvancedCookieConsent\Defaults;
use Flarum\Extend;

/** Decode a JSON setting, falling back to a default array. */
$json = fn (array $fallback) => function ($value) use ($fallback) {
    if (! $value) {
        return $fallback;
    }
    $decoded = json_decode($value, true);

    return is_array($decoded) ? $decoded : $fallback;
};

$bool = fn (bool $default) => fn ($value) => $value === null ? $default : filter_var($value, FILTER_VALIDATE_BOOLEAN);

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__ . '/js/dist/forum.js')
        ->css(__DIR__ . '/less/forum.less'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__ . '/js/dist/admin.js')
        ->css(__DIR__ . '/less/admin.less'),

    new Extend\Locales(__DIR__ . '/resources/locale'),

    (new Extend\Settings())
        ->serializeToForum('cookieConsent.enabled', 'ernestdefoe-acc.enabled', $bool(true))
        ->serializeToForum('cookieConsent.version', 'ernestdefoe-acc.version', fn ($v) => (string) ($v ?: '1'))
        ->serializeToForum('cookieConsent.position', 'ernestdefoe-acc.position', fn ($v) => $v ?: 'bottom')
        ->serializeToForum('cookieConsent.respectDnt', 'ernestdefoe-acc.respect_dnt', $bool(true))
        ->serializeToForum('cookieConsent.showRejectAll', 'ernestdefoe-acc.show_reject_all', $bool(true))
        // Free-text strings: null means "use the translated default" on the client.
        ->serializeToForum('cookieConsent.title', 'ernestdefoe-acc.title', fn ($v) => $v ?: null)
        ->serializeToForum('cookieConsent.message', 'ernestdefoe-acc.message', fn ($v) => $v ?: null)
        ->serializeToForum('cookieConsent.privacyUrl', 'ernestdefoe-acc.privacy_url', fn ($v) => $v ?: null)
        ->serializeToForum('cookieConsent.privacyLabel', 'ernestdefoe-acc.privacy_label', fn ($v) => $v ?: null)
        // Structured config.
        ->serializeToForum('cookieConsent.categories', 'ernestdefoe-acc.categories', $json(Defaults::categories()))
        ->serializeToForum('cookieConsent.services', 'ernestdefoe-acc.services', $json(Defaults::services())),
];
