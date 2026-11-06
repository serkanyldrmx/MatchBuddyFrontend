import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Alert, Button, Card, DatePicker, Grid, Input, Segmented, Select, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  MessageOutlined,
  PlusOutlined,
  ReloadOutlined,
  ScheduleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { formatPrice, ownerApi } from '../api/venues';
import { useOwnerVenue } from '../layout/VenueLayout';
import { useMessages } from '../messaging/MessagesContext';
import { EmptyState, MatchStatusTag, PageHeader, PlayerAvatar } from '../ui';
import { fromNow, fullName } from '../utils/format';
import ManualBookingDrawer from './ManualBookingDrawer';
import ManualBookingModal from './ManualBookingModal';
import ReservationDrawer from './ReservationDrawer';
import {
  InactiveTip,
  WriteButton,
  asList,
  isManualBooking,
  isPastStart,
  normalizeBlock,
  useBlockPaidToggle,
  useOwnerData,
  useReservationResponder,
  ymd,
} from './shared';

const { Text } = Typography;

const VIEWS = {
  pending: { label: 'Bekleyen', params: { status: 1 }, empty: 'Yanıt bekleyen talep yok' },
  approved: { label: 'Onaylı', params: () => ({ status: 2, from: ymd(dayjs()) }), empty: 'Yaklaşan onaylı maç yok' },
  rejected: { label: 'Reddedilen', params: { status: 3 }, empty: 'Reddedilen talep yok' },
  past: { label: 'Geçmiş', params: () => ({ status: 2, to: ymd(dayjs().add(1, 'day')) }), empty: 'Geçmiş maç bulunmuyor' },
  manual: { label: 'Harici', empty: 'Bu tarih aralığında harici rezervasyon yok' },
};

/** Rezervasyon talepleri ve maç listesi */
export default function OwnerReservations() {
  const { openMessages } = useMessages();
  const { venue, membershipActive } = useOwnerVenue();
  const [view, setView] = useState('pending');
  const [search, setSearch] = useState('');
  const [pitchFilter, setPitchFilter] = useState();
  const [selected, setSelected] = useState(null);
  const [range, setRange] = useState(() => [dayjs().subtract(7, 'day').startOf('day'), dayjs().add(30, 'day').startOf('day')]);
  const [manualSel, setManualSel] = useState(null);
  const [draft, setDraft] = useState(null);
  const isManual = view === 'manual';
  const isPhone = Grid.useBreakpoint().md === false;
  const rangeKey = `${ymd(range[0])}_${ymd(range[1])}`;

  const { data, loading, error, reload } = useOwnerData(
    (stadiumId) => {
      if (view === 'manual') return ownerApi.blocks(stadiumId, ymd(range[0]), ymd(range[1].add(1, 'day')));
      const p = VIEWS[view].params;
      return ownerApi.reservations({ stadiumId, ...(typeof p === 'function' ? p() : p) });
    },
    [view, rangeKey]
  );
  const pitchData = useOwnerData((stadiumId) => (isManual ? ownerApi.pitches(stadiumId) : Promise.resolve(null)), [isManual]);
  const pitchList = useMemo(() => asList(pitchData.data).map((p) => ({ pitchId: p.pitchId, name: p.name })), [pitchData.data]);
  const paid = useBlockPaidToggle(() => reload(true));
  const responder = useReservationResponder(() => {
    setSelected(null);
    reload(true);
  });

  const list = useMemo(() => asList(data), [data]);
  const manualRows = useMemo(() => {
    if (!isManual) return [];
    const names = new Map(pitchList.map((p) => [p.pitchId, p.name]));
    const q = search.trim().toLocaleLowerCase('tr');
    return list
      .filter((b) => b.slotBlockId != null && isManualBooking(b))
      .map((b) => normalizeBlock(b, names.get(b.pitchId)))
      .filter((b) => {
        if (pitchFilter != null && b.pitchId !== pitchFilter) return false;
        if (q && !`${b.customerName} ${b.customerPhone || ''} ${b.reason || ''}`.toLocaleLowerCase('tr').includes(q)) return false;
        return true;
      })
      .sort((a, b) => dayjs(a.start) - dayjs(b.start));
  }, [isManual, list, pitchList, search, pitchFilter]);

  const pitchOptions = useMemo(() => {
    const m = new Map();
    if (isManual) pitchList.forEach((p) => m.set(p.pitchId, p.name));
    else list.forEach((r) => r.pitch && m.set(r.pitch.pitchId, r.pitch.name));
    return [...m].map(([value, label]) => ({ value, label }));
  }, [list, isManual, pitchList]);

  const manualTotals = useMemo(
    () =>
      manualRows.reduce(
        (t, b) => {
          const v = Number(b.price) || 0;
          t.total += v;
          if (b.isPaid) t.paid += v;
          else t.unpaid += v;
          return t;
        },
        { total: 0, paid: 0, unpaid: 0 }
      ),
    [manualRows]
  );

  const manualColumns = [
    {
      title: 'Tarih',
      key: 'start',
      width: 160,
      render: (_, b) => {
        const s = dayjs(b.start);
        return (
          <div className="mb-owner-when">
            <strong>{s.format('DD MMM ddd')}</strong>
            <span>
              {s.format('HH:mm')}–{dayjs(b.end).format('HH:mm')}
            </span>
          </div>
        );
      },
    },
    { title: 'Saha', key: 'pitch', render: (_, b) => b.pitchName || '-' },
    {
      title: 'Müşteri',
      key: 'customer',
      render: (_, b) => (
        <Space direction="vertical" size={0}>
          <Space size={6}>
            <Text strong>{b.customerName}</Text>
            <span className="mb-cal-harici">Harici</span>
          </Space>
          {b.reason && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {b.reason}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Telefon',
      key: 'phone',
      render: (_, b) =>
        b.customerPhone ? (
          <a href={`tel:${b.customerPhone}`} onClick={(e) => e.stopPropagation()} className="mb-owner-phone">
            {b.customerPhone}
          </a>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    { title: 'Ücret', dataIndex: 'price', align: 'right', render: (v) => <Text strong>{formatPrice(v)}</Text> },
    {
      title: 'Ödeme',
      key: 'paid',
      render: (_, b) => (
        <span className={`mb-pay-cell ${b.isPaid ? 'is-paid' : 'is-unpaid'}`} onClick={(e) => e.stopPropagation()}>
          <InactiveTip>
            <Switch
              size="small"
              checked={b.isPaid}
              loading={paid.busyId === b.slotBlockId}
              disabled={!membershipActive}
              onChange={(v) => paid.toggle(b.slotBlockId, v)}
            />
          </InactiveTip>
          {b.isPaid ? 'Alındı' : 'Alınmadı'}
        </span>
      ),
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, b) => (
        <Space size={4} onClick={(e) => e.stopPropagation()}>
          <WriteButton size="small" icon={<EditOutlined />} onClick={() => setDraft({ mode: 'booking', booking: b })}>
            Düzenle
          </WriteButton>
        </Space>
      ),
    },
  ];

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
      responsive: ['md'], // telefonda çekmecede görünür
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
      fixed: isPhone ? undefined : 'right',
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
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => reload()} loading={loading}>
              Yenile
            </Button>
            {isManual && (
              <WriteButton
                type="primary"
                icon={<PlusOutlined />}
                disabled={!pitchList.length}
                onClick={() => setDraft({ mode: 'booking', pitchId: pitchList[0]?.pitchId, start: null })}
              >
                Rezervasyon ekle
              </WriteButton>
            )}
          </Space>
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
          <Space wrap className="mb-owner-toolbar__filters">
            {isManual && (
              <DatePicker.RangePicker
                value={range}
                allowClear={false}
                format="DD.MM.YYYY"
                onChange={(v) => v?.[0] && v?.[1] && setRange([v[0].startOf('day'), v[1].startOf('day')])}
                style={{ width: 250 }}
              />
            )}
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder={isManual ? 'Müşteri, telefon ya da başlık ara' : 'Maç ya da kurucu ara'}
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
        {isManual ? (
          <Table
            rowKey="slotBlockId"
            columns={manualColumns}
            dataSource={manualRows}
            loading={loading}
            scroll={{ x: 900 }}
            pagination={{ pageSize: 15, hideOnSinglePage: true }}
            onRow={(b) => ({ onClick: () => setManualSel(b), style: { cursor: 'pointer' } })}
            locale={{ emptyText: <EmptyState description={VIEWS.manual.empty} /> }}
            summary={() =>
              manualRows.length ? (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={4}>
                    <Text type="secondary">{manualRows.length} harici rezervasyon</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <Text strong>{formatPrice(manualTotals.total)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} colSpan={2}>
                    <span className="mb-pay-cell is-unpaid">Alınmadı: {formatPrice(manualTotals.unpaid)}</span>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              ) : null
            }
          />
        ) : (
          <Table
            rowKey="matchId"
            columns={columns}
            dataSource={rows}
            loading={loading}
            scroll={{ x: isPhone ? 860 : 1100 }}
            pagination={{ pageSize: 15, hideOnSinglePage: true }}
            onRow={(r) => ({ onClick: () => setSelected(r), style: { cursor: 'pointer' } })}
            locale={{ emptyText: <EmptyState description={VIEWS[view].empty} /> }}
          />
        )}
      </Card>
      <ManualBookingDrawer
        open={Boolean(manualSel)}
        booking={manualSel}
        onClose={() => setManualSel(null)}
        onEdit={(b) => {
          setManualSel(null);
          setDraft({ mode: 'booking', booking: b });
        }}
        onChanged={(b) => {
          if (b) setManualSel(b);
          reload(true);
        }}
      />
      <ManualBookingModal
        open={Boolean(draft)}
        draft={draft}
        pitches={pitchList}
        onClose={() => setDraft(null)}
        onSaved={() => {
          setDraft(null);
          reload(true);
        }}
      />
      <ReservationDrawer open={Boolean(selected)} reservation={selected} onClose={() => setSelected(null)} responder={responder} />
      {responder.modal}
    </>
  );
}
