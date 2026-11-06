import React, { useEffect, useState } from 'react';
import { Alert, App, Button, Card, Input, Modal, Radio, Skeleton, Switch, Tag } from 'antd';
import { BellOutlined, BgColorsOutlined, DeleteOutlined, LockOutlined, SettingOutlined, StopOutlined, WarningOutlined } from '@ant-design/icons';
import { Trans, useTranslation } from 'react-i18next';
import { logout } from '../../api/config';
import { emit, MESSAGE_PERMISSION, PROFILE_VISIBILITY, socialApi, SOCIAL_CHANGED } from '../../api/social';
import { EmptyState, PageHeader, PlayerAvatar } from '../../ui';
import { apiErrorMessage, fullName } from '../../utils/format';
import ThemeSwitch from '../../theme/ThemeSwitch';
import './Settings.css';

// Metinler render sırasında çevrilir (settings:privacy.* / settings:notifications.*)
const opt = (base) => ({ titleKey: `${base}.title`, descKey: `${base}.desc` });

const MESSAGE_OPTIONS = [
  { value: MESSAGE_PERMISSION.EVERYONE, ...opt('settings:privacy.message.everyone') },
  { value: MESSAGE_PERMISSION.MUTUALS, ...opt('settings:privacy.message.mutuals') },
  { value: MESSAGE_PERMISSION.MUTUALS_AND_TEAMMATES, ...opt('settings:privacy.message.mutualsAndTeammates'), recommended: true },
];

const VISIBILITY_OPTIONS = [
  { value: PROFILE_VISIBILITY.EVERYONE, ...opt('settings:privacy.visibility.everyone') },
  { value: PROFILE_VISIBILITY.FOLLOWERS, ...opt('settings:privacy.visibility.followers') },
  { value: PROFILE_VISIBILITY.ONLY_ME, ...opt('settings:privacy.visibility.onlyMe') },
];

const NOTIFY = [
  { key: 'notifyFollow', ...opt('settings:notifications.follow') },
  { key: 'notifyMatchInvite', ...opt('settings:notifications.matchInvite') },
  { key: 'notifyTeamInvite', ...opt('settings:notifications.teamInvite') },
  { key: 'notifyMatchReminder', ...opt('settings:notifications.matchReminder') },
  { key: 'notifyMatchResult', ...opt('settings:notifications.matchResult') },
  { key: 'notifyMatchUpdates', ...opt('settings:notifications.matchUpdates') },
];

/** Seçenek kartları olarak radyo grubu */
function OptionCards({ value, options, onChange, disabled }) {
  const { t } = useTranslation();
  return (
    <Radio.Group value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="mb-option-cards">
      {options.map((o) => (
        <Radio key={o.value} value={o.value} className={`mb-option-card ${value === o.value ? 'is-active' : ''}`}>
          <span className="mb-option-card__title">
            {t(o.titleKey)}
            {o.recommended && <Tag className="mb-option-card__tag">{t('settings:privacy.recommended')}</Tag>}
          </span>
          <span className="mb-option-card__desc">{t(o.descKey)}</span>
        </Radio>
      ))}
    </Radio.Group>
  );
}

export default function Settings() {
  const { message } = App.useApp();
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(true);
  const [unblocking, setUnblocking] = useState(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    socialApi
      .getSettings()
      .then(setSettings)
      .catch((e) => message.error(apiErrorMessage(e, t('settings:loadError'))))
      .finally(() => setLoading(false));
    socialApi
      .blocked()
      .then((list) => setBlocked(list || []))
      .catch(() => setBlocked([]))
      .finally(() => setBlockedLoading(false));
  }, [message, t]);

  // Her değişiklik anında kaydedilir; hata olursa eski değere döner
  const update = async (patch) => {
    const prev = settings;
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    try {
      await socialApi.saveSettings(next);
      message.success({ content: t('common:status.saved'), key: 'settings-save', duration: 1.5 });
    } catch (e) {
      setSettings(prev);
      message.error(apiErrorMessage(e, t('settings:saveError')));
    } finally {
      setSaving(false);
    }
  };

  const unblock = async (p) => {
    setUnblocking(p.playerId);
    try {
      await socialApi.unblock(p.playerId);
      setBlocked((list) => list.filter((x) => x.playerId !== p.playerId));
      message.success(t('settings:blocked.unblocked', { name: fullName(p) }));
      emit(SOCIAL_CHANGED);
    } catch (e) {
      message.error(apiErrorMessage(e));
    } finally {
      setUnblocking(null);
    }
  };

  const confirmWord = t('settings:deleteAccount.confirmWord');
  const canDelete = password && confirmText.trim().toLocaleUpperCase(i18n.language) === confirmWord.toLocaleUpperCase(i18n.language);

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await socialApi.deleteAccount(password);
      logout();
      window.location.href = '/';
    } catch (e) {
      message.error(apiErrorMessage(e, t('settings:deleteAccount.error')));
      setDeleting(false);
    }
  };

  const closeDelete = () => {
    setDeleteOpen(false);
    setPassword('');
    setConfirmText('');
  };

  return (
    <div className="mb-settings">
      <PageHeader
        eyebrow={t('settings:header.eyebrow')}
        title={t('settings:header.title')}
        subtitle={t('settings:header.subtitle')}
        icon={<SettingOutlined />}
      />

      <Card bordered={false} title={<span><BgColorsOutlined /> {t('settings:appearance.title')}</span>}>
        <div className="mb-settings__theme">
          <div>
            <strong>{t('settings:appearance.theme')}</strong>
            <span>{t('settings:appearance.themeHint')}</span>
          </div>
          <ThemeSwitch />
        </div>
      </Card>

      <Card
        bordered={false}
        title={<span><LockOutlined /> {t('settings:privacy.title')}</span>}
        extra={saving ? <span className="mb-settings__saving">{t('settings:saving')}</span> : null}
      >
        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : !settings ? (
          <EmptyState description={t('settings:loadError')} />
        ) : (
          <>
            <div className="mb-settings__group">
              <h4>{t('settings:privacy.message.question')}</h4>
              <OptionCards
                value={settings.messagePermission}
                options={MESSAGE_OPTIONS}
                onChange={(v) => update({ messagePermission: v })}
              />
              <p className="mb-settings__hint">{t('settings:privacy.message.hint')}</p>
            </div>
            <div className="mb-settings__group">
              <h4>{t('settings:privacy.visibility.question')}</h4>
              <OptionCards
                value={settings.profileVisibility}
                options={VISIBILITY_OPTIONS}
                onChange={(v) => update({ profileVisibility: v })}
              />
            </div>
          </>
        )}
      </Card>

      <Card bordered={false} title={<span><BellOutlined /> {t('settings:notifications.title')}</span>}>
        {loading ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : settings ? (
          <div className="mb-settings__switches">
            {NOTIFY.map((n) => (
              <div key={n.key} className="mb-settings__switch">
                <div>
                  <strong>{t(n.titleKey)}</strong>
                  <span>{t(n.descKey)}</span>
                </div>
                <Switch checked={!!settings[n.key]} onChange={(v) => update({ [n.key]: v })} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState description={t('settings:loadError')} />
        )}
      </Card>

      <Card bordered={false} title={<span><StopOutlined /> {t('settings:blocked.title')}</span>}>
        {blockedLoading ? (
          <Skeleton avatar active paragraph={{ rows: 1 }} />
        ) : !blocked.length ? (
          <EmptyState description={t('settings:blocked.empty')} />
        ) : (
          <div className="mb-settings__blocked">
            {blocked.map((p) => (
              <div key={p.playerId} className="mb-settings__blocked-row">
                <PlayerAvatar player={p} size={40} />
                <div className="mb-settings__blocked-name">
                  <strong>{fullName(p)}</strong>
                  <span>@{p.userName}</span>
                </div>
                <Button size="small" loading={unblocking === p.playerId} onClick={() => unblock(p)}>
                  {t('settings:blocked.unblock')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card bordered={false} className="mb-settings__danger" title={<span><WarningOutlined /> {t('settings:header.eyebrow')}</span>}>
        <div className="mb-settings__danger-row">
          <div>
            <strong>{t('settings:deleteAccount.button')}</strong>
            <span>{t('settings:deleteAccount.description')}</span>
          </div>
          <Button danger icon={<DeleteOutlined />} onClick={() => setDeleteOpen(true)}>
            {t('settings:deleteAccount.button')}
          </Button>
        </div>
      </Card>

      <Modal
        open={deleteOpen}
        title={t('settings:deleteAccount.modalTitle')}
        okText={t('settings:deleteAccount.ok')}
        cancelText={t('common:actions.cancel')}
        okButtonProps={{ danger: true, disabled: !canDelete, loading: deleting }}
        onOk={deleteAccount}
        onCancel={closeDelete}
        destroyOnClose
      >
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('settings:deleteAccount.alertTitle')}
          description={t('settings:deleteAccount.alertDescription')}
        />
        <div className="mb-settings__field">
          <label htmlFor="mb-delete-password">{t('settings:deleteAccount.password')}</label>
          <Input.Password
            id="mb-delete-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="mb-settings__field">
          <label htmlFor="mb-delete-confirm">
            <Trans i18nKey="settings:deleteAccount.typeToConfirm" values={{ word: confirmWord }} components={{ b: <strong /> }} />
          </label>
          <Input id="mb-delete-confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={confirmWord} />
        </div>
      </Modal>
    </div>
  );
}
