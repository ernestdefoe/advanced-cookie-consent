<?php

namespace ErnestDefoe\AdvancedCookieConsent;

/**
 * Built-in defaults. Category display names/descriptions are intentionally
 * omitted here — the frontend resolves them from the locale file by key
 * (ernestdefoe-acc.forum.categories.<key>.*) so the out-of-box experience is
 * fully translatable. Admins can override the text per category in the admin UI.
 */
class Defaults
{
    /** @return list<array<string,mixed>> */
    public static function categories(): array
    {
        return [
            ['key' => 'necessary',   'required' => true,  'scripts' => ''],
            ['key' => 'performance', 'required' => false, 'scripts' => ''],
            ['key' => 'functional',  'required' => false, 'scripts' => ''],
            ['key' => 'marketing',   'required' => false, 'scripts' => ''],
        ];
    }

    /** @return list<array<string,mixed>> */
    public static function services(): array
    {
        return [];
    }
}
