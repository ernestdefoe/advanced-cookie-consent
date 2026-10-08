import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import IndexPage from 'flarum/forum/components/IndexPage';
import LinkButton from 'flarum/common/components/LinkButton';
import CookieConsentRoot, { openSettings } from './components/CookieConsentRoot';
import { applyScripts, loadConsent, config, accepted, decideAll, onChange } from '../common/consent';

declare const m: any;
const t = (k: string, p?: any): any => app.translator.trans('ernestdefoe-acc.forum.' + k, p);

app.initializers.add('ernestdefoe/advanced-cookie-consent', () => {
  // Public API for themes / other extensions to gate their own scripts and to
  // re-open the settings dialog from a custom trigger.
  (window as any).cookieConsent = {
    open: openSettings,
    accepted,
    acceptAll: () => decideAll(true),
    rejectAll: () => decideAll(false),
    config,
    onChange,
    consent: () => loadConsent(),
  };

  // Config reads app.forum.attribute(), which is NOT populated yet while
  // initializers run — defer the config-dependent work to the next tick, by
  // which the forum payload is loaded.
  setTimeout(() => {
    if (!config().enabled) return;

    // Run any already-granted gated scripts as early as possible.
    const existing = loadConsent();
    if (existing) applyScripts(existing);

    // Mount the banner/dialog on its own node, outside Flarum's #app container,
    // so it overlays everything and works for guests. Flarum Component classes
    // must be created via m(Component), so mount a trivial root that renders it.
    if (document.getElementById('acc-root')) return;
    const node = document.createElement('div');
    node.id = 'acc-root';
    document.body.appendChild(node);
    m.mount(node, { view: () => m(CookieConsentRoot) });
  }, 0);

  // A "Cookie settings" link so visitors can change their mind. Themes can add
  // their own trigger anywhere via window.cookieConsent.open().
  extend(IndexSidebar.prototype, 'items', function (items: any) {
    // 🚨 The discussion list only. Flarum 2 reuses IndexSidebar for other
    // pages (Messages subclasses it), which lay the list out as a row, and a
    // box dropped in there pushes the whole page out of shape.
    if (!app.current || !app.current.matches(IndexPage)) return;
    items.add(
      'cookieConsent',
      LinkButton.component(
        {
          icon: 'fas fa-cookie-bite',
          onclick: (e: Event) => {
            e.preventDefault();
            openSettings();
          },
          href: '#',
        },
        t('reopen')
      ),
      -100
    );
  });
});
