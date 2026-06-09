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

    return m('.CookieConsent', [
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
