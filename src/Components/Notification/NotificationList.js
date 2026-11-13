import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Segmented, Skeleton } from 'antd';
import { BellOutlined, CheckOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { api } from '../../api/config';
import { onRealtime } from '../../api/realtime';
import { markNotificationRead, NotificationRow, NOTIFICATIONS_CHANGED } from '../../layout/NotificationBell';
import { EmptyState, PageHeader } from '../../ui';
import { apiErrorMessage, getCurrentUser } from '../../utils/format';
import './Notification.css';
import { SwipeTabs } from '../../ui/Swipe';

// Bugün / Dün / Bu hafta / Daha önce
const groupOf = (date) => {
  const d = dayjs(date);
  const today = dayjs().startOf('day');
  if (!d.isBefore(today)) return 'today';
  if (!d.isBefore(today.subtract(1, 'day'))) return 'yesterday';
  if (!d.isBefore(today.subtract(6, 'day'))) return 'week';
  return 'older';
};
const GROUP_ORDER = ['today', 'yesterday', 'week', 'older'];

const NotificationList = () => {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState('all');
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    const me = getCurrentUser();
    try {
      const res = await api.get(`/api/Notifications/GetNotificationsByPlayerId?playerId=${me?.playerId}`);
      setItems((res.data || []).sort((a, b) => new Date(b.notification?.createdAt) - new Date(a.notification?.createdAt)));
      setFailed(false);
    } catch (e) {
      setFailed(true);
      message.error(apiErrorMessage(e, t('notifications:list.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  useEffect(() => {
    load();
    const off = onRealtime('notification', load);
    return off;
  }, [load]);

  const unread = items.filter((n) => !n.isRead);
  const visible = useMemo(() => (filter === 'unread' ? items.filter((n) => !n.isRead) : items), [items, filter]);
  const groups = useMemo(() => {
    const map = {};
    visible.forEach((n) => {
      const g = groupOf(n.notification?.createdAt);
      (map[g] = map[g] || []).push(n);
    });
    return GROUP_ORDER.filter((g) => map[g]?.length).map((g) => ({ key: g, items: map[g] }));
  }, [visible]);

  const markAll = async () => {
    setMarkingAll(true);
    try {
      try {
        await api.post('/api/Notifications/MarkAllAsRead');
      } catch (e) {
        // Eski sunucu: tek tek işaretle
        if (e?.response?.status !== 404) throw e;
        await Promise.all(unread.map((n) => api.post(`/api/Notifications/MarkAsRead?playerNotificationId=${n.playerNotificationId}`)));
      }
      setItems((list) => list.map((n) => ({ ...n, isRead: true })));
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
    } catch (e) {
      message.error(apiErrorMessage(e, t('notifications:list.updateFailed')));
    } finally {
      setMarkingAll(false);
    }
  };

  const openItem = (n, link) => {
    if (!n.isRead) {
      setItems((list) => list.map((x) => (x.playerNotificationId === n.playerNotificationId ? { ...x, isRead: true } : x)));
      markNotificationRead(n);
    }
    if (link) navigate(link);
  };

  return (
    <SwipeTabs>
      <PageHeader
        title={t('notifications:list.title')}
        subtitle={t('notifications:list.subtitle')}
        icon={<BellOutlined />}
        extra={
          <Button icon={<CheckOutlined />} disabled={!unread.length} loading={markingAll} onClick={markAll}>
            {t('notifications:list.markAllRead')}
          </Button>
        }
      />
      <Card bordered={false} className="mb-notif-card">
        <Segmented
          className="mb-notif-filter"
          value={filter}
          onChange={setFilter}
          options={[
            { label: t('notifications:list.filterAll', { count: items.length }), value: 'all' },
            { label: t('notifications:list.filterUnread', { count: unread.length }), value: 'unread' },
          ]}
        />
        {loading ? (
          <Skeleton active avatar paragraph={{ rows: 4 }} />
        ) : failed && items.length === 0 ? (
          <EmptyState description={t('notifications:list.loadFailed')}>
            <Button icon={<ReloadOutlined />} onClick={load}>
              {t('notifications:list.retry')}
            </Button>
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState description={filter === 'unread' ? t('notifications:list.emptyUnread') : t('notifications:list.empty')} />
        ) : (
          groups.map((g) => (
            <section key={g.key} className="mb-notif-group">
              <h3 className="mb-notif-group__title">{t(`notifications:groups.${g.key}`)}</h3>
              {g.items.map((n) => (
                <NotificationRow key={n.playerNotificationId} n={n} onOpen={openItem} />
              ))}
            </section>
          ))
        )}
        <p className="mb-hint mb-notif-hint">{t('notifications:list.tapHint')}</p>
      </Card>
    </SwipeTabs>
  );
};

export default NotificationList;
