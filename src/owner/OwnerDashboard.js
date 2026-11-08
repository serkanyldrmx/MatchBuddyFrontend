import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { Alert, Button, Card, Col, Progress, Row, Skeleton, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  AppstoreOutlined,
  CalendarOutlined,
  CheckOutlined,
  CloseOutlined,
  RightOutlined,
  WalletOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { formatPrice, ownerApi } from '../api/venues';
import { useOwnerVenue } from '../layout/VenueLayout';
import { colors } from '../theme/theme';
import { EmptyState, MatchStatusTag, PageHeader, PlayerAvatar } from '../ui';
import { formatDate, fromNow, fullName } from '../utils/format';
import ManualBookingDrawer from './ManualBookingDrawer';
import ReservationDrawer from './ReservationDrawer';
import {
  Stars,
  WriteButton,
  asList,
  extrasText,
  isManualBooking,
  normalizeBlock,
  useOwnerData,
  useReservationResponder,
  ymd,
} from './shared';

const { Text } = Typography;

// Etiket ve ipuçları owner:dashboard.missing.<anahtar>.{label,hint} altındadır
const MISSING = {
  photo: { to: '/venue/facility' },
  pitch: { to: '/venue/pitches' },
  location: { to: '/venue/facility' },
  address: { to: '/venue/facility' },
  hours: { to: '/venue/pricing' },
};

function greeting(t) {
  const h = new Date().getHours();
  if (h < 6) return t('owner:dashboard.greeting.night');
  if (h < 12) return t('owner:dashboard.greeting.morning');
  if (h < 18) return t('owner:dashboard.greeting.day');
  return t('owner:dashboard.greeting.evening');
}

function StatCard({ label, value, icon, accent, to, children }) {
  const body = (
    <Card bordered={false} className={`mb-owner-stat${to ? ' is-link' : ''}`}>
      <div className="mb-owner-stat__head">
        <span className="mb-owner-stat__label">{label}</span>
        {icon && <span className="mb-owner-stat__icon" style={accent ? { color: accent } : undefined}>{icon}</span>}
      </div>
      <div className="mb-owner-stat__value" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {children}
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

/** Genel bakış: günün özeti, bekleyen talepler, yaklaşan maçlar */
export default function OwnerDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { venue, membershipUntil, membershipActive } = useOwnerVenue();
  const { data, loading, error, reload } = useOwnerData((id) => ownerApi.dashboard(id));
  const [selected, setSelected] = useState(null);
  const [manualSel, setManualSel] = useState(null);
  // Bugünkü harici rezervasyonlar ve bu ayın finans özeti (hata olursa sayfa yine çalışır)
  const extra = useOwnerData(async (id) => {
    const today = dayjs().startOf('day');
    const [blocks, finance] = await Promise.allSettled([
      ownerApi.blocks(id, ymd(today), ymd(today.add(1, 'day'))),
      ownerApi.finance(id, today.year(), today.month() + 1),
    ]);
    return {
      blocks: blocks.status === 'fulfilled' ? asList(blocks.value) : [],
      finance: finance.status === 'fulfilled' ? finance.value : null,
    };
  });
  const responder = useReservationResponder(() => {
    setSelected(null);
    reload(true);
  });

  const missing = (venue?.missing || []).filter(Boolean);
  const d = data || {};
  const pending = d.pending || [];
  const fin = extra.data?.finance;

  /** Yaklaşan maçlar + bugünün henüz bitmemiş harici rezervasyonları, saate göre */
  const agenda = useMemo(() => {
    const now = dayjs();
    const manual = (extra.data?.blocks || [])
      .filter((b) => b.slotBlockId != null && isManualBooking(b))
      .map((b) => normalizeBlock(b))
      .filter((b) => dayjs(b.start).isSame(now, 'day') && dayjs(b.end).isAfter(now))
      .map((b) => ({ type: 'manual', key: `b-${b.slotBlockId}`, start: dayjs(b.start), b }));
    const matches = (d.upcoming || []).map((r) => ({ type: 'match', key: `m-${r.matchId}`, start: dayjs(r.start), r }));
    return [...matches, ...manual].sort((a, b) => a.start - b.start);
  }, [d.upcoming, extra.data]);

  return (
    <>
      <PageHeader
        eyebrow={venue?.name}
        title={t('owner:dashboard.title')}
        icon={<AppstoreOutlined />}
        subtitle={t('owner:dashboard.subtitle', { greeting: greeting(t) })}
        extra={
          <Button icon={<CalendarOutlined />} onClick={() => navigate('/venue/calendar')}>
            {t('owner:dashboard.openCalendar')}
          </Button>
        }
      />

      {membershipUntil && membershipActive && (
        <div className="mb-owner-membership">{t('owner:dashboard.membershipUntil', { date: formatDate(membershipUntil) })}</div>
      )}

      {missing.length > 0 && (
        <Card bordered={false} className="mb-owner-missing">
          <div className="mb-owner-missing__head">
            <WarningOutlined />
            <div>
              <strong>{t('owner:dashboard.missingTitle')}</strong>
              <Text type="secondary">{t('owner:dashboard.missingText')}</Text>
            </div>
          </div>
          <div className="mb-owner-missing__list">
            {missing.map((k) => {
              const m = MISSING[k]
                ? {
                    to: MISSING[k].to,
                    label: t(`owner:dashboard.missing.${k}.label`),
                    hint: t(`owner:dashboard.missing.${k}.hint`),
                  }
                : { label: k, to: '/venue/facility', hint: t('owner:dashboard.missing.fallbackHint') };
              return (
                <Link key={k} to={m.to} className="mb-owner-missing__item">
                  <span>
                    <strong>{m.label}</strong>
                    <small>{m.hint}</small>
                  </span>
                  <RightOutlined />
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      <Row gutter={[16, 16]}>
        {loading && !data ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Col xs={12} md={8} xl={4} key={i}>
              <Card bordered={false}>
                <Skeleton active paragraph={{ rows: 1 }} title={false} />
              </Card>
            </Col>
          ))
        ) : (
          <>
            <Col xs={12} md={8} xl={4}>
              <StatCard label={t('owner:dashboard.stats.today')} value={d.todayCount ?? 0} accent={colors.primary} />
            </Col>
            <Col xs={12} md={8} xl={4}>
              <StatCard label={t('owner:dashboard.stats.week')} value={d.weekCount ?? 0} />
            </Col>
            <Col xs={12} md={8} xl={4}>
              <StatCard
                label={t('owner:dashboard.stats.pending')}
                value={d.pendingCount ?? pending.length}
                accent={colors.gold}
                to="/venue/reservations"
              >
                <span className="mb-owner-stat__link">
                  {t('owner:dashboard.stats.seeRequests')} <RightOutlined />
                </span>
              </StatCard>
            </Col>
            <Col xs={12} md={8} xl={4}>
              <StatCard
                label={t('owner:dashboard.stats.occupancy')}
                value={t('owner:dashboard.stats.percent', { value: Math.round(d.occupancyPercent || 0) })}
              >
                <Progress
                  percent={Math.round(d.occupancyPercent || 0)}
                  showInfo={false}
                  size="small"
                  strokeColor={colors.primary}
                  trailColor="rgba(148,163,184,0.16)"
                />
              </StatCard>
            </Col>
            <Col xs={12} md={8} xl={4}>
              <StatCard label={t('owner:dashboard.stats.weekRevenue')} value={formatPrice(d.weekRevenue || 0)} />
            </Col>
            <Col xs={12} md={8} xl={4}>
              <StatCard
                label={t('owner:dashboard.stats.rating')}
                value={d.rating ? Number(d.rating).toFixed(1) : '-'}
                accent={colors.gold}
                to="/venue/reviews"
              >
                <span className="mb-owner-stat__sub">
                  <Stars value={d.rating || 0} size={12} /> {t('owner:dashboard.stats.reviews', { count: d.reviewCount || 0 })}
                </span>
              </StatCard>
            </Col>
          </>
        )}

        <Col xs={24} xl={14}>
          <Card
            bordered={false}
            title={t('owner:dashboard.pending.title')}
            extra={
              <Button type="link" onClick={() => navigate('/venue/reservations')}>
                {t('common:all')} <RightOutlined />
              </Button>
            }
          >
            {loading && !data ? (
              <Skeleton active avatar />
            ) : pending.length === 0 ? (
              <EmptyState description={t('owner:dashboard.pending.empty')} />
            ) : (
              <div className="mb-owner-list">
                {pending.map((r) => (
                  <div key={r.matchId} className="mb-owner-request" onClick={() => setSelected(r)} role="button" tabIndex={0}>
                    <div className="mb-owner-request__date">
                      <strong>{dayjs(r.start).format('DD')}</strong>
                      <span>{dayjs(r.start).format('MMM')}</span>
                    </div>
                    <div className="mb-owner-request__body">
                      <Text strong ellipsis>
                        {r.matchName}
                      </Text>
                      <span className="mb-owner-request__meta">
                        {dayjs(r.start).format('dddd HH:mm')} · {r.pitch?.name}
                        {extrasText(r) ? ` · ${extrasText(r)}` : ''}
                      </span>
                      <span className="mb-owner-request__meta">
                        <PlayerAvatar player={r.creator} size={18} /> {fullName(r.creator)} · {fromNow(r.createdAt)}
                      </span>
                    </div>
                    <div className="mb-owner-request__price">{formatPrice(r.totalPrice)}</div>
                    <div className="mb-owner-request__actions" onClick={(e) => e.stopPropagation()}>
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <div className="mb-owner-stack">
            <Card
              bordered={false}
              className="mb-owner-fin-card"
              title={
                <span>
                  <WalletOutlined /> {t('owner:dashboard.finance.thisMonth', { month: dayjs().format('MMMM') })}
                </span>
              }
              extra={
                <Button type="link" onClick={() => navigate('/venue/finance')}>
                  {t('owner:dashboard.finance.link')} <RightOutlined />
                </Button>
              }
            >
              {extra.loading && !extra.data ? (
                <Skeleton active paragraph={{ rows: 1 }} title={false} />
              ) : !fin ? (
                <Text type="secondary">{t('owner:dashboard.finance.unavailable')}</Text>
              ) : (
                <>
                  <div className="mb-owner-fin-rows">
                    <div className="is-income">
                      <span>{t('owner:dashboard.finance.income')}</span>
                      <strong>{formatPrice(fin.income?.total ?? 0)}</strong>
                    </div>
                    <div className="is-expense">
                      <span>{t('owner:dashboard.finance.expense')}</span>
                      <strong>{formatPrice(fin.expenses ?? 0)}</strong>
                    </div>
                    <div className={Number(fin.net) < 0 ? 'is-neg' : 'is-income'}>
                      <span>{t('owner:dashboard.finance.net')}</span>
                      <strong>{formatPrice(fin.net ?? 0)}</strong>
                    </div>
                  </div>
                  <div className="mb-owner-fin-card__foot">
                    <span>
                      {Number(fin.receivable) > 0
                        ? t('owner:dashboard.finance.receivable', { amount: formatPrice(fin.receivable) })
                        : t('owner:dashboard.finance.noReceivable')}
                    </span>
                    {Number(fin.expectedIncome) > 0 && (
                      <span>{t('owner:dashboard.finance.expected', { amount: formatPrice(fin.expectedIncome) })}</span>
                    )}
                  </div>
                </>
              )}
            </Card>
            <Card
              bordered={false}
              title={t('owner:dashboard.upcoming.title')}
              extra={
                <Button type="link" onClick={() => navigate('/venue/calendar')}>
                  {t('owner:dashboard.upcoming.calendar')} <RightOutlined />
                </Button>
              }
            >
              {loading && !data ? (
                <Skeleton active />
              ) : agenda.length === 0 ? (
                <EmptyState description={t('owner:dashboard.upcoming.empty')} />
              ) : (
                <div className="mb-owner-agenda">
                  {agenda.map(({ type, key, start: s, r, b }) => {
                    const today = s.isSame(dayjs(), 'day');
                    if (type === 'manual') {
                      return (
                        <div key={key} className="mb-owner-agenda__item is-manual" onClick={() => setManualSel(b)} role="button" tabIndex={0}>
                          <div className="mb-owner-agenda__time">
                            <strong>{s.format('HH:mm')}</strong>
                            <span>{t('owner:dashboard.upcoming.today')}</span>
                          </div>
                          <div className="mb-owner-agenda__body">
                            <Text strong ellipsis>
                              {b.customerName}
                              {b.reason ? ` · ${b.reason}` : ''}
                            </Text>
                            <span>
                              {b.pitchName ? `${b.pitchName} · ` : ''}
                              {formatPrice(b.price)} · {b.isPaid ? t('owner:dashboard.upcoming.paid') : t('owner:dashboard.upcoming.unpaid')}
                            </span>
                          </div>
                          <Tag color="processing" bordered={false}>
                            {t('owner:dashboard.upcoming.external')}
                          </Tag>
                        </div>
                      );
                    }
                    return (
                      <div key={key} className="mb-owner-agenda__item" onClick={() => setSelected(r)} role="button" tabIndex={0}>
                        <div className="mb-owner-agenda__time">
                          <strong>{s.format('HH:mm')}</strong>
                          <span>{today ? t('owner:dashboard.upcoming.today') : s.format('DD MMM ddd')}</span>
                        </div>
                        <div className="mb-owner-agenda__body">
                          <Text strong ellipsis>
                            {r.matchName}
                          </Text>
                          <span>
                            {r.pitch?.name} ·{' '}
                            {t('owner:dashboard.upcoming.players', { going: r.goingCount ?? 0, capacity: r.capacity ?? 0 })}
                          </span>
                        </div>
                        <MatchStatusTag status={r.status} />
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </Col>
      </Row>

      <ManualBookingDrawer
        open={Boolean(manualSel)}
        booking={manualSel}
        onClose={() => setManualSel(null)}
        onChanged={(b) => {
          setManualSel(b);
          extra.reload(true);
        }}
      />
      <ReservationDrawer open={Boolean(selected)} reservation={selected} onClose={() => setSelected(null)} responder={responder} />
      {responder.modal}
    </>
  );
}
