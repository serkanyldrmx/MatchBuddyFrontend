import React, { useEffect, useState } from 'react';
import { Alert, App, Button, Card, Input, Modal, Radio, Skeleton, Switch, Tag } from 'antd';
import { BellOutlined, DeleteOutlined, LockOutlined, SettingOutlined, StopOutlined, WarningOutlined } from '@ant-design/icons';
import { logout } from '../../api/config';
import { emit, MESSAGE_PERMISSION, PROFILE_VISIBILITY, socialApi, SOCIAL_CHANGED } from '../../api/social';
import { EmptyState, PageHeader, PlayerAvatar } from '../../ui';
import { apiErrorMessage, fullName } from '../../utils/format';
import './Settings.css';

const MESSAGE_OPTIONS = [
  { value: MESSAGE_PERMISSION.EVERYONE, title: 'Herkes', desc: 'Her oyuncu sana mesaj atabilir.' },
  { value: MESSAGE_PERMISSION.MUTUALS, title: 'Sadece arkadaşlarım', desc: 'Karşılıklı takipleştiğin oyuncular.' },
  {
    value: MESSAGE_PERMISSION.MUTUALS_AND_TEAMMATES,
    title: 'Arkadaşlarım ve birlikte maç yaptıklarım',
    desc: 'Arkadaşların ve aynı maçta oynadığın oyuncular.',
    recommended: true,
  },
];

const VISIBILITY_OPTIONS = [
  { value: PROFILE_VISIBILITY.EVERYONE, title: 'Herkes', desc: 'İstatistiklerini ve takımlarını herkes görebilir.' },
  { value: PROFILE_VISIBILITY.FOLLOWERS, title: 'Beni takip edenler', desc: 'Sadece seni takip eden oyuncular görebilir.' },
  { value: PROFILE_VISIBILITY.ONLY_ME, title: 'Sadece ben', desc: 'İstatistiklerin herkesten gizlenir.' },
];

const NOTIFY = [
  { key: 'notifyFollow', title: 'Yeni takipçi', desc: 'Biri seni takip etmeye başladığında.' },
  { key: 'notifyMatchInvite', title: 'Maç davetleri', desc: 'Bir arkadaşın seni maça çağırdığında.' },
  { key: 'notifyTeamInvite', title: 'Takım davetleri', desc: 'Bir takıma davet edildiğinde.' },
  { key: 'notifyMatchReminder', title: 'Maç hatırlatmaları', desc: 'Katıldığın maç yaklaştığında.' },
  { key: 'notifyMatchResult', title: 'Maç sonuçları', desc: 'Oynadığın maçın skoru girildiğinde.' },
  { key: 'notifyMatchUpdates', title: 'Maç güncellemeleri', desc: 'Onay, iptal, kadro ve yedek listesi değişiklikleri.' },
];

/** Seçenek kartları olarak radyo grubu */
function OptionCards({ value, options, onChange, disabled }) {
  return (
    <Radio.Group value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="mb-option-cards">
      {options.map((o) => (
        <Radio key={o.value} value={o.value} className={`mb-option-card ${value === o.value ? 'is-active' : ''}`}>
          <span className="mb-option-card__title">
            {o.title}
            {o.recommended && <Tag className="mb-option-card__tag">Önerilen</Tag>}
          </span>
          <span className="mb-option-card__desc">{o.desc}</span>
        </Radio>
      ))}
    </Radio.Group>
  );
}

export default function Settings() {
  const { message } = App.useApp();
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
      .catch((e) => message.error(apiErrorMessage(e, 'Ayarlar yüklenemedi.')))
      .finally(() => setLoading(false));
    socialApi
      .blocked()
      .then((list) => setBlocked(list || []))
      .catch(() => setBlocked([]))
      .finally(() => setBlockedLoading(false));
  }, [message]);

  // Her değişiklik anında kaydedilir; hata olursa eski değere döner
  const update = async (patch) => {
    const prev = settings;
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    try {
      await socialApi.saveSettings(next);
      message.success({ content: 'Kaydedildi.', key: 'settings-save', duration: 1.5 });
    } catch (e) {
      setSettings(prev);
      message.error(apiErrorMessage(e, 'Ayar kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  };

  const unblock = async (p) => {
    setUnblocking(p.playerId);
    try {
      await socialApi.unblock(p.playerId);
      setBlocked((list) => list.filter((x) => x.playerId !== p.playerId));
      message.success(`${fullName(p)} adlı oyuncunun engeli kaldırıldı.`);
      emit(SOCIAL_CHANGED);
    } catch (e) {
      message.error(apiErrorMessage(e));
    } finally {
      setUnblocking(null);
    }
  };

  const canDelete = password && confirmText.trim().toLocaleUpperCase('tr') === 'SİL';

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await socialApi.deleteAccount(password);
      logout();
      window.location.href = '/';
    } catch (e) {
      message.error(apiErrorMessage(e, 'Hesap silinemedi.'));
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
        eyebrow="Hesap"
        title="Ayarlar"
        subtitle="Değişiklikler otomatik kaydedilir."
        icon={<SettingOutlined />}
      />

      <Card
        bordered={false}
        title={<span><LockOutlined /> Gizlilik</span>}
        extra={saving ? <span className="mb-settings__saving">Kaydediliyor…</span> : null}
      >
        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : !settings ? (
          <EmptyState description="Ayarlar yüklenemedi." />
        ) : (
          <>
            <div className="mb-settings__group">
              <h4>Bana kim mesaj atabilir?</h4>
              <OptionCards
                value={settings.messagePermission}
                options={MESSAGE_OPTIONS}
                onChange={(v) => update({ messagePermission: v })}
              />
              <p className="mb-settings__hint">Daha önce sana yazmış olduğun kişiler her zaman cevap verebilir.</p>
            </div>
            <div className="mb-settings__group">
              <h4>İstatistiklerimi kim görebilir?</h4>
              <OptionCards
                value={settings.profileVisibility}
                options={VISIBILITY_OPTIONS}
                onChange={(v) => update({ profileVisibility: v })}
              />
            </div>
          </>
        )}
      </Card>

      <Card bordered={false} title={<span><BellOutlined /> Bildirimler</span>}>
        {loading ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : settings ? (
          <div className="mb-settings__switches">
            {NOTIFY.map((n) => (
              <div key={n.key} className="mb-settings__switch">
                <div>
                  <strong>{n.title}</strong>
                  <span>{n.desc}</span>
                </div>
                <Switch checked={!!settings[n.key]} onChange={(v) => update({ [n.key]: v })} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState description="Ayarlar yüklenemedi." />
        )}
      </Card>

      <Card bordered={false} title={<span><StopOutlined /> Engellenenler</span>}>
        {blockedLoading ? (
          <Skeleton avatar active paragraph={{ rows: 1 }} />
        ) : !blocked.length ? (
          <EmptyState description="Engellediğin kimse yok." />
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
                  Engeli kaldır
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card bordered={false} className="mb-settings__danger" title={<span><WarningOutlined /> Hesap</span>}>
        <div className="mb-settings__danger-row">
          <div>
            <strong>Hesabımı sil</strong>
            <span>
              Profilin anonimleştirilir, takiplerin ve davetlerin silinir, gelecekteki maçlardan çıkarılırsın. Bu işlem
              geri alınamaz.
            </span>
          </div>
          <Button danger icon={<DeleteOutlined />} onClick={() => setDeleteOpen(true)}>
            Hesabımı sil
          </Button>
        </div>
      </Card>

      <Modal
        open={deleteOpen}
        title="Hesabını silmek istediğine emin misin?"
        okText="Hesabımı kalıcı olarak sil"
        cancelText="Vazgeç"
        okButtonProps={{ danger: true, disabled: !canDelete, loading: deleting }}
        onOk={deleteAccount}
        onCancel={closeDelete}
        destroyOnClose
      >
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Bu işlem geri alınamaz"
          description="Geçmiş maç kayıtların 'Silinmiş Kullanıcı' olarak kalır, diğer tüm bilgilerin silinir."
        />
        <div className="mb-settings__field">
          <label htmlFor="mb-delete-password">Şifren</label>
          <Input.Password
            id="mb-delete-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="mb-settings__field">
          <label htmlFor="mb-delete-confirm">
            Onaylamak için <strong>SİL</strong> yaz
          </label>
          <Input id="mb-delete-confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="SİL" />
        </div>
      </Modal>
    </div>
  );
}
