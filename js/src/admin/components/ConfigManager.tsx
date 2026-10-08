import app from 'flarum/admin/app';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Switch from 'flarum/common/components/Switch';
import type { CategoryDef, ServiceDef } from '../../common/consent';

declare const m: any;
const t = (k: string, p?: any): any => app.translator.trans('ernestdefoe-acc.admin.' + k, p);

const DEFAULT_KEYS = ['necessary', 'performance', 'functional', 'marketing'];

function slug(s: string): string {
  return (s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Edits the cookie categories + services, persisting them as JSON settings. */
export default class ConfigManager extends Component {
  categories: CategoryDef[] = [];
  services: ServiceDef[] = [];
  saving = false;
  saved = false;

  oninit(vnode: any) {
    super.oninit(vnode);
    this.categories = this.parse(
      'ernestdefoe-acc.categories',
      DEFAULT_KEYS.map((key) => ({ key, required: key === 'necessary', scripts: '' }))
    );
    this.services = this.parse('ernestdefoe-acc.services', []);
  }

  parse(key: string, fallback: any) {
    try {
      const raw = app.data.settings[key];
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  view() {
    return m('.AccConfig', [
      m('h3', t('config.categories_title')),
      m('p.helpText', t('config.categories_help')),
      m(
        '.AccConfig-list',
        this.categories.map((c, i) => this.categoryRow(c, i))
      ),
      Button.component({ className: 'Button Button--icon', icon: 'fas fa-plus', onclick: () => this.addCategory() }, t('config.add_category')),

      m('h3', { style: 'margin-top:26px;' }, t('config.services_title')),
      m('p.helpText', t('config.services_help')),
      m(
        '.AccConfig-list',
        this.services.map((s, i) => this.serviceRow(s, i))
      ),
      Button.component({ className: 'Button Button--icon', icon: 'fas fa-plus', onclick: () => this.addService() }, t('config.add_service')),

      m(
        '.AccConfig-save',
        Button.component(
          { className: 'Button Button--primary', loading: this.saving, onclick: () => this.save() },
          this.saved ? t('config.saved') : t('config.save')
        )
      ),
    ]);
  }

  categoryRow(c: CategoryDef, i: number) {
    const isDefault = DEFAULT_KEYS.includes(c.key);
    return m('.AccConfig-item', [
      m('.AccConfig-itemHead', [
        m('input.FormControl', {
          placeholder: isDefault ? app.translator.trans('ernestdefoe-acc.forum.categories.' + c.key + '.name') : t('config.category_name'),
          value: c.name || '',
          oninput: (e: any) => (c.name = e.target.value),
        }),
        m('label.AccConfig-required', [
          m(Switch, { state: !!c.required, disabled: c.key === 'necessary', onchange: (v: boolean) => (c.required = v) }, t('config.required')),
        ]),
        !isDefault
          ? Button.component({ className: 'Button Button--icon Button--text', icon: 'fas fa-trash', onclick: () => this.categories.splice(i, 1) })
          : null,
      ]),
      m('textarea.FormControl.AccConfig-scripts', {
        rows: 2,
        placeholder: t('config.scripts_placeholder'),
        value: c.scripts || '',
        oninput: (e: any) => (c.scripts = e.target.value),
      }),
    ]);
  }

  serviceRow(s: ServiceDef, i: number) {
    return m('.AccConfig-item', [
      m('.AccConfig-itemHead', [
        m('input.FormControl', { placeholder: t('config.service_name'), value: s.name || '', oninput: (e: any) => (s.name = e.target.value) }),
        m('input.FormControl', {
          placeholder: t('config.service_provider'),
          value: s.provider || '',
          oninput: (e: any) => (s.provider = e.target.value),
        }),
        m(
          'select.FormControl',
          { value: s.category || '', onchange: (e: any) => (s.category = e.target.value) },
          this.categories.map((c) => m('option', { value: c.key }, c.name || c.key))
        ),
        Button.component({ className: 'Button Button--icon Button--text', icon: 'fas fa-trash', onclick: () => this.services.splice(i, 1) }),
      ]),
      m('input.FormControl', { placeholder: t('config.service_cookies'), value: s.cookies || '', oninput: (e: any) => (s.cookies = e.target.value) }),
    ]);
  }

  addCategory() {
    this.categories.push({ key: '', name: '', required: false, scripts: '' });
  }

  addService() {
    this.services.push({ name: '', provider: '', category: this.categories[0]?.key || 'necessary', cookies: '', description: '' });
  }

  save() {
    // Finalise keys for any new categories.
    const seen: Record<string, boolean> = {};
    this.categories.forEach((c) => {
      if (!c.key) c.key = slug(c.name || '') || 'category';
      while (seen[c.key]) c.key += '-2';
      seen[c.key] = true;
    });

    this.saving = true;
    this.saved = false;
    const cats = JSON.stringify(this.categories.filter((c) => c.key));
    const svcs = JSON.stringify(this.services.filter((s) => s.name && s.category));

    app
      .request({
        method: 'POST',
        url: app.forum.attribute('apiUrl') + '/settings',
        body: { 'ernestdefoe-acc.categories': cats, 'ernestdefoe-acc.services': svcs },
      })
      .then(() => {
        app.data.settings['ernestdefoe-acc.categories'] = cats;
        app.data.settings['ernestdefoe-acc.services'] = svcs;
        this.saving = false;
        this.saved = true;
        m.redraw();
        setTimeout(() => {
          this.saved = false;
          m.redraw();
        }, 2500);
      })
      .catch(() => {
        this.saving = false;
        m.redraw();
      });
  }
}
