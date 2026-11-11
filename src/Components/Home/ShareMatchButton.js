import React, { useState } from 'react';
import { App, Button, Dropdown } from 'antd';
import { CopyOutlined, ShareAltOutlined, WhatsAppOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { matchesApi } from '../../api/matches';
import { apiErrorMessage } from '../../utils/format';

/**
 * Maçı WhatsApp'ta / başka uygulamada paylaş (MatchBuddy/docs/engagement-api.md §3).
 * Link ilk tıklamada oluşur; önizleme kartında maçın adı, saati, sahası ve eksik kişi sayısı görünür.
 */
export default function ShareMatchButton({ matchId, className, size = 'large' }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(false);

  const getLink = async () => {
    if (link) return link;
    setLoading(true);
    try {
      const res = await matchesApi.shareLink(matchId);
      setLink(res);
      return res;
    } catch (e) {
      message.error(apiErrorMessage(e, t('match:share.failed')));
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Tarayıcı açılır pencereyi engellemesin diye pencere tıklama anında açılır, adres sonra verilir
  const whatsapp = async () => {
    const win = window.open('', '_blank');
    const l = await getLink();
    if (!l) {
      win?.close();
      return;
    }
    const url = `https://wa.me/?text=${encodeURIComponent(l.text)}`;
    if (win) win.location.href = url;
    else window.location.href = url;
  };

  const copy = async () => {
    const l = await getLink();
    if (!l) return;
    try {
      await navigator.clipboard.writeText(l.url);
      message.success(t('match:share.copied'));
    } catch {
      message.info(l.url);
    }
  };

  const nativeShare = async () => {
    const l = await getLink();
    if (!l) return;
    try {
      await navigator.share({ title: t('match:share.title'), text: l.text });
    } catch {
      /* kullanıcı vazgeçti */
    }
  };

  const items = [
    { key: 'wa', icon: <WhatsAppOutlined style={{ color: '#25D366' }} />, label: t('match:share.whatsapp'), onClick: whatsapp },
    { key: 'copy', icon: <CopyOutlined />, label: t('match:share.copy'), onClick: copy },
    ...(navigator.share ? [{ key: 'native', icon: <ShareAltOutlined />, label: t('match:share.other'), onClick: nativeShare }] : []),
  ];

  return (
    <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
      <Button size={size} icon={<WhatsAppOutlined />} loading={loading} className={className}>
        {t('match:share.button')}
      </Button>
    </Dropdown>
  );
}
