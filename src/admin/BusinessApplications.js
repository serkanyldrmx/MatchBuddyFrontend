import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Card, Empty, Input, Segmented, Select, Skeleton, Space, Tag, Typography } from 'antd';
import { MailOutlined, PhoneOutlined, ReloadOutlined, ShopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { api } from '../api/config';
import { PageHeader } from '../ui';
import { apiErrorMessage } from '../utils/format';
import { formatPhone } from '../utils/phone';
import { SwipeTabs } from '../ui/Swipe';

const { Text, Paragraph } = Typography;

// Sunucu: BusinessApplicationStatus (0 yeni, 1 arandı, 2 hesap açıldı, 3 olumsuz)
const STATUS = [
  { value: 0, key: 'new', color: 'gold' },
  { value: 1, key: 'contacted', color: 'blue' },
  { value: 2, key: 'converted', color: 'green' },
  { value: 3, key: 'rejected', color: 'default' },
];

export const bizAppsApi = {
  list: (status) => api.get('/api/BusinessApplications', { params: { status } }).then((r) => r.data || []),
  newCount: () => api.get('/api/BusinessApplications/NewCount').then((r) => r.data || 0),
  update: (body) => api.post('/api/BusinessApplications/Update', body).then((r) => r.data),
};

function ApplicationCard({ a, onSaved }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [note, setNote] = useState(a.adminNote || '');
  const [saving, setSaving] = useState(false);
  const status = STATUS.find((s) => s.value === a.status) || STATUS[0];

  const save = async (patch) => {
    setSaving(true);
    try {
      await bizAppsApi.update({ businessApplicationId: a.businessApplicationId, status: a.status, adminNote: note, ...patch });
      message.success(t('common:status.saved'));
      onSaved();
    } catch (e) {
      message.error(apiErrorMessage(e, t('admin:bizApps.saveError')));
    } finally {
      setSaving(false);
    }
  };

  const place = [a.city, a.district].filter(Boolean).join(' / ');
  return (
    <Card bordered={false} className="mb-bizapp" size="small">
      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
          <Text strong style={{ fontSize: 16 }}>
            <ShopOutlined /> {a.businessName}
          </Text>
          <Tag color={status.color}>{t(`admin:bizApps.status.${status.key}`)}</Tag>
        </Space>
        <Text type="secondary">
          {a.contactName}
          {place && ` · ${place}`}
          {a.pitchCount ? ` · ${t('admin:bizApps.pitches', { count: a.pitchCount })}` : ''}
          {' · '}
          {dayjs(a.createdAt).format('DD.MM.YYYY HH:mm')}
        </Text>
        <Space wrap>
          <Button type="primary" icon={<PhoneOutlined />} href={`tel:${a.phone}`}>
            {formatPhone(a.phone)}
          </Button>
          {a.email && (
            <Button icon={<MailOutlined />} href={`mailto:${a.email}`}>
              {a.email}
            </Button>
          )}
        </Space>
        {a.note && <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>“{a.note}”</Paragraph>}
        <Input.TextArea
          rows={2}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('admin:bizApps.notePlaceholder')}
        />
        <Space wrap>
          <Select
            value={a.status}
            onChange={(v) => save({ status: v })}
            disabled={saving}
            style={{ minWidth: 170 }}
            options={STATUS.map((s) => ({ value: s.value, label: t(`admin:bizApps.status.${s.key}`) }))}
          />
          <Button onClick={() => save({})} loading={saving} disabled={note === (a.adminNote || '')}>
            {t('admin:bizApps.saveNote')}
          </Button>
          {a.status !== 2 && (
            <Button icon={<ShopOutlined />} onClick={() => navigate('/adminPanel/businesses')}>
              {t('admin:bizApps.createAccount')}
            </Button>
          )}
        </Space>
      </Space>
    </Card>
  );
}

/** Yönetim paneli: işletmeler sayfasından gelen üyelik başvuruları */
export default function BusinessApplications() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('open');
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    bizAppsApi
      .list()
      .then(setItems)
      .catch((e) => setError(apiErrorMessage(e, t('admin:bizApps.loadError'))));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = (items || []).filter((a) => (filter === 'open' ? a.status <= 1 : filter === 'all' ? true : a.status === 2));
  const openCount = (items || []).filter((a) => a.status <= 1).length;

  return (
    <SwipeTabs>
      <PageHeader
        eyebrow={t('admin:bizApps.eyebrow')}
        title={t('admin:bizApps.title')}
        subtitle={t('admin:bizApps.subtitle')}
        icon={<ShopOutlined />}
        extra={<Button icon={<ReloadOutlined />} onClick={load} aria-label={t('admin:bizApps.reload')} />}
      />
      <Segmented
        value={filter}
        onChange={setFilter}
        style={{ marginBottom: 16 }}
        options={[
          { value: 'open', label: t('admin:bizApps.filters.open', { count: openCount }) },
          { value: 'converted', label: t('admin:bizApps.filters.converted') },
          { value: 'all', label: t('admin:bizApps.filters.all') },
        ]}
      />
      {error ? (
        <Card bordered={false}>
          <Empty description={error}>
            <Button onClick={load}>{t('common:actions.retry')}</Button>
          </Empty>
        </Card>
      ) : items === null ? (
        <Card bordered={false}>
          <Skeleton active />
        </Card>
      ) : shown.length === 0 ? (
        <Card bordered={false}>
          <Empty description={t('admin:bizApps.empty')} />
        </Card>
      ) : (
        <div className="mb-bizapps">
          {shown.map((a) => (
            <ApplicationCard key={a.businessApplicationId} a={a} onSaved={load} />
          ))}
        </div>
      )}
    </SwipeTabs>
  );
}
