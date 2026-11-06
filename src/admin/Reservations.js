import React, { useMemo, useState } from 'react';
import { Alert, App, Button, Card, Grid, Input, Popconfirm, Segmented, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined, ReloadOutlined, ScheduleOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { api } from '../api/config';
import { formatPrice } from '../api/venues';
import { RESERVATIONS_CHANGED } from '../layout/AdminLayout';
import { EmptyState, MatchStatusTag, PageHeader, PlayerAvatar } from '../ui';
import { apiErrorMessage, formatDate, formatTime, fromNow, fullName, isPast } from '../utils/format';
import MatchDetailDrawer from './MatchDetailDrawer';
import useAdminData, { matchStadiumId, venueLabel } from './useAdminData';
import './AdminResponsive.css';

const { Text } = Typography;

const createdOf = (m) => m.createdAt || m.createDate || m.createdDate || null;

/** İşletme onayı bekleyen rezervasyonların izlenmesi (admin yalnızca gerekirse geçersiz kılar) */
export default function Reservations() {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const isPhone = Grid.useBreakpoint().md === false;
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
      render: (name, m) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          {(m.homeTeam || m.awayTeam) && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('admin:reservations.teamsLine', {
                home: m.homeTeam?.teamName || t('admin:shared.mixed'),
                away:
                  m.awayTeam?.teamName ||
                  (m.lookingForOpponent ? t('admin:shared.lookingForOpponent') : t('admin:shared.mixed')),
              })}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: t('admin:shared.columns.venuePitch'),
      key: 'venue',
      render: (_, m) => venueLabel(m, stadiumNames) || <Text type="secondary">-</Text>,
    },
    {
      title: t('admin:shared.columns.dateTime'),
      dataIndex: 'matchDate',
      sorter: (a, b) => new Date(a.matchDate) - new Date(b.matchDate),
      render: (d, m) => (
        <Space direction="vertical" size={0}>
          <Text>
            {formatDate(d)} · {formatTime(d)}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {fromNow(d)}
            {m.durationMinutes ? t('admin:reservations.durationShort', { count: m.durationMinutes }) : ''}
          </Text>
        </Space>
      ),
    },
    {
      title: t('admin:shared.columns.creator'),
      key: 'creator',
      responsive: ['md'],
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
      title: t('admin:shared.columns.amount'),
      dataIndex: 'totalPrice',
      align: 'right',
      sorter: (a, b) => (a.totalPrice || 0) - (b.totalPrice || 0),
      render: (v, m) => (
        <Space direction="vertical" size={0} style={{ alignItems: 'flex-end' }}>
          <Text strong>{formatPrice(v)}</Text>
          {m.perPlayer != null && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('admin:shared.perPlayer', { price: formatPrice(m.perPlayer) })}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: t('admin:reservations.waiting'),
      key: 'waiting',
      responsive: ['md'],
      sorter: (a, b) => new Date(createdOf(a) || a.matchDate) - new Date(createdOf(b) || b.matchDate),
      render: (_, m) => {
        const created = createdOf(m);
        return (
          <Space size={4} wrap>
            {created ? (
              <Tooltip
                title={t('admin:reservations.createdAt', { date: formatDate(created), time: formatTime(created) })}
              >
                <Text>{fromNow(created)}</Text>
              </Tooltip>
            ) : (
              <Text type="secondary">{formatDate(m.matchDate)}</Text>
            )}
            {isPast(m.matchDate) && <Tag color="volcano">{t('admin:shared.expired')}</Tag>}
          </Space>
        );
      },
    },
    {
      title: t('admin:shared.columns.status'),
      key: 'status',
      render: (_, m) => <MatchStatusTag status={m.isActive} />,
    },
    {
      title: t('admin:shared.columns.actions'),
      key: 'actions',
      align: 'right',
      render: (_, m) => (
        <Space size={4} onClick={(e) => e.stopPropagation()}>
          <Tooltip title={t('common:actions.detail')}>
            <Button size="small" icon={<EyeOutlined />} onClick={() => setSelected(m)} />
          </Tooltip>
          <Popconfirm
            title={t('admin:shared.approveAsAdminConfirm')}
            description={<div style={{ maxWidth: 260 }}>{t('admin:matchDetail.overrideWarning')}</div>}
            okText={t('common:actions.confirm')}
            cancelText={t('common:actions.cancel')}
            onConfirm={() => updateStatus(m.matchId, 2)}
          >
            <Tooltip title={t('admin:shared.approveAsAdmin')}>
              <Button
                size="small"
                icon={<CheckOutlined />}
                loading={busy?.matchId === m.matchId && busy.status === 2}
              />
            </Tooltip>
          </Popconfirm>
          <Popconfirm
            title={t('admin:shared.rejectAsAdminConfirm')}
            description={<div style={{ maxWidth: 260 }}>{t('admin:matchDetail.overrideWarning')}</div>}
            okText={t('common:actions.reject')}
            cancelText={t('common:actions.cancel')}
            okButtonProps={{ danger: true }}
            onConfirm={() => updateStatus(m.matchId, 3)}
          >
            <Tooltip title={t('admin:shared.rejectAsAdmin')}>
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
        title={t('admin:reservations.title')}
        subtitle={t('admin:reservations.subtitle')}
        icon={<ScheduleOutlined />}
        extra={
          <Button icon={<ReloadOutlined />} onClick={reload} loading={loading}>
            {t('common:actions.refresh')}
          </Button>
        }
      />
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('admin:reservations.alertMessage')}
        description={t('admin:reservations.alertDescription')}
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
              { label: t('admin:reservations.tabs.upcoming', { count: pending.length - expiredCount }), value: 'upcoming' },
              { label: t('admin:reservations.tabs.expired', { count: expiredCount }), value: 'expired' },
              { label: t('admin:reservations.tabs.all', { count: pending.length }), value: 'all' },
            ]}
          />
          <Space wrap className="mb-admin-filters">
            <Input
              className="mb-admin-filter"
              allowClear
              prefix={<SearchOutlined />}
              placeholder={t('admin:reservations.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 240 }}
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
          scroll={{ x: isPhone ? 'max-content' : 1100 }}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          onRow={(m) => ({ onClick: () => setSelected(m), style: { cursor: 'pointer' } })}
          locale={{ emptyText: <EmptyState description={t('admin:reservations.empty')} /> }}
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
