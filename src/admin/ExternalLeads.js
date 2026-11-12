import React, { useCallback, useEffect, useState } from 'react';
import { Alert, App, Button, Card, Form, Input, Modal, Radio, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { CompassOutlined, LinkOutlined, PhoneOutlined, ReloadOutlined, SearchOutlined, TrophyOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { api } from '../api/config';
import { PageHeader } from '../ui';
import { apiErrorMessage } from '../utils/format';
import { mapsUrl, telUrl } from '../Components/Venues/ExternalVenueForm';

const { Text } = Typography;

// Harici saha satış listesi — sözleşme: MatcBuddy/docs/engagement-api.md §4
const leadsApi = {
  list: (q) => api.get('/api/Admin/ExternalVenueLeads', { params: { q: q || undefined } }).then((r) => r.data || []),
  targets: (q) => api.get('/api/Admin/ExternalVenueLeads/Targets', { params: { q: q || undefined } }).then((r) => r.data || []),
  link: (body) => api.post('/api/Admin/ExternalVenueLeads/Link', body).then((r) => r.data),
};

/** Harici sahaları mevcut bir tesise ya da yeni aday tesise bağlama penceresi */
function LinkModal({ lead, onClose, onDone }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [mode, setMode] = useState('candidate');
  const [targets, setTargets] = useState([]);
  const [targetId, setTargetId] = useState();
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!lead) return;
    setMode('candidate');
    setTargetId(undefined);
    form.setFieldsValue({
      name: lead.name,
      city: lead.city,
      district: lead.district,
      address: lead.address,
      phone: lead.phones?.[0],
    });
    leadsApi.targets(lead.name).then(setTargets).catch(() => setTargets([]));
  }, [lead, form]);

  const search = (q) => leadsApi.targets(q).then(setTargets).catch(() => {});

  const save = async () => {
    let body = { stadiumIds: lead.stadiumIds };
    if (mode === 'existing') {
      if (!targetId) {
        message.warning(t('admin:leads.pickTarget'));
        return;
      }
      body = { ...body, targetStadiumId: targetId };
    } else {
      const v = await form.validateFields();
      body = { ...body, createCandidate: true, ...v, location: lead.location || null };
    }
    setSaving(true);
    try {
      const res = await leadsApi.link(body);
      message.success(res?.message || t('admin:leads.linked'));
      onDone();
    } catch (e) {
      message.error(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!lead} title={t('admin:leads.linkTitle', { name: lead?.name })} onCancel={onClose} onOk={save} confirmLoading={saving} okText={t('admin:leads.linkOk')} cancelText={t('common:actions.cancel')} destroyOnClose>
      <Alert type="info" showIcon message={t('admin:leads.linkHint', { count: lead?.matchCount || 0 })} style={{ marginBottom: 16 }} />
      <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)} style={{ marginBottom: 16 }}>
        <Radio.Button value="candidate">{t('admin:leads.modeCandidate')}</Radio.Button>
        <Radio.Button value="existing">{t('admin:leads.modeExisting')}</Radio.Button>
      </Radio.Group>
      {mode === 'existing' ? (
        <Select
          showSearch
          filterOption={false}
          onSearch={search}
          value={targetId}
          onChange={setTargetId}
          placeholder={t('admin:leads.targetPlaceholder')}
          style={{ width: '100%' }}
          options={targets.map((s) => ({
            value: s.stadiumId,
            label: `${s.name} — ${[s.district, s.city].filter(Boolean).join(', ')}${s.hasOwner ? '' : ` (${t('admin:leads.candidate')})`}`,
          }))}
        />
      ) : (
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="name" label={t('admin:leads.cols.venue')} rules={[{ required: true, min: 2, max: 100, whitespace: true }]}>
            <Input />
          </Form.Item>
          <Space.Compact block>
            <Form.Item name="city" label={t('admin:leads.city')} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="district" label={t('admin:leads.district')} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space.Compact>
          <Form.Item name="phone" label={t('admin:leads.cols.phone')}>
            <Input />
          </Form.Item>
          <Form.Item name="address" label={t('admin:leads.address')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Text type="secondary">{t('admin:leads.candidateHint')}</Text>
        </Form>
      )}
    </Modal>
  );
}

/**
 * Admin: oyuncuların telefonla ayarlayıp eklediği, anlaşmamız olmayan sahalar. En çok maç yapılan önce —
 * doğrudan aranacak işletme listesi. Anlaşma olunca harici kayıtlar tesise bağlanır, maçları taşınır.
 */
export default function ExternalLeads() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [linking, setLinking] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    leadsApi
      .list(q)
      .then(setRows)
      .catch((e) => message.error(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [q, message]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  const columns = [
    {
      title: '#',
      width: 48,
      render: (_, __, i) => (i < 3 ? <TrophyOutlined style={{ color: ['#fbbf24', '#cbd5e1', '#d97706'][i] }} /> : i + 1),
    },
    {
      title: t('admin:leads.cols.venue'),
      render: (r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.name}</Text>
          <Text type="secondary">{[r.district, r.city].filter(Boolean).join(', ') || '-'}</Text>
          {r.address && <Text type="secondary" style={{ fontSize: 12 }}>{r.address}</Text>}
        </Space>
      ),
    },
    {
      title: t('admin:leads.cols.phone'),
      render: (r) =>
        r.phones?.length ? (
          <Space direction="vertical" size={0}>
            {r.phones.map((p) => (
              <a key={p} href={telUrl(p)}>
                <PhoneOutlined /> {p}
              </a>
            ))}
          </Space>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: t('admin:leads.cols.matches'),
      dataIndex: 'matchCount',
      sorter: (a, b) => a.matchCount - b.matchCount,
      render: (v, r) => (
        <Space size={4} wrap>
          <Tag color="green">{v}</Tag>
          {r.upcomingCount > 0 && <Tag color="blue">{t('admin:leads.upcoming', { count: r.upcomingCount })}</Tag>}
        </Space>
      ),
    },
    { title: t('admin:leads.cols.players'), dataIndex: 'playerCount', sorter: (a, b) => a.playerCount - b.playerCount },
    { title: t('admin:leads.cols.addedBy'), dataIndex: 'addedBy', responsive: ['md'] },
    {
      title: t('admin:leads.cols.lastMatch'),
      dataIndex: 'lastMatchDate',
      responsive: ['lg'],
      sorter: (a, b) => new Date(a.lastMatchDate || 0) - new Date(b.lastMatchDate || 0),
      render: (v) => (v ? dayjs(v).format('DD.MM.YYYY') : '-'),
    },
    {
      title: '',
      align: 'right',
      render: (r) => (
        <Space>
          {mapsUrl(r) && (
            <Tooltip title={t('admin:leads.map')}>
              <Button icon={<CompassOutlined />} href={mapsUrl(r)} target="_blank" rel="noreferrer" />
            </Tooltip>
          )}
          <Button type="primary" icon={<LinkOutlined />} onClick={() => setLinking(r)}>
            {t('admin:leads.link')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader eyebrow={t('admin:leads.eyebrow')} title={t('admin:leads.title')} subtitle={t('admin:leads.subtitle')} />
      <Card
        title={
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder={t('admin:leads.search')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 320 }}
          />
        }
        extra={<Button icon={<ReloadOutlined />} onClick={load} aria-label={t('common:actions.refresh')} />}
      >
        <Table
          rowKey="key"
          loading={loading}
          dataSource={rows}
          columns={columns}
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          scroll={{ x: 760 }}
          locale={{ emptyText: t('admin:leads.empty') }}
        />
      </Card>
      <LinkModal
        lead={linking}
        onClose={() => setLinking(null)}
        onDone={() => {
          setLinking(null);
          load();
        }}
      />
    </>
  );
}
