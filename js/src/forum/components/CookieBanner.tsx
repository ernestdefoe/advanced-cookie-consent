import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type { CookieConsentConfig } from '../../common/consent';

declare const m: any;
const t = (k: string, p?: any): any => app.translator.trans('ernestdefoe-acc.forum.' + k, p);

export interface CookieBannerAttrs extends ComponentAttrs {
  config: CookieConsentConfig;
  onAccept: () => void;
  onReject: () => void;
  onCustomize: () => void;
}

/**
 * The first-layer cookie notice. Presentational: the mounted root passes the
 * config + the accept / reject / customize callbacks.
 */
export default class CookieBanner extends Component<CookieBannerAttrs> {
  view() {
    const cfg: CookieConsentConfig = this.attrs.config;
    const onAccept = this.attrs.onAccept;
    const onReject = this.attrs.onReject;
    const onCustomize = this.attrs.onCustomize;

    return m('.CookieBanner.CookieBanner--' + cfg.position, { role: 'dialog', 'aria-label': t('banner.aria') }, [
      m('.CookieBanner-inner', [
        m('.CookieBanner-body', [
          m('h2.CookieBanner-title', cfg.title || t('banner.title')),
          m('p.CookieBanner-message', cfg.message || t('banner.message')),
          m('.CookieBanner-links', [
            cfg.privacyUrl
              ? m('a.CookieBanner-link', { href: cfg.privacyUrl, target: '_blank', rel: 'noopener' }, cfg.privacyLabel || t('banner.privacy'))
              : null,
            m('button.CookieBanner-link', { type: 'button', onclick: onCustomize }, t('banner.more')),
          ]),
        ]),
        m('.CookieBanner-actions', [
          cfg.showRejectAll ? m('button.Button.CookieBanner-reject', { type: 'button', onclick: onReject }, t('banner.reject')) : null,
          m('button.Button.CookieBanner-customize', { type: 'button', onclick: onCustomize }, t('banner.customize')),
          m('button.Button.Button--primary.CookieBanner-accept', { type: 'button', onclick: onAccept }, t('banner.accept')),
        ]),
      ]),
    ]);
  }
}
