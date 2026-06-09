import app from 'flarum/forum/app';

export interface CategoryDef {
  key: string;
  required: boolean;
  scripts?: string;
  /** Optional admin overrides; when absent the UI falls back to locale strings. */
  name?: string;
  description?: string;
}

export interface ServiceDef {
  key?: string;
  name: string;
  provider?: string;
  description?: string;
  category: string;
  cookies?: string;
}

export interface CookieConsentConfig {
  enabled: boolean;
  version: string;
  position: 'bottom' | 'box' | 'center';
  respectDnt: boolean;
  showRejectAll: boolean;
  title: string | null;
  message: string | null;
  privacyUrl: string | null;
  privacyLabel: string | null;
  categories: CategoryDef[];
  services: ServiceDef[];
}

export interface StoredConsent {
  version: string;
  categories: Record<string, boolean>;
  ts: number;
}

const STORAGE_KEY = 'acc_consent';
const listeners: Array<(c: StoredConsent) => void> = [];

export function config(): CookieConsentConfig {
  const get = <T>(k: string, d: T): T => {
    const v = app.forum.attribute<T>('cookieConsent.' + k);
    return v === undefined || v === null ? d : v;
  };

  return {
    enabled: get('enabled', true),
    version: get('version', '1'),
    position: get('position', 'bottom'),
    respectDnt: get('respectDnt', true),
    showRejectAll: get('showRejectAll', true),
    title: get<string | null>('title', null),
    message: get<string | null>('message', null),
    privacyUrl: get<string | null>('privacyUrl', null),
    privacyLabel: get<string | null>('privacyLabel', null),
    categories: get<CategoryDef[]>('categories', []),
    services: get<ServiceDef[]>('services', []),
  };
}

/** The stored consent if present and matching the current policy version. */
export function loadConsent(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    if (parsed.version !== config().version) return null; // policy changed → re-ask
    return parsed;
  } catch (e) {
    return null;
  }
}

export function hasDecision(): boolean {
  return loadConsent() !== null;
}

export function accepted(categoryKey: string): boolean {
  const c = loadConsent();
  return !!c && !!c.categories[categoryKey];
}

/** Persist consent, run/refresh gated scripts and notify listeners. */
export function saveConsent(categories: Record<string, boolean>): void {
  const cfg = config();
  // Necessary (required) categories are always on.
  cfg.categories.forEach((cat) => {
    if (cat.required) categories[cat.key] = true;
  });

  const previous = loadConsent();
  const next: StoredConsent = { version: cfg.version, categories, ts: Date.now() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    /* storage may be blocked; consent simply won't persist */
  }

  // A revoked category means scripts may already be running — the only safe way
  // to truly stop them is a reload. Newly-granted categories can activate live.
  const revoked = previous
    ? Object.keys(previous.categories).some((k) => previous.categories[k] && !categories[k])
    : false;

  if (revoked) {
    window.location.reload();
    return;
  }

  applyScripts(next);
  listeners.forEach((cb) => cb(next));
}

/** Accept / reject all non-required categories in one go. */
export function decideAll(accept: boolean): void {
  const map: Record<string, boolean> = {};
  config().categories.forEach((cat) => (map[cat.key] = cat.required ? true : accept));
  saveConsent(map);
}

export function onChange(cb: (c: StoredConsent) => void): void {
  listeners.push(cb);
}

/**
 * Inject the scripts gated behind each granted category:
 *  1. admin-entered per-category markup, and
 *  2. any `<script type="text/plain" data-cc-category="key">` placeholders on
 *     the page (the standard "block until consent" pattern other extensions /
 *     themes can use).
 */
export function applyScripts(consent: StoredConsent): void {
  const cfg = config();

  cfg.categories.forEach((cat) => {
    if (!consent.categories[cat.key]) return;

    // (1) admin markup — injected once per category.
    if (cat.scripts && cat.scripts.trim() && !document.querySelector(`[data-acc-injected="${cat.key}"]`)) {
      const holder = document.createElement('div');
      holder.setAttribute('data-acc-injected', cat.key);
      holder.style.display = 'none';
      holder.innerHTML = cat.scripts;
      // innerHTML won't execute <script>, so rebuild them.
      holder.querySelectorAll('script').forEach((old) => reinsert(old));
      document.head.appendChild(holder);
    }

    // (2) activate placeholder scripts for this category.
    document
      .querySelectorAll<HTMLScriptElement>(
        `script[type="text/plain"][data-cc-category="${cat.key}"]:not([data-acc-active])`
      )
      .forEach((placeholder) => {
        placeholder.setAttribute('data-acc-active', '1');
        reinsert(placeholder);
      });
  });
}

/** Re-create a <script> node so the browser actually executes it. */
function reinsert(node: HTMLScriptElement): void {
  const script = document.createElement('script');
  for (const attr of Array.from(node.attributes)) {
    if (attr.name === 'type' || attr.name === 'data-cc-category') continue;
    script.setAttribute(attr.name, attr.value);
  }
  script.type = 'text/javascript';
  if (node.src) script.src = node.src;
  else script.textContent = node.textContent;
  (node.parentNode || document.head).appendChild(script);
}

/** Browser Do-Not-Track / Global Privacy Control signal. */
export function dntEnabled(): boolean {
  const nav = navigator as any;
  return nav.doNotTrack === '1' || nav.doNotTrack === 'yes' || window.doNotTrack === '1' || nav.globalPrivacyControl === true;
}
