import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Badge, Button, Card, List, Segmented, Skeleton, Typography } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/config';
import { NOTIFICATIONS_CHANGED } from '../../layout/NotificationBell';
import { NOTIFICATION_TYPES } from '../../layout/notificationTypes';
import { EmptyState, PageHeader } from '../../ui';
import { apiErrorMessage, formatDateTime, fromNow, getCurrentUser } from '../../utils/format';
import './Notification.css';

const { Text } = Typography;

const NotificationList = () => {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    const me = getCurrentUser();
    try {
      const res = await api.get(`/api/Notifications/GetNotificationsByPlayerId?playerId=${me?.playerId}`);
      setItems(
        (res.data || []).sort((a, b) => new Date(b.notification?.createdAt) - new Date(a.notification?.createdAt))
      );
    } catch (e) {
      message.error(apiErrorMessage(e, t('notifications:list.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (ids) => {
    try {
      await Promise.all(ids.map((id) => api.post(`/api/Notifications/MarkAsRead?playerNotificationId=${id}`)));
      setItems((list) => list.map((n) => (ids.includes(n.playerNotificationId) ? { ...n, isRead: true } : n)));
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
    } catch (e) {
      message.error(apiErrorMessage(e, t('notifications:list.updateFailed')));
    }
  };

  const unread = items.filter((n) => !n.isRead);
  const visible = useMemo(() => (filter === 'unread' ? items.filter((n) => !n.isRead) : items), [items, filter]);

  return (
    <>
      <PageHeader
        title={t('notifications:list.title')}
        subtitle={t('notifications:list.subtitle')}
        icon={<BellOutlined />}
        extra={
          <Button icon={<CheckOutlined />} disabled={!unread.length} onClick={() => markRead(unread.map((n) => n.playerNotificationId))}>
            {t('notifications:list.markAllRead')}
          </Button>
        }
      />
      <Card bordered={false}>
        <Segmented
          style={{ marginBottom: 8 }}
          value={filter}
          onChange={setFilter}
          options={[
            { label: t('notifications:list.filterAll', { count: items.length }), value: 'all' },
            { label: t('notifications:list.filterUnread', { count: unread.length }), value: 'unread' },
          ]}
        />
        {loading ? (
          <Skeleton active avatar paragraph={{ rows: 4 }} />
        ) : visible.length === 0 ? (
          <EmptyState description={filter === 'unread' ? t('notifications:list.emptyUnread') : t('notifications:list.empty')} />
        ) : (
          <List
            dataSource={visible}
            renderItem={(n) => {
              const type = NOTIFICATION_TYPES[n.notification?.type] || NOTIFICATION_TYPES.default;
              return (
                <List.Item
                  className={`mb-notif-row ${n.isRead ? '' : 'is-unread'}`}
                  actions={
                    n.isRead
                      ? []
                      : [
                          <Button key="read" size="small" type="link" onClick={() => markRead([n.playerNotificationId])}>
                            {t('notifications:list.markRead')}
                          </Button>,
                        ]
                  }
                >
                  <List.Item.Meta
                    avatar={
                      <Badge dot={!n.isRead} offset={[-2, 2]}>
                        <span className="mb-notif-icon" style={{ background: type.bg, color: type.color, width: 40, height: 40, fontSize: 18 }}>
                          {type.icon}
                        </span>
                      </Badge>
                    }
                    title={<Text strong={!n.isRead}>{n.notification?.text}</Text>}
                    description={
                      <Text type="secondary" style={{ fontSize: 12 }} title={formatDateTime(n.notification?.createdAt)}>
                        {type.label} · {fromNow(n.notification?.createdAt)}
                      </Text>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Card>
    </>
  );
};

export default NotificationList;
