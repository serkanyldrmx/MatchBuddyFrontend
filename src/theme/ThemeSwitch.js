import React from 'react';
import { Segmented } from 'antd';
import { DesktopOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useThemeMode } from './ThemeContext';

const OPTIONS = [
  { value: 'system', icon: <DesktopOutlined />, labelKey: 'common:theme.system' },
  { value: 'light', icon: <SunOutlined />, labelKey: 'common:theme.light' },
  { value: 'dark', icon: <MoonOutlined />, labelKey: 'common:theme.dark' },
];

/**
 * Tema seçici: Sistem / Açık / Koyu.
 * compact: kullanıcı menüsü gibi dar yerler için küçük sürüm.
 */
export default function ThemeSwitch({ compact = false, block = false, className = '' }) {
  const { t } = useTranslation();
  const { mode, setMode } = useThemeMode();
  return (
    <Segmented
      className={`mb-theme-switch${compact ? ' mb-theme-switch--compact' : ''} ${className}`.trim()}
      size={compact ? 'small' : 'middle'}
      block={block}
      value={mode}
      onChange={(v) => setMode(v)}
      aria-label={t('common:theme.label')}
      options={OPTIONS.map((o) => ({
        value: o.value,
        label: (
          <span title={t(o.labelKey)}>
            {o.icon}
            <span>{t(o.labelKey)}</span>
          </span>
        ),
      }))}
    />
  );
}

/**
 * Kabukların kullanıcı açılır menüsüne eklenecek öğe:
 *   items: [ ..., themeMenuItem(), { type: 'divider' }, ... ]
 * Seçiciye tıklamak menüyü kapatmaz.
 */
export function themeMenuItem() {
  return {
    key: 'theme',
    className: 'mb-theme-menu-entry',
    label: (
      // menü öğesinin tıklama (ve menüyü kapatma) davranışını engelle
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
      <div className="mb-theme-menu-item" onClick={(e) => e.stopPropagation()}>
        <span className="mb-theme-menu-item__label">{i18n.t('common:theme.label')}</span>
        <ThemeSwitch compact block />
      </div>
    ),
  };
}
