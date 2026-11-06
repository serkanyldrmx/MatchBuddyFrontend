import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Alert, Button, Card, Input, Segmented, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, MessageOutlined, ReloadOutlined, ScheduleOutlined, SearchOutlined } from '@ant-design/icons';
import { formatPrice, ownerApi } from '../api/venues';
import { useOwnerVenue } from '../layout/VenueLayout';
import { useMessages } from '../messaging/MessagesContext';
import { EmptyState, MatchStatusTag, PageHeader, PlayerAvatar } from '../ui';
import { fromNow, fullName } from '../utils/format';
import ReservationDrawer from './ReservationDrawer';
import { WriteButton, asList, isPastStart, useOwnerData, useReservationResponder, ymd } from './shared';

const { Text } = Typography;

const VIEWS = {
  pending: { label: 'Bekleyen', params: { status: 1 }, empty: 'Yanıt bekleyen talep yok' },
  approved: { label: 'Onaylı', params: () => ({ status: 2, from: ymd(dayjs()) }), empty: 'Yaklaşan onaylı maç yok' },
  rejected: { label: 'Reddedilen', params: { status: 3 }, empty: 'Reddedilen talep yok' },
  past: { label: 'Geçmiş', params: () => ({ status: 2, to: ymd(dayjs().add(1, 'day')) }), empty: 'Geçmiş maç bulunmuyor' },
};

/** Rezervasyon talepleri ve maç listesi */
export default function OwnerReservations() {
  const { openMessages } = useMessages();
  const { venue } = useOwnerVenue();
  const [view, setView] = useState('pending');
  const [search, setSearch] = useState('');
  const [pitchFilter, setPitchFilter] = useState();
  const [selected, setSelected] = useState(null);

  const { data, loading, error, reload } = useOwnerData(
    (stadiumId) => {
      const p = VIEWS[view].params;
      return ownerApi.reservations({ stadiumId, ...(typeof p === 'function' ? p() : p) });
    },
    [view]
  );
  const responder = useReservationResponder(() => {
    setSelected(null);
    reload(true);
  });

  const list = useMemo(() => asList(data), [data]);
  const pitchOptions = useMemo(() => {
    const m = new Map();
    list.forEach((r) => r.pitch && m.set(r.pitch.pitchId, r.pitch.name));
    return [...m].map(([value, label]) => ({ value, label }));
  }, [list]);

  const rows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    return list
      .filter((r) => {
        if (view === 'approved' && isPastStart(r)) return false;
        if (view === 'past' && !isPastStart(r)) return false;
        if (pitchFilter != null && r.pitch?.pitchId !== pitchFilter) return false;
        if (q && !`${r.matchName} ${fullName(r.creator)}`.toLocaleLowerCase('tr').includes(q)) return false;
        return true;
      })
      .sort((a, b) => (view === 'past' || view === 'rejected' ? dayjs(b.start) - dayjs(a.start) : dayjs(a.start) - dayjs(b.start)));
  }, [list, view, search, pitchFilter]);

  const columns = [
    {
      title: 'Tarih & saat',
      key: 'start',
      width: 170,
      render: (_, r) => {
        const s = dayjs(r.start);
        const e = r.end ? dayjs(r.end) : s.add(r.durationMinutes || 60, 'minute');
        return (
          <div className="mb-owner-when">
            <strong>{s.format('DD MMM ddd')}</strong>
            <span>
              {s.format('HH:mm')}–{e.format('HH:mm')}
            </span>
          </div>
        );
      },
    },
    { title: 'Saha', key: 'pitch', render: (_, r) => r.pitch?.name || '-' },
    {
      title: 'Maç',
      dataIndex: 'matchName',
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{v}</Text>
          {(r.homeTeam || r.awayTeam) && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {r.homeTeam?.teamName || 'Karma'} vs {r.awayTeam?.teamName || 'Rakip aranıyor'}
            </Text>
          )}
          {r.createdAt && view === 'pending' && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Talep: {fromNow(r.createdAt)}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Kurucu',
      key: 'creator',
      render: (_, r) => (
        <div className="mb-owner-creator">
          <PlayerAvatar player={r.creator} size={32} />
          <div>
            <Text strong>{fullName(r.creator)}</Text>
            {r.creator?.phoneNumber && (
              <a href={`tel:${r.creator.phoneNumber}`} onClick={(e) => e.stopPropagation()} className="mb-owner-phone">
                {r.creator.phoneNumber}
              </a>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Kadro',
      key: 'squad',
      align: 'center',
      render: (_, r) => (
        <span className={`mb-owner-squad${r.capacity && r.goingCount >= r.capacity ? ' is-full' : ''}`}>
          {r.goingCount ?? 0}/{r.capacity ?? 0}
        </span>
      ),
    },
    {
      title: 'Ekstralar',
      key: 'extras',
      render: (_, r) =>
        r.cleatCount || r.cameraRequested ? (
          <Space size={4} wrap>
            {r.cleatCount ? <Tag>Krampon ×{r.cleatCount}</Tag> : null}
            {r.cameraRequested ? <Tag>Kamera</Tag> : null}
          </Space>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: 'Tutar',
      dataIndex: 'totalPrice',
      align: 'right',
      render: (v) => <Text strong>{formatPrice(v)}</Text>,
    },
    {
      title: 'Durum',
      key: 'status',
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <MatchStatusTag status={r.status} past={isPastStart(r) && r.status === 2} />
          {r.status === 1 && isPastStart(r) && <Tag color="volcano">Saati geçti</Tag>}
          {r.status === 3 && r.rejectReason && (
            <Text type="secondary" ellipsis style={{ maxWidth: 180, fontSize: 12 }}>
              {r.rejectReason}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      fixed: 'right',
      render: (_, r) => (
        <Space size={4} onClick={(e) => e.stopPropagation()}>
          {r.creator && (
            <Tooltip title="Mesaj gönder">
              <Button size="small" icon={<MessageOutlined />} onClick={() => openMessages({ type: 'user', data: r.creator })} />
            </Tooltip>
          )}
          {r.status === 1 && !isPastStart(r) && (
            <>
              <WriteButton
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => responder.reject(r)}
                loading={responder.busy?.matchId === r.matchId && responder.busy.approve === false}
              >
                Reddet
              </WriteButton>
              <WriteButton
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => responder.approve(r)}
                loading={responder.busy?.matchId === r.matchId && responder.busy.approve === true}
              >
                Onayla
              </WriteButton>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow={venue?.name}
        title="Talepler"
        icon={<ScheduleOutlined />}
        subtitle="Oyuncuların rezervasyon taleplerini yanıtlayın, maçlarınızı takip edin."
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => reload()} loading={loading}>
            Yenile
          </Button>
        }
      />
      <Card bordered={false}>
        <div className="mb-owner-toolbar">
          <Segmented
            value={view}
            onChange={(v) => {
              setView(v);
              setPitchFilter(undefined);
            }}
            options={Object.entries(VIEWS).map(([value, v]) => ({ value, label: v.label }))}
          />
          <Space wrap>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Maç ya da kurucu ara"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220 }}
            />
            {pitchOptions.length > 1 && (
              <Select allowClear placeholder="Saha" value={pitchFilter} onChange={setPitchFilter} options={pitchOptions} style={{ width: 150 }} />
            )}
          </Space>
        </div>
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
        <Table
          rowKey="matchId"
          columns={columns}
          dataSource={rows}
          loading={loading}
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 15, hideOnSinglePage: true }}
          onRow={(r) => ({ onClick: () => setSelected(r), style: { cursor: 'pointer' } })}
          locale={{ emptyText: <EmptyState description={VIEWS[view].empty} /> }}
        />
      </Card>
      <ReservationDrawer open={Boolean(selected)} reservation={selected} onClose={() => setSelected(null)} responder={responder} />
      {responder.modal}
    </>
  );
}
