import React, { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Empty, Grid, Popover, Typography } from 'antd';
import { BellOutlined, RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/config';
import { onRealtime } from '../api/realtime';
import { syncPushSubscription } from '../pwa';
import { fromNow, getCurrentUser } from '../utils/format';
import { notificationLink, notificationType } from './notificationTypes';

const { Text } = Typography;
export const NOTIFICATIONS_CHANGED = 'mb:notifications-changed';

/** Bildirimi okundu işaretler (sessiz) ve diğer bileşenlere haber verir */
export async function markNotificationRead(n) {
  if (!n || n.isRead) return;
  try {
    await api.post(`/api/Notifications/MarkAsRead?playerNotificationId=${n.playerNotificationId}`);
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
  } catch {
    /* okundu işareti kritik değil */
  }
}

/** Tek bir bildirim satırı (zil açılır listesi ve bildirimler sayfası ortak) */
export function NotificationRow({ n, onOpen, compact = false }) {
  const type = notificationType(n);
  const link = notificationLink(n);
  return (
    <button
      type="button"
      className={`mb-notif-item ${n.isRead ? '' : 'is-unread'} ${compact ? 'is-compact' : ''} ${link ? '' : 'is-static'}`}
      onClick={() => onOpen(n, link)}
    >
      <span className="mb-notif-icon" style={{ background: type.bg, color: type.color }}>
        {type.icon}
      </span>
      <span className="mb-notif-item__body">
        <Text strong={!n.isRead} className="mb-notif-item__text">
          {n.notification?.text}
        </Text>
        <Text type="secondary" className="mb-notif-item__meta">
          {type.label} · {fromNow(n.notification?.createdAt)}
        </Text>
      </span>
      {!n.isRead && <span className="mb-notif-item__dot" aria-hidden="true" />}
      {link && <RightOutlined className="mb-notif-item__chevron" aria-hidden="true" />}
    </button>
  );
}

/** Üst bardaki bildirim zili: okunmamış sayısı + son bildirimler. Telefonda doğrudan bildirimler sayfasını açar. */
export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const screens = Grid.useBreakpoint();
  const isPhone = screens.md === false;

  const load = useCallback(async () => {
    const me = getCurrentUser();
    if (!me?.playerId) return;
    try {
      const res = await api.get(`/api/Notifications/GetNotificationsByPlayerId?playerId=${me.playerId}`);
      const sorted = (res.data || []).sort(
        (a, b) => new Date(b.notification?.createdAt) - new Date(a.notification?.createdAt)
      );
      setItems(sorted);
    } catch {
      /* üst barda sessiz geç */
    }
  }, []);

  useEffect(() => {
    load();
    // Yeni bildirim anında gelir (anlık bağlantı); bağlantı yoksa yavaş yoklama devam eder
    const timer = setInterval(load, 60000);
    const off = onRealtime('notification', load);
    window.addEventListener(NOTIFICATIONS_CHANGED, load);
    syncPushSubscription();
    return () => {
      off();
      clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_CHANGED, load);
    };
  }, [load]);

  const unread = items.filter((n) => !n.isRead).length;

  const openItem = (n, link) => {
    setOpen(false);
    if (!n.isRead) {
      setItems((list) => list.map((x) => (x.playerNotificationId === n.playerNotificationId ? { ...x, isRead: true } : x)));
      markNotificationRead(n);
    }
    navigate(link || '/NotificationList');
  };

  const bell = (
    <Badge count={unread} size="small" offset={[-4, 4]}>
      <Button
        className="mb-icon-btn"
        icon={<BellOutlined />}
        aria-label={t('layout:notifications.title')}
        onClick={isPhone ? () => navigate('/NotificationList') : undefined}
      />
    </Badge>
  );

  // Telefonda açılır pencere ekranın dışına taşıyordu: zil doğrudan tam sayfa listeyi açar
  if (isPhone) return bell;

  const content = (
    <div className="mb-notif-popover">
      {items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('layout:notifications.empty')} />
      ) : (
        <div className="mb-notif-popover__list">
          {items.slice(0, 6).map((n) => (
            <NotificationRow key={n.playerNotificationId} n={n} onOpen={openItem} compact />
          ))}
        </div>
      )}
      <Button
        block
        type="link"
        onClick={() => {
          setOpen(false);
          navigate('/NotificationList');
        }}
      >
        {t('layout:notifications.seeAll')}
      </Button>
    </div>
  );

  return (
    <Popover
      content={content}
      title={t('layout:notifications.title')}
      trigger="click"
      placement="bottomRight"
      arrow={false}
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) load();
      }}
    >
      {bell}
    </Popover>
  );
}
