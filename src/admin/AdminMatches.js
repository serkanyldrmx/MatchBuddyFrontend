import React, { useMemo, useState } from 'react';
import { App, Button, Card, Grid, Input, Popconfirm, Segmented, Select, Space, Table, Tooltip, Typography } from 'antd';
import { CalendarOutlined, DeleteOutlined, EyeOutlined, HeartOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
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
      message.success('Maç silindi.');
      setMatches((list) => list.filter((m) => m.matchId !== matchId));
      window.dispatchEvent(new Event(RESERVATIONS_CHANGED));
    } catch (e) {
      message.error(apiErrorMessage(e, 'Maç silinemedi.'));
    } finally {
      setDeleting(null);
    }
  };

  const updateStatus = async (matchId, status) => {
    setBusy(status);
    try {
      await api.post('/api/Match/MatchStatusUpdate', { matchId, status });
      message.success(status === 2 ? 'Rezervasyon admin olarak onaylandı.' : 'Rezervasyon admin olarak reddedildi.');
      setMatches((list) => list.map((m) => (m.matchId === matchId ? { ...m, isActive: status } : m)));
      setSelected(null);
      window.dispatchEvent(new Event(RESERVATIONS_CHANGED));
    } catch (e) {
      message.error(apiErrorMessage(e, 'Durum güncellenemedi.'));
    } finally {
      setBusy(null);
    }
  };

  const columns = [
    {
      title: 'Maç',
      dataIndex: 'matchName',
      sorter: (a, b) => (a.matchName || '').localeCompare(b.matchName || '', 'tr'),
      render: (name) => <Text strong>{name}</Text>,
    },
    {
      title: 'Tesis · Saha',
      key: 'venue',
      render: (_, m) => venueLabel(m, stadiumNames) || <Text type="secondary">-</Text>,
    },
    {
      title: 'Tarih',
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
      title: 'Oyuncu',
      dataIndex: 'userCount',
      align: 'center',
      width: 90,
      sorter: (a, b) => (a.userCount || 0) - (b.userCount || 0),
    },
    {
      title: 'Tutar',
      dataIndex: 'totalPrice',
      align: 'right',
      sorter: (a, b) => (a.totalPrice || 0) - (b.totalPrice || 0),
      render: (v) => (v != null ? formatPrice(v) : <Text type="secondary">-</Text>),
    },
    {
      title: 'Beğeni',
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
      title: 'Durum',
      key: 'status',
      render: (_, m) => <MatchStatusTag status={m.isActive} past={m.isActive !== 3 && isPast(m.matchDate)} />,
    },
    {
      title: 'İşlemler',
      key: 'actions',
      align: 'right',
      width: 110,
      render: (_, m) => (
        <Space size={4} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Detay">
            <Button size="small" icon={<EyeOutlined />} onClick={() => setSelected(m)} />
          </Tooltip>
          <Popconfirm
            title="Maç silinsin mi?"
            description="Bu işlem geri alınamaz."
            okText="Sil"
            cancelText="Vazgeç"
            okButtonProps={{ danger: true }}
            onConfirm={() => deleteMatch(m.matchId)}
          >
            <Tooltip title="Sil">
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
        title="Tüm Maçlar"
        subtitle="Sistemde oluşturulmuş tüm maçlar ve durumları"
        icon={<CalendarOutlined />}
        extra={
          <Button icon={<ReloadOutlined />} onClick={reload} loading={loading}>
            Yenile
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
              { label: `Tümü (${counts.all})`, value: 'all' },
              { label: `Onay bekleyen (${counts.pending})`, value: 'pending' },
              { label: `Onaylı (${counts.approved})`, value: 'approved' },
              { label: `Reddedilen (${counts.rejected})`, value: 'rejected' },
              { label: `Tamamlanan (${counts.done})`, value: 'done' },
            ]}
          />
          <Space wrap className="mb-admin-filters">
            <Input
              className="mb-admin-filter"
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Maç adı ara"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220 }}
            />
            <Select
              className="mb-admin-filter"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Tesis"
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
          locale={{ emptyText: <EmptyState description="Bu filtreye uygun maç yok" /> }}
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
