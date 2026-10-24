import app from 'flarum/forum/app';

export interface CategoryDef {
  key: string;
  required: boolean;
  scripts?: string;
  /** Admin markup run when this category is rejected or revoked (e.g. to clear its cookies). */
  rejectScripts?: string;
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
  theme: 'auto' | 'light' | 'dark';
  accentColor: string | null;
  width: number | null;
  radius: number | null;
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

export type ConsentAction = 'accept' | 'reject' | 'save';

/** `detail` of the `cookie-consent:change` event. */
export interface ConsentChangeDetail {
  action: ConsentAction;
  /** Every category and whether it is now allowed. */
  categories: Record<string, boolean>;
  /** The categories before this decision, or null if this is the first one. */
  previous: Record<string, boolean> | null;
  /** Categories switched on by this decision. */
  granted: string[];
  /** Categories that were on and are now off. The page reloads right after this event. */
  revoked: string[];
  /** Every category that is now off. */
  rejected: string[];
}

export const CHANGE_EVENT = 'cookie-consent:change';
export const READY_EVENT = 'cookie-consent:ready';

const STORAGE_KEY = 'acc_consent';

export function config(): CookieConsentConfig {
  const get = <T>(k: string, d: T): T => {
    const v = app.forum.attribute<T>('cookieConsent.' + k);
    return v === undefined || v === null ? d : v;
  };

  return {
    enabled: get('enabled', true),
    version: get('version', '1'),
    position: get('position', 'bottom'),
    theme: get('theme', 'auto'),
    accentColor: get<string | null>('accentColor', null),
    width: get<number | null>('width', null),
    radius: get<number | null>('radius', null),
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
export function saveConsent(categories: Record<string, boolean>, action: ConsentAction = 'save'): void {
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

  const before = previous ? previous.categories : null;
  const keys = cfg.categories.map((cat) => cat.key);
  const detail: ConsentChangeDetail = {
    action,
    categories: { ...categories },
    previous: before ? { ...before } : null,
    granted: keys.filter((k) => categories[k] && !(before && before[k])),
    revoked: before ? Object.keys(before).filter((k) => before[k] && !categories[k]) : [],
    rejected: keys.filter((k) => !categories[k]),
  };

  // Listeners run before any reload so they can clean up (e.g. delete cookies).
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail }));

  // A revoked category means scripts may already be running — the only safe way
  // to truly stop them is a reload. Newly-granted categories can activate live;
  // the reject scripts of revoked ones run when the reloaded page boots.
  if (detail.revoked.length) {
    window.location.reload();
    return;
  }

  applyScripts(next);
}

/** Accept / reject all non-required categories in one go. */
export function decideAll(accept: boolean): void {
  const map: Record<string, boolean> = {};
  config().categories.forEach((cat) => (map[cat.key] = cat.required ? true : accept));
  saveConsent(map, accept ? 'accept' : 'reject');
}

/** Read-only snapshot of the current decision (null until the visitor decides). */
export function getConsent(): Record<string, boolean> | null {
  const c = loadConsent();
  return c ? { ...c.categories } : null;
}

/** Subscribe to consent decisions (given, rejected, changed or revoked). Returns an unsubscribe function. */
export function on(cb: (detail: ConsentChangeDetail) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<ConsentChangeDetail>).detail);
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}

/** Legacy subscriber: receives the stored consent after every decision. */
export function onChange(cb: (c: StoredConsent) => void): () => void {
  return on((d) => cb({ version: config().version, categories: d.categories, ts: Date.now() }));
}

/**
 * Inject the scripts gated behind each category:
 *  1. admin-entered per-category markup — the consent scripts of granted
 *     categories, the reject scripts of declined ones, and
 *  2. any `<script type="text/plain" data-cc-category="key">` placeholders on
 *     the page (the standard "block until consent" pattern other extensions /
 *     themes can use).
 */
export function applyScripts(consent: StoredConsent): void {
  const cfg = config();

  cfg.categories.forEach((cat) => {
    if (!consent.categories[cat.key]) {
      inject(cat.key + ':reject', cat.rejectScripts);
      return;
    }

    // (1) admin markup — injected once per category.
    inject(cat.key, cat.scripts);

    // (2) activate placeholder scripts for this category.
    document
      .querySelectorAll<HTMLScriptElement>(`script[type="text/plain"][data-cc-category="${cat.key}"]:not([data-acc-active])`)
      .forEach((placeholder) => {
        placeholder.setAttribute('data-acc-active', '1');
        reinsert(placeholder);
      });
  });
}

/** Inject admin markup once per page, executing any <script> in it. */
function inject(marker: string, markup?: string): void {
  if (!markup || !markup.trim() || document.querySelector(`[data-acc-injected="${marker}"]`)) return;
  const holder = document.createElement('div');
  holder.setAttribute('data-acc-injected', marker);
  holder.style.display = 'none';
  holder.innerHTML = markup;
  // innerHTML won't execute <script>, so rebuild them.
  holder.querySelectorAll('script').forEach((old) => reinsert(old));
  document.head.appendChild(holder);
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
  // window.doNotTrack is the legacy IE/Edge and old Safari spelling, absent from the DOM typings.
  const win = window as Window & { doNotTrack?: string };
  return nav.doNotTrack === '1' || nav.doNotTrack === 'yes' || win.doNotTrack === '1' || nav.globalPrivacyControl === true;
}
