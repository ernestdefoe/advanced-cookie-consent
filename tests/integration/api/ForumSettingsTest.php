<?php

namespace ErnestDefoe\AdvancedCookieConsent\Tests\integration\api;

use Flarum\Testing\integration\TestCase;
use PHPUnit\Framework\Attributes\Test;

/**
 * The banner's whole configuration reaches the browser through the forum
 * payload. Every visitor reads it, before consent, so it must arrive with
 * sane defaults and in the types the banner expects, whatever is stored.
 */
class ForumSettingsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ernestdefoe-advanced-cookie-consent');
    }

    /** @return array<string, mixed> */
    private function consent(): array
    {
        $response = $this->send($this->request('GET', '/api'));

        $this->assertSame(200, $response->getStatusCode());

        $attributes = json_decode((string) $response->getBody(), true)['data']['attributes'];

        return array_filter($attributes, fn ($key) => str_starts_with($key, 'cookieConsent.'), ARRAY_FILTER_USE_KEY);
    }

    #[Test]
    public function an_unconfigured_forum_gets_a_working_banner()
    {
        $this->assertSame([
            'cookieConsent.enabled' => true,
            'cookieConsent.version' => '1',
            'cookieConsent.position' => 'bottom',
            'cookieConsent.theme' => 'auto',
            'cookieConsent.accentColor' => null,
            'cookieConsent.width' => null,
            'cookieConsent.radius' => null,
            'cookieConsent.respectDnt' => true,
            'cookieConsent.showRejectAll' => true,
            'cookieConsent.title' => null,
            'cookieConsent.message' => null,
            'cookieConsent.privacyUrl' => null,
            'cookieConsent.privacyLabel' => null,
            'cookieConsent.categories' => [
                ['key' => 'necessary', 'required' => true, 'scripts' => ''],
                ['key' => 'performance', 'required' => false, 'scripts' => ''],
                ['key' => 'functional', 'required' => false, 'scripts' => ''],
                ['key' => 'marketing', 'required' => false, 'scripts' => ''],
            ],
            'cookieConsent.services' => [],
        ], $this->consent());
    }

    #[Test]
    public function stored_settings_arrive_typed()
    {
        $this->setting('ernestdefoe-acc.enabled', '0');
        $this->setting('ernestdefoe-acc.respect_dnt', 'false');
        $this->setting('ernestdefoe-acc.show_reject_all', '1');
        $this->setting('ernestdefoe-acc.version', '3');
        $this->setting('ernestdefoe-acc.position', 'top');
        $this->setting('ernestdefoe-acc.theme', 'dark');
        $this->setting('ernestdefoe-acc.accent_color', '#ff0000');
        $this->setting('ernestdefoe-acc.width', '480');
        $this->setting('ernestdefoe-acc.radius', '0');
        $this->setting('ernestdefoe-acc.title', 'Cookies');
        $this->setting('ernestdefoe-acc.privacy_url', 'https://example.com/privacy');
        $this->setting('ernestdefoe-acc.categories', json_encode([['key' => 'necessary', 'required' => true, 'scripts' => '']]));
        $this->setting('ernestdefoe-acc.services', json_encode([['name' => 'Analytics', 'category' => 'performance']]));

        $consent = $this->consent();

        $this->assertFalse($consent['cookieConsent.enabled']);
        $this->assertFalse($consent['cookieConsent.respectDnt']);
        $this->assertTrue($consent['cookieConsent.showRejectAll']);
        $this->assertSame('3', $consent['cookieConsent.version']);
        $this->assertSame('top', $consent['cookieConsent.position']);
        $this->assertSame('dark', $consent['cookieConsent.theme']);
        $this->assertSame('#ff0000', $consent['cookieConsent.accentColor']);
        $this->assertSame(480, $consent['cookieConsent.width']);
        $this->assertSame(0, $consent['cookieConsent.radius'], 'A radius of 0 (square corners) is a choice, not "unset"');
        $this->assertSame('Cookies', $consent['cookieConsent.title']);
        $this->assertSame('https://example.com/privacy', $consent['cookieConsent.privacyUrl']);
        $this->assertSame([['key' => 'necessary', 'required' => true, 'scripts' => '']], $consent['cookieConsent.categories']);
        $this->assertSame([['name' => 'Analytics', 'category' => 'performance']], $consent['cookieConsent.services']);
    }

    #[Test]
    public function corrupt_category_json_falls_back_to_the_defaults()
    {
        $this->setting('ernestdefoe-acc.categories', '{not json');
        $this->setting('ernestdefoe-acc.services', '"a string"');

        $consent = $this->consent();

        $this->assertCount(4, $consent['cookieConsent.categories']);
        $this->assertSame([], $consent['cookieConsent.services']);
    }

    #[Test]
    public function a_width_of_zero_means_the_default_width()
    {
        $this->setting('ernestdefoe-acc.width', '0');

        $this->assertNull($this->consent()['cookieConsent.width']);
    }
}
