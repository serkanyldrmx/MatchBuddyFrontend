import React, { useMemo, useState } from 'react';
import { App, Button, Card, Grid, Input, Popconfirm, Segmented, Select, Space, Table, Tooltip, Typography } from 'antd';
import { CalendarOutlined, DeleteOutlined, EyeOutlined, HeartOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { api } from '../api/config';
import { formatPrice } from '../api/venues';
import { RESERVATIONS_CHANGED } from '../layout/AdminLayout';
import { EmptyState, MatchStatusTag, PageHeader } from '../ui';
import { apiErrorMessage, formatDate, formatTime, isPast } from '../utils/format';
import MatchDetailDrawer from './MatchDetailDrawer';
import useAdminData, { matchStadiumId, venueLabel } from './useAdminData';
import './AdminResponsive.css';

const { Text } = Typography;

const FILTERS = {
  all: () => true,
  pending: (m) => m.isActive === 1 && !isPast(m.matchDate),
  approved: (m) => m.isActive === 2 && !isPast(m.matchDate),
  rejected: (m) => m.isActive === 3,
  done: (m) => m.isActive !== 3 && isPast(m.matchDate),
};

/** Sistemdeki tüm maçlar */
export default function AdminMatches() {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const isPhone = Grid.useBreakpoint().md === false;
  const { matches, setMatches, stadiums, stadiumNames, loading, reload } = useAdminData();
  const [view, setView] = useState('all');
  const [search, setSearch] = useState('');
  const [stadiumId, setStadiumId] = useState();
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(null);

  const counts = useMemo(() => {
    const c = {};
    Object.keys(FILTERS).forEach((k) => {
      c[k] = matches.filter(FILTERS[k]).length;
    });
    return c;
  }, [matches]);

  const data = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    return matches
      .filter(FILTERS[view])
      .filter((m) => stadiumId == null || matchStadiumId(m) === stadiumId)
      .filter((m) => !q || (m.matchName || '').toLocaleLowerCase('tr').includes(q));
  }, [matches, view, search, stadiumId]);

  const deleteMatch = async (matchId) => {
    setDeleting(matchId);
    try {
      await api.post('/api/Match/DeleteMatch', { matchId });
      message.success(t('admin:matches.deleted'));
      setMatches((list) => list.filter((m) => m.matchId !== matchId));
      window.dispatchEvent(new Event(RESERVATIONS_CHANGED));
    } catch (e) {
      message.error(apiErrorMessage(e, t('admin:matches.deleteFailed')));
    } finally {
      setDeleting(null);
    }
  };

  const updateStatus = async (matchId, status) => {
    setBusy(status);
    try {
      await api.post('/api/Match/MatchStatusUpdate', { matchId, status });
      message.success(status === 2 ? t('admin:shared.approvedAsAdmin') : t('admin:shared.rejectedAsAdmin'));
      setMatches((list) => list.map((m) => (m.matchId === matchId ? { ...m, isActive: status } : m)));
      setSelected(null);
      window.dispatchEvent(new Event(RESERVATIONS_CHANGED));
    } catch (e) {
      message.error(apiErrorMessage(e, t('admin:shared.statusUpdateFailed')));
    } finally {
      setBusy(null);
    }
  };

  const columns = [
    {
      title: t('admin:shared.columns.match'),
      dataIndex: 'matchName',
      sorter: (a, b) => (a.matchName || '').localeCompare(b.matchName || '', 'tr'),
      render: (name) => <Text strong>{name}</Text>,
    },
    {
      title: t('admin:shared.columns.venuePitch'),
      key: 'venue',
      render: (_, m) => venueLabel(m, stadiumNames) || <Text type="secondary">-</Text>,
    },
    {
      title: t('admin:shared.columns.date'),
      dataIndex: 'matchDate',
      defaultSortOrder: 'descend',
      sorter: (a, b) => new Date(a.matchDate) - new Date(b.matchDate),
      render: (d) => (
        <span>
          {formatDate(d)} <Text type="secondary">· {formatTime(d)}</Text>
        </span>
      ),
    },
    {
      title: t('admin:shared.columns.players'),
      dataIndex: 'userCount',
      align: 'center',
      width: 90,
      sorter: (a, b) => (a.userCount || 0) - (b.userCount || 0),
    },
    {
      title: t('admin:shared.columns.amount'),
      dataIndex: 'totalPrice',
      align: 'right',
      sorter: (a, b) => (a.totalPrice || 0) - (b.totalPrice || 0),
      render: (v) => (v != null ? formatPrice(v) : <Text type="secondary">-</Text>),
    },
    {
      title: t('admin:shared.columns.likes'),
      dataIndex: 'likes',
      align: 'center',
      responsive: ['md'],
      width: 90,
      sorter: (a, b) => (a.likes || 0) - (b.likes || 0),
      render: (v) => (
        <Space size={4}>
          <HeartOutlined style={{ color: 'var(--mb-danger)' }} />
          {v ?? 0}
        </Space>
      ),
    },
    {
      title: t('admin:shared.columns.status'),
      key: 'status',
      render: (_, m) => <MatchStatusTag status={m.isActive} past={m.isActive !== 3 && isPast(m.matchDate)} />,
    },
    {
      title: t('admin:shared.columns.actions'),
      key: 'actions',
      align: 'right',
      width: 110,
      render: (_, m) => (
        <Space size={4} onClick={(e) => e.stopPropagation()}>
          <Tooltip title={t('common:actions.detail')}>
            <Button size="small" icon={<EyeOutlined />} onClick={() => setSelected(m)} />
          </Tooltip>
          <Popconfirm
            title={t('admin:matches.deleteConfirm')}
            description={t('admin:matches.deleteConfirmDesc')}
            okText={t('common:actions.delete')}
            cancelText={t('common:actions.cancel')}
            okButtonProps={{ danger: true }}
            onConfirm={() => deleteMatch(m.matchId)}
          >
            <Tooltip title={t('common:actions.delete')}>
              <Button size="small" danger icon={<DeleteOutlined />} loading={deleting === m.matchId} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('admin:matches.title')}
        subtitle={t('admin:matches.subtitle')}
        icon={<CalendarOutlined />}
        extra={
          <Button icon={<ReloadOutlined />} onClick={reload} loading={loading}>
            {t('common:actions.refresh')}
          </Button>
        }
      />
      <Card bordered={false}>
        <Space
          wrap
          size={12}
          className="mb-admin-toolbar"
          style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}
        >
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { label: t('admin:matches.filters.all', { count: counts.all }), value: 'all' },
              { label: t('admin:matches.filters.pending', { count: counts.pending }), value: 'pending' },
              { label: t('admin:matches.filters.approved', { count: counts.approved }), value: 'approved' },
              { label: t('admin:matches.filters.rejected', { count: counts.rejected }), value: 'rejected' },
              { label: t('admin:matches.filters.done', { count: counts.done }), value: 'done' },
            ]}
          />
          <Space wrap className="mb-admin-filters">
            <Input
              className="mb-admin-filter"
              allowClear
              prefix={<SearchOutlined />}
              placeholder={t('admin:matches.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220 }}
            />
            <Select
              className="mb-admin-filter"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={t('admin:shared.venuePlaceholder')}
              value={stadiumId}
              onChange={setStadiumId}
              style={{ width: 200 }}
              options={stadiums.map((s) => ({ value: s.stadiumId, label: s.stadiumName }))}
            />
          </Space>
        </Space>
        <Table
          rowKey="matchId"
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: isPhone ? 'max-content' : 1000 }}
          pagination={{ pageSize: 15, hideOnSinglePage: true, showSizeChanger: false }}
          onRow={(m) => ({ onClick: () => setSelected(m), style: { cursor: 'pointer' } })}
          locale={{ emptyText: <EmptyState description={t('admin:matches.empty')} /> }}
        />
      </Card>
      <MatchDetailDrawer
        open={Boolean(selected)}
        match={selected}
        stadiumName={selected ? stadiumNames[matchStadiumId(selected)] : undefined}
        onClose={() => setSelected(null)}
        onStatusChange={updateStatus}
        actionLoading={busy}
      />
    </>
  );
}
