import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import CookieBanner from './CookieBanner';
import PrivacySettingsModal from './PrivacySettingsModal';
import { config, loadConsent, hasDecision, saveConsent, decideAll, dntEnabled, type CookieConsentConfig } from '../../common/consent';

declare const m: any;

/** Module ref so the public API (window.cookieConsent.open) can reach the mounted root. */
let instance: CookieConsentRoot | null = null;
export function openSettings(): void {
  if (instance) instance.openModal();
}

/**
 * The mounted root (attached to its own node on <body>, outside Flarum's app
 * container) so the notice + settings dialog sit above everything and work for
 * guests. Owns the show/hide state and the accept/reject/save flow.
 */
export default class CookieConsentRoot extends Component {
  cfg!: CookieConsentConfig;
  bannerVisible = false;
  modalOpen = false;

  oninit(vnode: any) {
    super.oninit(vnode);
    instance = this;
    this.cfg = config();

    if (!this.cfg.enabled) return;

    if (hasDecision()) {
      // Already decided — nothing to show (scripts are applied at boot in index.ts).
      return;
    }

    // Honour a browser opt-out signal: treat DNT / GPC as "reject non-essential".
    if (this.cfg.respectDnt && dntEnabled()) {
      decideAll(false);
      return;
    }

    this.bannerVisible = true;
  }

  onremove() {
    if (instance === this) instance = null;
  }

  openModal() {
    this.modalOpen = true;
    m.redraw();
  }

  acceptAll() {
    decideAll(true);
    this.dismiss();
  }

  rejectAll() {
    decideAll(false);
    this.dismiss();
  }

  saveSettings(map: Record<string, boolean>) {
    saveConsent(map);
    this.dismiss();
  }

  dismiss() {
    this.bannerVisible = false;
    this.modalOpen = false;
    m.redraw();
  }

  view() {
    if (!this.cfg || !this.cfg.enabled) return null;

    const style: Record<string, string> = {};
    if (this.cfg.accentColor) {
      style['--acc-accent'] = this.cfg.accentColor;
      const text = textOn(this.cfg.accentColor);
      if (text) style['--acc-accent-text'] = text;
    }
    if (this.cfg.width) style['--acc-width'] = this.cfg.width + 'px';
    if (this.cfg.radius !== null && this.cfg.radius !== undefined) style['--acc-radius'] = this.cfg.radius + 'px';

    return m('.CookieConsent.CookieConsent--theme-' + this.cfg.theme, { style }, [
      this.bannerVisible && !this.modalOpen
        ? m(CookieBanner, {
            config: this.cfg,
            onAccept: () => this.acceptAll(),
            onReject: () => this.rejectAll(),
            onCustomize: () => this.openModal(),
          })
        : null,

      this.modalOpen
        ? m(PrivacySettingsModal, {
            config: this.cfg,
            initial: loadConsent()?.categories || {},
            onSave: (map: Record<string, boolean>) => this.saveSettings(map),
            onAcceptAll: () => this.acceptAll(),
            onRejectAll: () => this.rejectAll(),
            onClose: () => {
              // Closing the dialog without choosing keeps the banner up if no
              // decision has been made yet.
              this.modalOpen = false;
              this.bannerVisible = !hasDecision();
              m.redraw();
            },
          })
        : null,
    ]);
  }
}

/**
 * Black or white, whichever reads on the given colour.
 *
 * The accent paints the primary buttons solid, so their text has to be chosen
 * against it — a pale accent with white text is as unreadable as the theme
 * colour it replaced. Only #rgb / #rrggbb are understood; anything else returns
 * null and the theme's own primary-button text colour is used.
 */
function textOn(color: string): string | null {
  const hex = String(color).trim().replace(/^#/, '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;

  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // The point where black and white text have equal contrast.
  return luminance > 0.179 ? '#000' : '#fff';
}
