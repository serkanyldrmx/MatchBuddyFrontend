import React, { useMemo, useState } from 'react';
import { Alert, App, Button, Card, Input, Popconfirm, Segmented, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined, ReloadOutlined, ScheduleOutlined, SearchOutlined } from '@ant-design/icons';
import { api } from '../api/config';
import { formatPrice } from '../api/venues';
import { RESERVATIONS_CHANGED } from '../layout/AdminLayout';
import { EmptyState, MatchStatusTag, PageHeader, PlayerAvatar } from '../ui';
import { apiErrorMessage, formatDate, formatTime, fromNow, fullName, isPast } from '../utils/format';
import MatchDetailDrawer, { OVERRIDE_WARNING } from './MatchDetailDrawer';
import useAdminData, { matchStadiumId, venueLabel } from './useAdminData';

const { Text } = Typography;

const createdOf = (m) => m.createdAt || m.createDate || m.createdDate || null;

/** İşletme onayı bekleyen rezervasyonların izlenmesi (admin yalnızca gerekirse geçersiz kılar) */
export default function Reservations() {
  const { message } = App.useApp();
  const { matches, setMatches, stadiums, stadiumNames, loading, reload } = useAdminData();
  const [view, setView] = useState('upcoming');
  const [search, setSearch] = useState('');
  const [stadiumId, setStadiumId] = useState();
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(null); // { matchId, status }

  const pending = useMemo(() => matches.filter((m) => m.isActive === 1), [matches]);
  const expiredCount = useMemo(() => pending.filter((m) => isPast(m.matchDate)).length, [pending]);

  const data = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    return pending
      .filter((m) => {
        const past = isPast(m.matchDate);
        if (view === 'upcoming' && past) return false;
        if (view === 'expired' && !past) return false;
        if (stadiumId != null && matchStadiumId(m) !== stadiumId) return false;
        if (
          q &&
          ![m.matchName, venueLabel(m, stadiumNames), m.createdBy && fullName(m.createdBy)].some((v) =>
            (v || '').toLocaleLowerCase('tr').includes(q)
          )
        )
          return false;
        return true;
      })
      .sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate));
  }, [pending, view, search, stadiumId, stadiumNames]);

  const updateStatus = async (matchId, status) => {
    setBusy({ matchId, status });
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
      render: (name, m) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          {(m.homeTeam || m.awayTeam) && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {m.homeTeam?.teamName || 'Karma'} vs {m.awayTeam?.teamName || (m.lookingForOpponent ? 'Rakip aranıyor' : 'Karma')}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Tesis · Saha',
      key: 'venue',
      render: (_, m) => venueLabel(m, stadiumNames) || <Text type="secondary">-</Text>,
    },
    {
      title: 'Tarih & saat',
      dataIndex: 'matchDate',
      sorter: (a, b) => new Date(a.matchDate) - new Date(b.matchDate),
      render: (d, m) => (
        <Space direction="vertical" size={0}>
          <Text>
            {formatDate(d)} · {formatTime(d)}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {fromNow(d)}
            {m.durationMinutes ? ` · ${m.durationMinutes} dk` : ''}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Kurucu',
      key: 'creator',
      render: (_, m) =>
        m.createdBy ? (
          <Space size={8}>
            <PlayerAvatar player={m.createdBy} size={26} />
            <Text>{fullName(m.createdBy)}</Text>
          </Space>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: 'Tutar',
      dataIndex: 'totalPrice',
      align: 'right',
      sorter: (a, b) => (a.totalPrice || 0) - (b.totalPrice || 0),
      render: (v, m) => (
        <Space direction="vertical" size={0} style={{ alignItems: 'flex-end' }}>
          <Text strong>{formatPrice(v)}</Text>
          {m.perPlayer != null && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              kişi başı {formatPrice(m.perPlayer)}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Bekleme süresi',
      key: 'waiting',
      sorter: (a, b) => new Date(createdOf(a) || a.matchDate) - new Date(createdOf(b) || b.matchDate),
      render: (_, m) => {
        const created = createdOf(m);
        return (
          <Space size={4} wrap>
            {created ? (
              <Tooltip title={`Oluşturulma: ${formatDate(created)} ${formatTime(created)}`}>
                <Text>{fromNow(created)}</Text>
              </Tooltip>
            ) : (
              <Text type="secondary">{formatDate(m.matchDate)}</Text>
            )}
            {isPast(m.matchDate) && <Tag color="volcano">Tarihi geçti</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Durum',
      key: 'status',
      render: (_, m) => <MatchStatusTag status={m.isActive} />,
    },
    {
      title: 'İşlemler',
      key: 'actions',
      align: 'right',
      render: (_, m) => (
        <Space size={4} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Detay">
            <Button size="small" icon={<EyeOutlined />} onClick={() => setSelected(m)} />
          </Tooltip>
          <Popconfirm
            title="Admin olarak onaylansın mı?"
            description={<div style={{ maxWidth: 260 }}>{OVERRIDE_WARNING}</div>}
            okText="Onayla"
            cancelText="Vazgeç"
            onConfirm={() => updateStatus(m.matchId, 2)}
          >
            <Tooltip title="Admin olarak onayla">
              <Button
                size="small"
                icon={<CheckOutlined />}
                loading={busy?.matchId === m.matchId && busy.status === 2}
              />
            </Tooltip>
          </Popconfirm>
          <Popconfirm
            title="Admin olarak reddedilsin mi?"
            description={<div style={{ maxWidth: 260 }}>{OVERRIDE_WARNING}</div>}
            okText="Reddet"
            cancelText="Vazgeç"
            okButtonProps={{ danger: true }}
            onConfirm={() => updateStatus(m.matchId, 3)}
          >
            <Tooltip title="Admin olarak reddet">
              <Button
                size="small"
                danger
                icon={<CloseOutlined />}
                loading={busy?.matchId === m.matchId && busy.status === 3}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Rezervasyonlar"
        subtitle="İşletme onayı bekleyen talepler"
        icon={<ScheduleOutlined />}
        extra={
          <Button icon={<ReloadOutlined />} onClick={reload} loading={loading}>
            Yenile
          </Button>
        }
      />
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Rezervasyon talepleri artık tesis işletmeleri tarafından onaylanır."
        description="Bu ekran izleme amaçlıdır. Admin onayı/reddi yalnızca istisnai durumlarda işletmenin kararını geçersiz kılmak için kullanılmalıdır."
      />
      <Card bordered={false}>
        <Space wrap size={12} style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { label: `Bekleyenler (${pending.length - expiredCount})`, value: 'upcoming' },
              { label: `Tarihi geçenler (${expiredCount})`, value: 'expired' },
              { label: `Tümü (${pending.length})`, value: 'all' },
            ]}
          />
          <Space wrap>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Maç, tesis veya kurucu ara"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 240 }}
            />
            <Select
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
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          onRow={(m) => ({ onClick: () => setSelected(m), style: { cursor: 'pointer' } })}
          locale={{ emptyText: <EmptyState description="İşletme onayı bekleyen talep yok" /> }}
        />
      </Card>
      <MatchDetailDrawer
        open={Boolean(selected)}
        match={selected}
        stadiumName={selected ? stadiumNames[matchStadiumId(selected)] : undefined}
        onClose={() => setSelected(null)}
        onStatusChange={updateStatus}
        actionLoading={busy && selected && busy.matchId === selected.matchId ? busy.status : null}
      />
    </>
  );
}
