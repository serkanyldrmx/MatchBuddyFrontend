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
import { useTranslation } from 'react-i18next';
import { formatPrice, ownerApi } from '../api/venues';
import i18n from '../i18n';
import { useOwnerVenue } from '../layout/VenueLayout';
import { useMessages } from '../messaging/MessagesContext';
import { EmptyState, MatchStatusTag, PageHeader, PlayerAvatar, ReliabilityBadge } from '../ui';
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
import { SwipeTabs } from '../ui/Swipe';

const { Text } = Typography;

// label / empty erişildiği anda (render sırasında) çevrilir
const viewDef = (key, rest) => ({
  ...rest,
  get label() {
    return i18n.t(`owner:reservations.views.${key}.label`);
  },
  get empty() {
    return i18n.t(`owner:reservations.views.${key}.empty`);
  },
});

const VIEWS = {
  pending: viewDef('pending', { params: { status: 1 } }),
  approved: viewDef('approved', { params: () => ({ status: 2, from: ymd(dayjs()) }) }),
  rejected: viewDef('rejected', { params: { status: 3 } }),
  past: viewDef('past', { params: () => ({ status: 2, to: ymd(dayjs().add(1, 'day')) }) }),
  manual: viewDef('manual', {}),
};

/** Rezervasyon talepleri ve maç listesi */
export default function OwnerReservations() {
  const { t } = useTranslation();
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
        (acc, b) => {
          const v = Number(b.price) || 0;
          acc.total += v;
          if (b.isPaid) acc.paid += v;
          else acc.unpaid += v;
          return acc;
        },
        { total: 0, paid: 0, unpaid: 0 }
      ),
    [manualRows]
  );

  const manualColumns = [
    {
      title: t('owner:reservations.table.date'),
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
    { title: t('common:pitch'), key: 'pitch', render: (_, b) => b.pitchName || '-' },
    {
      title: t('owner:reservations.table.customer'),
      key: 'customer',
      render: (_, b) => (
        <Space direction="vertical" size={0}>
          <Space size={6}>
            <Text strong>{b.customerName}</Text>
            <span className="mb-cal-harici">{t('owner:reservations.external')}</span>
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
      title: t('owner:reservations.table.phone'),
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
    { title: t('owner:reservations.table.fee'), dataIndex: 'price', align: 'right', render: (v) => <Text strong>{formatPrice(v)}</Text> },
    {
      title: t('owner:reservations.table.payment'),
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
          {b.isPaid ? t('owner:reservations.paid') : t('owner:reservations.unpaid')}
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
            {t('common:actions.edit')}
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
      title: t('owner:reservations.table.dateTime'),
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
    { title: t('common:pitch'), key: 'pitch', render: (_, r) => r.pitch?.name || '-' },
    {
      title: t('owner:reservations.table.match'),
      dataIndex: 'matchName',
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{v}</Text>
          {(r.homeTeam || r.awayTeam) && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('owner:reservations.teams', {
                home: r.homeTeam?.teamName || t('owner:reservations.mixedTeam'),
                away: r.awayTeam?.teamName || t('owner:reservations.seekingOpponent'),
              })}
            </Text>
          )}
          {r.createdAt && view === 'pending' && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('owner:reservations.requestedAt', { time: fromNow(r.createdAt) })}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: t('owner:reservations.table.creator'),
      key: 'creator',
      render: (_, r) => (
        <div className="mb-owner-creator">
          <PlayerAvatar player={r.creator} size={32} />
          <div>
            <Text strong>
              {fullName(r.creator)}{' '}
              {r.creatorReliability && <ReliabilityBadge reliability={r.creatorReliability} compact />}
            </Text>
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
      title: t('owner:reservations.table.squad'),
      key: 'squad',
      align: 'center',
      render: (_, r) => (
        <span className={`mb-owner-squad${r.capacity && r.goingCount >= r.capacity ? ' is-full' : ''}`}>
          {r.goingCount ?? 0}/{r.capacity ?? 0}
        </span>
      ),
    },
    {
      title: t('owner:reservations.table.extras'),
      key: 'extras',
      responsive: ['md'], // telefonda çekmecede görünür
      render: (_, r) =>
        r.cleatCount || r.cameraRequested ? (
          <Space size={4} wrap>
            {r.cleatCount ? <Tag>{t('owner:shared.extras.cleats', { count: r.cleatCount })}</Tag> : null}
            {r.cameraRequested ? <Tag>{t('owner:shared.extras.camera')}</Tag> : null}
          </Space>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: t('owner:reservations.table.amount'),
      dataIndex: 'totalPrice',
      align: 'right',
      render: (v) => <Text strong>{formatPrice(v)}</Text>,
    },
    {
      title: t('owner:reservations.table.status'),
      key: 'status',
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <MatchStatusTag status={r.status} past={isPastStart(r) && r.status === 2} />
          {r.status === 1 && isPastStart(r) && <Tag color="volcano">{t('owner:reservations.expired')}</Tag>}
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
            <Tooltip title={t('owner:reservations.sendMessage')}>
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
                {t('common:actions.reject')}
              </WriteButton>
              <WriteButton
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => responder.approve(r)}
                loading={responder.busy?.matchId === r.matchId && responder.busy.approve === true}
              >
                {t('common:actions.confirm')}
              </WriteButton>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <SwipeTabs>
      <PageHeader
        eyebrow={venue?.name}
        title={t('owner:reservations.title')}
        icon={<ScheduleOutlined />}
        subtitle={t('owner:reservations.subtitle')}
        extra={
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => reload()} loading={loading}>
              {t('common:actions.refresh')}
            </Button>
            {isManual && (
              <WriteButton
                type="primary"
                icon={<PlusOutlined />}
                disabled={!pitchList.length}
                onClick={() => setDraft({ mode: 'booking', pitchId: pitchList[0]?.pitchId, start: null })}
              >
                {t('owner:reservations.addBooking')}
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
              placeholder={isManual ? t('owner:reservations.searchManual') : t('owner:reservations.searchMatches')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220 }}
            />
            {pitchOptions.length > 1 && (
              <Select allowClear placeholder={t('common:pitch')} value={pitchFilter} onChange={setPitchFilter} options={pitchOptions} style={{ width: 150 }} />
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
                    <Text type="secondary">{t('owner:reservations.manualCount', { count: manualRows.length })}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <Text strong>{formatPrice(manualTotals.total)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} colSpan={2}>
                    <span className="mb-pay-cell is-unpaid">
                      {t('owner:reservations.unpaidTotal', { amount: formatPrice(manualTotals.unpaid) })}
                    </span>
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
    </SwipeTabs>
  );
}
