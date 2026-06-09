import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import type { CategoryDef, CookieConsentConfig, ServiceDef } from '../../common/consent';

declare const m: any;
const t = (k: string, p?: any): any => app.translator.trans('ernestdefoe-acc.forum.' + k, p);

/**
 * Second-layer "Privacy Settings" dialog: a Categories tab with per-category
 * toggles and an expandable detail (the services + cookies it covers), and a
 * Services transparency tab. Footer offers Save / Reject all / Accept all.
 */
export default class PrivacySettingsModal extends Component {
  tab: 'categories' | 'services' = 'categories';
  values: Record<string, boolean> = {};
  expanded: Record<string, boolean> = {};

  oninit(vnode: any) {
    super.oninit(vnode);
    const cfg: CookieConsentConfig = this.attrs.config;
    const initial: Record<string, boolean> = this.attrs.initial || {};
    cfg.categories.forEach((c) => (this.values[c.key] = c.required ? true : !!initial[c.key]));
  }

  catName(c: CategoryDef): string {
    return c.name || (t('categories.' + c.key + '.name') as unknown as string);
  }

  catDesc(c: CategoryDef): string {
    return c.description || (t('categories.' + c.key + '.description') as unknown as string);
  }

  view() {
    const cfg: CookieConsentConfig = this.attrs.config;

    return m('.CookieModal-overlay', { onclick: (e: any) => e.target === e.currentTarget && this.attrs.onClose() }, [
      m('.CookieModal', { role: 'dialog', 'aria-modal': 'true' }, [
        m('.CookieModal-header', [
          m('h2', t('settings.title')),
          m('button.CookieModal-close', { type: 'button', 'aria-label': t('settings.close'), onclick: () => this.attrs.onClose() }, m('i.fas.fa-xmark')),
        ]),

        m('.CookieModal-intro', [
          m('p', t('settings.intro')),
          cfg.privacyUrl ? m('a', { href: cfg.privacyUrl, target: '_blank', rel: 'noopener' }, cfg.privacyLabel || t('banner.privacy')) : null,
        ]),

        m('.CookieModal-tabs', [
          m('button.CookieModal-tab' + (this.tab === 'categories' ? '.is-active' : ''), { type: 'button', onclick: () => (this.tab = 'categories') }, t('settings.tab_categories')),
          cfg.services.length
            ? m('button.CookieModal-tab' + (this.tab === 'services' ? '.is-active' : ''), { type: 'button', onclick: () => (this.tab = 'services') }, t('settings.tab_services'))
            : null,
        ]),

        m('.CookieModal-content', this.tab === 'categories' ? this.categories(cfg) : this.services(cfg)),

        m('.CookieModal-footer', [
          m('button.Button.CookieModal-save', { type: 'button', onclick: () => this.attrs.onSave({ ...this.values }) }, t('settings.save')),
          cfg.showRejectAll ? m('button.Button.CookieModal-reject', { type: 'button', onclick: () => this.attrs.onRejectAll() }, t('banner.reject')) : null,
          m('button.Button.Button--primary.CookieModal-accept', { type: 'button', onclick: () => this.attrs.onAcceptAll() }, t('banner.accept')),
        ]),
      ]),
    ]);
  }

  categories(cfg: CookieConsentConfig) {
    return m('.CookieCategories', cfg.categories.map((c) => {
      const services = cfg.services.filter((s) => s.category === c.key);
      const open = !!this.expanded[c.key];

      return m('.CookieCategory' + (open ? '.is-open' : ''), [
        m('.CookieCategory-head', [
          m('button.CookieCategory-toggleDetail', { type: 'button', onclick: () => (this.expanded[c.key] = !open) }, [
            m('i.fas', { className: open ? 'fa-chevron-up' : 'fa-chevron-down' }),
          ]),
          m('.CookieCategory-titles', [
            m('h3.CookieCategory-name', this.catName(c)),
          ]),
          this.switch(c),
        ]),
        m('p.CookieCategory-desc', this.catDesc(c)),
        open && services.length
          ? m('.CookieCategory-services', services.map((s) => m('.CookieCategory-service', [
              m('strong', s.name),
              s.provider ? m('span.CookieCategory-provider', ' — ' + s.provider) : null,
              s.cookies ? m('.CookieCategory-cookies', t('settings.cookies') + ': ' + s.cookies) : null,
            ])))
          : null,
      ]);
    }));
  }

  switch(c: CategoryDef) {
    const on = !!this.values[c.key];
    return m('button.CookieSwitch' + (on ? '.is-on' : '') + (c.required ? '.is-locked' : ''), {
      type: 'button',
      role: 'switch',
      'aria-checked': on ? 'true' : 'false',
      disabled: c.required,
      title: c.required ? t('settings.always_on') : '',
      onclick: () => { if (!c.required) this.values[c.key] = !on; },
    }, m('.CookieSwitch-knob'));
  }

  services(cfg: CookieConsentConfig) {
    if (!cfg.services.length) return m('p.CookieModal-empty', t('settings.no_services'));
    return m('.CookieServices', cfg.services.map((s: ServiceDef) =>
      m('.CookieServiceRow', [
        m('.CookieServiceRow-main', [m('strong', s.name), s.provider ? m('span', ' — ' + s.provider) : null]),
        s.description ? m('p.CookieServiceRow-desc', s.description) : null,
        m('.CookieServiceRow-meta', [
          m('span.CookieServiceRow-cat', this.categoryLabel(cfg, s.category)),
          s.cookies ? m('span.CookieServiceRow-cookies', s.cookies) : null,
        ]),
      ])
    ));
  }

  categoryLabel(cfg: CookieConsentConfig, key: string): string {
    const c = cfg.categories.find((x) => x.key === key);
    return c ? this.catName(c) : key;
  }
}
