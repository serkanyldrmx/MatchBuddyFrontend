import React, { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Empty, List, Popover, Typography } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/config';
import { onRealtime } from '../api/realtime';
import { syncPushSubscription } from '../pwa';
import { fromNow, getCurrentUser } from '../utils/format';
import { NOTIFICATION_TYPES } from './notificationTypes';

const { Text } = Typography;
export const NOTIFICATIONS_CHANGED = 'mb:notifications-changed';

/** Üst bardaki bildirim zili: okunmamış sayısı + son 5 bildirim */
export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

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

  const content = (
    <div style={{ width: 360 }}>
      <List
        size="small"
        dataSource={items.slice(0, 5)}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('layout:notifications.empty')} /> }}
        renderItem={(n) => {
          const type = NOTIFICATION_TYPES[n.notification?.type] || NOTIFICATION_TYPES.default;
          return (
            <List.Item style={{ alignItems: 'flex-start', opacity: n.isRead ? 0.65 : 1 }}>
              <List.Item.Meta
                avatar={<span className="mb-notif-icon" style={{ background: type.bg, color: type.color }}>{type.icon}</span>}
                title={<Text strong={!n.isRead} style={{ fontSize: 13 }} ellipsis={{ rows: 2 }}>{n.notification?.text}</Text>}
                description={<Text type="secondary" style={{ fontSize: 12 }}>{fromNow(n.notification?.createdAt)}</Text>}
              />
            </List.Item>
          );
        }}
      />
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
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) load();
      }}
    >
      <Badge count={unread} size="small" offset={[-4, 4]}>
        <Button className="mb-icon-btn" icon={<BellOutlined />} aria-label={t('layout:notifications.title')} />
      </Badge>
    </Popover>
  );
}
