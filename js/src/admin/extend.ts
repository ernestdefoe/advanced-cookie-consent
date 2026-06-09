import Extend from 'flarum/common/extenders';
import app from 'flarum/admin/app';
import ConfigManager from './components/ConfigManager';

declare const m: any;
const t = (k: string) => app.translator.trans('ernestdefoe-acc.admin.' + k);

export default [
  new Extend.Admin()
    .setting(() => ({ setting: 'ernestdefoe-acc.enabled', type: 'boolean', label: t('settings.enabled'), default: true }))
    .setting(() => ({
      setting: 'ernestdefoe-acc.position',
      type: 'select',
      label: t('settings.position'),
      options: { bottom: t('settings.position_bottom'), box: t('settings.position_box'), center: t('settings.position_center') },
      default: 'bottom',
    }))
    .setting(() => ({ setting: 'ernestdefoe-acc.show_reject_all', type: 'boolean', label: t('settings.show_reject_all'), default: true }))
    .setting(() => ({ setting: 'ernestdefoe-acc.respect_dnt', type: 'boolean', label: t('settings.respect_dnt'), help: t('settings.respect_dnt_help'), default: true }))
    .setting(() => ({ setting: 'ernestdefoe-acc.version', type: 'text', label: t('settings.version'), help: t('settings.version_help'), default: '1' }))
    .setting(() => ({ setting: 'ernestdefoe-acc.title', type: 'text', label: t('settings.title'), help: t('settings.blank_default') }))
    .setting(() => ({ setting: 'ernestdefoe-acc.message', type: 'textarea', label: t('settings.message'), help: t('settings.blank_default') }))
    .setting(() => ({ setting: 'ernestdefoe-acc.privacy_url', type: 'text', label: t('settings.privacy_url') }))
    .setting(() => ({ setting: 'ernestdefoe-acc.privacy_label', type: 'text', label: t('settings.privacy_label'), help: t('settings.blank_default') }))
    // Category + service managers (persist JSON settings themselves).
    .customSetting(() => m(ConfigManager), -10),
];
